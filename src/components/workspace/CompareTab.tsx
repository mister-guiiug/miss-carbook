import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatCandidateListLabel } from '../../lib/candidateLabel'
import { formatPriceEur } from '../../lib/formatPrice'
import { supabase } from '../../lib/supabase'
import { CRITERIA } from '../../lib/compareCriteria'
import { isCandidateSpecDimensionKey } from '../../lib/candidateSpecsUi'
import { formatGroupedIntegerFrDisplay } from '../../lib/formatGroupedIntegerFr'
import type { CandidateStatus, Json } from '../../types/database'
import { useToast } from '../../contexts/ToastContext'
import { useErrorDialog } from '../../contexts/ErrorDialogContext'
import {
  IconActionButton,
  IconJson,
  IconPrinter,
  IconSave,
  IconTable,
} from '../ui/IconActionButton'

const CompareTabRadar = lazy(() => import('./CompareTabRadar'))

type Candidate = {
  id: string
  brand: string
  model: string
  trim: string
  parent_candidate_id: string | null
  engine: string
  price: number | null
  status: CandidateStatus
  candidate_specs: { specs: Json } | null
  is_current?: boolean
}

type Review = { candidate_id: string; score: number }

type Preset = { id: string; name: string; criteria_keys: string[] }

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

export function CompareTab({ workspaceId, canWrite }: { workspaceId: string; canWrite: boolean }) {
  const { showToast } = useToast()
  const { reportException } = useErrorDialog()
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [currentVehicle, setCurrentVehicle] = useState<Candidate | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [criteria, setCriteria] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CRITERIA.map((c) => [c.key, true]))
  )
  const [presets, setPresets] = useState<Preset[]>([])
  const [presetName, setPresetName] = useState('')
  const printRef = useRef<HTMLDivElement>(null)

  const loadCandidates = useCallback(async () => {
    const { data, error } = await supabase
      .from('candidates')
      .select(
        'id, brand, model, trim, parent_candidate_id, engine, price, status, candidate_specs ( specs )'
      )
      .eq('workspace_id', workspaceId)
      .order('parent_candidate_id', { ascending: true, nullsFirst: true })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) {
      reportException(error, 'Chargement des modèles (comparer)')
      return
    }
    const list = (data ?? []).map((row) => ({
      ...(row as unknown as Candidate),
      parent_candidate_id:
        (row as { parent_candidate_id?: string | null }).parent_candidate_id ?? null,
    }))
    setCandidates(list)

    const { data: cvData } = await supabase
      .from('current_vehicle')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (cvData) {
      setCurrentVehicle({
        id: 'current',
        brand: cvData.brand,
        model: cvData.model,
        trim: '',
        parent_candidate_id: null,
        engine: cvData.engine,
        price: null,
        status: 'selected' as CandidateStatus,
        candidate_specs: { specs: cvData.specs },
        is_current: true,
      })
    } else {
      setCurrentVehicle(null)
    }

    const ids = list.map((c) => c.id)
    if (!ids.length) {
      setReviews([])
      return
    }
    const { data: revs } = await supabase
      .from('candidate_reviews')
      .select('candidate_id, score')
      .in('candidate_id', ids)
    setReviews(revs ?? [])
  }, [workspaceId, reportException])

  useEffect(() => {
    void loadCandidates()
  }, [loadCandidates])

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('comparison_presets')
        .select('id, name, criteria_keys')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
      setPresets((data ?? []) as Preset[])
    })()
  }, [workspaceId])

  useEffect(() => {
    setSelected((prev) => {
      const next = { ...prev }
      if (currentVehicle && next[currentVehicle.id] === undefined) next[currentVehicle.id] = true
      for (const c of candidates) if (next[c.id] === undefined) next[c.id] = false
      return next
    })
  }, [candidates, currentVehicle])

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

  const picked = useMemo(() => {
    const list = candidates.filter((c) => selected[c.id])
    if (currentVehicle && selected[currentVehicle.id]) {
      list.unshift(currentVehicle)
    }
    return list
  }, [candidates, currentVehicle, selected])

  const rows = useMemo(() => {
    return picked.map((c) => {
      const spec = (c.candidate_specs?.specs ?? {}) as Record<string, unknown>
      const row: Record<string, string | number | null> = {
        id: c.id,
        libellé: c.is_current ? 'Véhicule actuel' : formatCandidateListLabel(c),
        marque: c.brand,
        modele: c.model,
        finition: c.trim,
        motorisation: c.engine,
        statut: c.is_current ? 'Actuel' : c.status,
      }
      for (const def of CRITERIA) {
        if (!criteria[def.key]) continue
        if (def.key === 'price') row[def.label] = c.price != null ? formatPriceEur(c.price) : null
        else if (def.key === 'scoreAvg') row[def.label] = avgByCand[c.id] ?? null
        else if (def.path === 'spec') {
          const v = spec[def.key]
          if (typeof v === 'number' && isCandidateSpecDimensionKey(def.key)) {
            const s = formatGroupedIntegerFrDisplay(v)
            row[def.label] = s !== '' ? s : null
          } else {
            row[def.label] = typeof v === 'number' ? v : v != null ? String(v) : null
          }
        }
      }
      return row
    })
  }, [picked, criteria, avgByCand])

  const radarData = useMemo(() => {
    const keys = CRITERIA.filter((c) => criteria[c.key] && c.numeric).map((c) => c.key)
    if (picked.length < 2 || keys.length < 2) return []
    const raw: Record<string, Record<string, number>> = {}
    for (const p of picked) {
      raw[p.id] = {}
      const spec = (p.candidate_specs?.specs ?? {}) as Record<string, unknown>
      for (const k of keys) {
        let v = 0
        if (k === 'price') v = p.price ?? 0
        else if (k === 'scoreAvg') v = avgByCand[p.id] ?? 0
        else v = Number(spec[k]) || 0
        raw[p.id][k] = v
      }
    }
    const normKey = (k: string) => {
      const vals = picked.map((p) => raw[p.id][k])
      const min = Math.min(...vals)
      const max = Math.max(...vals)
      const span = max - min || 1
      return (p: Candidate) => (raw[p.id][k] - min) / span
    }
    return keys.map((k) => {
      const row: Record<string, string | number> = {
        subject: CRITERIA.find((c) => c.key === k)?.label ?? k,
      }
      for (const p of picked) row[p.id] = Math.round(normKey(k)(p) * 100)
      return row
    })
  }, [picked, criteria, avgByCand])

  const toggleCand = (id: string) => setSelected((s) => ({ ...s, [id]: !s[id] }))
  const toggleCrit = (key: string) => setCriteria((s) => ({ ...s, [key]: !s[key] }))

  const exportJson = () => {
    download('comparaison.json', 'application/json', JSON.stringify(rows, null, 2))
    showToast('Export JSON téléchargé')
  }
  const exportCsv = () => {
    download('comparaison.csv', 'text/csv;charset=utf-8', toCsv(rows))
    showToast('Export CSV téléchargé')
  }

  const savePreset = async () => {
    if (!canWrite || !presetName.trim()) return
    const keys = CRITERIA.filter((c) => criteria[c.key]).map((c) => c.key)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('comparison_presets').insert({
      workspace_id: workspaceId,
      name: presetName.trim(),
      criteria_keys: keys,
      created_by: user.id,
    })
    if (!error) {
      setPresetName('')
      const { data } = await supabase
        .from('comparison_presets')
        .select('id, name, criteria_keys')
        .eq('workspace_id', workspaceId)
      setPresets((data ?? []) as Preset[])
      showToast('Profil de critères enregistré')
    }
  }

  const applyPreset = (p: Preset) => {
    const set = new Set(p.criteria_keys)
    setCriteria(Object.fromEntries(CRITERIA.map((c) => [c.key, set.has(c.key)])))
    showToast(`Profil « ${p.name} » appliqué`)
  }

  const printCompare = () => {
    window.print()
  }

  return (
    <div className="stack compare-tab">
      <p className="muted">
        Profils de critères, graphique radar (valeurs normalisées), exports et impression.
      </p>

      <div className="card stack no-print" style={{ boxShadow: 'none' }}>
        <h3 style={{ margin: 0 }}>Profils enregistrés</h3>
        <div className="row" style={{ flexWrap: 'wrap', gap: '0.35rem' }}>
          {presets.map((p) => (
            <button key={p.id} type="button" className="secondary" onClick={() => applyPreset(p)}>
              {p.name}
            </button>
          ))}
        </div>
        {canWrite ? (
          <div className="row icon-action-toolbar" style={{ alignItems: 'center' }}>
            <input
              placeholder="Nom du profil"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              style={{ flex: 1 }}
            />
            <IconActionButton
              variant="primary"
              label="Enregistrer le profil de critères actuels"
              onClick={() => void savePreset()}
            >
              <IconSave />
            </IconActionButton>
          </div>
        ) : null}
      </div>

      <div className="card stack" style={{ boxShadow: 'none' }}>
        <h3 style={{ margin: 0 }}>Modèles</h3>
        {candidates.length === 0 && !currentVehicle ? (
          <div className="empty-state">
            <p className="muted" style={{ margin: 0 }}>
              Aucun modèle candidat pour l’instant. Ajoutez des véhicules dans l’onglet{' '}
              <strong>Modèles</strong> pour les comparer ici.
            </p>
          </div>
        ) : (
          <div className="stack">
            {currentVehicle && (
              <label key={currentVehicle.id} className="row" style={{ gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={!!selected[currentVehicle.id]}
                  onChange={() => toggleCand(currentVehicle.id)}
                />
                <strong>Véhicule actuel</strong> (référence)
              </label>
            )}
            {candidates.map((c) => (
              <label key={c.id} className="row" style={{ gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={!!selected[c.id]}
                  onChange={() => toggleCand(c.id)}
                />
                <span>{formatCandidateListLabel(c)}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="card stack" style={{ boxShadow: 'none' }}>
        <h3 style={{ margin: 0 }}>Critères</h3>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {CRITERIA.map((c) => (
            <label key={c.key} className="row" style={{ gap: '0.35rem' }}>
              <input
                type="checkbox"
                checked={!!criteria[c.key]}
                onChange={() => toggleCrit(c.key)}
              />
              {c.label}
            </label>
          ))}
        </div>
      </div>

      <div className="row no-print icon-action-toolbar">
        <IconActionButton
          variant="secondary"
          label="Exporter la comparaison en JSON"
          onClick={exportJson}
          disabled={!rows.length}
        >
          <IconJson />
        </IconActionButton>
        <IconActionButton
          variant="secondary"
          label="Exporter la comparaison en CSV"
          onClick={exportCsv}
          disabled={!rows.length}
        >
          <IconTable />
        </IconActionButton>
        <IconActionButton
          variant="secondary"
          label="Imprimer ou enregistrer en PDF"
          onClick={printCompare}
          disabled={!rows.length}
        >
          <IconPrinter />
        </IconActionButton>
      </div>

      <div ref={printRef} className="print-area">
        <h2 className="print-only">Comparaison Miss Carbook</h2>
        <div className="table-wrap compare-table-wrap">
          <table>
            <thead>
              <tr>{rows[0] ? Object.keys(rows[0]).map((k) => <th key={k}>{k}</th>) : null}</tr>
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

        {radarData.length >= 2 && picked.length >= 2 ? (
          <Suspense
            fallback={
              <p
                className="muted"
                style={{ minHeight: 320, display: 'flex', alignItems: 'center' }}
              >
                Chargement du graphique…
              </p>
            }
          >
            <CompareTabRadar radarData={radarData} picked={picked} />
          </Suspense>
        ) : (
          <p className="muted print-only">
            Graphique : sélectionnez au moins 2 modèles et critères numériques.
          </p>
        )}
      </div>
    </div>
  )
}
