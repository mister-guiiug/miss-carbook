import { useEffect, useState } from 'react'
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
        const { data: profs } = await supabase.from('profiles').select('id, display_name').in('id', ids)
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

  return (
    <div className="stack">
      <p className="muted">Journal des actions récentes (temps réel pour les nouvelles entrées).</p>
      <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {rows.map((r) => (
          <li key={r.id} className="card" style={{ boxShadow: 'none' }}>
            <div className="muted">
              {new Date(r.created_at).toLocaleString('fr-FR')} ·{' '}
              <strong>{r.user_id ? names[r.user_id] ?? r.user_id.slice(0, 8) : 'Système'}</strong>
            </div>
            <div>
              {r.action_type} · {r.entity_type}
              {r.entity_id ? ` · ${r.entity_id.slice(0, 8)}…` : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
