import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatCandidateListLabel } from '../../lib/candidateLabel'
import { supabase } from '../../lib/supabase'
import { useErrorDialog } from '../../contexts/ErrorDialogContext'
import { useToast } from '../../contexts/ToastContext'
import type { CandidateStatus, RequirementLevel } from '../../types/database'
import { EmptyState } from '../ui/EmptyState'
import {
  IconActionButton,
  IconDownload,
  IconFilter,
  IconX,
} from '../ui/IconActionButton'

type Req = {
  id: string
  label: string
  level: RequirementLevel
  weight: number | null
  tags: string[]
  description: string
  sort_order: number
}

type Cand = {
  id: string
  brand: string
  model: string
  trim: string
  parent_candidate_id: string | null
  status: CandidateStatus
  price: number | null
}

type EvalRow = {
  requirement_id: string
  candidate_id: string
  status: string
  note: string
}

type Vote = {
  requirement_id: string
  user_id: string
  vote: string
}

const STATUS_VALUES: Record<string, number> = {
  unknown: 0,
  ko: 0,
  partial: 0.5,
  ok: 1,
}

const STATUS_LABELS: Record<string, string> = {
  unknown: '?',
  ko: 'Non',
  partial: 'Partiel',
  ok: 'OK',
}

const STATUS_COLORS: Record<string, string> = {
  unknown: 'muted',
  ko: 'danger',
  partial: 'warning',
  ok: 'success',
}

type MatrixView = 'full' | 'compact' | 'scores'

export function RequirementsMatrix({
  workspaceId,
  canWrite,
  userId,
}: {
  workspaceId: string
  canWrite: boolean
  userId: string
}) {
  const { reportException } = useErrorDialog()
  const { showToast } = useToast()
  const [reqs, setReqs] = useState<Req[]>([])
  const [cands, setCands] = useState<Cand[]>([])
  const [evals, setEvals] = useState<EvalRow[]>([])
  const [votes, setVotes] = useState<Vote[]>([])
  const [view, setView] = useState<MatrixView>('full')
  const [showFilters, setShowFilters] = useState(false)

  const [levelFilter, setLevelFilter] = useState<'all' | RequirementLevel>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | CandidateStatus>('all')
  const [hideExcluded, setHideExcluded] = useState(true)
  const [hideToSee, setHideToSee] = useState(false)

  const load = useCallback(async () => {
    const [r, c, e, v] = await Promise.all([
      supabase
        .from('requirements')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('candidates')
        .select('id, brand, model, trim, parent_candidate_id, status, price')
        .eq('workspace_id', workspaceId)
        .order('parent_candidate_id', { ascending: true, nullsFirst: true })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('requirement_candidate_evaluations')
        .select('requirement_id, candidate_id, status, note'),
      supabase.from('requirement_priority_votes').select('requirement_id, user_id, vote'),
    ])
    const firstErr = r.error ?? c.error ?? e.error ?? v.error
    if (firstErr) reportException(firstErr, 'Chargement de la matrice des exigences')

    setReqs((r.data ?? []) as Req[])
    setCands((c.data ?? []) as Cand[])
    setEvals((e.data ?? []) as EvalRow[])
    setVotes((v.data ?? []) as Vote[])
  }, [workspaceId, reportException])

  useEffect(() => {
    void load()
  }, [load])

  const filteredReqs = useMemo(() => {
    if (levelFilter === 'all') return reqs
    return reqs.filter((r) => r.level === levelFilter)
  }, [reqs, levelFilter])

  const filteredCands = useMemo(() => {
    return cands.filter((c) => {
      if (hideExcluded && c.status === 'rejected') return false
      if (hideToSee && c.status === 'to_see') return false
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      return true
    })
  }, [cands, hideExcluded, hideToSee, statusFilter])

  const evalKey = (rid: string, cid: string) => `${rid}:${cid}`
  const evalMap = useMemo(() => {
    const m = new Map<string, EvalRow>()
    for (const x of evals) m.set(evalKey(x.requirement_id, x.candidate_id), x)
    return m
  }, [evals])

  const setStatus = async (requirementId: string, candidateId: string, status: string) => {
    if (!canWrite) return
    const cur = evalMap.get(evalKey(requirementId, candidateId))
    const { error } = await supabase.from('requirement_candidate_evaluations').upsert(
      {
        requirement_id: requirementId,
        candidate_id: candidateId,
        status,
        note: cur?.note ?? '',
      },
      { onConflict: 'requirement_id,candidate_id' }
    )
    if (error) reportException(error, 'Mise à jour du statut')
    else await load()
  }

  const candidateScores = useMemo(() => {
    const scores: Record<string, { total: number; weighted: number; maxPossible: number; details: Array<{ reqId: string; reqLabel: string; score: number; weight: number }> }> = {}

    for (const cand of filteredCands) {
      let total = 0
      let weighted = 0
      let maxPossible = 0
      const details: Array<{ reqId: string; reqLabel: string; score: number; weight: number }> = []

      for (const req of filteredReqs) {
        const eval_ = evalMap.get(evalKey(req.id, cand.id))
        const score = eval_ ? STATUS_VALUES[eval_.status] ?? 0 : 0
        const weight = req.weight ?? 1

        total += score
        weighted += score * weight
        maxPossible += weight

        details.push({
          reqId: req.id,
          reqLabel: req.label,
          score,
          weight,
        })
      }

      scores[cand.id] = {
        total,
        weighted: maxPossible > 0 ? (weighted / maxPossible) * 100 : 0,
        maxPossible,
        details,
      }
    }

    return scores
  }, [filteredCands, filteredReqs, evalMap])

  const exportCsv = () => {
    const headers = ['Exigence', 'Niveau', 'Poids', ...filteredCands.map((c) => formatCandidateListLabel(c))]
    const rows = filteredReqs.map((req) => [
      req.label,
      req.level === 'mandatory' ? 'Obligatoire' : 'À discuter',
      req.weight?.toString() ?? '1',
      ...filteredCands.map((c) => {
        const eval_ = evalMap.get(evalKey(req.id, c.id))
        return eval_ ? STATUS_LABELS[eval_.status] : '?'
      }),
    ])

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `matrice-exigences-${workspaceId}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Export CSV téléchargé')
  }

  if (!reqs.length || !cands.length) {
    return (
      <EmptyState
        icon="requirements"
        title="Matrice non disponible"
        text={
          !reqs.length && !cands.length
            ? 'Ajoutez des exigences (onglet Exigences) et des modèles (onglet Modèles) pour remplir la matrice.'
            : !reqs.length
              ? 'Ajoutez des exigences (onglet Exigences) pour remplir la matrice.'
              : 'Ajoutez des modèles (onglet Modèles) pour remplir la matrice.'
        }
      />
    )
  }

  return (
    <div className="stack requirements-matrix">
      <div className="card stack" style={{ boxShadow: 'none' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ margin: 0 }}>Matrice des exigences</h3>
          <div className="row icon-action-toolbar">
            <IconActionButton
              variant="secondary"
              label={showFilters ? 'Masquer les filtres' : 'Afficher les filtres'}
              onClick={() => setShowFilters((v) => !v)}
            >
              <IconFilter />
            </IconActionButton>
            <IconActionButton
              variant="secondary"
              label="Exporter en CSV"
              onClick={exportCsv}
            >
              <IconDownload />
            </IconActionButton>
          </div>
        </div>

        <div className="row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <div className="tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'full'}
              className={view === 'full' ? 'active' : ''}
              onClick={() => setView('full')}
            >
              Complète
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'compact'}
              className={view === 'compact' ? 'active' : ''}
              onClick={() => setView('compact')}
            >
              Compacte
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'scores'}
              className={view === 'scores' ? 'active' : ''}
              onClick={() => setView('scores')}
            >
              Scores
            </button>
          </div>
        </div>

        {showFilters ? (
          <div className="card stack" style={{ boxShadow: 'none', padding: '1rem' }}>
            <div className="row" style={{ flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label htmlFor="req-level-filter">Niveau d'exigence</label>
                <select
                  id="req-level-filter"
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value as 'all' | RequirementLevel)}
                >
                  <option value="all">Toutes</option>
                  <option value="mandatory">Obligatoires</option>
                  <option value="discuss">À discuter</option>
                </select>
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <label htmlFor="cand-status-filter">Statut des modèles</label>
                <select
                  id="cand-status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | CandidateStatus)}
                >
                  <option value="all">Tous</option>
                  <option value="to_see">À voir</option>
                  <option value="tried">Essayés</option>
                  <option value="shortlist">Shortlist</option>
                  <option value="selected">Sélectionné</option>
                  <option value="rejected">Exclus</option>
                </select>
              </div>
            </div>
            <div className="row" style={{ flexWrap: 'wrap', gap: '1rem' }}>
              <label className="row" style={{ gap: '0.35rem', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={hideExcluded}
                  onChange={(e) => setHideExcluded(e.target.checked)}
                />
                Masquer les exclus
              </label>
              <label className="row" style={{ gap: '0.35rem', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={hideToSee}
                  onChange={(e) => setHideToSee(e.target.checked)}
                />
                Masquer les « À voir »
              </label>
            </div>
            <p className="muted" style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
              {filteredReqs.length} / {reqs.length} exigences · {filteredCands.length} / {cands.length} modèles affichés
            </p>
          </div>
        ) : null}
      </div>

      {view === 'scores' ? (
        <div className="card stack" style={{ boxShadow: 'none' }}>
          <h4 style={{ margin: 0 }}>Scores pondérés par modèle</h4>
          <p className="muted" style={{ margin: '0.25rem 0 1rem', fontSize: '0.9rem' }}>
            Score basé sur les évaluations (OK=1, Partiel=0.5, Non=0) et le poids de chaque exigence.
          </p>
          {filteredCands.length === 0 ? (
            <p className="muted">Aucun modèle à afficher avec les filtres actuels.</p>
          ) : (
            <div className="stack" style={{ gap: '0.75rem' }}>
              {filteredCands
                .map((c) => ({ cand: c, score: candidateScores[c.id] }))
                .sort((a, b) => b.score.weighted - a.score.weighted)
                .map(({ cand, score }) => (
                  <div key={cand.id} className="card" style={{ boxShadow: 'none' }}>
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>{formatCandidateListLabel(cand)}</strong>
                        {cand.price != null ? (
                          <span className="muted" style={{ marginLeft: '0.5rem' }}>
                            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cand.price)}
                          </span>
                        ) : null}
                      </div>
                      <div className="row" style={{ gap: '1rem', alignItems: 'center' }}>
                        <span className="muted" style={{ fontSize: '0.85rem' }}>
                          {score.details.filter((d) => d.score > 0).length} / {score.details.length} satisfaites
                        </span>
                        <span className="badge success" style={{ fontSize: '1.1rem', padding: '0.35rem 0.75rem' }}>
                          {score.weighted.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div style={{ marginTop: '0.75rem' }}>
                      <div style={{ height: '8px', background: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${score.weighted}%`,
                            background: `hsl(${(score.weighted / 100) * 120}, 70%, 45%)`,
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      ) : (
        <div className="table-wrap requirements-matrix-table-wrap">
          <table className={`requirements-matrix-table requirements-matrix-table--${view}`}>
            <thead>
              <tr>
                <th>Exigence</th>
                {view === 'full' && <th>Niveau</th>}
                {view === 'full' && <th>Poids</th>}
                {filteredCands.map((c) => (
                  <th key={c.id}>{formatCandidateListLabel(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredReqs.map((req) => (
                <tr key={req.id}>
                  <td>
                    <span className={`badge ${req.level}`}>
                      {req.level === 'mandatory' ? 'Obl.' : 'Disc.'}
                    </span>{' '}
                    <strong>{req.label}</strong>
                    {req.tags?.length ? (
                      <div className="muted" style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                        {req.tags.join(', ')}
                      </div>
                    ) : null}
                  </td>
                  {view === 'full' && (
                    <td>
                      <span className={`badge ${req.level}`}>
                        {req.level === 'mandatory' ? 'Obligatoire' : 'À discuter'}
                      </span>
                    </td>
                  )}
                  {view === 'full' && (
                    <td className="muted">{req.weight?.toString() ?? '1'}</td>
                  )}
                  {filteredCands.map((c) => {
                    const cell = evalMap.get(evalKey(req.id, c.id))
                    const status = cell?.status ?? 'unknown'
                    return (
                      <td key={c.id}>
                        {canWrite ? (
                          <select
                            value={status}
                            onChange={(e) => void setStatus(req.id, c.id, e.target.value)}
                            className={`status-select status-select--${STATUS_COLORS[status]}`}
                          >
                            <option value="unknown">?</option>
                            <option value="ok">OK</option>
                            <option value="partial">Partiel</option>
                            <option value="ko">Non</option>
                          </select>
                        ) : (
                          <span className={`badge ${STATUS_COLORS[status]}`}>
                            {STATUS_LABELS[status]}
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
