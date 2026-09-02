import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WEIGHTS,
  SCENARIO_PRESETS,
  analyzeGroupConsensus,
  calculateCompositeScores,
  generateRecommendation,
  type CandidateEvaluationData,
  type CandidateScore,
} from './scoringAlgorithm';

/** Un candidat complet ; on ne surcharge que ce que le test regarde. */
function candidate(
  overrides: Partial<CandidateEvaluationData> & { id: string }
): CandidateEvaluationData {
  return {
    label: overrides.id,
    brand: 'Marque',
    model: 'Modèle',
    trim: 'Finition',
    price: 20000,
    mandatoryScore: 1,
    optionalScore: 0.5,
    evaluationScore: 0.75,
    avgReviewScore: 7,
    reviewCount: 3,
    mandatoryMet: 4,
    mandatoryTotal: 4,
    optionalMet: 1,
    optionalTotal: 2,
    ...overrides,
  };
}

describe('scoringAlgorithm — préréglages', () => {
  it('chaque scénario pondère à 1 au total, et « équilibré » est le défaut', () => {
    for (const preset of SCENARIO_PRESETS) {
      const { evaluations, reviews, price } = preset.weights;
      expect(evaluations + reviews + price).toBeCloseTo(1, 10);
    }
    expect(SCENARIO_PRESETS.find(p => p.id === 'balanced')?.weights).toEqual(
      DEFAULT_WEIGHTS
    );
  });
});

describe('calculateCompositeScores', () => {
  it('sans candidat : rien', () => {
    expect(calculateCompositeScores([])).toEqual([]);
  });

  it('le moins cher a le meilleur score prix, le plus cher le pire ; sans prix, 50', () => {
    const scored = calculateCompositeScores([
      candidate({ id: 'cher', price: 30000 }),
      candidate({ id: 'moyen', price: 20000 }),
      candidate({ id: 'pas-cher', price: 10000 }),
      candidate({ id: 'sans-prix', price: null }),
    ]);
    const by = Object.fromEntries(scored.map(c => [c.id, c.scores.price]));
    expect(by['pas-cher']).toBe(100);
    expect(by.moyen).toBe(50);
    expect(by.cher).toBe(0);
    expect(by['sans-prix']).toBe(50);
  });

  it('les avis se normalisent entre les candidats ; sans avis, 50', () => {
    const scored = calculateCompositeScores([
      candidate({ id: 'a', avgReviewScore: 9 }),
      candidate({ id: 'b', avgReviewScore: 5 }),
      candidate({ id: 'c', avgReviewScore: null }),
    ]);
    const by = Object.fromEntries(scored.map(c => [c.id, c.scores.reviews]));
    expect(by.a).toBe(100);
    expect(by.b).toBe(0);
    expect(by.c).toBe(50);
  });

  it('tous au même prix : 50 pour chacun (pas de division par zéro)', () => {
    const scored = calculateCompositeScores([
      candidate({ id: 'a', price: 15000 }),
      candidate({ id: 'b', price: 15000 }),
    ]);
    expect(scored.map(c => c.scores.price)).toEqual([50, 50]);
  });

  it('le composite est la somme pondérée, arrondi au dixième, et classe du meilleur au moins bon', () => {
    const scored = calculateCompositeScores(
      [
        candidate({
          id: 'fort',
          evaluationScore: 1,
          avgReviewScore: 10,
          price: 10000,
        }),
        candidate({
          id: 'faible',
          evaluationScore: 0,
          avgReviewScore: 0,
          price: 30000,
        }),
      ],
      { evaluations: 0.5, reviews: 0.3, price: 0.2 }
    );
    expect(scored.map(c => c.id)).toEqual(['fort', 'faible']);
    expect(scored.map(c => c.rank)).toEqual([1, 2]);
    expect(scored[0]?.compositeScore).toBe(100);
    expect(scored[1]?.compositeScore).toBe(0);
  });

  it('les explications suivent les poids : un poids nul ne produit pas de ligne', () => {
    const [only] = calculateCompositeScores([candidate({ id: 'x' })], {
      evaluations: 1,
      reviews: 0,
      price: 0,
    });
    expect(only?.reasoning).toHaveLength(1);
    expect(only?.reasoning[0]).toMatch(/^Score d'évaluation : 75%/);

    const [full] = calculateCompositeScores([candidate({ id: 'y' })]);
    expect(full?.reasoning).toHaveLength(3);
    expect(full?.reasoning[1]).toContain('note moyenne 7.0/10, 3 avis');
  });
});

describe('generateRecommendation', () => {
  const scored = (...composites: number[]): CandidateScore[] =>
    composites.map((compositeScore, i) => ({
      ...candidate({ id: `c${i}` }),
      compositeScore,
      scores: { evaluations: 50, reviews: 50, price: 70 },
      rank: i + 1,
      reasoning: [],
    }));

  it('sans candidat : pas de recommandation, confiance basse', () => {
    expect(generateRecommendation([], DEFAULT_WEIGHTS)).toEqual({
      topCandidate: null,
      reasoning: 'Aucun candidat à analyser.',
      confidence: 'low',
    });
  });

  it('la confiance suit l’écart avec le second : > 15 haute, > 7 moyenne, sinon basse', () => {
    expect(
      generateRecommendation(scored(80, 60), DEFAULT_WEIGHTS).confidence
    ).toBe('high');
    expect(
      generateRecommendation(scored(80, 70), DEFAULT_WEIGHTS).confidence
    ).toBe('medium');
    expect(
      generateRecommendation(scored(80, 78), DEFAULT_WEIGHTS).confidence
    ).toBe('low');
    expect(generateRecommendation(scored(80), DEFAULT_WEIGHTS).confidence).toBe(
      'low'
    );
  });

  it('le raisonnement nomme le premier, et le second quand les scores sont proches', () => {
    const close = generateRecommendation(scored(80, 78), DEFAULT_WEIGHTS);
    expect(close.topCandidate?.id).toBe('c0');
    expect(close.reasoning).toContain(
      '**c0** obtient le meilleur score composite (80/100)'
    );
    expect(close.reasoning).toContain('considérez aussi c1');

    const clear = generateRecommendation(scored(90, 60), DEFAULT_WEIGHTS);
    expect(clear.reasoning).toContain('préférence claire');
    expect(clear.reasoning).not.toContain('considérez aussi');
  });

  it('un prix compétitif n’est commenté que si le prix pèse plus de 0,3', () => {
    const light = generateRecommendation(scored(80, 60), DEFAULT_WEIGHTS);
    expect(light.reasoning).not.toContain('compétitif');
    const heavy = generateRecommendation(scored(80, 60), {
      evaluations: 0.3,
      reviews: 0.2,
      price: 0.5,
    });
    expect(heavy.reasoning).toContain('Son prix est **compétitif**');
  });
});

describe('analyzeGroupConsensus', () => {
  const withReviews = (...reviews: number[]): CandidateScore[] =>
    reviews.map((r, i) => ({
      ...candidate({ id: `c${i}` }),
      compositeScore: 50,
      scores: { evaluations: 50, reviews: r, price: 50 },
      rank: i + 1,
      reasoning: [],
    }));

  it('sans candidat : consensus bas, rien à montrer', () => {
    expect(analyzeGroupConsensus([]).consensus).toBe('low');
    expect(analyzeGroupConsensus([]).details.mostAgreed).toBeNull();
  });

  it('l’étendue des scores d’avis décide : < 15 haut, < 30 moyen, sinon bas', () => {
    expect(analyzeGroupConsensus(withReviews(80, 90)).consensus).toBe('high');
    expect(analyzeGroupConsensus(withReviews(60, 85)).consensus).toBe('medium');
    expect(analyzeGroupConsensus(withReviews(20, 90)).consensus).toBe('low');
  });

  it('un score de 50 (« pas de données ») ne compte pas dans l’étendue', () => {
    const result = analyzeGroupConsensus(withReviews(50, 84, 90));
    expect(result.details.varianceScore).toBe(6);
    expect(result.consensus).toBe('high');
    expect(result.details.mostAgreed?.id).toBe('c0');
    expect(result.details.mostDisputed?.id).toBe('c2');
  });
});
