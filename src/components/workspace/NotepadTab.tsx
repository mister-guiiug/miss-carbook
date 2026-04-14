import { useEffect, useRef, useState } from 'react'
import {
  WORKSPACE_QUICK_ADD_EVENT,
  type WorkspaceQuickAddDetail,
} from '../../lib/workspaceHeaderEvents'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activity'
import { useErrorDialog } from '../../contexts/ErrorDialogContext'
import { useToast } from '../../contexts/ToastContext'

const LOCK_MS = 90_000

export function NotepadTab({ workspaceId, canWrite }: { workspaceId: string; canWrite: boolean }) {
  const { reportException } = useErrorDialog()
  const { showToast } = useToast()
  const [body, setBody] = useState('')
  const [noteId, setNoteId] = useState<string | null>(null)
  const [lockUser, setLockUser] = useState<string | null>(null)
  const [lockExp, setLockExp] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [myId, setMyId] = useState<string | null>(null)
  const lockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const applyRow = (row: {
    id: string
    body?: string
    edit_lock_user_id?: string | null
    edit_lock_expires_at?: string | null
  }) => {
    setNoteId(row.id)
    if (row.body !== undefined) setBody(row.body ?? '')
    setLockUser(row.edit_lock_user_id ?? null)
    setLockExp(row.edit_lock_expires_at ?? null)
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!cancelled) setMyId(user?.id ?? null)
      const { data, error } = await supabase
        .from('notes')
        .select('id, body, edit_lock_user_id, edit_lock_expires_at')
        .eq('workspace_id', workspaceId)
        .maybeSingle()
      if (cancelled) return
      if (error) {
        reportException(error, 'Chargement du bloc-notes')
        return
      }
      if (data) {
        applyRow(data)
        return
      }
      if (canWrite) {
        const ins = await supabase
          .from('notes')
          .insert({ workspace_id: workspaceId })
          .select('id, body, edit_lock_user_id, edit_lock_expires_at')
          .single()
        if (!cancelled && !ins.error && ins.data) applyRow(ins.data)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [workspaceId, canWrite, reportException])

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
          const row = payload.new as {
            id?: string
            body?: string
            edit_lock_user_id?: string | null
            edit_lock_expires_at?: string | null
          }
          if (row.id) applyRow(row as Parameters<typeof applyRow>[0])
        }
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [workspaceId])

  const renewLock = async () => {
    if (!canWrite || !noteId || !myId) return
    const exp = new Date(Date.now() + LOCK_MS).toISOString()
    await supabase
      .from('notes')
      .update({ edit_lock_user_id: myId, edit_lock_expires_at: exp })
      .eq('id', noteId)
  }

  const clearLock = async () => {
    if (!canWrite || !noteId || !myId) return
    await supabase
      .from('notes')
      .update({ edit_lock_user_id: null, edit_lock_expires_at: null })
      .eq('id', noteId)
      .eq('edit_lock_user_id', myId)
  }

  const stopLockTimer = () => {
    if (lockTimerRef.current) {
      clearInterval(lockTimerRef.current)
      lockTimerRef.current = null
    }
  }

  const startLockTimer = () => {
    stopLockTimer()
    void renewLock()
    lockTimerRef.current = setInterval(() => void renewLock(), 25_000)
  }

  const onFocus = () => {
    if (canWrite) startLockTimer()
  }

  const onBlur = () => {
    stopLockTimer()
    void clearLock()
  }

  useEffect(() => {
    return () => {
      stopLockTimer()
    }
  }, [])

  useEffect(() => {
    const onQuick = (ev: Event) => {
      const d = (ev as CustomEvent<WorkspaceQuickAddDetail>).detail
      if (d?.tab !== 'notepad') return
      requestAnimationFrame(() => {
        document
          .querySelector<HTMLTextAreaElement>('[data-workspace-focus="notepad-body"]')
          ?.focus()
      })
    }
    window.addEventListener(WORKSPACE_QUICK_ADD_EVENT, onQuick)
    return () => window.removeEventListener(WORKSPACE_QUICK_ADD_EVENT, onQuick)
  }, [])

  const lockedByOther =
    lockUser && lockUser !== myId && lockExp && new Date(lockExp) > new Date() && canWrite

  const save = async () => {
    if (!canWrite || !noteId || lockedByOther) return
    setBusy(true)
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
      showToast('Bloc-notes enregistré')
    } catch (e: unknown) {
      reportException(e, 'Sauvegarde du bloc-notes')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <p className="muted">
        Bloc-notes partagé — <strong>last-write-wins</strong> : la dernière sauvegarde remplace le
        contenu côté serveur pour tout le monde. Verrou léger pendant la frappe (~90 s, renouvelé
        tant que le champ est focalisé) pour signaler une édition en cours.
      </p>
      {lockedByOther ? (
        <p className="error">
          Un autre participant semble éditer le bloc-notes (verrou actif). Vous pouvez toujours
          forcer l’enregistrement au risque d’écraser.
        </p>
      ) : null}
      <textarea
        data-workspace-focus="notepad-body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={!canWrite}
        onFocus={onFocus}
        onBlur={onBlur}
      />
      <div className="row">
        <button type="button" onClick={() => void save()} disabled={!canWrite || busy || !noteId}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {!canWrite ? <span className="muted">Lecture seule</span> : null}
      </div>
    </div>
  )
}
