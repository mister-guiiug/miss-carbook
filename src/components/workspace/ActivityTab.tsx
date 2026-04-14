import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
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
        .limit(120)
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
          setRows((prev) => [row, ...prev].slice(0, 120))
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
    <div className="stack">
      <p className="muted">Journal des actions récentes (temps réel pour les nouvelles entrées).</p>
      {rows.length === 0 ? (
        <div className="empty-state">
          <p className="muted" style={{ margin: 0 }}>
            Aucune entrée pour l’instant. Les actions (ajouts, votes, invitations…) apparaîtront ici
            au fil de l’usage du dossier.
          </p>
        </div>
      ) : (
        <ul className="activity-timeline" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {groups.map(([dayKey, { heading, items }]) => (
            <li key={dayKey} className="stack activity-day-group">
              <h3 className="activity-day-heading">{heading}</h3>
              <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {items.map((r) => (
                  <li key={r.id} className="card" style={{ boxShadow: 'none' }}>
                    <div className="muted">
                      {new Date(r.created_at).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      ·{' '}
                      <strong>
                        {r.user_id ? (names[r.user_id] ?? r.user_id.slice(0, 8)) : 'Système'}
                      </strong>
                    </div>
                    <div>
                      {r.action_type} · {r.entity_type}
                      {r.entity_id ? ` · ${r.entity_id.slice(0, 8)}…` : null}
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
