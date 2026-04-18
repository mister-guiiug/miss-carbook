import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatCandidateListLabel } from '../../lib/candidateLabel'
import { supabase } from '../../lib/supabase'
import { useErrorDialog } from '../../contexts/ErrorDialogContext'
import { useToast } from '../../contexts/ToastContext'
import type { CandidateStatus, RequirementLevel } from '../../types/database'
import { EmptyState } from '../ui/EmptyState'

type Req = {
  id: string
  label: string
  level: RequirementLevel
  weight: number | null
}

type Cand = {
  id: string
  brand: string
  model: string
  trim: string
  parent_candidate_id: string | null
  status: CandidateStatus
}

type WeightedReqVote = {
  requirement_id: string
  user_id: string
  weight: number
}

type WeightedCandVote = {
  candidate_id: string
  user_id: string
  weight: number
  category: string
}

type VotingWeight = {
  user_id: string
  voting_weight: number
}

type Profile = {
  id: string
  display_name: string
}

const CATEGORIES = [
  { value: 'overall', label: 'Global' },
  { value: 'design', label: 'Design' },
  { value: 'performance', label: 'Performances' },
  { value: 'comfort', label: 'Confort' },
  { value: 'value', label: 'Rapport qualité/prix' },
  { value: 'reliability', label: 'Fiabilité' },
] as const

type VoteTab = 'requirements' | 'candidates' | 'weights'

export function WeightedVotingTab({
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
  const [reqVotes, setReqVotes] = useState<WeightedReqVote[]>([])
  const [candVotes, setCandVotes] = useState<WeightedCandVote[]>([])
  const [votingWeights, setVotingWeights] = useState<VotingWeight[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [tab, setTab] = useState<VoteTab>('requirements')
  const [categoryFilter, setCategoryFilter] = useState<string>('overall')

  const load = useCallback(async () => {
    const [r, c, rv, cv, vw, p] = await Promise.all([
      supabase
        .from('requirements')
        .select('id, label, level, weight')
        .eq('workspace_id', workspaceId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('candidates')
        .select('id, brand, model, trim, parent_candidate_id, status')
        .eq('workspace_id', workspaceId)
        .order('parent_candidate_id', { ascending: true, nullsFirst: true })
        .order('sort_order', { ascending: true }),
      supabase.from('weighted_requirement_votes').select('*'),
      supabase.from('weighted_candidate_votes').select('*'),
      supabase.from('workspace_voting_weights').select('*'),
      supabase.from('profiles').select('id, display_name'),
    ])

    const firstErr = r.error ?? c.error ?? rv.error ?? cv.error ?? vw.error ?? p.error
    if (firstErr) reportException(firstErr, 'Chargement des votes pondérés')

    setReqs((r.data ?? []) as Req[])
    setCands((c.data ?? []) as Cand[])
    setReqVotes((rv.data ?? []) as WeightedReqVote[])
    setCandVotes((cv.data ?? []) as WeightedCandVote[])
    setVotingWeights((vw.data ?? []) as VotingWeight[])
    setProfiles((p.data ?? []) as Profile[])
  }, [workspaceId, reportException])

  useEffect(() => {
    void load()
  }, [load])

  const profileById = useMemo(() => {
    const m = new Map<string, Profile>()
    for (const p of profiles) m.set(p.id, p)
    return m
  }, [profiles])

  const votingWeightByUserId = useMemo(() => {
    const m = new Map<string, number>()
    for (const vw of votingWeights) m.set(vw.user_id, vw.voting_weight)
    return m
  }, [votingWeights])

  const myVotingWeight = useMemo(() => {
    return votingWeightByUserId.get(userId) ?? 1
  }, [votingWeightByUserId, userId])

  const setReqVote = async (requirementId: string, weight: number) => {
    if (!canWrite) return
    const { error } = await supabase
      .from('weighted_requirement_votes')
      .upsert(
        { requirement_id: requirementId, user_id: userId, weight },
        { onConflict: 'requirement_id,user_id' }
      )
    if (error) reportException(error, 'Mise à jour du vote pondéré')
    else {
      await load()
      showToast('Vote enregistré')
    }
  }

  const setCandVote = async (candidateId: string, category: string, weight: number) => {
    if (!canWrite) return
    const { error } = await supabase
      .from('weighted_candidate_votes')
      .upsert(
        { candidate_id: candidateId, user_id: userId, category, weight },
        { onConflict: 'candidate_id,user_id,category' }
      )
    if (error) reportException(error, 'Mise à jour du vote pondéré')
    else {
      await load()
      showToast('Vote enregistré')
    }
  }

  const weightedReqScores = useMemo(() => {
    const scores: Record<string, number> = {}
    for (const req of reqs) {
      let totalWeight = 0
      let weightedSum = 0
      for (const vote of reqVotes.filter((v) => v.requirement_id === req.id)) {
        const userWeight = votingWeightByUserId.get(vote.user_id) ?? 1
        totalWeight += userWeight
        weightedSum += vote.weight * userWeight
      }
      scores[req.id] = totalWeight > 0 ? weightedSum / totalWeight : 0
    }
    return scores
  }, [reqs, reqVotes, votingWeightByUserId])

  const weightedCandScores = useMemo(() => {
    const scores: Record<string, number> = {}
    for (const cand of cands) {
      let totalWeight = 0
      let weightedSum = 0
      for (const vote of candVotes.filter(
        (v) => v.candidate_id === cand.id && v.category === categoryFilter
      )) {
        const userWeight = votingWeightByUserId.get(vote.user_id) ?? 1
        totalWeight += userWeight
        weightedSum += vote.weight * userWeight
      }
      scores[cand.id] = totalWeight > 0 ? weightedSum / totalWeight : 0
    }
    return scores
  }, [cands, candVotes, votingWeightByUserId, categoryFilter])

  const myReqVotes = useMemo(() => {
    const m = new Map<string, number>()
    for (const v of reqVotes.filter((v) => v.user_id === userId)) m.set(v.requirement_id, v.weight)
    return m
  }, [reqVotes, userId])

  const myCandVotes = useMemo(() => {
    const m = new Map<string, number>()
    for (const v of candVotes.filter((v) => v.user_id === userId && v.category === categoryFilter))
      m.set(v.candidate_id, v.weight)
    return m
  }, [candVotes, userId, categoryFilter])

  if (!reqs.length && !cands.length) {
    return (
      <EmptyState
        icon="requirements"
        title="Votes pondérés non disponibles"
        text="Ajoutez des exigences ou des modèles pour commencer à voter."
      />
    )
  }

  return (
    <div className="stack weighted-voting-tab">
      <p className="muted" style={{ margin: 0 }}>
        Attribuez des poids à vos votes. Les membres avec un poids de vote plus élevé ont plus
        d'influence sur le score final.
      </p>

      <div className="card" style={{ boxShadow: 'none', padding: '0.5rem 1rem' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'requirements'}
              className={tab === 'requirements' ? 'active' : ''}
              onClick={() => setTab('requirements')}
            >
              Exigences
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'candidates'}
              className={tab === 'candidates' ? 'active' : ''}
              onClick={() => setTab('candidates')}
            >
              Modèles
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'weights'}
              className={tab === 'weights' ? 'active' : ''}
              onClick={() => setTab('weights')}
            >
              Poids des membres
            </button>
          </div>
          <div className="muted" style={{ fontSize: '0.85rem' }}>
            Votre poids de vote : <strong>{myVotingWeight}x</strong>
          </div>
        </div>
      </div>

      {tab === 'requirements' ? (
        reqs.length === 0 ? (
          <EmptyState
            icon="requirements"
            title="Aucune exigence"
            text="Ajoutez des exigences dans l'onglet Exigences pour commencer."
          />
        ) : (
          <div className="stack">
            <div className="card stack" style={{ boxShadow: 'none' }}>
              <h4 style={{ margin: 0 }}>Votes pondérés par exigence</h4>
              <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
                Attribuez un poids de 0 à 10 pour chaque exigence. Le score final est calculé en
                pondérant les votes de tous les membres.
              </p>
            </div>

            <div className="stack">
              {reqs.map((req) => {
                const myVote = myReqVotes.get(req.id) ?? 5
                const finalScore = weightedReqScores[req.id] ?? 0
                return (
                  <div key={req.id} className="card" style={{ boxShadow: 'none' }}>
                    <div
                      className="row"
                      style={{
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '1rem',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <span className={`badge ${req.level}`}>
                          {req.level === 'mandatory' ? 'Obl.' : 'Disc.'}
                        </span>{' '}
                        <strong>{req.label}</strong>
                      </div>
                      <div className="row" style={{ alignItems: 'center', gap: '1rem' }}>
                        <div className="row" style={{ alignItems: 'center', gap: '0.5rem' }}>
                          <label
                            htmlFor={`req-vote-${req.id}`}
                            className="muted"
                            style={{ fontSize: '0.85rem' }}
                          >
                            Votre vote :
                          </label>
                          <input
                            id={`req-vote-${req.id}`}
                            type="range"
                            min="0"
                            max="10"
                            step="0.5"
                            value={myVote}
                            disabled={!canWrite}
                            onChange={(e) => void setReqVote(req.id, parseFloat(e.target.value))}
                            style={{ width: '120px' }}
                          />
                          <span
                            className="badge"
                            style={{ minWidth: '2.5rem', textAlign: 'center' }}
                          >
                            {myVote}
                          </span>
                        </div>
                        <div className="row" style={{ alignItems: 'center', gap: '0.5rem' }}>
                          <span className="muted" style={{ fontSize: '0.85rem' }}>
                            Score final :
                          </span>
                          <span
                            className="badge success"
                            style={{ fontSize: '1rem', padding: '0.35rem 0.75rem' }}
                          >
                            {finalScore.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      ) : tab === 'candidates' ? (
        cands.length === 0 ? (
          <EmptyState
            icon="requirements"
            title="Aucun modèle"
            text="Ajoutez des modèles dans l'onglet Modèles pour commencer."
          />
        ) : (
          <div className="stack">
            <div className="card stack" style={{ boxShadow: 'none' }}>
              <div
                className="row"
                style={{ justifyContent: 'space-between', alignItems: 'center' }}
              >
                <h4 style={{ margin: 0 }}>Votes pondérés par modèle</h4>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={{ flex: '0 0 180px' }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
                Attribuez un poids de 0 à 10 pour chaque modèle selon la catégorie choisie.
              </p>
            </div>

            <div className="stack">
              {cands.map((cand) => {
                const myVote = myCandVotes.get(cand.id) ?? 5
                const finalScore = weightedCandScores[cand.id] ?? 0
                const categoryLabel =
                  CATEGORIES.find((c) => c.value === categoryFilter)?.label ?? categoryFilter
                return (
                  <div key={cand.id} className="card" style={{ boxShadow: 'none' }}>
                    <div
                      className="row"
                      style={{
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '1rem',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <strong>{formatCandidateListLabel(cand)}</strong>
                      </div>
                      <div className="row" style={{ alignItems: 'center', gap: '1rem' }}>
                        <div className="row" style={{ alignItems: 'center', gap: '0.5rem' }}>
                          <label
                            htmlFor={`cand-vote-${cand.id}`}
                            className="muted"
                            style={{ fontSize: '0.85rem' }}
                          >
                            Votre vote ({categoryLabel}) :
                          </label>
                          <input
                            id={`cand-vote-${cand.id}`}
                            type="range"
                            min="0"
                            max="10"
                            step="0.5"
                            value={myVote}
                            disabled={!canWrite}
                            onChange={(e) =>
                              void setCandVote(cand.id, categoryFilter, parseFloat(e.target.value))
                            }
                            style={{ width: '120px' }}
                          />
                          <span
                            className="badge"
                            style={{ minWidth: '2.5rem', textAlign: 'center' }}
                          >
                            {myVote}
                          </span>
                        </div>
                        <div className="row" style={{ alignItems: 'center', gap: '0.5rem' }}>
                          <span className="muted" style={{ fontSize: '0.85rem' }}>
                            Score final :
                          </span>
                          <span
                            className="badge success"
                            style={{ fontSize: '1rem', padding: '0.35rem 0.75rem' }}
                          >
                            {finalScore.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      ) : (
        <div className="stack">
          <div className="card stack" style={{ boxShadow: 'none' }}>
            <h4 style={{ margin: 0 }}>Poids de vote des membres</h4>
            <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
              Les administrateurs peuvent modifier le poids de vote de chaque membre. Par défaut,
              tous les membres ont un poids de 1.
            </p>
          </div>

          <div className="stack">
            {profiles.map((profile) => {
              const weight = votingWeightByUserId.get(profile.id) ?? 1
              return (
                <div key={profile.id} className="card" style={{ boxShadow: 'none' }}>
                  <div
                    className="row"
                    style={{ justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <div>
                      <strong>{profile.display_name}</strong>
                      {profile.id === userId ? (
                        <span
                          className="muted"
                          style={{ marginLeft: '0.5rem', fontSize: '0.85rem' }}
                        >
                          (vous)
                        </span>
                      ) : null}
                    </div>
                    <div className="row" style={{ alignItems: 'center', gap: '0.5rem' }}>
                      <span className="muted" style={{ fontSize: '0.85rem' }}>
                        Poids :
                      </span>
                      <span
                        className="badge"
                        style={{ fontSize: '1rem', padding: '0.35rem 0.75rem' }}
                      >
                        {weight}x
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
