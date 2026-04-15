import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { activityActionLabel, activityEntityLabel } from '../../lib/activityLogLabels'
import { useErrorDialog } from '../../contexts/ErrorDialogContext'

type Row = {
  id: string
  action_type: string
  entity_type: string
  entity_id: string | null
  created_at: string
  user_id: string | null
  metadata: unknown
}

function localDayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dayKeyFromIso(iso: string): string {
  return localDayKey(new Date(iso))
}

function formatActivityDayHeading(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const k = dayKeyFromIso(iso)
  if (k === localDayKey(today)) return "Aujourd'hui"
  if (k === localDayKey(yesterday)) return 'Hier'
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const ACTIVITY_PAGE_LIMIT = 120

export function ActivityTab({ workspaceId }: { workspaceId: string }) {
  const { reportException } = useErrorDialog()
  const [rows, setRows] = useState<Row[]>([])
  const [names, setNames] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('activity_log')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(ACTIVITY_PAGE_LIMIT)
      if (cancelled) return
      if (error) {
        reportException(error, 'Chargement du journal d’activité')
        return
      }
      const list = (data ?? []) as Row[]
      setRows(list)
      const ids = [...new Set(list.map((r) => r.user_id).filter(Boolean))] as string[]
      if (ids.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', ids)
        const map: Record<string, string> = {}
        for (const p of profs ?? []) map[p.id] = p.display_name
        setNames(map)
      } else {
        setNames({})
      }
    })()
    const ch = supabase
      .channel(`act-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_log',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          const row = payload.new as Row
          setRows((prev) => [row, ...prev].slice(0, ACTIVITY_PAGE_LIMIT))
        }
      )
      .subscribe()
    return () => {
      cancelled = true
      void supabase.removeChannel(ch)
    }
  }, [workspaceId, reportException])

  const groups = useMemo(() => {
    const map = new Map<string, { heading: string; items: Row[] }>()
    for (const r of rows) {
      const key = dayKeyFromIso(r.created_at)
      const cur = map.get(key)
      if (cur) {
        cur.items.push(r)
      } else {
        map.set(key, { heading: formatActivityDayHeading(r.created_at), items: [r] })
      }
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [rows])

  return (
    <div className="stack activity-tab-page">
      <header className="activity-tab-header">
        <h2 className="activity-tab-title">Activité et historique</h2>
        <p className="muted activity-tab-lead">
          Actions récentes sur ce dossier (créations, modifications, partage…). Les nouvelles
          entrées s’affichent en temps réel.
        </p>
        {rows.length > 0 ? (
          <p className="muted activity-tab-meta" role="status">
            {rows.length} événement{rows.length > 1 ? 's' : ''} affiché{rows.length > 1 ? 's' : ''} — jusqu’à{' '}
            {ACTIVITY_PAGE_LIMIT} au maximum.
          </p>
        ) : null}
      </header>

      {rows.length === 0 ? (
        <div className="empty-state activity-tab-empty">
          <p className="muted activity-tab-empty-text">
            Aucun événement pour l’instant. Dès que vous ou d’autres membres agirez dans le dossier,
            le détail apparaîtra ici avec la date et l’auteur.
          </p>
        </div>
      ) : (
        <ul className="activity-timeline">
          {groups.map(([dayKey, { heading, items }]) => (
            <li key={dayKey} className="activity-day-group stack">
              <h3 className="activity-day-heading">{heading}</h3>
              <ul className="activity-day-list">
                {items.map((r) => {
                  const who = r.user_id
                    ? (names[r.user_id] ?? r.user_id.slice(0, 8))
                    : 'Système'
                  const timeStr = new Date(r.created_at).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                  const action = activityActionLabel(r.action_type)
                  const entity = activityEntityLabel(r.entity_type)
                  const idBit = r.entity_id ? ` · ${r.entity_id.slice(0, 8)}…` : ''
                  const titleTip = `${timeStr} · ${who} · ${action} — ${entity}${idBit}`
                  return (
                    <li key={r.id} className="activity-entry" title={titleTip}>
                      <time className="activity-entry-time" dateTime={r.created_at}>
                        {timeStr}
                      </time>
                      <span className="activity-entry-main">
                        <strong className="activity-entry-who">{who}</strong>
                        <span className="activity-entry-sep" aria-hidden="true">
                          ·
                        </span>
                        <span className="activity-entry-action">{action}</span>
                        <span className="activity-entry-entity muted">
                          <span className="activity-entry-sep" aria-hidden="true">
                            ·
                          </span>
                          {entity}
                          {r.entity_id ? (
                            <span className="activity-entry-id">{idBit}</span>
                          ) : null}
                        </span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
