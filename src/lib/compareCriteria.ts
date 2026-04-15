import { candidateSpecLabels } from './candidateSpecsUi'

/** Critères de comparaison (partagés entre l’onglet Comparer et le graphique radar chargé à la demande). */
export const CRITERIA: { key: string; label: string; path: 'root' | 'spec'; numeric: boolean }[] = [
  { key: 'price', label: 'Prix', path: 'root', numeric: true },
  { key: 'scoreAvg', label: 'Note moyenne', path: 'root', numeric: true },
  { key: 'trunkLiters', label: candidateSpecLabels.trunkLiters, path: 'spec', numeric: true },
  {
    key: 'consumptionL100',
    label: candidateSpecLabels.consumptionL100,
    path: 'spec',
    numeric: true,
  },
  {
    key: 'consumptionUrbanL100',
    label: candidateSpecLabels.consumptionUrbanL100,
    path: 'spec',
    numeric: true,
  },
  {
    key: 'consumptionExtraUrbanL100',
    label: candidateSpecLabels.consumptionExtraUrbanL100,
    path: 'spec',
    numeric: true,
  },
  {
    key: 'consumptionKwh100',
    label: candidateSpecLabels.consumptionKwh100,
    path: 'spec',
    numeric: true,
  },
  {
    key: 'consumptionKwh100Mixed',
    label: candidateSpecLabels.consumptionKwh100Mixed,
    path: 'spec',
    numeric: true,
  },
  { key: 'powerKw', label: candidateSpecLabels.powerKw, path: 'spec', numeric: true },
  { key: 'lengthMm', label: candidateSpecLabels.lengthMm, path: 'spec', numeric: true },
  { key: 'widthMm', label: candidateSpecLabels.widthMm, path: 'spec', numeric: true },
  { key: 'heightMm', label: candidateSpecLabels.heightMm, path: 'spec', numeric: true },
  { key: 'wheelbaseMm', label: candidateSpecLabels.wheelbaseMm, path: 'spec', numeric: true },
  { key: 'co2Gkm', label: candidateSpecLabels.co2Gkm, path: 'spec', numeric: true },
]

export const COMPARE_RADAR_COLORS = ['#0f766e', '#7c3aed', '#ea580c', '#2563eb', '#db2777']
