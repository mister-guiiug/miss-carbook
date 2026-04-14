import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activity'
import { useErrorDialog } from '../../contexts/ErrorDialogContext'

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
  const [rows, setRows] = useState<Row[]>([])
  const [candidates, setCandidates] = useState<{ id: string; label: string }[]>([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [due, setDue] = useState('')
  const [candId, setCandId] = useState('')

  const load = async () => {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('due_at', { ascending: true, nullsFirst: false })
    if (error) reportException(error, 'Chargement des rappels')
    else setRows((data ?? []) as Row[])
  }

  useEffect(() => {
    void load()
    void (async () => {
      const { data } = await supabase
        .from('candidates')
        .select('id, brand, model')
        .eq('workspace_id', workspaceId)
      setCandidates(
        (data ?? []).map((c) => ({
          id: c.id,
          label: `${c.brand} ${c.model}`.trim(),
        }))
      )
    })()
  }, [workspaceId])

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
    }
  }

  const toggle = async (r: Row) => {
    if (!canWrite) return
    const { error } = await supabase.from('reminders').update({ done: !r.done }).eq('id', r.id)
    if (error) reportException(error, 'Mise à jour d’un rappel (fait / rouvrir)')
    else await load()
  }

  const remove = async (id: string) => {
    if (!canWrite || !confirm('Supprimer ce rappel ?')) return
    const { error } = await supabase.from('reminders').delete().eq('id', id)
    if (error) reportException(error, 'Suppression d’un rappel')
    else await load()
  }

  return (
    <div className="stack">
      <p className="muted">Prochains essais, relances garage, échéances — visibles par tous les membres.</p>

      {canWrite ? (
        <form onSubmit={add} className="card stack" style={{ boxShadow: 'none' }}>
          <h3 style={{ margin: 0 }}>Nouveau rappel</h3>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre" required />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Détail (optionnel)" />
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
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit">Ajouter</button>
        </form>
      ) : null}

      <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {rows.map((r) => (
          <li key={r.id} className="card" style={{ boxShadow: 'none', opacity: r.done ? 0.65 : 1 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <strong>{r.title}</strong>
                {r.due_at ? (
                  <div className="muted">{new Date(r.due_at).toLocaleString('fr-FR')}</div>
                ) : null}
                {r.body ? <p style={{ margin: '0.35rem 0 0' }}>{r.body}</p> : null}
              </div>
              <div className="row">
                {canWrite ? (
                  <>
                    <button type="button" className="secondary" onClick={() => void toggle(r)}>
                      {r.done ? 'Rouvrir' : 'Fait'}
                    </button>
                    <button type="button" className="secondary" onClick={() => void remove(r.id)}>
                      Supprimer
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
