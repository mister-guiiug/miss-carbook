import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { logActivity } from '../../../lib/activity'
import {
  allowedImageMime,
  candidateSchema,
  candidateSpecsSchema,
  commentSchema,
  MAX_IMAGE_BYTES,
  reviewSchema,
} from '../../../lib/validation/schemas'
import { uploadCandidateImage, signedUrlForPath } from '../../../lib/storageUpload'
import { compressImageToMaxBytes } from '../../../lib/imageCompress'
import { renderMentions } from '../../../lib/renderMentions'
import { useErrorDialog } from '../../../contexts/ErrorDialogContext'
import { useToast } from '../../../contexts/ToastContext'
import type { CandidateStatus, Json } from '../../../types/database'
import { displayVersionLabel, formatCandidateListLabel } from '../../../lib/candidateLabel'
import {
  CANDIDATE_HIERARCHY_HELP_FR,
  resolveIdentityForCandidateUpdate,
  validateParentChange,
} from '../../../lib/candidateTree'
import { formatMileageKmDisplay, parseMileageKmInput } from '../../../lib/formatMileage'
import { formatPriceInputDisplay, parsePriceInput } from '../../../lib/formatPrice'
import { IconActionButton, IconCheck, IconSend, IconX } from '../../ui/IconActionButton'
import { ImageViewerCarousel } from '../../ui/ImageViewerCarousel'
import { GarageLocationInput } from './GarageLocationInput'
import type { CandidateRow } from './candidateTypes'
import { statusLabels } from './candidateTypes'
import {
  candidateSpecFieldGroups,
  candidateSpecLabels,
  hasCandidateSpecVisibleData,
} from '../../../lib/candidateSpecsUi'

/** Suggestions boîte de vitesses (saisie libre via liste). */
const GEARBOX_SUGGESTIONS = [
  'Manuelle',
  'Automatique',
  'Robotisée (double embrayage)',
  'CVT',
  'Réducteur fixe (électrique)',
  'Autre / NC',
] as const

/** Suggestions énergie / carburant (saisie libre). */
const ENERGY_SUGGESTIONS = [
  'Essence',
  'Diesel',
  'GPL / GNV',
  'Électrique',
  'Hybride essence rechargeable',
  'Hybride essence non rechargeable',
  'Hybride diesel',
  'E85',
  'Hydrogène',
  'Autre / NC',
] as const

function isBlank(s: string | null | undefined): boolean {
  return !s || String(s).trim() === ''
}

/** Détails « véhicule » sans identité : tout est vide côté saisie. */
function isVehicleDetailMetaEmpty(m: {
  engine: string
  price: string
  mileage_km: string
  first_registration: string
  gearbox: string
  energy: string
  garage_location: string
  manufacturer_url: string
  options: string
  reject_reason: string
}): boolean {
  const priceEmpty = m.price === '' || m.price === undefined
  const mileageEmpty = parseMileageKmInput(String(m.mileage_km ?? '')) == null
  return (
    isBlank(m.engine) &&
    priceEmpty &&
    mileageEmpty &&
    isBlank(m.first_registration) &&
    isBlank(m.gearbox) &&
    isBlank(m.energy) &&
    isBlank(m.garage_location) &&
    isBlank(m.manufacturer_url) &&
    isBlank(m.options) &&
    isBlank(m.reject_reason)
  )
}

function vehicleDetailFromCandidate(c: CandidateRow) {
  return {
    engine: c.engine ?? '',
    price: c.price != null ? formatPriceInputDisplay(c.price) : '',
    mileage_km: formatMileageKmDisplay(c.mileage_km),
    first_registration: c.first_registration ?? '',
    gearbox: c.gearbox ?? '',
    energy: c.energy ?? '',
    garage_location: c.garage_location ?? '',
    manufacturer_url: c.manufacturer_url ?? '',
    options: c.options ?? '',
    reject_reason: c.reject_reason ?? '',
  }
}

export function CandidateDetail({
  candidate,
  rootCandidates,
  variationCount,
  workspaceId,
  canWrite,
  userId,
  onChanged,
  garageSuggestions,
}: {
  candidate: CandidateRow
  rootCandidates: CandidateRow[]
  variationCount: number
  workspaceId: string
  canWrite: boolean
  userId: string
  onChanged: () => void
  garageSuggestions: string[]
}) {
  const { reportException, reportMessage } = useErrorDialog()
  const { showToast } = useToast()
  const [meta, setMeta] = useState({
    parent_candidate_id: candidate.parent_candidate_id ?? '',
    brand: candidate.brand,
    model: candidate.model,
    trim: candidate.trim,
    engine: candidate.engine,
    price: candidate.price != null ? formatPriceInputDisplay(candidate.price) : '',
    mileage_km: formatMileageKmDisplay(candidate.mileage_km),
    first_registration: candidate.first_registration ?? '',
    gearbox: candidate.gearbox ?? '',
    energy: candidate.energy ?? '',
    event_date: candidate.event_date ?? '',
    status: candidate.status,
    reject_reason: candidate.reject_reason,
    options: candidate.options,
    garage_location: candidate.garage_location,
    manufacturer_url: candidate.manufacturer_url,
  })
  const rootDraftRef = useRef<{ brand: string; model: string; event_date: string } | null>(null)

  useEffect(() => {
    setMeta({
      parent_candidate_id: candidate.parent_candidate_id ?? '',
      brand: candidate.brand,
      model: candidate.model,
      trim: candidate.trim,
      engine: candidate.engine,
      price: candidate.price != null ? formatPriceInputDisplay(candidate.price) : '',
      mileage_km: formatMileageKmDisplay(candidate.mileage_km),
      first_registration: candidate.first_registration ?? '',
      gearbox: candidate.gearbox ?? '',
      energy: candidate.energy ?? '',
      event_date: candidate.event_date ?? '',
      status: candidate.status,
      reject_reason: candidate.reject_reason,
      options: candidate.options,
      garage_location: candidate.garage_location,
      manufacturer_url: candidate.manufacturer_url,
    })
    rootDraftRef.current = null
  }, [candidate])

  const draftParentRow = useMemo(
    () =>
      meta.parent_candidate_id
        ? (rootCandidates.find((p) => p.id === meta.parent_candidate_id) ?? null)
        : null,
    [meta.parent_candidate_id, rootCandidates]
  )

  const saveIdentity = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canWrite) return
    const parsed = candidateSchema.safeParse({
      ...meta,
      parent_candidate_id: meta.parent_candidate_id || null,
      price: meta.price,
      event_date: meta.event_date?.trim() || null,
    })
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? 'Invalide'
      reportMessage(msg, JSON.stringify(parsed.error.flatten(), null, 2))
      return
    }
    const parentId = parsed.data.parent_candidate_id
    const assignCheck = validateParentChange(candidate.id, parentId, {
      isRoot: !candidate.parent_candidate_id,
      directVariationCount: variationCount,
    })
    if (!assignCheck.ok) {
      reportMessage(assignCheck.message, 'validateParentChange')
      return
    }
    if (parentId && !rootCandidates.some((r) => r.id === parentId)) {
      reportMessage(
        'Le modèle racine choisi est introuvable dans ce dossier. Enregistrez d’abord la racine ou choisissez une autre fiche.',
        'parent not in roots'
      )
      return
    }

    try {
      const identity = resolveIdentityForCandidateUpdate({
        nextParentId: parentId,
        meta: {
          brand: meta.brand,
          model: meta.model,
          event_date: meta.event_date,
        },
        rootCandidates,
      })

      const savesAsRoot = !parentId
      const vehiclePayload = savesAsRoot
        ? {
            engine: '',
            price: null as number | null,
            mileage_km: null as number | null,
            first_registration: '',
            gearbox: '',
            energy: '',
            options: '',
            garage_location: '',
            manufacturer_url: '',
          }
        : {
            engine: parsed.data.engine,
            price: parsed.data.price,
            mileage_km: parsed.data.mileage_km ?? null,
            first_registration: parsed.data.first_registration,
            gearbox: parsed.data.gearbox,
            energy: parsed.data.energy,
            options: parsed.data.options,
            garage_location: parsed.data.garage_location,
            manufacturer_url: parsed.data.manufacturer_url,
          }

      const { error } = await supabase
        .from('candidates')
        .update({
          parent_candidate_id: parentId,
          brand: identity.brand,
          model: identity.model,
          trim: parsed.data.trim,
          ...vehiclePayload,
          event_date: identity.event_date,
          status: parsed.data.status,
          reject_reason: parsed.data.reject_reason,
        })
        .eq('id', candidate.id)
      if (error) throw error

      if (savesAsRoot) {
        const { error: specErr } = await supabase
          .from('candidate_specs')
          .upsert({ candidate_id: candidate.id, specs: {} as Json })
        if (specErr) throw specErr
        setSpecs({})
      }

      await logActivity(workspaceId, 'candidate.update_identity', 'candidate', candidate.id, {})
      await onChanged()
    } catch (err: unknown) {
      reportException(err, 'Mise à jour de la fiche modèle')
    }
  }

  const [specs, setSpecs] = useState<Record<string, unknown>>(
    () => (candidate.candidate_specs?.specs as Record<string, unknown>) ?? {}
  )
  const [review, setReview] = useState({ score: '8', free_text: '', pros: '', cons: '' })
  const [comment, setComment] = useState('')
  const [comments, setComments] = useState<
    { id: string; body: string; user_id: string; created_at: string }[]
  >([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [photos, setPhotos] = useState<{ id: string; url: string }[]>([])

  useEffect(() => {
    setSpecs((candidate.candidate_specs?.specs as Record<string, unknown>) ?? {})
  }, [candidate])

  const [vehDetailsOpen, setVehDetailsOpen] = useState(
    () => !isVehicleDetailMetaEmpty(vehicleDetailFromCandidate(candidate))
  )
  const [specsAccordionOpen, setSpecsAccordionOpen] = useState(() =>
    hasCandidateSpecVisibleData((candidate.candidate_specs?.specs as Record<string, unknown>) ?? {})
  )
  const [commentsAccordionOpen, setCommentsAccordionOpen] = useState(false)
  const [photosAccordionOpen, setPhotosAccordionOpen] = useState(false)
  const [reviewAccordionOpen, setReviewAccordionOpen] = useState(false)
  const [pendingOversizedPhoto, setPendingOversizedPhoto] = useState<File | null>(null)
  const [compressingPhoto, setCompressingPhoto] = useState(false)
  const compressCancelRef = useRef<HTMLButtonElement | null>(null)
  const [photoViewerIndex, setPhotoViewerIndex] = useState<number | null>(null)

  useEffect(() => {
    setVehDetailsOpen(!isVehicleDetailMetaEmpty(vehicleDetailFromCandidate(candidate)))
  }, [candidate])

  useEffect(() => {
    setSpecsAccordionOpen(
      hasCandidateSpecVisibleData(
        (candidate.candidate_specs?.specs as Record<string, unknown>) ?? {}
      )
    )
  }, [candidate])

  const loadComments = async () => {
    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('candidate_id', candidate.id)
      .order('created_at', { ascending: true })
    const list = data ?? []
    setComments(list)
    const ids = [...new Set(list.map((x) => x.user_id))]
    if (ids.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', ids)
      const m: Record<string, string> = {}
      for (const p of profs ?? []) m[p.id] = p.display_name
      setNames(m)
    }
  }

  const loadPhotos = async () => {
    const { data: atts } = await supabase
      .from('attachments')
      .select('id, storage_path')
      .eq('candidate_id', candidate.id)
    const out: { id: string; url: string }[] = []
    for (const a of atts ?? []) {
      try {
        const url = await signedUrlForPath(a.storage_path, 600)
        out.push({ id: a.id, url })
      } catch {
        /* ignore */
      }
    }
    setPhotos(out)
  }

  useEffect(() => {
    void loadComments()
    if (!candidate.parent_candidate_id) {
      setPhotos([])
    } else {
      void loadPhotos()
    }
    const ch = supabase
      .channel(`comments-${candidate.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `candidate_id=eq.${candidate.id}`,
        },
        () => void loadComments()
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate.id])

  useEffect(() => {
    if (comments.length > 0) setCommentsAccordionOpen(true)
  }, [comments.length])

  useEffect(() => {
    setCommentsAccordionOpen(false)
    setPhotosAccordionOpen(false)
    setReviewAccordionOpen(false)
    setPendingOversizedPhoto(null)
    setPhotoViewerIndex(null)
  }, [candidate.id])

  useEffect(() => {
    if (photoViewerIndex === null) return
    if (photos.length === 0) {
      setPhotoViewerIndex(null)
      return
    }
    if (photoViewerIndex >= photos.length) {
      setPhotoViewerIndex(photos.length - 1)
    }
  }, [photos, photoViewerIndex])

  useEffect(() => {
    if (!pendingOversizedPhoto) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !compressingPhoto) setPendingOversizedPhoto(null)
    }
    window.addEventListener('keydown', onKey)
    window.setTimeout(() => compressCancelRef.current?.focus(), 0)
    return () => window.removeEventListener('keydown', onKey)
  }, [pendingOversizedPhoto, compressingPhoto])

  const saveSpecs = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canWrite || !candidate.parent_candidate_id) return
    const parsed = candidateSpecsSchema.safeParse(specs)
    if (!parsed.success) {
      reportMessage(
        'Données constructeur invalides',
        JSON.stringify(parsed.error.flatten(), null, 2)
      )
      return
    }
    const { error } = await supabase
      .from('candidate_specs')
      .upsert({ candidate_id: candidate.id, specs: parsed.data as Json })
    if (error) reportException(error, 'Enregistrement des données constructeur')
    else {
      await logActivity(workspaceId, 'candidate.specs.upsert', 'candidate', candidate.id, {})
      onChanged()
    }
  }

  const saveReview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canWrite) return
    const parsed = reviewSchema.safeParse({
      ...review,
      score: review.score,
    })
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? 'Avis invalide'
      reportMessage(msg, JSON.stringify(parsed.error.flatten(), null, 2))
      return
    }
    const { error } = await supabase.from('candidate_reviews').upsert({
      candidate_id: candidate.id,
      user_id: userId,
      score: parsed.data.score,
      free_text: parsed.data.free_text,
      pros: parsed.data.pros,
      cons: parsed.data.cons,
    })
    if (error) reportException(error, 'Enregistrement de l’avis sur le modèle')
    else {
      await logActivity(workspaceId, 'candidate.review.upsert', 'candidate', candidate.id, {})
      onChanged()
    }
  }

  const sendComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canWrite) return
    const parsed = commentSchema.safeParse({ body: comment })
    if (!parsed.success) {
      reportMessage('Commentaire invalide', JSON.stringify(parsed.error.flatten(), null, 2))
      return
    }
    const { error } = await supabase.from('comments').insert({
      candidate_id: candidate.id,
      user_id: userId,
      body: parsed.data.body,
    })
    if (error) reportException(error, 'Envoi d’un commentaire')
    else {
      setComment('')
      await loadComments()
    }
  }

  const runPhotoUpload = async (file: File, compressedHint?: boolean) => {
    await uploadCandidateImage(workspaceId, candidate.id, file, userId)
    await loadPhotos()
    await logActivity(workspaceId, 'candidate.photo.upload', 'candidate', candidate.id, {})
    if (compressedHint) {
      showToast('Photo envoyée (image compressée automatiquement)')
    }
  }

  const onFile = async (file: File | null) => {
    if (!file || !canWrite || !candidate.parent_candidate_id) return
    if (!allowedImageMime.includes(file.type as (typeof allowedImageMime)[number])) {
      reportMessage('Type non autorisé (JPEG, PNG, WebP, GIF)')
      return
    }
    if (file.size <= MAX_IMAGE_BYTES) {
      try {
        await runPhotoUpload(file, false)
      } catch (e: unknown) {
        reportException(e, 'Upload d’une photo pour le modèle')
      }
      return
    }
    setPendingOversizedPhoto(file)
  }

  const dismissCompressOffer = () => {
    if (compressingPhoto) return
    setPendingOversizedPhoto(null)
  }

  const confirmCompressAndUpload = async () => {
    if (!pendingOversizedPhoto || !canWrite) return
    setCompressingPhoto(true)
    try {
      const compressed = await compressImageToMaxBytes(pendingOversizedPhoto, MAX_IMAGE_BYTES)
      await runPhotoUpload(compressed, true)
      setPendingOversizedPhoto(null)
    } catch (e: unknown) {
      reportException(e, 'Compression ou envoi de la photo')
    } finally {
      setCompressingPhoto(false)
    }
  }

  const specNumInput = (k: string, v: unknown) => (
    <div key={k} style={{ flex: '1 1 140px' }}>
      <label htmlFor={`cand-spec-${candidate.id}-${k}`}>
        {candidateSpecLabels[k as keyof typeof candidateSpecLabels] ?? k}
      </label>
      <input
        id={`cand-spec-${candidate.id}-${k}`}
        type="number"
        inputMode="decimal"
        step="any"
        value={typeof v === 'number' ? v : ''}
        onChange={(e) =>
          setSpecs((s) => ({
            ...s,
            [k]: e.target.value === '' ? undefined : Number(e.target.value),
          }))
        }
        disabled={!canWrite}
      />
    </div>
  )

  const identityIsRoot = !meta.parent_candidate_id
  const persistedIsRoot = !candidate.parent_candidate_id
  const hasMultipleVariants = variationCount >= 2
  /** Détails véhicule (motorisation, prix, statut…) : uniquement pour une variation. */
  const showVehicleDetailsSection = !identityIsRoot
  const showParentSelect = !identityIsRoot || variationCount === 0
  /** Fiche racine : pas de données constructeur ni de photos dans l’UI. */
  const showSpecsAndPhotos = !identityIsRoot

  return (
    <div className="stack" style={{ marginTop: '0.75rem' }}>
      {canWrite ? (
        <form onSubmit={saveIdentity} className="card stack" style={{ boxShadow: 'none' }}>
          <h4 style={{ margin: 0 }}>Fiche modèle</h4>

          {showParentSelect ? (
            <div>
              <label htmlFor={`cand-meta-parent-${candidate.id}`}>Rattaché au modèle racine</label>
              <p className="muted" style={{ margin: '0.25rem 0 0.35rem', fontSize: '0.8rem' }}>
                {CANDIDATE_HIERARCHY_HELP_FR}
              </p>
              <select
                id={`cand-meta-parent-${candidate.id}`}
                value={meta.parent_candidate_id}
                onChange={(e) => {
                  const pid = e.target.value
                  setMeta((m) => {
                    if (!pid) {
                      const draft = rootDraftRef.current
                      rootDraftRef.current = null
                      return {
                        ...m,
                        parent_candidate_id: '',
                        brand: draft?.brand ?? candidate.brand,
                        model: draft?.model ?? candidate.model,
                        event_date: draft?.event_date ?? candidate.event_date ?? '',
                      }
                    }
                    const p = rootCandidates.find((x) => x.id === pid)
                    if (!m.parent_candidate_id) {
                      rootDraftRef.current = {
                        brand: m.brand,
                        model: m.model,
                        event_date: m.event_date ?? '',
                      }
                    }
                    return {
                      ...m,
                      parent_candidate_id: pid,
                      brand: p?.brand ?? m.brand,
                      model: p?.model ?? m.model,
                    }
                  })
                }}
              >
                <option value="">— Racine (pas de parent) —</option>
                {rootCandidates.map((p) => (
                  <option key={p.id} value={p.id}>
                    {formatCandidateListLabel(p)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="candidate-fiche-identity stack">
            <h5 className="candidate-fiche-subtitle">Identité</h5>
            {identityIsRoot ? (
              <>
                <div className="row">
                  <div style={{ flex: '1 1 160px' }}>
                    <label htmlFor={`cand-meta-brand-${candidate.id}`}>Marque</label>
                    <input
                      id={`cand-meta-brand-${candidate.id}`}
                      value={meta.brand}
                      onChange={(e) => setMeta((m) => ({ ...m, brand: e.target.value }))}
                    />
                  </div>
                  <div style={{ flex: '1 1 160px' }}>
                    <label htmlFor={`cand-meta-model-${candidate.id}`}>Modèle</label>
                    <input
                      id={`cand-meta-model-${candidate.id}`}
                      value={meta.model}
                      onChange={(e) => setMeta((m) => ({ ...m, model: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="row">
                  <div style={{ flex: '1 1 160px' }}>
                    <label htmlFor={`cand-meta-trim-${candidate.id}`}>Version de base</label>
                    <input
                      id={`cand-meta-trim-${candidate.id}`}
                      value={meta.trim}
                      onChange={(e) => setMeta((m) => ({ ...m, trim: e.target.value }))}
                      placeholder="Vide = « Générique » (version de base)"
                    />
                  </div>
                  <div style={{ flex: '1 1 160px' }}>
                    <label htmlFor={`cand-meta-date-${candidate.id}`}>Année(s) / période / génération</label>
                    <input
                      id={`cand-meta-date-${candidate.id}`}
                      type="text"
                      autoComplete="off"
                      value={meta.event_date}
                      onChange={(e) => setMeta((m) => ({ ...m, event_date: e.target.value }))}
                      placeholder="ex. 2024, 2020-2023, printemps 2025"
                    />
                  </div>
                </div>
                <div className="row">
                  <div style={{ flex: '1 1 200px' }}>
                    <label htmlFor={`cand-meta-st-root-${candidate.id}`}>Statut</label>
                    <select
                      id={`cand-meta-st-root-${candidate.id}`}
                      value={meta.status}
                      onChange={(e) =>
                        setMeta((m) => ({ ...m, status: e.target.value as CandidateStatus }))
                      }
                    >
                      {(Object.keys(statusLabels) as CandidateStatus[]).map((k) => (
                        <option key={k} value={k}>
                          {statusLabels[k]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: '1 1 200px' }}>
                    <label htmlFor={`cand-meta-rej-root-${candidate.id}`}>Raison si rejet</label>
                    <input
                      id={`cand-meta-rej-root-${candidate.id}`}
                      value={meta.reject_reason}
                      onChange={(e) => setMeta((m) => ({ ...m, reject_reason: e.target.value }))}
                    />
                  </div>
                </div>
              </>
            ) : draftParentRow ? (
              <>
                <div className="row">
                  <div style={{ flex: '1 1 160px' }}>
                    <label htmlFor={`cand-meta-brand-${candidate.id}`}>Marque</label>
                    <input
                      id={`cand-meta-brand-${candidate.id}`}
                      className="candidate-field-readonly"
                      readOnly
                      value={draftParentRow.brand}
                      tabIndex={-1}
                    />
                  </div>
                  <div style={{ flex: '1 1 160px' }}>
                    <label htmlFor={`cand-meta-model-${candidate.id}`}>Modèle</label>
                    <input
                      id={`cand-meta-model-${candidate.id}`}
                      className="candidate-field-readonly"
                      readOnly
                      value={draftParentRow.model}
                      tabIndex={-1}
                    />
                  </div>
                </div>
                <div className="row">
                  <div style={{ flex: '1 1 160px' }}>
                    <label htmlFor={`cand-meta-basever-${candidate.id}`}>Version de base</label>
                    <input
                      id={`cand-meta-basever-${candidate.id}`}
                      className="candidate-field-readonly"
                      readOnly
                      value={displayVersionLabel({
                        trim: draftParentRow.trim,
                        parent_candidate_id: null,
                      })}
                      tabIndex={-1}
                    />
                  </div>
                  <div style={{ flex: '1 1 160px' }}>
                    <label htmlFor={`cand-meta-period-ro-${candidate.id}`}>
                      Année(s) / période / génération
                    </label>
                    <input
                      id={`cand-meta-period-ro-${candidate.id}`}
                      className="candidate-field-readonly"
                      readOnly
                      value={draftParentRow.event_date ?? ''}
                      tabIndex={-1}
                    />
                  </div>
                </div>
                <div className="row">
                  <div style={{ flex: '1 1 100%' }}>
                    <label htmlFor={`cand-meta-trim-${candidate.id}`}>Version complémentaire</label>
                    <input
                      id={`cand-meta-trim-${candidate.id}`}
                      value={meta.trim}
                      onChange={(e) => setMeta((m) => ({ ...m, trim: e.target.value }))}
                      placeholder="ex. finition, pack, motorisation…"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                  Parent introuvable : identité en lecture seule depuis cette ligne.
                </p>
                <div className="row">
                  <div style={{ flex: '1 1 160px' }}>
                    <label htmlFor={`cand-meta-brand-${candidate.id}`}>Marque</label>
                    <input
                      id={`cand-meta-brand-${candidate.id}`}
                      className="candidate-field-readonly"
                      readOnly
                      value={meta.brand}
                      tabIndex={-1}
                    />
                  </div>
                  <div style={{ flex: '1 1 160px' }}>
                    <label htmlFor={`cand-meta-model-${candidate.id}`}>Modèle</label>
                    <input
                      id={`cand-meta-model-${candidate.id}`}
                      className="candidate-field-readonly"
                      readOnly
                      value={meta.model}
                      tabIndex={-1}
                    />
                  </div>
                </div>
                <div className="row">
                  <div style={{ flex: '1 1 160px' }}>
                    <label htmlFor={`cand-meta-period-ro-${candidate.id}`}>
                      Année(s) / période / génération
                    </label>
                    <input
                      id={`cand-meta-period-ro-${candidate.id}`}
                      className="candidate-field-readonly"
                      readOnly
                      value={meta.event_date ?? ''}
                      tabIndex={-1}
                    />
                  </div>
                  <div style={{ flex: '1 1 160px' }}>
                    <label htmlFor={`cand-meta-trim-${candidate.id}`}>Version complémentaire</label>
                    <input
                      id={`cand-meta-trim-${candidate.id}`}
                      value={meta.trim}
                      onChange={(e) => setMeta((m) => ({ ...m, trim: e.target.value }))}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {persistedIsRoot && hasMultipleVariants ? (
            <p className="muted" style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.45 }}>
              Plusieurs variations : ouvrez chaque ligne complément pour renseigner détails véhicule,
              données constructeur, photos et avis.
            </p>
          ) : null}

          {showVehicleDetailsSection ? (
            <details
              key={`veh-detail-${candidate.id}`}
              className="card home-accordion candidate-detail-accordion"
              style={{ boxShadow: 'none' }}
              open={vehDetailsOpen}
              onToggle={(e) => setVehDetailsOpen(e.currentTarget.open)}
            >
              <summary className="home-accordion-summary">
                Détails du véhicule
                {isVehicleDetailMetaEmpty(meta) ? (
                  <span className="muted" style={{ fontWeight: 400, marginLeft: '0.35rem' }}>
                    (vide)
                  </span>
                ) : null}
              </summary>
              <div className="home-accordion-body stack">
                <div className="row">
                  <div style={{ flex: '1 1 160px' }}>
                    <label htmlFor={`cand-meta-engine-${candidate.id}`}>Motorisation</label>
                    <input
                      id={`cand-meta-engine-${candidate.id}`}
                      value={meta.engine}
                      onChange={(e) => setMeta((m) => ({ ...m, engine: e.target.value }))}
                    />
                  </div>
                  <div style={{ flex: '1 1 160px' }}>
                    <label htmlFor={`cand-meta-price-${candidate.id}`}>Prix</label>
                    <input
                      id={`cand-meta-price-${candidate.id}`}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={meta.price}
                      onChange={(e) => setMeta((m) => ({ ...m, price: e.target.value }))}
                      onFocus={() => {
                        const n = parsePriceInput(meta.price)
                        setMeta((m) => ({
                          ...m,
                          price: n != null ? String(n).replace('.', ',') : '',
                        }))
                      }}
                      onBlur={() => {
                        const n = parsePriceInput(meta.price)
                        setMeta((m) => ({
                          ...m,
                          price: n != null ? formatPriceInputDisplay(n) : '',
                        }))
                      }}
                    />
                  </div>
                  <div style={{ flex: '1 1 160px' }}>
                    <label htmlFor={`cand-meta-mileage-${candidate.id}`}>Kilométrage (km)</label>
                    <input
                      id={`cand-meta-mileage-${candidate.id}`}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="ex. 45 000"
                      value={meta.mileage_km}
                      onChange={(e) =>
                        setMeta((m) => ({
                          ...m,
                          mileage_km: e.target.value.replace(/[^\d\s\u00a0\u202f,]/g, ''),
                        }))
                      }
                      onFocus={() => {
                        const n = parseMileageKmInput(meta.mileage_km)
                        setMeta((m) => ({
                          ...m,
                          mileage_km: n != null ? String(n) : '',
                        }))
                      }}
                      onBlur={() => {
                        const n = parseMileageKmInput(meta.mileage_km)
                        setMeta((m) => ({
                          ...m,
                          mileage_km: n != null ? formatMileageKmDisplay(n) : '',
                        }))
                      }}
                    />
                  </div>
                </div>
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 160px' }}>
                    <label htmlFor={`cand-meta-circ-${candidate.id}`}>Mise en circulation</label>
                    <input
                      id={`cand-meta-circ-${candidate.id}`}
                      type="text"
                      autoComplete="off"
                      value={meta.first_registration}
                      onChange={(e) =>
                        setMeta((m) => ({ ...m, first_registration: e.target.value }))
                      }
                      placeholder="ex. 12/03/2019, mars 2019…"
                      maxLength={120}
                    />
                  </div>
                  <div style={{ flex: '1 1 160px' }}>
                    <label htmlFor={`cand-meta-energy-${candidate.id}`}>Énergie / carburant</label>
                    <input
                      id={`cand-meta-energy-${candidate.id}`}
                      type="text"
                      autoComplete="off"
                      list={`cand-meta-energy-dl-${candidate.id}`}
                      value={meta.energy}
                      onChange={(e) => setMeta((m) => ({ ...m, energy: e.target.value }))}
                      placeholder="ex. Essence, Électrique…"
                      maxLength={120}
                    />
                    <datalist id={`cand-meta-energy-dl-${candidate.id}`}>
                      {ENERGY_SUGGESTIONS.map((o) => (
                        <option key={o} value={o} />
                      ))}
                    </datalist>
                  </div>
                  <div style={{ flex: '1 1 160px' }}>
                    <label htmlFor={`cand-meta-gear-${candidate.id}`}>Boîte de vitesses</label>
                    <input
                      id={`cand-meta-gear-${candidate.id}`}
                      type="text"
                      autoComplete="off"
                      list={`cand-meta-gear-dl-${candidate.id}`}
                      value={meta.gearbox}
                      onChange={(e) => setMeta((m) => ({ ...m, gearbox: e.target.value }))}
                      placeholder="ex. Automatique, Manuelle…"
                      maxLength={120}
                    />
                    <datalist id={`cand-meta-gear-dl-${candidate.id}`}>
                      {GEARBOX_SUGGESTIONS.map((o) => (
                        <option key={o} value={o} />
                      ))}
                    </datalist>
                  </div>
                </div>
                <div>
                  <GarageLocationInput
                    id={`cand-meta-garage-${candidate.id}`}
                    label="Garage / lieu"
                    value={meta.garage_location}
                    onChange={(v) => setMeta((m) => ({ ...m, garage_location: v }))}
                    suggestions={garageSuggestions}
                    placeholder="Saisie libre ou choix dans la liste"
                  />
                </div>
                <div>
                  <label htmlFor={`cand-meta-url-${candidate.id}`}>Lien constructeur</label>
                  <input
                    id={`cand-meta-url-${candidate.id}`}
                    value={meta.manufacturer_url}
                    onChange={(e) => setMeta((m) => ({ ...m, manufacturer_url: e.target.value }))}
                  />
                </div>
                <div>
                  <label htmlFor={`cand-meta-opt-${candidate.id}`}>Options</label>
                  <textarea
                    id={`cand-meta-opt-${candidate.id}`}
                    value={meta.options}
                    onChange={(e) => setMeta((m) => ({ ...m, options: e.target.value }))}
                  />
                </div>
                <div className="row">
                  <div style={{ flex: '1 1 200px' }}>
                    <label htmlFor={`cand-meta-st-${candidate.id}`}>Statut</label>
                    <select
                      id={`cand-meta-st-${candidate.id}`}
                      value={meta.status}
                      onChange={(e) =>
                        setMeta((m) => ({ ...m, status: e.target.value as CandidateStatus }))
                      }
                    >
                      {(Object.keys(statusLabels) as CandidateStatus[]).map((k) => (
                        <option key={k} value={k}>
                          {statusLabels[k]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: '1 1 200px' }}>
                    <label htmlFor={`cand-meta-rej-${candidate.id}`}>Raison si rejet</label>
                    <input
                      id={`cand-meta-rej-${candidate.id}`}
                      value={meta.reject_reason}
                      onChange={(e) => setMeta((m) => ({ ...m, reject_reason: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </details>
          ) : null}

          <button type="submit">Enregistrer la fiche</button>
        </form>
      ) : null}

      {showSpecsAndPhotos ? (
        <form onSubmit={saveSpecs} className="stack">
          <details
            key={`specs-${candidate.id}`}
            className="card home-accordion candidate-detail-accordion"
            style={{ boxShadow: 'none' }}
            open={specsAccordionOpen}
            onToggle={(e) => setSpecsAccordionOpen(e.currentTarget.open)}
          >
            <summary className="home-accordion-summary">
              Données constructeur
              {!hasCandidateSpecVisibleData(specs) ? (
                <span className="muted" style={{ fontWeight: 400, marginLeft: '0.35rem' }}>
                  (vide)
                </span>
              ) : null}
            </summary>
            <div className="home-accordion-body stack">
              <p className="muted" style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.45 }}>
                Champs indicatifs (WLTP, NEDC ou données brochure). Les unités sont rappelées dans
                les libellés.
              </p>
              {candidateSpecFieldGroups.map((g) => (
                <div key={g.title} className="stack" style={{ gap: '0.5rem' }}>
                  <h5 className="candidate-fiche-subtitle" style={{ margin: 0 }}>
                    {g.title}
                  </h5>
                  <div className="row" style={{ flexWrap: 'wrap' }}>
                    {g.keys.map((k) => specNumInput(k, specs[k]))}
                  </div>
                </div>
              ))}
              <div>
                <label htmlFor={`cand-spec-notes-${candidate.id}`}>{candidateSpecLabels.notes}</label>
                <textarea
                  id={`cand-spec-notes-${candidate.id}`}
                  value={typeof specs.notes === 'string' ? specs.notes : ''}
                  onChange={(e) =>
                    setSpecs((s) => ({
                      ...s,
                      notes: e.target.value === '' ? undefined : e.target.value,
                    }))
                  }
                  disabled={!canWrite}
                  rows={3}
                  maxLength={2000}
                  placeholder="Norme, cycle, options, lien fiche PDF…"
                />
              </div>
              {canWrite ? <button type="submit">Enregistrer les données constructeur</button> : null}
            </div>
          </details>
        </form>
      ) : null}

      <form onSubmit={saveReview} className="stack">
        <details
          className="card home-accordion candidate-detail-accordion"
          style={{ boxShadow: 'none' }}
          open={reviewAccordionOpen}
          onToggle={(e) => setReviewAccordionOpen(e.currentTarget.open)}
        >
          <summary className="home-accordion-summary">Mon avis (0–10)</summary>
          <div className="home-accordion-body stack">
            <div className="row">
              <div style={{ flex: '0 0 120px' }}>
                <label>Note</label>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  max={10}
                  value={review.score}
                  onChange={(e) => setReview((r) => ({ ...r, score: e.target.value }))}
                  disabled={!canWrite}
                />
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <label>Commentaire</label>
                <input
                  value={review.free_text}
                  onChange={(e) => setReview((r) => ({ ...r, free_text: e.target.value }))}
                  disabled={!canWrite}
                />
              </div>
            </div>
            <div className="row">
              <div style={{ flex: '1 1 200px' }}>
                <label>Points forts</label>
                <input
                  value={review.pros}
                  onChange={(e) => setReview((r) => ({ ...r, pros: e.target.value }))}
                  disabled={!canWrite}
                />
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <label>Points faibles</label>
                <input
                  value={review.cons}
                  onChange={(e) => setReview((r) => ({ ...r, cons: e.target.value }))}
                  disabled={!canWrite}
                />
              </div>
            </div>
            {canWrite ? <button type="submit">Enregistrer mon avis</button> : null}
          </div>
        </details>
      </form>

      <details
        key={`comments-${candidate.id}`}
        className="card home-accordion candidate-detail-accordion"
        style={{ boxShadow: 'none' }}
        open={commentsAccordionOpen}
        onToggle={(e) => setCommentsAccordionOpen(e.currentTarget.open)}
      >
        <summary className="home-accordion-summary">
          Commentaires
          <span className="muted" style={{ fontWeight: 400, marginLeft: '0.35rem' }}>
            ({comments.length}){comments.length === 0 ? ' — vide' : ''}
          </span>
        </summary>
        <div className="home-accordion-body stack">
          <ul style={{ paddingLeft: '1.1rem', margin: 0 }}>
            {comments.map((c) => (
              <li key={c.id}>
                <strong>{names[c.user_id] ?? c.user_id.slice(0, 6)}</strong> —{' '}
                {renderMentions(c.body)}
              </li>
            ))}
          </ul>
          {canWrite ? (
            <form
              onSubmit={sendComment}
              className="row icon-action-toolbar"
              style={{ alignItems: 'center' }}
            >
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                style={{ flex: 1 }}
              />
              <IconActionButton
                nativeType="submit"
                variant="primary"
                label="Envoyer le commentaire"
              >
                <IconSend />
              </IconActionButton>
            </form>
          ) : null}
        </div>
      </details>

      {showSpecsAndPhotos ? (
        <details
          key={`photos-${candidate.id}`}
          className="card home-accordion candidate-detail-accordion"
          style={{ boxShadow: 'none' }}
          open={photosAccordionOpen}
          onToggle={(e) => setPhotosAccordionOpen(e.currentTarget.open)}
        >
          <summary className="home-accordion-summary">
            Photos (max 5 Mo, JPEG/PNG/WebP/GIF — compression proposée si besoin)
            {!photos.length ? (
              <span className="muted" style={{ fontWeight: 400, marginLeft: '0.35rem' }}>
                (vide)
              </span>
            ) : (
              <span className="muted" style={{ fontWeight: 400, marginLeft: '0.35rem' }}>
                ({photos.length})
              </span>
            )}
          </summary>
          <div className="home-accordion-body stack">
            {canWrite ? (
              <>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
                />
                <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
                  Si le fichier dépasse 5 Mo, vous pourrez le compresser automatiquement (JPEG, taille
                  et qualité ajustées) avant envoi.
                </p>
              </>
            ) : null}
            <div className="row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
              {photos.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPhotoViewerIndex(i)}
                  aria-label={`Agrandir la photo ${i + 1} sur ${photos.length}`}
                  style={{
                    padding: 0,
                    border: '1px solid var(--border, #333)',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: 'transparent',
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={p.url}
                    alt=""
                    width={120}
                    height={80}
                    loading="lazy"
                    decoding="async"
                    style={{ width: 120, height: 80, objectFit: 'cover', display: 'block' }}
                  />
                </button>
              ))}
            </div>
          </div>
        </details>
      ) : null}

      <ImageViewerCarousel
        items={photos}
        index={photoViewerIndex}
        onClose={() => setPhotoViewerIndex(null)}
        onNavigate={setPhotoViewerIndex}
      />

      {pendingOversizedPhoto ? (
        <div
          className="error-dialog-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) dismissCompressOffer()
          }}
        >
          <div
            className="error-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="compress-photo-title"
            aria-describedby="compress-photo-desc"
          >
            <h2 id="compress-photo-title" className="error-dialog-title">
              Image trop volumineuse
            </h2>
            <p id="compress-photo-desc" className="error-dialog-message">
              Ce fichier fait environ{' '}
              <strong>
                {(pendingOversizedPhoto.size / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo
              </strong>{' '}
              (limite {MAX_IMAGE_BYTES / 1024 / 1024} Mo). Vous pouvez le{' '}
              <strong>compresser automatiquement</strong> (réduction des dimensions et qualité, export
              JPEG) pour l’envoyer.
            </p>
            <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
              Les GIF animés deviennent une image fixe. La transparence des PNG est remplacée par un
              fond.
            </p>
            <div className="error-dialog-actions">
              <IconActionButton
                variant="secondary"
                label="Annuler"
                onClick={dismissCompressOffer}
                disabled={compressingPhoto}
                ref={compressCancelRef}
              >
                <IconX />
              </IconActionButton>
              <IconActionButton
                variant="primary"
                label={compressingPhoto ? 'Compression…' : 'Compresser et envoyer'}
                onClick={() => void confirmCompressAndUpload()}
                disabled={compressingPhoto}
              >
                <IconCheck />
              </IconActionButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
