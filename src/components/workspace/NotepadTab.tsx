import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activity'

export function NotepadTab({
  workspaceId,
  canWrite,
}: {
  workspaceId: string
  canWrite: boolean
}) {
  const [body, setBody] = useState('')
  const [noteId, setNoteId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('id, body')
        .eq('workspace_id', workspaceId)
        .maybeSingle()
      if (cancelled) return
      if (error) {
        setErr(error.message)
        return
      }
      if (data) {
        setNoteId(data.id)
        setBody(data.body ?? '')
        return
      }
      if (canWrite) {
        const ins = await supabase
          .from('notes')
          .insert({ workspace_id: workspaceId })
          .select('id, body')
          .single()
        if (!cancelled && !ins.error && ins.data) {
          setNoteId(ins.data.id)
          setBody(ins.data.body ?? '')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [workspaceId, canWrite])

  useEffect(() => {
    const ch = supabase
      .channel(`note-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          const row = payload.new as { id?: string; body?: string }
          if (row.id && row.body !== undefined) {
            setNoteId(row.id)
            setBody(row.body)
          }
        }
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [workspaceId])

  const save = async () => {
    if (!canWrite || !noteId) return
    setBusy(true)
    setErr(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('notes')
        .update({ body, updated_by: user?.id ?? null })
        .eq('id', noteId)
      if (error) throw error
      await logActivity(workspaceId, 'note.update', 'note', noteId, { chars: body.length })
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Sauvegarde impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <p className="muted">
        Bloc-notes partagé — stratégie <strong>last-write-wins</strong> ; les modifications apparaissent
        en temps réel (Supabase Realtime).
      </p>
      {err ? <p className="error">{err}</p> : null}
      <textarea value={body} onChange={(e) => setBody(e.target.value)} disabled={!canWrite} />
      <div className="row">
        <button type="button" onClick={() => void save()} disabled={!canWrite || busy || !noteId}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {!canWrite ? <span className="muted">Lecture seule</span> : null}
      </div>
    </div>
  )
}
