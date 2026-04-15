import { useEffect, useMemo, useRef, useState } from 'react'
import { formatCandidateListLabel } from '../lib/candidateLabel'
import { supabase } from '../lib/supabase'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { IconActionButton, IconX } from './ui/IconActionButton'

type Item = { type: string; label: string; tab: string; hint?: string }

export function WorkspaceSearchModal({
  workspaceId,
  open,
  onClose,
  onPick,
}: {
  workspaceId: string
  open: boolean
  onClose: () => void
  onPick: (tab: string) => void
}) {
  const [q, setQ] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const panelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(panelRef, open)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      const [req, cand, rem, visits] = await Promise.all([
        supabase.from('requirements').select('id, label').eq('workspace_id', workspaceId),
        supabase
          .from('candidates')
          .select('id, brand, model, trim, parent_candidate_id')
          .eq('workspace_id', workspaceId),
        supabase
          .from('reminders')
          .select('id, title')
          .eq('workspace_id', workspaceId)
          .eq('done', false),
        supabase
          .from('visits')
          .select('id, location, visit_at')
          .eq('workspace_id', workspaceId)
          .order('visit_at', { ascending: false })
          .limit(40),
      ])
      if (cancelled) return
      const list: Item[] = []
      for (const r of req.data ?? [])
        list.push({ type: 'Exigence', label: r.label, tab: 'requirements', hint: r.id.slice(0, 8) })
      for (const c of cand.data ?? [])
        list.push({
          type: 'Modèle',
          label: formatCandidateListLabel({
            brand: c.brand,
            model: c.model,
            trim: c.trim ?? '',
            parent_candidate_id: c.parent_candidate_id ?? null,
          }),
          tab: 'candidates',
          hint: c.id.slice(0, 8),
        })
      for (const r of rem.data ?? [])
        list.push({ type: 'Rappel', label: r.title, tab: 'reminders', hint: r.id.slice(0, 8) })
      for (const v of visits.data ?? []) {
        const dt = (v as { visit_at: string }).visit_at
        const loc = ((v as { location?: string | null }).location ?? '').trim()
        const label = loc ? `${loc} · ${new Date(dt).toLocaleDateString('fr-FR')}` : new Date(dt).toLocaleDateString('fr-FR')
        list.push({ type: 'Visite', label, tab: 'reminders', hint: (v as { id: string }).id.slice(0, 8) })
      }
      setItems(list)
    })()
    return () => {
      cancelled = true
    }
  }, [open, workspaceId])

  useEffect(() => {
    if (!open) setQ('')
  }, [open])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return items.slice(0, 40)
    return items
      .filter((i) => i.label.toLowerCase().includes(s) || i.type.toLowerCase().includes(s))
      .slice(0, 40)
  }, [items, q])

  if (!open) return null

  return (
    <div
      className="search-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Recherche dossier"
    >
      <div ref={panelRef} className="search-modal card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <strong>Recherche dans le dossier</strong>
          <IconActionButton variant="secondary" label="Fermer la recherche" onClick={onClose}>
            <IconX />
          </IconActionButton>
        </div>
        <input
          autoFocus
          placeholder="Exigence, modèle, rappel, visite…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <ul className="search-modal-list">
          {filtered.map((i) => (
            <li key={`${i.type}-${i.hint}`}>
              <button
                type="button"
                className="search-modal-item"
                onClick={() => {
                  onPick(i.tab)
                  onClose()
                }}
              >
                <span className="badge">{i.type}</span> {i.label}
              </button>
            </li>
          ))}
        </ul>
        <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
          Raccourci : Ctrl+K
        </p>
      </div>
    </div>
  )
}
