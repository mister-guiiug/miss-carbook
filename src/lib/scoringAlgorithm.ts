/**
 * Algorithme de scoring pour la réduction de la shortlist
 * Combine plusieurs critères pour générer un score composite
 */

export type WeightConfig = {
  evaluations: number // Poids des évaluations (matrice exigences)
  reviews: number // Poids des avis membres
  price: number // Poids du prix
}

export const DEFAULT_WEIGHTS: WeightConfig = {
  evaluations: 0.5,
  reviews: 0.3,
  price: 0.2,
}

export type ScenarioPreset = {
  id: string
  name: string
  description: string
  weights: WeightConfig
}

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'balanced',
    name: 'Équilibré',
    description: 'Tous les critères sont pris en compte de manière égale',
    weights: { evaluations: 0.5, reviews: 0.3, price: 0.2 },
  },
  {
    id: 'price-focused',
    name: 'Priorité prix',
    description: 'Le budget est le critère principal',
    weights: { evaluations: 0.3, reviews: 0.2, price: 0.5 },
  },
  {
    id: 'quality-focused',
    name: 'Priorité qualité',
    description: 'Les caractéristiques techniques priment sur le prix',
    weights: { evaluations: 0.6, reviews: 0.3, price: 0.1 },
  },
  {
    id: 'consensus',
    name: 'Consensus groupe',
    description: "L'avis des membres est prépondérant",
    weights: { evaluations: 0.3, reviews: 0.6, price: 0.1 },
  },
  {
    id: 'mandatory-only',
    name: 'Exigences obligatoires',
    description: 'Seules les exigences obligatoires comptent',
    weights: { evaluations: 1, reviews: 0, price: 0 },
  },
]

export type CandidateEvaluationData = {
  id: string
  label: string
  brand: string
  model: string
  trim: string
  price: number | null
  // Scores d'évaluation (matrice)
  mandatoryScore: number // Score sur les exigences obligatoires (0-1)
  optionalScore: number // Score sur les exigences à discuter (0-1)
  evaluationScore: number // Score global d'évaluation (0-1)
  // Avis membres
  avgReviewScore: number | null // Moyenne des notes (0-10)
  reviewCount: number
  // Données brutes pour affichage
  mandatoryMet: number
  mandatoryTotal: number
  optionalMet: number
  optionalTotal: number
}

export type CandidateScore = CandidateEvaluationData & {
  compositeScore: number // Score final (0-100)
  scores: {
    evaluations: number // Score d'évaluation normalisé (0-100)
    reviews: number // Score des avis normalisé (0-100)
    price: number // Score de prix normalisé (0-100)
  }
  rank: number
  reasoning: string[] // Explications du score
}

/**
 * Calcule le score d'une catégorie normalisé entre 0 et 100
 */
function normalizeScore(value: number, min: number, max: number, invert = false): number {
  if (max === min) return 50
  const normalized = ((value - min) / (max - min)) * 100
  return invert ? 100 - normalized : normalized
}

/**
 * Calcul du score de prix (inverse : moins cher = meilleur)
 */
function calculatePriceScore(candidatePrice: number | null, allPrices: (number | null)[]): number {
  const validPrices = allPrices.filter((p) => p != null && Number.isFinite(p)) as number[]
  if (validPrices.length === 0) return 50 // Pas de données de prix
  if (candidatePrice == null) return 50 // Pas de prix pour ce candidat

  const min = Math.min(...validPrices)
  const max = Math.max(...validPrices)
  return normalizeScore(candidatePrice, min, max, true) // Inversé : moins cher = meilleur
}

/**
 * Calcul du score des avis membres
 */
function calculateReviewScore(avgReview: number | null, allAvgReviews: (number | null)[]): number {
  const validReviews = allAvgReviews.filter((r) => r != null && Number.isFinite(r)) as number[]
  if (validReviews.length === 0) return 50 // Pas d'avis
  if (avgReview == null) return 50 // Pas d'avis pour ce candidat

  const min = Math.min(...validReviews)
  const max = Math.max(...validReviews)
  return normalizeScore(avgReview, min, max, false)
}

/**
 * Calcule le score composite pour tous les candidats
 */
export function calculateCompositeScores(
  candidates: CandidateEvaluationData[],
  weights: WeightConfig = DEFAULT_WEIGHTS
): CandidateScore[] {
  if (candidates.length === 0) return []

  // Extraire les données pour les calculs de normalisation
  const allPrices = candidates.map((c) => c.price)
  const allAvgReviews = candidates.map((c) => c.avgReviewScore)

  // Calculer les scores pour chaque candidat
  const scored = candidates.map((candidate) => {
    const evaluationsScore = normalizeScore(candidate.evaluationScore, 0, 1, false)

    const reviewsScore = calculateReviewScore(candidate.avgReviewScore, allAvgReviews)

    const priceScore = calculatePriceScore(candidate.price, allPrices)

    // Score composite pondéré
    const compositeScore =
      evaluationsScore * weights.evaluations +
      reviewsScore * weights.reviews +
      priceScore * weights.price

    // Générer les explications
    const reasoning: string[] = []

    if (weights.evaluations > 0) {
      const pct = Math.round(evaluationsScore)
      reasoning.push(
        `Score d'évaluation : ${pct}% (${candidate.mandatoryMet}/${candidate.mandatoryTotal} obligatoires satisfaites)`
      )
    }

    if (weights.reviews > 0 && candidate.avgReviewScore != null) {
      const pct = Math.round(reviewsScore)
      reasoning.push(
        `Avis membres : ${pct}% (note moyenne ${candidate.avgReviewScore.toFixed(1)}/10, ${candidate.reviewCount} avis)`
      )
    }

    if (weights.price > 0 && candidate.price != null) {
      const pct = Math.round(priceScore)
      reasoning.push(`Score prix : ${pct}% (${candidate.price.toLocaleString('fr-FR')} €)`)
    }

    return {
      ...candidate,
      compositeScore: Math.round(compositeScore * 10) / 10,
      scores: {
        evaluations: Math.round(evaluationsScore),
        reviews: Math.round(reviewsScore),
        price: Math.round(priceScore),
      },
      reasoning,
    }
  })

  // Trier par score composite et ajouter le rang
  scored.sort((a, b) => b.compositeScore - a.compositeScore)

  return scored.map((c, index) => ({
    ...c,
    rank: index + 1,
  }))
}

/**
 * Génère une recommandation finale argumentée
 */
export function generateRecommendation(
  scoredCandidates: CandidateScore[],
  weights: WeightConfig
): {
  topCandidate: CandidateScore | null
  reasoning: string
  confidence: 'high' | 'medium' | 'low'
} {
  if (scoredCandidates.length === 0) {
    return {
      topCandidate: null,
      reasoning: 'Aucun candidat à analyser.',
      confidence: 'low',
    }
  }

  const top = scoredCandidates[0]
  const second = scoredCandidates[1]

  // Calculer l'écart avec le second
  const gap = second ? top.compositeScore - second.compositeScore : 0

  // Déterminer la confiance
  let confidence: 'high' | 'medium' | 'low' = 'low'
  if (gap > 15) confidence = 'high'
  else if (gap > 7) confidence = 'medium'

  // Construire le raisonnement
  const reasoningParts: string[] = []

  reasoningParts.push(
    `**${top.label}** obtient le meilleur score composite (${top.compositeScore}/100).`
  )

  if (weights.evaluations > 0.3) {
    reasoningParts.push(
      `Il satisfait **${top.mandatoryMet}/${top.mandatoryTotal}** exigences obligatoires et **${top.optionalMet}/${top.optionalTotal}** exigences à discuter.`
    )
  }

  if (weights.reviews > 0.3 && top.avgReviewScore != null) {
    reasoningParts.push(
      `Les avis membres sont positifs : **${top.avgReviewScore.toFixed(1)}/10** de moyenne (${top.reviewCount} avis).`
    )
  }

  if (weights.price > 0.3 && top.price != null) {
    if (top.scores.price >= 60) {
      reasoningParts.push(`Son prix est **compétitif** (${top.price.toLocaleString('fr-FR')} €).`)
    } else if (top.scores.price <= 40) {
      reasoningParts.push(
        `Son prix est **élevé**, mais justifié par ses autres qualités (${top.price.toLocaleString('fr-FR')} €).`
      )
    }
  }

  if (confidence === 'high') {
    reasoningParts.push(
      `L'écart avec le second (${gap.toFixed(1)} points) indique une **préférence claire**.`
    )
  } else if (confidence === 'medium') {
    reasoningParts.push(
      `L'écart avec le second est modéré (${gap.toFixed(1)} points), mais ce candidat ressort.`
    )
  } else {
    reasoningParts.push(
      `Les scores sont proches ; **considérez aussi ${second?.label}** avant de décider.`
    )
  }

  return {
    topCandidate: top,
    reasoning: reasoningParts.join('\n\n'),
    confidence,
  }
}

/**
 * Analyse les conflits potentiels dans les avis du groupe
 */
export function analyzeGroupConsensus(candidates: CandidateScore[]): {
  consensus: 'high' | 'medium' | 'low'
  details: {
    mostAgreed: CandidateScore | null
    mostDisputed: CandidateScore | null
    varianceScore: number
  }
} {
  if (candidates.length === 0) {
    return {
      consensus: 'low',
      details: {
        mostAgreed: null,
        mostDisputed: null,
        varianceScore: 0,
      },
    }
  }

  // Calculer la variance des scores de revues
  const reviewScores = candidates.map((c) => c.scores.reviews).filter((s) => s !== 50) // 50 = pas de données

  const variance =
    reviewScores.length > 0 ? Math.max(...reviewScores) - Math.min(...reviewScores) : 0

  let consensus: 'high' | 'medium' | 'low' = 'low'
  if (variance < 15) consensus = 'high'
  else if (variance < 30) consensus = 'medium'

  return {
    consensus,
    details: {
      mostAgreed: candidates[0],
      mostDisputed: candidates[candidates.length - 1],
      varianceScore: variance,
    },
  }
}
