import { useCallback, useEffect, useState } from 'react'
import {
  WORKSPACE_QUICK_ADD_EVENT,
  type WorkspaceQuickAddDetail,
} from '../../lib/workspaceHeaderEvents'
import { formatCandidateListLabel } from '../../lib/candidateLabel'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activity'
import { useErrorDialog } from '../../contexts/ErrorDialogContext'
import { useToast } from '../../contexts/ToastContext'
import { IconActionButton, IconCheck, IconRotateCcw, IconTrash } from '../ui/IconActionButton'

type Row = {
  id: string
  title: string
  body: string
  due_at: string | null
  done: boolean
  candidate_id: string | null
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
  const [candidates, setCandidates] = useState<
    { id: string; brand: string; model: string; trim: string; parent_candidate_id: string | null }[]
  >([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [due, setDue] = useState('')
  const [candId, setCandId] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('due_at', { ascending: true, nullsFirst: false })
    if (error) reportException(error, 'Chargement des rappels')
    else setRows((data ?? []) as Row[])

    const { data: cand } = await supabase
      .from('candidates')
      .select('id, brand, model, trim, parent_candidate_id')
      .eq('workspace_id', workspaceId)
    setCandidates(
      (cand ?? []).map((c) => ({
        id: c.id,
        brand: c.brand,
        model: c.model,
        trim: c.trim ?? '',
        parent_candidate_id: c.parent_candidate_id ?? null,
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
      requestAnimationFrame(() => {
        document.getElementById('reminder-title')?.focus()
      })
    }
    window.addEventListener(WORKSPACE_QUICK_ADD_EVENT, onQuick)
    return () => window.removeEventListener(WORKSPACE_QUICK_ADD_EVENT, onQuick)
  }, [])

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canWrite || !title.trim()) return
    const { error } = await supabase.from('reminders').insert({
      workspace_id: workspaceId,
      title: title.trim(),
      body: body.trim(),
      due_at: due ? new Date(due).toISOString() : null,
      candidate_id: candId || null,
    })
    if (error) reportException(error, 'Création d’un rappel')
    else {
      setTitle('')
      setBody('')
      setDue('')
      setCandId('')
      await load()
      await logActivity(workspaceId, 'reminder.create', 'reminder', null, {})
      showToast('Rappel ajouté')
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
      await load()
      showToast('Rappel supprimé')
    }
  }

  return (
    <div className="stack">
      <p className="muted">
        Prochains essais, relances garage, échéances — visibles par tous les membres.
      </p>

      {canWrite ? (
        <form onSubmit={add} className="card stack" style={{ boxShadow: 'none' }}>
          <h3 style={{ margin: 0 }}>Nouveau rappel</h3>
          <input
            id="reminder-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre"
            required
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Détail (optionnel)"
          />
          <div className="row">
            <div style={{ flex: '1 1 160px' }}>
              <label>Échéance</label>
              <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
            <div style={{ flex: '1 1 200px' }}>
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
          <button type="submit">Ajouter</button>
        </form>
      ) : null}

      {rows.length === 0 ? (
        <div className="empty-state">
          <p className="muted" style={{ margin: 0 }}>
            Aucun rappel pour ce dossier. Créez-en un ci-dessus pour suivre essais, relances ou
            échéances.
          </p>
        </div>
      ) : (
        <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {rows.map((r) => (
            <li
              key={r.id}
              className="card"
              style={{ boxShadow: 'none', opacity: r.done ? 0.65 : 1 }}
            >
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <strong>{r.title}</strong>
                  {r.due_at ? (
                    <div className="muted">{new Date(r.due_at).toLocaleString('fr-FR')}</div>
                  ) : null}
                  {r.body ? <p style={{ margin: '0.35rem 0 0' }}>{r.body}</p> : null}
                </div>
                <div className="row icon-action-toolbar">
                  {canWrite ? (
                    <>
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
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
