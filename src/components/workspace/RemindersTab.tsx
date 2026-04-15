import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  WORKSPACE_QUICK_ADD_EVENT,
  type WorkspaceQuickAddDetail,
} from '../../lib/workspaceHeaderEvents'
import { formatCandidateListLabel } from '../../lib/candidateLabel'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activity'
import { useErrorDialog } from '../../contexts/ErrorDialogContext'
import { useToast } from '../../contexts/ToastContext'
import {
  IconActionButton,
  IconCheck,
  IconPencil,
  IconRotateCcw,
  IconTrash,
  IconX,
} from '../ui/IconActionButton'

function isoToDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

type ReminderKind = 'contact' | 'visit' | 'appointment' | 'other'

const reminderKindLabel: Record<ReminderKind, string> = {
  contact: 'Contact',
  visit: 'Visite',
  appointment: 'RDV',
  other: 'Autre',
}

type Row = {
  id: string
  title: string
  body: string
  due_at: string | null
  done: boolean
  candidate_id: string | null
  place?: string | null
  kind?: ReminderKind | null
}

type VisitRow = {
  id: string
  visit_at: string
  location: string
  notes: string
  candidate_id: string | null
}

type View = 'open' | 'done' | 'visits'

function fmtShortDateTimeFr(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('fr-FR', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isOverdue(iso: string | null): boolean {
  if (!iso) return false
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return false
  return d.getTime() < Date.now()
}

export function RemindersTab({
  workspaceId,
  canWrite,
}: {
  workspaceId: string
  canWrite: boolean
}) {
  const { reportException } = useErrorDialog()
  const { showToast } = useToast()
  const [rows, setRows] = useState<Row[]>([])
  const [visits, setVisits] = useState<VisitRow[]>([])
  const [candidates, setCandidates] = useState<
    { id: string; brand: string; model: string; trim: string; parent_candidate_id: string | null }[]
  >([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [due, setDue] = useState('')
  const [candId, setCandId] = useState('')
  const [place, setPlace] = useState('')
  const [kind, setKind] = useState<ReminderKind>('contact')

  const [visitAt, setVisitAt] = useState(() => isoToDatetimeLocal(new Date().toISOString()))
  const [visitLocation, setVisitLocation] = useState('')
  const [visitNotes, setVisitNotes] = useState('')
  const [visitCandId, setVisitCandId] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editDue, setEditDue] = useState('')
  const [editCandId, setEditCandId] = useState('')
  const [editPlace, setEditPlace] = useState('')
  const [editKind, setEditKind] = useState<ReminderKind>('contact')
  const [savingEdit, setSavingEdit] = useState(false)

  const [view, setView] = useState<View>('open')
  const [query, setQuery] = useState('')
  const [kindFilter, setKindFilter] = useState<ReminderKind | 'all'>('all')
  const [candidateFilter, setCandidateFilter] = useState('all')
  const [showAddReminder, setShowAddReminder] = useState(false)
  const [showAddVisit, setShowAddVisit] = useState(false)

  const load = useCallback(async () => {
    const [rem, vs, cand] = await Promise.all([
      supabase
        .from('reminders')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('due_at', { ascending: true, nullsFirst: false }),
      supabase
        .from('visits')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('visit_at', { ascending: false }),
      supabase
        .from('candidates')
        .select('id, brand, model, trim, parent_candidate_id')
        .eq('workspace_id', workspaceId)
        .order('parent_candidate_id', { ascending: true, nullsFirst: true })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
    ])

    if (rem.error) reportException(rem.error, 'Chargement des rappels')
    else setRows((rem.data ?? []) as Row[])

    if (vs.error) reportException(vs.error, 'Chargement des visites')
    else setVisits((vs.data ?? []) as VisitRow[])

    setCandidates(
      (cand.data ?? []).map((c) => ({
        id: (c as { id: string }).id,
        brand: (c as { brand: string }).brand,
        model: (c as { model: string }).model,
        trim: ((c as { trim: string | null }).trim ?? '') as string,
        parent_candidate_id: ((c as { parent_candidate_id: string | null }).parent_candidate_id ??
          null) as string | null,
      }))
    )
  }, [workspaceId, reportException])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onQuick = (ev: Event) => {
      const d = (ev as CustomEvent<WorkspaceQuickAddDetail>).detail
      if (d?.tab !== 'reminders') return
      setView('open')
      setShowAddReminder(true)
      requestAnimationFrame(() => {
        document.getElementById('reminder-title')?.focus()
      })
    }
    window.addEventListener(WORKSPACE_QUICK_ADD_EVENT, onQuick)
    return () => window.removeEventListener(WORKSPACE_QUICK_ADD_EVENT, onQuick)
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
  }, [])

  useEffect(() => {
    if (!editingId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelEdit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editingId, cancelEdit])

  const startEdit = (r: Row) => {
    setEditingId(r.id)
    setEditTitle(r.title)
    setEditBody(r.body)
    setEditDue(isoToDatetimeLocal(r.due_at))
    setEditCandId(r.candidate_id ?? '')
    setEditPlace((r.place ?? '').trim())
    setEditKind(((r.kind as ReminderKind | null) ?? 'contact') as ReminderKind)
  }

  const add = async (e: FormEvent) => {
    e.preventDefault()
    if (!canWrite || !title.trim()) return
    const { error } = await supabase.from('reminders').insert({
      workspace_id: workspaceId,
      title: title.trim(),
      body: body.trim(),
      due_at: due ? new Date(due).toISOString() : null,
      candidate_id: candId || null,
      place: place.trim(),
      kind,
    })
    if (error) reportException(error, 'Création d’un rappel')
    else {
      setTitle('')
      setBody('')
      setDue('')
      setCandId('')
      setPlace('')
      setKind('contact')
      await load()
      await logActivity(workspaceId, 'reminder.create', 'reminder', null, {})
      showToast('Rappel ajouté')
    }
  }

  const addVisit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canWrite || !visitAt) return
    const { error } = await supabase.from('visits').insert({
      workspace_id: workspaceId,
      candidate_id: visitCandId || null,
      visit_at: new Date(visitAt).toISOString(),
      location: visitLocation.trim(),
      notes: visitNotes.trim(),
    })
    if (error) reportException(error, 'Création d’une visite')
    else {
      setVisitAt(isoToDatetimeLocal(new Date().toISOString()))
      setVisitLocation('')
      setVisitNotes('')
      setVisitCandId('')
      await load()
      await logActivity(workspaceId, 'visit.create', 'visit', null, {})
      showToast('Visite ajoutée')
    }
  }

  const saveEdit = async (e: FormEvent, id: string) => {
    e.preventDefault()
    if (!canWrite || !editTitle.trim()) return
    setSavingEdit(true)
    try {
      const { error } = await supabase
        .from('reminders')
        .update({
          title: editTitle.trim(),
          body: editBody.trim(),
          due_at: editDue ? new Date(editDue).toISOString() : null,
          candidate_id: editCandId || null,
          place: editPlace.trim(),
          kind: editKind,
        })
        .eq('id', id)
      if (error) reportException(error, 'Mise à jour d’un rappel')
      else {
        cancelEdit()
        await load()
        await logActivity(workspaceId, 'reminder.update', 'reminder', id, {})
        showToast('Rappel mis à jour')
      }
    } finally {
      setSavingEdit(false)
    }
  }

  const toggle = async (r: Row) => {
    if (!canWrite) return
    const { error } = await supabase.from('reminders').update({ done: !r.done }).eq('id', r.id)
    if (error) reportException(error, 'Mise à jour d’un rappel (fait / rouvrir)')
    else {
      await load()
      showToast(r.done ? 'Rappel rouvert' : 'Rappel marqué comme fait')
    }
  }

  const remove = async (id: string) => {
    if (!canWrite || !confirm('Supprimer ce rappel ?')) return
    const { error } = await supabase.from('reminders').delete().eq('id', id)
    if (error) reportException(error, 'Suppression d’un rappel')
    else {
      if (editingId === id) cancelEdit()
      await load()
      showToast('Rappel supprimé')
    }
  }

  const removeVisit = async (id: string) => {
    if (!canWrite || !confirm('Supprimer cette visite ?')) return
    const { error } = await supabase.from('visits').delete().eq('id', id)
    if (error) reportException(error, 'Suppression d’une visite')
    else {
      await load()
      showToast('Visite supprimée')
    }
  }

  const openReminders = rows.filter((r) => !r.done)
  const doneReminders = rows.filter((r) => r.done)

  const counts = useMemo(
    () => ({
      open: openReminders.length,
      done: doneReminders.length,
      visits: visits.length,
    }),
    [openReminders.length, doneReminders.length, visits.length]
  )

  const candidateLabelById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of candidates) m.set(c.id, formatCandidateListLabel(c))
    return m
  }, [candidates])

  const filteredOpen = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = openReminders.filter((r) => {
      if (kindFilter !== 'all' && ((r.kind as ReminderKind | null) ?? 'other') !== kindFilter)
        return false
      if (candidateFilter !== 'all' && (r.candidate_id ?? '') !== candidateFilter) return false
      if (!q) return true
      const linked = r.candidate_id ? (candidateLabelById.get(r.candidate_id) ?? '') : ''
      return (
        (r.title ?? '').toLowerCase().includes(q) ||
        (r.body ?? '').toLowerCase().includes(q) ||
        (r.place ?? '').toLowerCase().includes(q) ||
        linked.toLowerCase().includes(q)
      )
    })
    return [...list].sort((a, b) => {
      const ad = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY
      const bd = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY
      if (ad !== bd) return ad - bd
      return String(a.title ?? '').localeCompare(String(b.title ?? ''), 'fr-FR')
    })
  }, [openReminders, query, kindFilter, candidateFilter, candidateLabelById])

  const filteredDone = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = doneReminders.filter((r) => {
      if (kindFilter !== 'all' && ((r.kind as ReminderKind | null) ?? 'other') !== kindFilter)
        return false
      if (candidateFilter !== 'all' && (r.candidate_id ?? '') !== candidateFilter) return false
      if (!q) return true
      const linked = r.candidate_id ? (candidateLabelById.get(r.candidate_id) ?? '') : ''
      return (
        (r.title ?? '').toLowerCase().includes(q) ||
        (r.body ?? '').toLowerCase().includes(q) ||
        (r.place ?? '').toLowerCase().includes(q) ||
        linked.toLowerCase().includes(q)
      )
    })
    // On garde un ordre stable : par échéance (si existe) puis par titre.
    return [...list].sort((a, b) => {
      const ad = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY
      const bd = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY
      if (ad !== bd) return ad - bd
      return String(a.title ?? '').localeCompare(String(b.title ?? ''), 'fr-FR')
    })
  }, [doneReminders, query, kindFilter, candidateFilter, candidateLabelById])

  const filteredVisits = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = visits.filter((v) => {
      if (candidateFilter !== 'all' && (v.candidate_id ?? '') !== candidateFilter) return false
      if (!q) return true
      const linked = v.candidate_id ? (candidateLabelById.get(v.candidate_id) ?? '') : ''
      return (
        (v.location ?? '').toLowerCase().includes(q) ||
        (v.notes ?? '').toLowerCase().includes(q) ||
        linked.toLowerCase().includes(q)
      )
    })
    return [...list].sort((a, b) => {
      const ad = new Date(a.visit_at).getTime()
      const bd = new Date(b.visit_at).getTime()
      return bd - ad
    })
  }, [visits, query, candidateFilter, candidateLabelById])

  return (
    <div className="stack reminders-tab">
      <p className="muted" style={{ margin: 0 }}>
        Saisissez vos visites (historique) et vos rappels (à faire / faits) — visibles par tous les
        membres.
      </p>

      <div className="card stack reminders-toolbar" style={{ boxShadow: 'none' }}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div className="tabs" role="tablist" aria-label="Sections rappels">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'open'}
              className={view === 'open' ? 'active' : ''}
              onClick={() => setView('open')}
            >
              À faire <span className="muted">({counts.open})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'done'}
              className={view === 'done' ? 'active' : ''}
              onClick={() => setView('done')}
            >
              Faits <span className="muted">({counts.done})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'visits'}
              className={view === 'visits' ? 'active' : ''}
              onClick={() => setView('visits')}
            >
              Visites <span className="muted">({counts.visits})</span>
            </button>
          </div>

          {canWrite ? (
            <div className="row icon-action-toolbar" style={{ gap: '0.35rem' }}>
              {view !== 'visits' ? (
                <IconActionButton
                  variant="secondary"
                  label={showAddReminder ? 'Fermer le formulaire de rappel' : 'Ajouter un rappel'}
                  onClick={() => setShowAddReminder((v) => !v)}
                >
                  {showAddReminder ? <IconX /> : <IconPencil />}
                </IconActionButton>
              ) : (
                <IconActionButton
                  variant="secondary"
                  label={showAddVisit ? 'Fermer le formulaire de visite' : 'Ajouter une visite'}
                  onClick={() => setShowAddVisit((v) => !v)}
                >
                  {showAddVisit ? <IconX /> : <IconPencil />}
                </IconActionButton>
              )}
            </div>
          ) : null}
        </div>

        <div className="row reminders-filters" style={{ flexWrap: 'wrap' }}>
          <div style={{ flex: '2 1 220px' }}>
            <label htmlFor="rem-q">Recherche</label>
            <input
              id="rem-q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Titre, détail, lieu, modèle…"
              maxLength={200}
            />
          </div>
          <div style={{ flex: '1 1 180px' }}>
            <label htmlFor="rem-kind">Type</label>
            <select
              id="rem-kind"
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value as ReminderKind | 'all')}
              disabled={view === 'visits'}
            >
              <option value="all">Tous</option>
              <option value="contact">{reminderKindLabel.contact}</option>
              <option value="visit">{reminderKindLabel.visit}</option>
              <option value="appointment">{reminderKindLabel.appointment}</option>
              <option value="other">{reminderKindLabel.other}</option>
            </select>
          </div>
          <div style={{ flex: '1 1 220px' }}>
            <label htmlFor="rem-cand">Modèle</label>
            <select
              id="rem-cand"
              value={candidateFilter}
              onChange={(e) => setCandidateFilter(e.target.value)}
            >
              <option value="all">Tous</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {formatCandidateListLabel(c)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {canWrite && showAddReminder && view !== 'visits' ? (
        <form onSubmit={add} className="card stack" style={{ boxShadow: 'none' }}>
          <h3 style={{ margin: 0 }}>Nouveau rappel</h3>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 180px' }}>
              <label>Type</label>
              <select value={kind} onChange={(e) => setKind(e.target.value as ReminderKind)}>
                <option value="contact">{reminderKindLabel.contact}</option>
                <option value="visit">{reminderKindLabel.visit}</option>
                <option value="appointment">{reminderKindLabel.appointment}</option>
                <option value="other">{reminderKindLabel.other}</option>
              </select>
            </div>
          </div>
          <input
            id="reminder-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre"
            required
            maxLength={200}
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Détail (optionnel)"
            maxLength={2000}
            rows={3}
          />
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 160px' }}>
              <label>Échéance</label>
              <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
            <div style={{ flex: '1 1 220px' }}>
              <label>Lieu (optionnel)</label>
              <input
                value={place}
                onChange={(e) => setPlace(e.target.value)}
                placeholder="ex. Nom du garage, ville…"
                maxLength={200}
              />
            </div>
            <div style={{ flex: '1 1 220px' }}>
              <label>Lié à un modèle (optionnel)</label>
              <select value={candId} onChange={(e) => setCandId(e.target.value)}>
                <option value="">—</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {formatCandidateListLabel(c)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="row icon-action-toolbar" style={{ flexWrap: 'wrap' }}>
            <button type="submit">Ajouter le rappel</button>
            <IconActionButton
              variant="secondary"
              label="Fermer le formulaire"
              onClick={() => setShowAddReminder(false)}
            >
              <IconX />
            </IconActionButton>
          </div>
        </form>
      ) : null}

      {canWrite && showAddVisit && view === 'visits' ? (
        <form onSubmit={addVisit} className="card stack" style={{ boxShadow: 'none' }}>
          <h3 style={{ margin: 0 }}>Nouvelle visite</h3>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 180px' }}>
              <label>Date / heure</label>
              <input
                type="datetime-local"
                value={visitAt}
                onChange={(e) => setVisitAt(e.target.value)}
                required
              />
            </div>
            <div style={{ flex: '1 1 220px' }}>
              <label>Lieu</label>
              <input
                value={visitLocation}
                onChange={(e) => setVisitLocation(e.target.value)}
                placeholder="ex. Nom du garage, ville…"
                maxLength={500}
              />
            </div>
            <div style={{ flex: '1 1 220px' }}>
              <label>Modèle (optionnel)</label>
              <select value={visitCandId} onChange={(e) => setVisitCandId(e.target.value)}>
                <option value="">—</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {formatCandidateListLabel(c)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label>Notes</label>
            <textarea
              value={visitNotes}
              onChange={(e) => setVisitNotes(e.target.value)}
              placeholder="Impressions, points à vérifier, résultat…"
              maxLength={4000}
              rows={3}
            />
          </div>
          <div className="row icon-action-toolbar" style={{ flexWrap: 'wrap' }}>
            <button type="submit">Ajouter la visite</button>
            <IconActionButton
              variant="secondary"
              label="Fermer le formulaire"
              onClick={() => setShowAddVisit(false)}
            >
              <IconX />
            </IconActionButton>
          </div>
        </form>
      ) : null}

      {view === 'visits' ? (
        filteredVisits.length === 0 ? (
          <div className="empty-state">
            <p className="muted" style={{ margin: 0 }}>
              Aucune visite.
            </p>
          </div>
        ) : (
          <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {filteredVisits.map((v) => {
              const linkedLabel = v.candidate_id ? candidateLabelById.get(v.candidate_id) : null
              return (
                <li key={v.id} className="card" style={{ boxShadow: 'none' }}>
                  <div className="row" style={{ justifyContent: 'space-between', gap: '0.75rem' }}>
                    <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                      <strong>{fmtShortDateTimeFr(v.visit_at)}</strong>
                      {(v.location ?? '').trim() ? (
                        <div className="muted" style={{ fontSize: '0.9rem' }}>
                          Lieu : {(v.location ?? '').trim()}
                        </div>
                      ) : null}
                      {linkedLabel ? (
                        <div className="muted" style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>
                          Modèle : {linkedLabel}
                        </div>
                      ) : null}
                      {(v.notes ?? '').trim() ? (
                        <p style={{ margin: '0.35rem 0 0' }}>{v.notes}</p>
                      ) : null}
                    </div>
                    <div className="row icon-action-toolbar">
                      {canWrite ? (
                        <IconActionButton
                          variant="danger"
                          label="Supprimer la visite"
                          onClick={() => void removeVisit(v.id)}
                        >
                          <IconTrash />
                        </IconActionButton>
                      ) : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <p className="muted" style={{ margin: 0 }}>
            Aucun rappel pour ce dossier.
          </p>
        </div>
      ) : (
        <div className="card stack" style={{ boxShadow: 'none' }}>
          <h4 style={{ margin: 0 }}>{view === 'open' ? 'À faire' : 'Faits'}</h4>
          {(view === 'open' ? filteredOpen : filteredDone).length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              Aucun résultat pour ces filtres.
            </p>
          ) : (
            <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {(view === 'open' ? filteredOpen : filteredDone).map((r) => {
                const isEditing = editingId === r.id
                const linkedLabel = r.candidate_id ? candidateLabelById.get(r.candidate_id) : null
                const k = ((r.kind as ReminderKind | null) ?? 'other') as ReminderKind
                const overdue = !r.done && isOverdue(r.due_at)
                return (
                  <li
                    key={r.id}
                    className="card"
                    style={{
                      boxShadow: 'none',
                      opacity: r.done && !isEditing ? 0.65 : 1,
                      borderColor: overdue ? 'var(--danger)' : undefined,
                    }}
                  >
                    {isEditing ? (
                      <form
                        className="stack"
                        onSubmit={(e) => void saveEdit(e, r.id)}
                        aria-label={`Modifier le rappel « ${r.title} »`}
                      >
                        <span className="muted" style={{ fontSize: '0.85rem' }}>
                          Modification · <kbd>Échap</kbd> pour annuler
                        </span>
                        <div className="row" style={{ flexWrap: 'wrap' }}>
                          <div style={{ flex: '1 1 180px' }}>
                            <label htmlFor={`rem-edit-kind-${r.id}`}>Type</label>
                            <select
                              id={`rem-edit-kind-${r.id}`}
                              value={editKind}
                              onChange={(e) => setEditKind(e.target.value as ReminderKind)}
                            >
                              <option value="contact">{reminderKindLabel.contact}</option>
                              <option value="visit">{reminderKindLabel.visit}</option>
                              <option value="appointment">{reminderKindLabel.appointment}</option>
                              <option value="other">{reminderKindLabel.other}</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label htmlFor={`rem-edit-title-${r.id}`}>Titre</label>
                          <input
                            id={`rem-edit-title-${r.id}`}
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            required
                            maxLength={200}
                            autoFocus
                          />
                        </div>
                        <div>
                          <label htmlFor={`rem-edit-body-${r.id}`}>Détail</label>
                          <textarea
                            id={`rem-edit-body-${r.id}`}
                            value={editBody}
                            onChange={(e) => setEditBody(e.target.value)}
                            maxLength={2000}
                            rows={3}
                          />
                        </div>
                        <div className="row" style={{ flexWrap: 'wrap' }}>
                          <div style={{ flex: '1 1 160px' }}>
                            <label htmlFor={`rem-edit-due-${r.id}`}>Échéance</label>
                            <input
                              id={`rem-edit-due-${r.id}`}
                              type="datetime-local"
                              value={editDue}
                              onChange={(e) => setEditDue(e.target.value)}
                            />
                          </div>
                          <div style={{ flex: '1 1 220px' }}>
                            <label htmlFor={`rem-edit-place-${r.id}`}>Lieu</label>
                            <input
                              id={`rem-edit-place-${r.id}`}
                              value={editPlace}
                              onChange={(e) => setEditPlace(e.target.value)}
                              placeholder="ex. Nom du garage, ville…"
                              maxLength={200}
                            />
                          </div>
                          <div style={{ flex: '1 1 220px' }}>
                            <label htmlFor={`rem-edit-cand-${r.id}`}>Lié à un modèle</label>
                            <select
                              id={`rem-edit-cand-${r.id}`}
                              value={editCandId}
                              onChange={(e) => setEditCandId(e.target.value)}
                            >
                              <option value="">—</option>
                              {candidates.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {formatCandidateListLabel(c)}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="row icon-action-toolbar" style={{ flexWrap: 'wrap' }}>
                          <button type="submit" disabled={savingEdit}>
                            {savingEdit ? 'Enregistrement…' : 'Enregistrer'}
                          </button>
                          <IconActionButton
                            variant="secondary"
                            label="Annuler la modification"
                            onClick={cancelEdit}
                            disabled={savingEdit}
                          >
                            <IconX />
                          </IconActionButton>
                        </div>
                      </form>
                    ) : (
                      <div className="row" style={{ justifyContent: 'space-between', gap: '0.75rem' }}>
                        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                          <div className="row" style={{ gap: '0.35rem', flexWrap: 'wrap' }}>
                            <span className="badge">{reminderKindLabel[k] ?? 'Rappel'}</span>
                            {overdue ? <span className="badge danger">En retard</span> : null}
                          </div>
                          <strong>{r.title}</strong>
                          {r.due_at ? <div className="muted">{fmtShortDateTimeFr(r.due_at)}</div> : null}
                          {(r.place ?? '').trim() ? (
                            <div className="muted" style={{ fontSize: '0.9rem' }}>
                              Lieu : {(r.place ?? '').trim()}
                            </div>
                          ) : null}
                          {linkedLabel ? (
                            <div className="muted" style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>
                              Modèle : {linkedLabel}
                            </div>
                          ) : null}
                          {r.body ? <p style={{ margin: '0.35rem 0 0' }}>{r.body}</p> : null}
                        </div>
                        <div className="row icon-action-toolbar">
                          {canWrite ? (
                            <>
                              <IconActionButton
                                variant="primary"
                                label={`Modifier le rappel « ${r.title} »`}
                                onClick={() => startEdit(r)}
                              >
                                <IconPencil />
                              </IconActionButton>
                              <IconActionButton
                                variant="secondary"
                                label={r.done ? 'Rouvrir ce rappel' : 'Marquer comme fait'}
                                onClick={() => void toggle(r)}
                              >
                                {r.done ? <IconRotateCcw /> : <IconCheck />}
                              </IconActionButton>
                              <IconActionButton
                                variant="danger"
                                label="Supprimer ce rappel"
                                onClick={() => void remove(r.id)}
                              >
                                <IconTrash />
                              </IconActionButton>
                            </>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
