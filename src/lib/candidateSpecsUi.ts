/**
 * Libellés FR et ordre d’affichage des champs « données constructeur » (candidate_specs).
 * Aligné sur `candidateSpecsShape` dans validation/schemas.ts.
 */
export const candidateSpecNumericKeys = [
  'lengthMm',
  'widthMm',
  'heightMm',
  'wheelbaseMm',
  'trunkLiters',
  'trunkSeatsFoldedLiters',
  'consumptionL100',
  'consumptionUrbanL100',
  'consumptionExtraUrbanL100',
  'consumptionKwh100',
  'powerKw',
  'powerHp',
  'co2Gkm',
  'warrantyMonths',
] as const

export type CandidateSpecNumericKey = (typeof candidateSpecNumericKeys)[number]

export const candidateSpecLabels: Record<CandidateSpecNumericKey | 'notes', string> = {
  lengthMm: 'Longueur (mm)',
  widthMm: 'Largeur (mm)',
  heightMm: 'Hauteur (mm)',
  wheelbaseMm: 'Empattement (mm)',
  trunkLiters: 'Volume coffre (L)',
  trunkSeatsFoldedLiters: 'Coffre, sièges rabattus (L)',
  consumptionL100: 'Consommation mixte (L/100 km)',
  consumptionUrbanL100: 'Consommation urbaine (L/100 km)',
  consumptionExtraUrbanL100: 'Consommation extra-urbaine (L/100 km)',
  consumptionKwh100: 'Consommation électrique (kWh/100 km)',
  powerKw: 'Puissance (kW)',
  powerHp: 'Puissance (ch)',
  co2Gkm: 'Émissions CO₂ (g/km)',
  warrantyMonths: 'Garantie constructeur (mois)',
  notes: 'Remarques / sources constructeur',
}

/** Groupes pour l’UI (titres optionnels au-dessus des champs). */
export const candidateSpecFieldGroups: {
  title: string
  keys: readonly CandidateSpecNumericKey[]
}[] = [
  {
    title: 'Dimensions',
    keys: ['lengthMm', 'widthMm', 'heightMm', 'wheelbaseMm'],
  },
  {
    title: 'Coffre',
    keys: ['trunkLiters', 'trunkSeatsFoldedLiters'],
  },
  {
    title: 'Consommation',
    keys: [
      'consumptionL100',
      'consumptionUrbanL100',
      'consumptionExtraUrbanL100',
      'consumptionKwh100',
    ],
  },
  {
    title: 'Motorisation & environnement',
    keys: ['powerKw', 'powerHp', 'co2Gkm'],
  },
  {
    title: 'Garantie',
    keys: ['warrantyMonths'],
  },
]

export function hasCandidateSpecVisibleData(specs: Record<string, unknown>): boolean {
  for (const k of candidateSpecNumericKeys) {
    const v = specs[k]
    if (typeof v === 'number' && !Number.isNaN(v)) return true
  }
  const n = specs.notes
  return typeof n === 'string' && n.trim() !== ''
}
