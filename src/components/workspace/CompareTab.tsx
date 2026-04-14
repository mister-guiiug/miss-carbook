import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { CandidateStatus, Json } from '../../types/database'

type Candidate = {
  id: string
  brand: string
  model: string
  trim: string
  engine: string
  price: number | null
  status: CandidateStatus
  candidate_specs: { specs: Json } | null
}

type Review = { candidate_id: string; score: number }

const CRITERIA: { key: string; label: string; path: 'root' | 'spec' }[] = [
  { key: 'price', label: 'Prix', path: 'root' },
  { key: 'scoreAvg', label: 'Note moyenne (0–10)', path: 'root' },
  { key: 'trunkLiters', label: 'Coffre (L)', path: 'spec' },
  { key: 'consumptionL100', label: 'Conso L/100', path: 'spec' },
  { key: 'consumptionKwh100', label: 'Conso kWh/100', path: 'spec' },
  { key: 'powerKw', label: 'Puissance kW', path: 'spec' },
  { key: 'lengthMm', label: 'Longueur mm', path: 'spec' },
  { key: 'co2Gkm', label: 'CO₂ g/km', path: 'spec' },
]

function download(filename: string, mime: string, text: string) {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function toCsv(rows: Record<string, string | number | null>[]) {
  if (!rows.length) return ''
  const keys = Object.keys(rows[0])
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  return [keys.join(','), ...rows.map((r) => keys.map((k) => esc(r[k])).join(','))].join('\n')
}

export function CompareTab({ workspaceId }: { workspaceId: string }) {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [criteria, setCriteria] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CRITERIA.map((c) => [c.key, true]))
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('candidates')
        .select('id, brand, model, trim, engine, price, status, candidate_specs ( specs )')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
      if (cancelled || error) return
      const list = (data ?? []) as unknown as Candidate[]
      setCandidates(list)
      const ids = list.map((c) => c.id)
      if (!ids.length) {
        setReviews([])
        return
      }
      const { data: revs } = await supabase
        .from('candidate_reviews')
        .select('candidate_id, score')
        .in('candidate_id', ids)
      if (!cancelled) setReviews(revs ?? [])
    })()
    return () => {
      cancelled = true
    }
  }, [workspaceId])

  useEffect(() => {
    setSelected((prev) => {
      const next = { ...prev }
      for (const c of candidates) if (next[c.id] === undefined) next[c.id] = false
      return next
    })
  }, [candidates])

  const avgByCand = useMemo(() => {
    const map: Record<string, { sum: number; n: number }> = {}
    for (const r of reviews) {
      if (!map[r.candidate_id]) map[r.candidate_id] = { sum: 0, n: 0 }
      map[r.candidate_id].sum += Number(r.score)
      map[r.candidate_id].n += 1
    }
    const out: Record<string, number | null> = {}
    for (const id of Object.keys(map)) {
      const { sum, n } = map[id]
      out[id] = n ? Math.round((sum / n) * 10) / 10 : null
    }
    return out
  }, [reviews])

  const picked = candidates.filter((c) => selected[c.id])

  const rows = useMemo(() => {
    return picked.map((c) => {
      const spec = (c.candidate_specs?.specs ?? {}) as Record<string, unknown>
      const row: Record<string, string | number | null> = {
        id: c.id,
        marque: c.brand,
        modele: c.model,
        finition: c.trim,
        motorisation: c.engine,
        statut: c.status,
      }
      for (const def of CRITERIA) {
        if (!criteria[def.key]) continue
        if (def.key === 'price') row[def.label] = c.price
        else if (def.key === 'scoreAvg') row[def.label] = avgByCand[c.id] ?? null
        else if (def.path === 'spec') {
          const v = spec[def.key]
          row[def.label] = typeof v === 'number' ? v : v != null ? String(v) : null
        }
      }
      return row
    })
  }, [picked, criteria, avgByCand])

  const toggleCand = (id: string) => setSelected((s) => ({ ...s, [id]: !s[id] }))
  const toggleCrit = (key: string) => setCriteria((s) => ({ ...s, [key]: !s[key] }))

  const exportJson = () => {
    download('comparaison.json', 'application/json', JSON.stringify(rows, null, 2))
  }
  const exportCsv = () => {
    download('comparaison.csv', 'text/csv;charset=utf-8', toCsv(rows))
  }

  return (
    <div className="stack">
      <p className="muted">
        Sélectionnez des modèles et les critères à comparer. Export JSON/CSV entièrement côté client.
      </p>

      <div className="card stack" style={{ boxShadow: 'none' }}>
        <h3 style={{ margin: 0 }}>Modèles</h3>
        <div className="stack">
          {candidates.map((c) => (
            <label key={c.id} className="row" style={{ gap: '0.5rem' }}>
              <input type="checkbox" checked={!!selected[c.id]} onChange={() => toggleCand(c.id)} />
              <span>
                {c.brand} {c.model} {c.trim ? `· ${c.trim}` : ''}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="card stack" style={{ boxShadow: 'none' }}>
        <h3 style={{ margin: 0 }}>Critères</h3>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {CRITERIA.map((c) => (
            <label key={c.key} className="row" style={{ gap: '0.35rem' }}>
              <input type="checkbox" checked={!!criteria[c.key]} onChange={() => toggleCrit(c.key)} />
              {c.label}
            </label>
          ))}
        </div>
      </div>

      <div className="row">
        <button type="button" className="secondary" onClick={exportJson} disabled={!rows.length}>
          Export JSON
        </button>
        <button type="button" className="secondary" onClick={exportCsv} disabled={!rows.length}>
          Export CSV
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {rows[0] ? Object.keys(rows[0]).map((k) => <th key={k}>{k}</th>) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)}>
                {Object.values(r).map((v, i) => (
                  <td key={i}>{v == null ? '' : String(v)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
