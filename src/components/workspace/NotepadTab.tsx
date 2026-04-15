import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import {
  WORKSPACE_QUICK_ADD_EVENT,
  type WorkspaceQuickAddDetail,
} from '../../lib/workspaceHeaderEvents'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activity'
import { useErrorDialog } from '../../contexts/ErrorDialogContext'
import { IconActionButton, IconGripVertical, IconSave } from '../ui/IconActionButton'
import { useToast } from '../../contexts/ToastContext'

type UserNoteRow = {
  workspace_id: string
  user_id: string
  body: string
  updated_at: string
  peer_order?: string[] | null
}

type Member = { user_id: string; display_name: string }

export function NotepadTab({ workspaceId, canWrite }: { workspaceId: string; canWrite: boolean }) {
  const { reportException } = useErrorDialog()
  const { showToast } = useToast()
  const [myId, setMyId] = useState<string | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [rows, setRows] = useState<UserNoteRow[]>([])
  const [bodies, setBodies] = useState<Record<string, string>>({})
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const focusRef = useRef<HTMLTextAreaElement | null>(null)

  const [peerOrderOverride, setPeerOrderOverride] = useState<string[] | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)

  useEffect(() => {
    setPeerOrderOverride(null)
  }, [workspaceId])

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
              const prevRow = prev.find((x) => x.user_id === row.user_id)
              next.push({
                ...(prevRow ?? {}),
                ...row,
                body: row.body ?? prevRow?.body ?? '',
                peer_order: row.peer_order ?? prevRow?.peer_order ?? [],
              } as UserNoteRow)
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

  const peerOrderFromDb = useMemo(() => {
    if (!myId) return [] as string[]
    const r = rows.find((x) => x.user_id === myId)
    const po = r?.peer_order
    if (!Array.isArray(po)) return []
    return po.map((x) => String(x))
  }, [rows, myId])

  const peerOrder = peerOrderOverride ?? peerOrderFromDb

  const { myMember, orderedOthers } = useMemo(() => {
    const me = myId ? members.find((m) => m.user_id === myId) : undefined
    const others = myId ? members.filter((m) => m.user_id !== myId) : [...members]
    const idSet = new Set(others.map((m) => m.user_id))
    const ordered: Member[] = []
    for (const id of peerOrder) {
      if (!idSet.has(id)) continue
      const m = others.find((o) => o.user_id === id)
      if (m) ordered.push(m)
    }
    const rest = [...others].filter((m) => !ordered.some((o) => o.user_id === m.user_id))
    rest.sort((a, b) => a.display_name.localeCompare(b.display_name, 'fr-FR'))
    return { myMember: me, orderedOthers: [...ordered, ...rest] }
  }, [members, myId, peerOrder])

  const canReorderOthers = Boolean(canWrite && myId && orderedOthers.length > 1 && !reordering)

  const persistPeerOrder = useCallback(
    async (orderedIds: string[]) => {
      if (!canWrite || !myId) return
      setReordering(true)
      try {
        const existing = rowsByUser.get(myId)
        const bodyNow = (bodies[myId] ?? existing?.body ?? '').toString()
        if (existing) {
          const { error } = await supabase
            .from('user_notes')
            .update({ peer_order: orderedIds })
            .eq('workspace_id', workspaceId)
            .eq('user_id', myId)
          if (error) throw error
        } else {
          const { error } = await supabase.from('user_notes').insert({
            workspace_id: workspaceId,
            user_id: myId,
            body: bodyNow,
            peer_order: orderedIds,
          })
          if (error) throw error
        }
        setRows((prev) => {
          const rest = prev.filter((x) => x.user_id !== myId)
          const base = existing ?? {
            workspace_id: workspaceId,
            user_id: myId,
            body: bodyNow,
            updated_at: new Date().toISOString(),
          }
          return [...rest, { ...base, peer_order: orderedIds }]
        })
        setPeerOrderOverride(null)
        showToast('Ordre des notes mis à jour')
      } catch (e: unknown) {
        reportException(e, 'Enregistrement de l’ordre du bloc-notes')
      } finally {
        setReordering(false)
        setDraggingId(null)
        setDragOverId(null)
      }
    },
    [canWrite, myId, rowsByUser, bodies, workspaceId, reportException, showToast]
  )

  const onDropReorderOthers = useCallback(
    (targetId: string, draggedId: string, siblingIds: string[]) => {
      if (!canReorderOthers || draggedId === targetId) return
      const from = siblingIds.indexOf(draggedId)
      const to = siblingIds.indexOf(targetId)
      if (from === -1 || to === -1) return
      const next = [...siblingIds]
      next.splice(from, 1)
      next.splice(to, 0, draggedId)
      void persistPeerOrder(next)
    },
    [canReorderOthers, persistPeerOrder]
  )

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
        .select('workspace_id, user_id, body, updated_at, peer_order')
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
          peer_order: peerOrder,
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

  const dragHandlers = (m: Member, ro: { siblingIds: string[] } | undefined, canDrag: boolean) => ({
    onDragOver:
      canDrag && ro
        ? (e: DragEvent<HTMLDivElement>) => {
            if (![...e.dataTransfer.types].includes('text/plain')) return
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            setDragOverId(m.user_id)
          }
        : undefined,
    onDragLeave: canDrag
      ? (e: DragEvent<HTMLDivElement>) => {
          const next = e.relatedTarget as Node | null
          if (next && e.currentTarget.contains(next)) return
          setDragOverId((cur) => (cur === m.user_id ? null : cur))
        }
      : undefined,
    onDrop:
      canDrag && ro
        ? (e: DragEvent<HTMLDivElement>) => {
            e.preventDefault()
            const draggedId = e.dataTransfer.getData('text/plain')
            setDragOverId(null)
            if (draggedId) onDropReorderOthers(m.user_id, draggedId, ro.siblingIds)
          }
        : undefined,
  })

  const renderPeerInline = (
    m: Member,
    opts: {
      dragReorder?: { siblingIds: string[] }
    }
  ) => {
    const value = bodies[m.user_id] ?? rowsByUser.get(m.user_id)?.body ?? ''
    const updatedAt = rowsByUser.get(m.user_id)?.updated_at ?? null
    const ro = opts.dragReorder
    const canDrag = Boolean(ro && canReorderOthers)
    const trimmed = value.trim()
    const dateLabel = updatedAt
      ? new Date(updatedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
      : null

    return (
      <div
        key={m.user_id}
        className={`card stack notepad-peer-inline${
          canDrag && draggingId === m.user_id ? ' notepad-accordion-item--dragging' : ''
        }${canDrag && dragOverId === m.user_id ? ' notepad-accordion-item--drag-target' : ''}`}
        style={{ boxShadow: 'none' }}
        {...dragHandlers(m, ro, canDrag)}
      >
        <div className="row notepad-peer-inline-head">
          {canDrag ? (
            <button
              type="button"
              className="reorder-drag-handle"
              draggable
              aria-label={`Réordonner : ${m.display_name}`}
              title="Glisser pour réordonner"
              onDragStart={(e) => {
                setDraggingId(m.user_id)
                e.dataTransfer.setData('text/plain', m.user_id)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragEnd={() => {
                setDraggingId(null)
                setDragOverId(null)
              }}
            >
              <IconGripVertical />
            </button>
          ) : null}
          <div
            className="notepad-peer-inline-meta"
            role="group"
            aria-label={`Note partagée de ${m.display_name}`}
          >
            <span className="notepad-peer-inline-name">{m.display_name}</span>
            {dateLabel ? (
              <>
                <span className="notepad-peer-inline-sep muted" aria-hidden="true">
                  ·
                </span>
                <time className="notepad-peer-inline-date muted" dateTime={updatedAt ?? undefined}>
                  {dateLabel}
                </time>
              </>
            ) : null}
            <span className="notepad-peer-inline-ro muted">Lecture seule</span>
          </div>
        </div>
        <div
          className="notepad-peer-inline-body"
          tabIndex={0}
          role="region"
          aria-label={trimmed ? `Contenu de la note de ${m.display_name}` : 'Note vide'}
        >
          {trimmed ? (
            value
          ) : (
            <span className="notepad-peer-inline-empty muted">Pas encore de note</span>
          )}
        </div>
      </div>
    )
  }

  const renderMyAccordion = (
    m: Member,
    opts: {
      pinned: boolean
    }
  ) => {
    const isOpen = Boolean(open[m.user_id])
    const value = bodies[m.user_id] ?? rowsByUser.get(m.user_id)?.body ?? ''
    const updatedAt = rowsByUser.get(m.user_id)?.updated_at ?? null

    return (
      <div
        key={m.user_id}
        className={`card stack notepad-accordion-item${opts.pinned ? ' notepad-accordion-item--pinned' : ''}`}
        style={{ boxShadow: 'none' }}
      >
        <div className="row notepad-accordion-head-row">
          <button
            type="button"
            className="row notepad-accordion-header"
            style={{ flex: '1 1 auto', minWidth: 0 }}
            aria-expanded={isOpen}
            onClick={() => setOpen((o) => ({ ...o, [m.user_id]: !isOpen }))}
          >
            <span className="notepad-accordion-header-text">
              <strong className="notepad-accordion-name">{m.display_name}</strong>
              <span className="badge notepad-accordion-badge-moi">Moi</span>
              {opts.pinned ? (
                <span
                  className="muted notepad-accordion-pinned-hint"
                  title="Votre bloc reste toujours affiché en premier"
                >
                  1er
                </span>
              ) : null}
              <span className="muted notepad-accordion-status">
                <span className="notepad-accordion-status-sep" aria-hidden="true">
                  ·
                </span>
                {updatedAt
                  ? `Modifié ${new Date(updatedAt).toLocaleString('fr-FR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}`
                  : 'Aucune note'}
              </span>
            </span>
            <span className="muted notepad-accordion-toggle-label">
              {isOpen ? 'Réduire' : 'Afficher'}
            </span>
          </button>
        </div>

        {isOpen ? (
          <div className="stack">
            <textarea
              ref={(el) => {
                focusRef.current = el
              }}
              data-workspace-focus="notepad-body"
              value={value}
              onChange={(e) => setBodies((b) => ({ ...b, [m.user_id]: e.target.value }))}
              disabled={!canWrite}
              placeholder="Votre note…"
            />
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
          </div>
        ) : null}
      </div>
    )
  }

  const otherIds = orderedOthers.map((m) => m.user_id)

  return (
    <div className="stack">
      <p className="muted">
        Chaque participant a son propre bloc-notes. La vôtre reste <strong>en premier</strong> ; les
        notes des autres sont affichées <strong>tout de suite</strong> en dessous. Avec l’édition,
        vous pouvez <strong>réordonner les autres</strong> via la poignée (ordre enregistré sur
        votre compte).
      </p>

      <div className="stack notepad-tab-layout">
        {myMember ? renderMyAccordion(myMember, { pinned: true }) : null}
        {orderedOthers.length ? (
          <div className="notepad-peers-block stack">
            <h3 className="notepad-peers-heading">Autres participants</h3>
            <div className="notepad-peers-list">
              {orderedOthers.map((m) =>
                renderPeerInline(m, { dragReorder: { siblingIds: otherIds } })
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
