import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { logActivity } from '../../../lib/activity'
import {
  candidateSchema,
  candidateSpecsSchema,
  commentSchema,
  reviewSchema,
} from '../../../lib/validation/schemas'
import { uploadCandidateImage, signedUrlForPath } from '../../../lib/storageUpload'
import { renderMentions } from '../../../lib/renderMentions'
import { useErrorDialog } from '../../../contexts/ErrorDialogContext'
import type { CandidateStatus, Json } from '../../../types/database'
import { displayVersionLabel, formatCandidateListLabel } from '../../../lib/candidateLabel'
import { formatPriceInputDisplay, parsePriceInput } from '../../../lib/formatPrice'
import { IconActionButton, IconSend } from '../../ui/IconActionButton'
import type { CandidateRow } from './candidateTypes'
import { statusLabels } from './candidateTypes'

function isBlank(s: string | null | undefined): boolean {
  return !s || String(s).trim() === ''
}

/** Détails « véhicule » sans identité : tout est vide côté saisie. */
function isVehicleDetailMetaEmpty(m: {
  engine: string
  price: string
  garage_location: string
  manufacturer_url: string
  options: string
  reject_reason: string
}): boolean {
  const priceEmpty = m.price === '' || m.price === undefined
  return (
    isBlank(m.engine) &&
    priceEmpty &&
    isBlank(m.garage_location) &&
    isBlank(m.manufacturer_url) &&
    isBlank(m.options) &&
    isBlank(m.reject_reason)
  )
}

const SPEC_NUM_KEYS = [
  'lengthMm',
  'trunkLiters',
  'consumptionL100',
  'consumptionKwh100',
  'powerKw',
  'co2Gkm',
] as const

function hasAnySpecData(specs: Record<string, unknown>): boolean {
  return SPEC_NUM_KEYS.some((k) => {
    const v = specs[k]
    return typeof v === 'number' && !Number.isNaN(v)
  })
}

function vehicleDetailFromCandidate(c: CandidateRow) {
  return {
    engine: c.engine ?? '',
    price: c.price != null ? formatPriceInputDisplay(c.price) : '',
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
}: {
  candidate: CandidateRow
  rootCandidates: CandidateRow[]
  variationCount: number
  workspaceId: string
  canWrite: boolean
  userId: string
  onChanged: () => void
}) {
  const { reportException, reportMessage } = useErrorDialog()
  const [meta, setMeta] = useState({
    parent_candidate_id: candidate.parent_candidate_id ?? '',
    brand: candidate.brand,
    model: candidate.model,
    trim: candidate.trim,
    engine: candidate.engine,
    price: candidate.price != null ? formatPriceInputDisplay(candidate.price) : '',
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
      event_date: candidate.event_date ?? '',
      status: candidate.status,
      reject_reason: candidate.reject_reason,
      options: candidate.options,
      garage_location: candidate.garage_location,
      manufacturer_url: candidate.manufacturer_url,
    })
    rootDraftRef.current = null
  }, [candidate])

  const parentRow = useMemo(
    () =>
      candidate.parent_candidate_id
        ? (rootCandidates.find((p) => p.id === candidate.parent_candidate_id) ?? null)
        : null,
    [candidate.parent_candidate_id, rootCandidates]
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
    if (parsed.data.parent_candidate_id && variationCount > 0) {
      reportMessage(
        'Ce modèle a des variations : vous ne pouvez pas le rattacher à un parent tant qu’elles existent. Supprimez ou détachez les variations d’abord.',
        'variationCount > 0'
      )
      return
    }
    const isChild = Boolean(candidate.parent_candidate_id)

    try {
      const brand = isChild && parentRow ? parentRow.brand : parsed.data.brand
      const model = isChild && parentRow ? parentRow.model : parsed.data.model
      const eventDate = isChild && parentRow ? parentRow.event_date : parsed.data.event_date

      const { error } = await supabase
        .from('candidates')
        .update({
          parent_candidate_id: parsed.data.parent_candidate_id,
          brand,
          model,
          trim: parsed.data.trim,
          engine: parsed.data.engine,
          price: parsed.data.price,
          options: parsed.data.options,
          garage_location: parsed.data.garage_location,
          manufacturer_url: parsed.data.manufacturer_url,
          event_date: eventDate,
          status: parsed.data.status,
          reject_reason: parsed.data.reject_reason,
        })
        .eq('id', candidate.id)
      if (error) throw error
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
    hasAnySpecData((candidate.candidate_specs?.specs as Record<string, unknown>) ?? {})
  )
  const [commentsAccordionOpen, setCommentsAccordionOpen] = useState(false)
  const [photosAccordionOpen, setPhotosAccordionOpen] = useState(false)

  useEffect(() => {
    setVehDetailsOpen(!isVehicleDetailMetaEmpty(vehicleDetailFromCandidate(candidate)))
  }, [candidate])

  useEffect(() => {
    setSpecsAccordionOpen(
      hasAnySpecData((candidate.candidate_specs?.specs as Record<string, unknown>) ?? {})
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
    void loadPhotos()
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
    if (photos.length > 0) setPhotosAccordionOpen(true)
  }, [photos.length])

  useEffect(() => {
    setCommentsAccordionOpen(false)
    setPhotosAccordionOpen(false)
  }, [candidate.id])

  const saveSpecs = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canWrite) return
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

  const onFile = async (file: File | null) => {
    if (!file || !canWrite) return
    try {
      await uploadCandidateImage(workspaceId, candidate.id, file, userId)
      await loadPhotos()
      await logActivity(workspaceId, 'candidate.photo.upload', 'candidate', candidate.id, {})
    } catch (e: unknown) {
      reportException(e, 'Upload d’une photo pour le modèle')
    }
  }

  const num = (k: string, v: unknown) => (
    <div key={k} style={{ flex: '1 1 140px' }}>
      <label>{k}</label>
      <input
        type="number"
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

  const isRoot = !candidate.parent_candidate_id
  const hasMultipleVariants = variationCount >= 2
  const showDetailFields = !isRoot || !hasMultipleVariants
  const showParentSelect = !isRoot || variationCount === 0

  return (
    <div className="stack" style={{ marginTop: '0.75rem' }}>
      {canWrite ? (
        <form onSubmit={saveIdentity} className="card stack" style={{ boxShadow: 'none' }}>
          <h4 style={{ margin: 0 }}>Fiche modèle</h4>

          {showParentSelect ? (
            <div>
              <label htmlFor={`cand-meta-parent-${candidate.id}`}>Rattaché au modèle racine</label>
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
                        event_date: draft?.event_date ?? (candidate.event_date ?? ''),
                      }
                    }
                    const p = rootCandidates.find((x) => x.id === pid)
                    if (!m.parent_candidate_id) {
                      rootDraftRef.current = { brand: m.brand, model: m.model, event_date: m.event_date ?? '' }
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
            {isRoot ? (
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
                    <label htmlFor={`cand-meta-date-${candidate.id}`}>Année(s) / période</label>
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
              </>
            ) : parentRow ? (
              <>
                <div className="row">
                  <div style={{ flex: '1 1 160px' }}>
                    <label htmlFor={`cand-meta-brand-${candidate.id}`}>Marque</label>
                    <input
                      id={`cand-meta-brand-${candidate.id}`}
                      className="candidate-field-readonly"
                      readOnly
                      value={parentRow.brand}
                      tabIndex={-1}
                    />
                  </div>
                  <div style={{ flex: '1 1 160px' }}>
                    <label htmlFor={`cand-meta-model-${candidate.id}`}>Modèle</label>
                    <input
                      id={`cand-meta-model-${candidate.id}`}
                      className="candidate-field-readonly"
                      readOnly
                      value={parentRow.model}
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
                        trim: parentRow.trim,
                        parent_candidate_id: null,
                      })}
                      tabIndex={-1}
                    />
                  </div>
                  <div style={{ flex: '1 1 160px' }}>
                    <label htmlFor={`cand-meta-period-ro-${candidate.id}`}>
                      Année(s) / période
                    </label>
                    <input
                      id={`cand-meta-period-ro-${candidate.id}`}
                      className="candidate-field-readonly"
                      readOnly
                      value={parentRow.event_date ?? ''}
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
                      Année(s) / période
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

          {isRoot && hasMultipleVariants ? (
            <p className="muted" style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.45 }}>
              Plusieurs variations : motorisation, prix, options, statut, etc. se renseignent sur
              chaque ligne de variation.
            </p>
          ) : null}

          {showDetailFields ? (
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
                </div>
                <div>
                  <label htmlFor={`cand-meta-garage-${candidate.id}`}>Garage / lieu</label>
                  <input
                    id={`cand-meta-garage-${candidate.id}`}
                    value={meta.garage_location}
                    onChange={(e) => setMeta((m) => ({ ...m, garage_location: e.target.value }))}
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

      <form onSubmit={saveSpecs} className="stack">
        <details
          key={`specs-${candidate.id}`}
          className="card home-accordion candidate-detail-accordion"
          style={{ boxShadow: 'none' }}
          open={specsAccordionOpen}
          onToggle={(e) => setSpecsAccordionOpen(e.currentTarget.open)}
        >
          <summary className="home-accordion-summary">
            Données constructeur (flexibles)
            {!hasAnySpecData(specs) ? (
              <span className="muted" style={{ fontWeight: 400, marginLeft: '0.35rem' }}>
                (vide)
              </span>
            ) : null}
          </summary>
          <div className="home-accordion-body stack">
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {num('lengthMm', specs.lengthMm)}
              {num('trunkLiters', specs.trunkLiters)}
              {num('consumptionL100', specs.consumptionL100)}
              {num('consumptionKwh100', specs.consumptionKwh100)}
              {num('powerKw', specs.powerKw)}
              {num('co2Gkm', specs.co2Gkm)}
            </div>
            {canWrite ? <button type="submit">Enregistrer fiche technique</button> : null}
          </div>
        </details>
      </form>

      <form onSubmit={saveReview} className="stack">
        <h4 style={{ margin: 0 }}>Mon avis (0–10)</h4>
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

      <details
        key={`photos-${candidate.id}`}
        className="card home-accordion candidate-detail-accordion"
        style={{ boxShadow: 'none' }}
        open={photosAccordionOpen}
        onToggle={(e) => setPhotosAccordionOpen(e.currentTarget.open)}
      >
        <summary className="home-accordion-summary">
          Photos (max 5 Mo, JPEG/PNG/WebP/GIF)
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
            <input
              type="file"
              accept="image/*"
              onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
            />
          ) : null}
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {photos.map((p) => (
              <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                <img
                  src={p.url}
                  alt=""
                  width={120}
                  height={80}
                  loading="lazy"
                  decoding="async"
                  style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 8 }}
                />
              </a>
            ))}
          </div>
        </div>
      </details>
    </div>
  )
}
