import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatCandidateListLabel } from '../../lib/candidateLabel'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../contexts/ToastContext'
import { useErrorDialog } from '../../contexts/ErrorDialogContext'
import {
  calculateCompositeScores,
  generateRecommendation,
  analyzeGroupConsensus,
  SCENARIO_PRESETS,
  DEFAULT_WEIGHTS,
  type WeightConfig,
  type CandidateEvaluationData,
  type CandidateScore,
} from '../../lib/scoringAlgorithm'
import { EmptyState } from '../ui/EmptyState'
import {
  IconActionButton,
  IconTrendingUp,
  IconInfo,
  IconX,
  IconRefresh,
} from '../ui/IconActionButton'
import './SmartCompareTab.css'

type RawCandidate = {
  id: string
  brand: string
  model: string
  trim: string
  price: number | null
}

type EvaluationRow = {
  requirement_id: string
  candidate_id: string
  status: string
}

type Requirement = {
  id: string
  level: 'mandatory' | 'discuss'
}

type ReviewRow = {
  candidate_id: string
  score: number
}

export function SmartCompareTab({
  workspaceId,
  canWrite,
}: {
  workspaceId: string
  canWrite: boolean
}) {
  const { showToast } = useToast()
  const { reportException } = useErrorDialog()
  const [candidates, setCandidates] = useState<RawCandidate[]>([])
  const [evaluations, setEvaluations] = useState<EvaluationRow[]>([])
  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedScenario, setSelectedScenario] = useState<string>('balanced')
  const [customWeights, setCustomWeights] = useState<WeightConfig>(DEFAULT_WEIGHTS)
  const [showDetails, setShowDetails] = useState<string | null>(null)
  const [showRecommendation, setShowRecommendation] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cands, evals, reqs, revs] = await Promise.all([
        supabase
          .from('candidates')
          .select('id, brand, model, trim, price')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: true }),
        supabase
          .from('requirement_candidate_evaluations')
          .select('requirement_id, candidate_id, status')
          .eq('workspace_id', workspaceId),
        supabase.from('requirements').select('id, level').eq('workspace_id', workspaceId),
        supabase
          .from('candidate_reviews')
          .select('candidate_id, score')
          .eq('workspace_id', workspaceId),
      ])

      if (cands.error) throw cands.error
      if (evals.error) throw evals.error
      if (reqs.error) throw reqs.error
      if (revs.error) throw revs.error

      setCandidates((cands.data ?? []) as RawCandidate[])
      setEvaluations((evals.data ?? []) as EvaluationRow[])
      setRequirements((reqs.data ?? []) as Requirement[])
      setReviews((revs.data ?? []) as ReviewRow[])
    } catch (err) {
      reportException(err, 'Chargement des données pour assistant de décision')
    } finally {
      setLoading(false)
    }
  }, [workspaceId, reportException])

  useEffect(() => {
    void load()
  }, [load])

  // Préparer les données pour le scoring
  const candidateData = useMemo(() => {
    const mandatoryReqs = new Set(
      requirements.filter((r) => r.level === 'mandatory').map((r) => r.id)
    )
    const optionalReqs = new Set(requirements.filter((r) => r.level === 'discuss').map((r) => r.id))

    // Agréger les revues par candidat
    const reviewMap = new Map<string, number[]>()
    for (const r of reviews) {
      if (!reviewMap.has(r.candidate_id)) reviewMap.set(r.candidate_id, [])
      reviewMap.get(r.candidate_id)!.push(r.score)
    }

    // Calculer les scores d'évaluation par candidat
    const evalMap = new Map<string, Set<string>>() // candidate_id -> requirement_ids satisfaits
    for (const e of evaluations) {
      if (e.status === 'ok' || e.status === 'partial') {
        if (!evalMap.has(e.candidate_id)) evalMap.set(e.candidate_id, new Set())
        evalMap.get(e.candidate_id)!.add(e.requirement_id)
      }
    }

    return candidates.map((c) => {
      const satisfiedReqs = evalMap.get(c.id) || new Set()
      const mandatoryMet = [...mandatoryReqs].filter((id) => satisfiedReqs.has(id)).length
      const optionalMet = [...optionalReqs].filter((id) => satisfiedReqs.has(id)).length

      const mandatoryScore = mandatoryReqs.size > 0 ? mandatoryMet / mandatoryReqs.size : 0
      const optionalScore = optionalReqs.size > 0 ? optionalMet / optionalReqs.size : 0
      const evaluationScore = mandatoryScore * 0.7 + optionalScore * 0.3

      const candidateReviews = reviewMap.get(c.id) || []
      const avgReviewScore =
        candidateReviews.length > 0
          ? candidateReviews.reduce((a, b) => a + b, 0) / candidateReviews.length
          : null

      return {
        id: c.id,
        label: formatCandidateListLabel(c),
        brand: c.brand,
        model: c.model,
        trim: c.trim,
        price: c.price,
        mandatoryScore,
        optionalScore,
        evaluationScore,
        avgReviewScore,
        reviewCount: candidateReviews.length,
        mandatoryMet,
        mandatoryTotal: mandatoryReqs.size,
        optionalMet,
        optionalTotal: optionalReqs.size,
      } as CandidateEvaluationData
    })
  }, [candidates, evaluations, requirements, reviews])

  // Calculer les scores composite
  const scoredCandidates = useMemo(() => {
    const preset = SCENARIO_PRESETS.find((p) => p.id === selectedScenario)
    const weights = preset?.weights || customWeights
    return calculateCompositeScores(candidateData, weights)
  }, [candidateData, selectedScenario, customWeights])

  // Générer la recommandation
  const recommendation = useMemo(() => {
    const preset = SCENARIO_PRESETS.find((p) => p.id === selectedScenario)
    const weights = preset?.weights || customWeights
    return generateRecommendation(scoredCandidates, weights)
  }, [scoredCandidates, selectedScenario, customWeights])

  // Analyser le consensus
  const consensus = useMemo(() => analyzeGroupConsensus(scoredCandidates), [scoredCandidates])

  const isCustom = selectedScenario === 'custom'

  const toggleDetails = (id: string) => {
    setShowDetails((prev) => (prev === id ? null : id))
  }

  if (loading) {
    return (
      <div className="stack">
        <p className="muted">Chargement de l'assistant de décision...</p>
      </div>
    )
  }

  if (candidateData.length === 0) {
    return (
      <EmptyState
        icon="comparison"
        title="Aucun modèle à analyser"
        text="Ajoutez des candidats et des exigences pour utiliser l'assistant de décision."
      />
    )
  }

  return (
    <div className="stack smart-compare-tab">
      <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
        L'assistant de décision analyse tous les candidats selon plusieurs critères et vous aide à
        identifier les meilleurs compromis.
      </p>

      {/* Sélection du scénario */}
      <div className="card stack" style={{ boxShadow: 'none' }}>
        <h3 style={{ margin: 0 }}>Scénario d'analyse</h3>
        <div className="row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          {SCENARIO_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={selectedScenario === preset.id ? 'primary' : 'secondary'}
              onClick={() => setSelectedScenario(preset.id)}
              title={preset.description}
            >
              {preset.name}
            </button>
          ))}
          <button
            type="button"
            className={isCustom ? 'primary' : 'secondary'}
            onClick={() => setSelectedScenario('custom')}
          >
            Personnalisé
          </button>
        </div>

        {isCustom ? (
          <div className="row" style={{ flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
            <span className="muted">Poids :</span>
            <label className="row" style={{ gap: '0.35rem' }}>
              <span>Évaluations</span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.1}
                value={customWeights.evaluations}
                onChange={(e) =>
                  setCustomWeights((w) => ({ ...w, evaluations: parseFloat(e.target.value) || 0 }))
                }
                style={{ width: '60px' }}
              />
            </label>
            <label className="row" style={{ gap: '0.35rem' }}>
              <span>Avis</span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.1}
                value={customWeights.reviews}
                onChange={(e) =>
                  setCustomWeights((w) => ({ ...w, reviews: parseFloat(e.target.value) || 0 }))
                }
                style={{ width: '60px' }}
              />
            </label>
            <label className="row" style={{ gap: '0.35rem' }}>
              <span>Prix</span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.1}
                value={customWeights.price}
                onChange={(e) =>
                  setCustomWeights((w) => ({ ...w, price: parseFloat(e.target.value) || 0 }))
                }
                style={{ width: '60px' }}
              />
            </label>
            <span className="muted">
              (Total :{' '}
              {Math.round(
                (customWeights.evaluations + customWeights.reviews + customWeights.price) * 10
              ) / 10}
            </span>
          </div>
        ) : null}

        {selectedScenario && (
          <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
            {SCENARIO_PRESETS.find((p) => p.id === selectedScenario)?.description ||
              'Scénario personnalisé'}
          </p>
        )}
      </div>

      {/* Recommandation */}
      {showRecommendation && recommendation.topCandidate && (
        <div className="card smart-recommendation" style={{ boxShadow: 'none' }}>
          <div
            className="row"
            style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
          >
            <div className="stack" style={{ flex: 1 }}>
              <h3 style={{ margin: 0 }}>💡 Recommandation</h3>
              <div
                className="smart-recommendation-content"
                dangerouslySetInnerHTML={{
                  __html: recommendation.reasoning
                    .replace(/\n\n/g, '<br/><br/>')
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'),
                }}
              />
              <div className="row" style={{ gap: '0.5rem', marginTop: '0.5rem' }}>
                <span
                  className={`badge smart-confidence-${recommendation.confidence}`}
                  style={{ fontSize: '0.85rem' }}
                >
                  Confiance :{' '}
                  {recommendation.confidence === 'high'
                    ? 'Élevée'
                    : recommendation.confidence === 'medium'
                      ? 'Moyenne'
                      : 'Faible'}
                </span>
                {consensus.consensus !== 'low' && (
                  <span className="badge" style={{ fontSize: '0.85rem' }}>
                    Consensus : {consensus.consensus === 'high' ? 'Élevé' : 'Moyen'}
                  </span>
                )}
              </div>
            </div>
            <IconActionButton
              variant="secondary"
              label="Masquer"
              onClick={() => setShowRecommendation(false)}
            >
              <IconX />
            </IconActionButton>
          </div>
        </div>
      )}

      {!showRecommendation && recommendation.topCandidate && (
        <div className="row" style={{ justifyContent: 'center' }}>
          <button type="button" className="secondary" onClick={() => setShowRecommendation(true)}>
            Afficher la recommandation
          </button>
        </div>
      )}

      {/* Classement des candidats */}
      <div className="card stack" style={{ boxShadow: 'none' }}>
        <h3 style={{ margin: 0 }}>Classement</h3>
        {scoredCandidates.length === 0 ? (
          <p className="muted">Aucun score calculé</p>
        ) : (
          <div className="smart-ranking-list stack">
            {scoredCandidates.map((candidate) => {
              const isTop = candidate.rank === 1
              const detailsOpen = showDetails === candidate.id

              return (
                <div
                  key={candidate.id}
                  className={`smart-ranking-card${isTop ? ' smart-ranking-card--top' : ''}`}
                >
                  <div
                    className="row smart-ranking-main"
                    style={{ justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <div className="row" style={{ gap: '0.75rem', alignItems: 'center', flex: 1 }}>
                      <span
                        className={`smart-rank smart-rank--${candidate.rank <= 3 ? 'top' : 'other'}`}
                      >
                        #{candidate.rank}
                      </span>
                      <div className="stack" style={{ flex: 1, gap: '0.15rem' }}>
                        <strong>{candidate.label}</strong>
                        <div className="row" style={{ gap: '1rem', flexWrap: 'wrap' }}>
                          <span className="muted" style={{ fontSize: '0.85rem' }}>
                            Score global : <strong>{candidate.compositeScore}</strong>/100
                          </span>
                          <span className="muted" style={{ fontSize: '0.85rem' }}>
                            Évaluations : {candidate.scores.evaluations}%
                          </span>
                          <span className="muted" style={{ fontSize: '0.85rem' }}>
                            Avis : {candidate.scores.reviews}%
                          </span>
                          <span className="muted" style={{ fontSize: '0.85rem' }}>
                            Prix : {candidate.scores.price}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <IconActionButton
                      variant="secondary"
                      label={detailsOpen ? 'Masquer les détails' : 'Voir les détails'}
                      onClick={() => toggleDetails(candidate.id)}
                    >
                      {detailsOpen ? <IconX /> : <IconInfo />}
                    </IconActionButton>
                  </div>

                  {detailsOpen && (
                    <div className="smart-ranking-details">
                      <div className="stack" style={{ gap: '0.75rem' }}>
                        {/* Barres de score */}
                        <div className="smart-score-bars">
                          <div className="smart-score-bar">
                            <label>Évaluations</label>
                            <div className="smart-score-bar-track">
                              <div
                                className="smart-score-bar-fill smart-score-bar-fill--evaluations"
                                style={{ width: `${candidate.scores.evaluations}%` }}
                              />
                            </div>
                            <span>{candidate.scores.evaluations}%</span>
                          </div>
                          <div className="smart-score-bar">
                            <label>Avis membres</label>
                            <div className="smart-score-bar-track">
                              <div
                                className="smart-score-bar-fill smart-score-bar-fill--reviews"
                                style={{ width: `${candidate.scores.reviews}%` }}
                              />
                            </div>
                            <span>{candidate.scores.reviews}%</span>
                          </div>
                          <div className="smart-score-bar">
                            <label>Prix</label>
                            <div className="smart-score-bar-track">
                              <div
                                className="smart-score-bar-fill smart-score-bar-fill--price"
                                style={{ width: `${candidate.scores.price}%` }}
                              />
                            </div>
                            <span>{candidate.scores.price}%</span>
                          </div>
                        </div>

                        {/* Détails textuels */}
                        <div className="stack" style={{ gap: '0.35rem' }}>
                          {candidate.reasoning.map((line, i) => (
                            <p key={i} className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                              {line}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="row icon-action-toolbar">
        <IconActionButton
          variant="secondary"
          label="Actualiser les données"
          onClick={() => void load()}
        >
          <IconRefresh />
        </IconActionButton>
      </div>
    </div>
  )
}
