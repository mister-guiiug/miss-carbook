import { useEffect, useState } from 'react'
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
import { formatCandidateListLabel } from '../../../lib/candidateLabel'
import { IconActionButton, IconSend } from '../../ui/IconActionButton'
import type { CandidateRow } from './candidateTypes'
import { statusLabels } from './candidateTypes'

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
    price: candidate.price != null ? String(candidate.price) : '',
    event_date: candidate.event_date ?? '',
    status: candidate.status,
    reject_reason: candidate.reject_reason,
    options: candidate.options,
    garage_location: candidate.garage_location,
    manufacturer_url: candidate.manufacturer_url,
  })

  useEffect(() => {
    setMeta({
      parent_candidate_id: candidate.parent_candidate_id ?? '',
      brand: candidate.brand,
      model: candidate.model,
      trim: candidate.trim,
      engine: candidate.engine,
      price: candidate.price != null ? String(candidate.price) : '',
      event_date: candidate.event_date ?? '',
      status: candidate.status,
      reject_reason: candidate.reject_reason,
      options: candidate.options,
      garage_location: candidate.garage_location,
      manufacturer_url: candidate.manufacturer_url,
    })
  }, [candidate])

  const saveIdentity = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canWrite) return
    const parsed = candidateSchema.safeParse({
      ...meta,
      parent_candidate_id: meta.parent_candidate_id || null,
      price: meta.price,
      event_date: meta.event_date || null,
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
    try {
      const { error } = await supabase
        .from('candidates')
        .update({
          parent_candidate_id: parsed.data.parent_candidate_id,
          brand: parsed.data.brand,
          model: parsed.data.model,
          trim: parsed.data.trim,
          engine: parsed.data.engine,
          price: parsed.data.price,
          options: parsed.data.options,
          garage_location: parsed.data.garage_location,
          manufacturer_url: parsed.data.manufacturer_url,
          event_date: parsed.data.event_date,
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
                    if (!pid) return { ...m, parent_candidate_id: '' }
                    const p = rootCandidates.find((x) => x.id === pid)
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
                <label htmlFor={`cand-meta-trim-${candidate.id}`}>Version</label>
                <input
                  id={`cand-meta-trim-${candidate.id}`}
                  value={meta.trim}
                  onChange={(e) => setMeta((m) => ({ ...m, trim: e.target.value }))}
                  placeholder="ex. finition, millésime court"
                />
              </div>
              <div style={{ flex: '1 1 160px' }}>
                <label htmlFor={`cand-meta-date-${candidate.id}`}>Année(s) / période</label>
                <input
                  id={`cand-meta-date-${candidate.id}`}
                  type="date"
                  value={meta.event_date}
                  onChange={(e) => setMeta((m) => ({ ...m, event_date: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {isRoot && hasMultipleVariants ? (
            <p className="muted" style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.45 }}>
              Plusieurs variations : motorisation, prix, options, statut, etc. se renseignent sur
              chaque ligne de variation.
            </p>
          ) : null}

          {showDetailFields ? (
            <div className="candidate-fiche-details-attached stack">
              <h5 className="candidate-fiche-subtitle">Détails du véhicule</h5>
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
                    type="number"
                    step="0.01"
                    value={meta.price}
                    onChange={(e) => setMeta((m) => ({ ...m, price: e.target.value }))}
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
          ) : null}

          <button type="submit">Enregistrer la fiche</button>
        </form>
      ) : null}

      <form onSubmit={saveSpecs} className="stack">
        <h4 style={{ margin: 0 }}>Données constructeur (flexibles)</h4>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {num('lengthMm', specs.lengthMm)}
          {num('trunkLiters', specs.trunkLiters)}
          {num('consumptionL100', specs.consumptionL100)}
          {num('consumptionKwh100', specs.consumptionKwh100)}
          {num('powerKw', specs.powerKw)}
          {num('co2Gkm', specs.co2Gkm)}
        </div>
        {canWrite ? <button type="submit">Enregistrer fiche technique</button> : null}
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

      <div className="stack">
        <h4 style={{ margin: 0 }}>Commentaires</h4>
        <ul style={{ paddingLeft: '1.1rem' }}>
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
            <IconActionButton nativeType="submit" variant="primary" label="Envoyer le commentaire">
              <IconSend />
            </IconActionButton>
          </form>
        ) : null}
      </div>

      <div className="stack">
        <h4 style={{ margin: 0 }}>Photos (max 5 Mo, JPEG/PNG/WebP/GIF)</h4>
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
    </div>
  )
}
