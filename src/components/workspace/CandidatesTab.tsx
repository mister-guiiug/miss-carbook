import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activity'
import {
  candidateSchema,
  candidateSpecsSchema,
  commentSchema,
  reviewSchema,
} from '../../lib/validation/schemas'
import { uploadCandidateImage, signedUrlForPath } from '../../lib/storageUpload'
import { renderMentions } from '../../lib/renderMentions'
import { useErrorDialog } from '../../contexts/ErrorDialogContext'
import type { CandidateStatus, Json } from '../../types/database'

type CandidateRow = {
  id: string
  brand: string
  model: string
  trim: string
  engine: string
  price: number | null
  options: string
  garage_location: string
  manufacturer_url: string
  event_date: string | null
  status: CandidateStatus
  reject_reason: string
  candidate_specs: { specs: Json } | null
}

const statusLabels: Record<CandidateStatus, string> = {
  to_see: 'À voir',
  tried: 'Essayé',
  shortlist: 'Shortlist',
  selected: 'Retenu',
  rejected: 'Rejeté',
}

export function CandidatesTab({
  workspaceId,
  canWrite,
  userId,
}: {
  workspaceId: string
  canWrite: boolean
  userId: string
}) {
  const { reportException, reportMessage } = useErrorDialog()
  const [candidates, setCandidates] = useState<CandidateRow[]>([])
  const [reviews, setReviews] = useState<{ candidate_id: string; score: number }[]>([])
  const [open, setOpen] = useState<string | null>(null)

  const load = async () => {
    const { data, error } = await supabase
      .from('candidates')
      .select('*, candidate_specs ( specs )')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
    if (error) reportException(error, 'Chargement des modèles candidats')
    else setCandidates((data ?? []) as unknown as CandidateRow[])
    const ids = (data ?? []).map((c: { id: string }) => c.id)
    if (ids.length) {
      const { data: revs } = await supabase
        .from('candidate_reviews')
        .select('candidate_id, score')
        .in('candidate_id', ids)
      setReviews(revs ?? [])
    } else setReviews([])
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId])

  const [form, setForm] = useState({
    brand: '',
    model: '',
    trim: '',
    engine: '',
    price: '',
    options: '',
    garage_location: '',
    manufacturer_url: '',
    event_date: '',
    status: 'to_see' as CandidateStatus,
    reject_reason: '',
  })

  const duplicateOne = async (c: CandidateRow) => {
    if (!canWrite) return
    try {
      const { data, error } = await supabase
        .from('candidates')
        .insert({
          workspace_id: workspaceId,
          brand: c.brand,
          model: c.model ? `${c.model} (copie)` : '(copie)',
          trim: c.trim,
          engine: c.engine,
          price: c.price,
          options: c.options,
          garage_location: c.garage_location,
          manufacturer_url: c.manufacturer_url,
          event_date: c.event_date,
          status: 'to_see',
          reject_reason: '',
        })
        .select('id')
        .single()
      if (error) throw error
      const specs = (c.candidate_specs?.specs ?? {}) as Json
      await supabase.from('candidate_specs').insert({ candidate_id: data.id, specs })
      await logActivity(workspaceId, 'candidate.duplicate', 'candidate', data.id, { from: c.id })
      await load()
    } catch (e: unknown) {
      reportException(e, 'Duplication d’un modèle candidat')
    }
  }

  const importCsv = async (file: File | null) => {
    if (!file || !canWrite) return
    try {
      const text = await file.text()
      const lines = text.split(/\r?\n/).filter((l) => l.trim())
      if (lines.length < 2) throw new Error('CSV vide')
      const head = lines[0].split(',').map((s) => s.trim().toLowerCase())
      const col = (name: string, ...alts: string[]) => {
        const i = head.indexOf(name)
        if (i >= 0) return i
        for (const a of alts) {
          const j = head.indexOf(a)
          if (j >= 0) return j
        }
        return -1
      }
      const iBrand = col('brand', 'marque')
      const iModel = col('model', 'modele', 'modèle')
      const iTrim = col('trim', 'finition')
      const iEngine = col('engine', 'motorisation')
      const iPrice = col('price', 'prix')
      if (iBrand < 0 || iModel < 0) throw new Error('Colonnes brand et model requises')
      for (let li = 1; li < lines.length; li++) {
        const cols = lines[li].split(',').map((s) => s.trim())
        const brand = cols[iBrand] ?? ''
        const model = cols[iModel] ?? ''
        if (!brand && !model) continue
        const priceRaw = iPrice >= 0 ? cols[iPrice] : ''
        const price = priceRaw ? Number(priceRaw.replace(',', '.')) : null
        const { data, error } = await supabase
          .from('candidates')
          .insert({
            workspace_id: workspaceId,
            brand,
            model,
            trim: iTrim >= 0 ? (cols[iTrim] ?? '') : '',
            engine: iEngine >= 0 ? (cols[iEngine] ?? '') : '',
            price: Number.isFinite(price as number) ? price : null,
          })
          .select('id')
          .single()
        if (error) throw error
        await supabase.from('candidate_specs').insert({ candidate_id: data.id, specs: {} })
      }
      await load()
      await logActivity(workspaceId, 'candidate.import_csv', 'workspace', workspaceId, {})
    } catch (e: unknown) {
      reportException(e, 'Import CSV des modèles')
    }
  }

  const addCandidate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canWrite) return
    const parsed = candidateSchema.safeParse({
      ...form,
      price: form.price,
      event_date: form.event_date || null,
    })
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? 'Invalide'
      reportMessage(msg, JSON.stringify(parsed.error.flatten(), null, 2))
      return
    }
    try {
      const { data, error } = await supabase
        .from('candidates')
        .insert({
          workspace_id: workspaceId,
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
        .select('id')
        .single()
      if (error) throw error
      await supabase.from('candidate_specs').insert({ candidate_id: data.id, specs: {} })
      await logActivity(workspaceId, 'candidate.create', 'candidate', data.id, {})
      setForm({
        brand: '',
        model: '',
        trim: '',
        engine: '',
        price: '',
        options: '',
        garage_location: '',
        manufacturer_url: '',
        event_date: '',
        status: 'to_see',
        reject_reason: '',
      })
      await load()
    } catch (e: unknown) {
      reportException(e, 'Création d’un modèle candidat')
    }
  }

  return (
    <div className="stack">
      {canWrite ? (
        <div className="card stack" style={{ boxShadow: 'none' }}>
          <h3 style={{ margin: 0 }}>Import CSV</h3>
          <p className="muted" style={{ margin: 0 }}>
            Première ligne : brand, model (obligatoires), trim, engine, price… Séparateur virgule
            (simple).
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => void importCsv(e.target.files?.[0] ?? null)}
          />
        </div>
      ) : null}

      {canWrite ? (
        <form onSubmit={addCandidate} className="card stack" style={{ boxShadow: 'none' }}>
          <h3 style={{ margin: 0 }}>Nouveau modèle candidat</h3>
          <div className="row">
            <div style={{ flex: '1 1 160px' }}>
              <label>Marque</label>
              <input
                value={form.brand}
                onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
              />
            </div>
            <div style={{ flex: '1 1 160px' }}>
              <label>Modèle</label>
              <input
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              />
            </div>
          </div>
          <div className="row">
            <div style={{ flex: '1 1 160px' }}>
              <label>Finition</label>
              <input
                value={form.trim}
                onChange={(e) => setForm((f) => ({ ...f, trim: e.target.value }))}
              />
            </div>
            <div style={{ flex: '1 1 160px' }}>
              <label>Motorisation</label>
              <input
                value={form.engine}
                onChange={(e) => setForm((f) => ({ ...f, engine: e.target.value }))}
              />
            </div>
          </div>
          <div className="row">
            <div style={{ flex: '1 1 160px' }}>
              <label>Prix</label>
              <input
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              />
            </div>
            <div style={{ flex: '1 1 160px' }}>
              <label>Date (essai / devis)</label>
              <input
                type="date"
                value={form.event_date}
                onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label>Garage / lieu</label>
            <input
              value={form.garage_location}
              onChange={(e) => setForm((f) => ({ ...f, garage_location: e.target.value }))}
            />
          </div>
          <div>
            <label>Lien constructeur</label>
            <input
              value={form.manufacturer_url}
              onChange={(e) => setForm((f) => ({ ...f, manufacturer_url: e.target.value }))}
            />
          </div>
          <div>
            <label>Options</label>
            <textarea
              value={form.options}
              onChange={(e) => setForm((f) => ({ ...f, options: e.target.value }))}
            />
          </div>
          <div className="row">
            <div style={{ flex: '1 1 200px' }}>
              <label>Statut</label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value as CandidateStatus }))
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
              <label>Raison si rejet</label>
              <input
                value={form.reject_reason}
                onChange={(e) => setForm((f) => ({ ...f, reject_reason: e.target.value }))}
              />
            </div>
          </div>
          <button type="submit">Ajouter</button>
        </form>
      ) : null}

      <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {candidates.map((c) => (
          <li key={c.id} className="card" style={{ boxShadow: 'none' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <strong>
                  {c.brand} {c.model}
                </strong>{' '}
                <span className="badge">{statusLabels[c.status]}</span>
                <div className="muted">
                  {c.trim ? `${c.trim} · ` : ''}
                  {c.engine}
                  {c.price != null ? ` · ${c.price} €` : ''}
                </div>
              </div>
              <button type="button" className="secondary" onClick={() => void duplicateOne(c)}>
                Dupliquer
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setOpen(open === c.id ? null : c.id)}
              >
                {open === c.id ? 'Fermer' : 'Détail'}
              </button>
            </div>
            {open === c.id ? (
              <CandidateDetail
                candidate={c}
                workspaceId={workspaceId}
                canWrite={canWrite}
                userId={userId}
                onChanged={load}
              />
            ) : null}
          </li>
        ))}
      </ul>

      <p className="muted">
        Les avis agrégés pour la comparaison proviennent des notes saisies ci-dessous (
        {reviews.length} entrées chargées).
      </p>
    </div>
  )
}

function CandidateDetail({
  candidate,
  workspaceId,
  canWrite,
  userId,
  onChanged,
}: {
  candidate: CandidateRow
  workspaceId: string
  canWrite: boolean
  userId: string
  onChanged: () => void
}) {
  const { reportException, reportMessage } = useErrorDialog()
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

  return (
    <div className="stack" style={{ marginTop: '0.75rem' }}>
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
          <form onSubmit={sendComment} className="row">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="submit">Envoyer</button>
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
