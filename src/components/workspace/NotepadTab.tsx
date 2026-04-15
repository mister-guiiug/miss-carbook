import { useEffect, useMemo, useRef, useState } from 'react'
import {
  WORKSPACE_QUICK_ADD_EVENT,
  type WorkspaceQuickAddDetail,
} from '../../lib/workspaceHeaderEvents'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activity'
import { useErrorDialog } from '../../contexts/ErrorDialogContext'
import { IconActionButton, IconSave } from '../ui/IconActionButton'
import { useToast } from '../../contexts/ToastContext'

type UserNoteRow = {
  workspace_id: string
  user_id: string
  body: string
  updated_at: string
}

export function NotepadTab({ workspaceId, canWrite }: { workspaceId: string; canWrite: boolean }) {
  const { reportException } = useErrorDialog()
  const { showToast } = useToast()
  const [myId, setMyId] = useState<string | null>(null)
  const [members, setMembers] = useState<{ user_id: string; display_name: string }[]>([])
  const [rows, setRows] = useState<UserNoteRow[]>([])
  const [bodies, setBodies] = useState<Record<string, string>>({})
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const focusRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!cancelled) setMyId(user?.id ?? null)
    })()
    return () => {
      cancelled = true
    }
  }, [workspaceId, canWrite, reportException])

  useEffect(() => {
    const ch = supabase
      .channel(`user-notes-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_notes',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          const row = payload.new as Partial<UserNoteRow>
          if (!row.user_id) return
          setRows((prev) => {
            const next = prev.filter((x) => x.user_id !== row.user_id)
            if (payload.eventType !== 'DELETE' && row.workspace_id && row.updated_at) {
              next.push(row as UserNoteRow)
            }
            return next
          })
          if (row.body != null)
            setBodies((b) => ({ ...b, [row.user_id as string]: String(row.body) }))
        }
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [workspaceId])

  useEffect(() => {
    const onQuick = (ev: Event) => {
      const d = (ev as CustomEvent<WorkspaceQuickAddDetail>).detail
      if (d?.tab !== 'notepad') return
      requestAnimationFrame(() => {
        focusRef.current?.focus()
      })
    }
    window.addEventListener(WORKSPACE_QUICK_ADD_EVENT, onQuick)
    return () => window.removeEventListener(WORKSPACE_QUICK_ADD_EVENT, onQuick)
  }, [])

  const rowsByUser = useMemo(() => {
    const m = new Map<string, UserNoteRow>()
    for (const r of rows) m.set(r.user_id, r)
    return m
  }, [rows])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data: mems, error } = await supabase
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', workspaceId)
      if (cancelled) return
      if (error) {
        reportException(error, 'Chargement des membres du dossier')
        return
      }
      const ids = (mems ?? []).map((m) => (m as { user_id: string }).user_id)
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', ids)
      const names: Record<string, string> = {}
      for (const p of profs ?? [])
        names[(p as { id: string }).id] = (p as { display_name: string }).display_name
      setMembers(ids.map((id) => ({ user_id: id, display_name: names[id] ?? id.slice(0, 8) })))

      const { data: notes, error: notesErr } = await supabase
        .from('user_notes')
        .select('workspace_id, user_id, body, updated_at')
        .eq('workspace_id', workspaceId)
        .order('updated_at', { ascending: false })
      if (cancelled) return
      if (notesErr) {
        reportException(notesErr, 'Chargement des notes')
        return
      }
      const list = (notes ?? []) as UserNoteRow[]
      setRows(list)
      setBodies((prev) => {
        const next = { ...prev }
        for (const r of list) next[r.user_id] = r.body ?? ''
        return next
      })

      // Ouvrir par défaut ma note si présente, sinon la première.
      setOpen((prev) => {
        if (Object.keys(prev).length) return prev
        const next: Record<string, boolean> = {}
        if (myId) next[myId] = true
        return next
      })
    })()
    return () => {
      cancelled = true
    }
  }, [workspaceId, reportException, myId])

  const saveMyNote = async () => {
    if (!canWrite || !myId) return
    setBusyUserId(myId)
    try {
      const body = (bodies[myId] ?? '').toString()
      const existing = rowsByUser.get(myId)
      if (existing) {
        const { error } = await supabase
          .from('user_notes')
          .update({ body })
          .eq('workspace_id', workspaceId)
          .eq('user_id', myId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('user_notes').insert({
          workspace_id: workspaceId,
          user_id: myId,
          body,
        })
        if (error) throw error
      }
      await logActivity(workspaceId, 'user_note.update', 'user_note', null, { chars: body.length })
      showToast('Note enregistrée')
    } catch (e: unknown) {
      reportException(e, 'Sauvegarde de la note')
    } finally {
      setBusyUserId(null)
    }
  }

  return (
    <div className="stack">
      <p className="muted">
        Chaque participant a son propre bloc-notes. Vous pouvez consulter les notes des autres
        utilisateurs et réduire/agrandir chaque section.
      </p>

      <div className="stack">
        {members.map((m) => {
          const isMe = myId === m.user_id
          const isOpen = Boolean(open[m.user_id])
          const value = bodies[m.user_id] ?? rowsByUser.get(m.user_id)?.body ?? ''
          const updatedAt = rowsByUser.get(m.user_id)?.updated_at ?? null
          return (
            <div
              key={m.user_id}
              className="card stack notepad-accordion-item"
              style={{ boxShadow: 'none' }}
            >
              <button
                type="button"
                className="row notepad-accordion-header"
                aria-expanded={isOpen}
                onClick={() => setOpen((o) => ({ ...o, [m.user_id]: !isOpen }))}
              >
                <div style={{ minWidth: 0 }}>
                  <strong>{m.display_name}</strong>{' '}
                  {isMe ? <span className="badge">Moi</span> : null}
                  {updatedAt ? (
                    <div className="muted" style={{ fontSize: '0.85rem' }}>
                      Modifié : {new Date(updatedAt).toLocaleString('fr-FR')}
                    </div>
                  ) : (
                    <div className="muted" style={{ fontSize: '0.85rem' }}>
                      Aucune note
                    </div>
                  )}
                </div>
                <span className="muted">{isOpen ? 'Réduire' : 'Afficher'}</span>
              </button>

              {isOpen ? (
                <div className="stack">
                  <textarea
                    ref={isMe ? (el) => (focusRef.current = el) : undefined}
                    data-workspace-focus={isMe ? 'notepad-body' : undefined}
                    value={value}
                    onChange={(e) => setBodies((b) => ({ ...b, [m.user_id]: e.target.value }))}
                    disabled={!canWrite || !isMe}
                    placeholder={isMe ? 'Votre note…' : '—'}
                  />
                  {isMe ? (
                    <div className="row icon-action-toolbar">
                      <IconActionButton
                        variant="primary"
                        label={busyUserId ? 'Enregistrement en cours…' : 'Enregistrer ma note'}
                        disabled={!canWrite || busyUserId !== null}
                        onClick={() => void saveMyNote()}
                      >
                        <IconSave />
                      </IconActionButton>
                      {!canWrite ? <span className="muted">Lecture seule</span> : null}
                    </div>
                  ) : (
                    <div className="muted" style={{ fontSize: '0.85rem' }}>
                      Lecture seule
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
