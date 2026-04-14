/** Critères de comparaison (partagés entre l’onglet Comparer et le graphique radar chargé à la demande). */
export const CRITERIA: { key: string; label: string; path: 'root' | 'spec'; numeric: boolean }[] = [
  { key: 'price', label: 'Prix', path: 'root', numeric: true },
  { key: 'scoreAvg', label: 'Note moy.', path: 'root', numeric: true },
  { key: 'trunkLiters', label: 'Coffre (L)', path: 'spec', numeric: true },
  { key: 'consumptionL100', label: 'Conso L/100', path: 'spec', numeric: true },
  { key: 'consumptionKwh100', label: 'kWh/100', path: 'spec', numeric: true },
  { key: 'powerKw', label: 'kW', path: 'spec', numeric: true },
  { key: 'lengthMm', label: 'Long. mm', path: 'spec', numeric: true },
  { key: 'co2Gkm', label: 'CO₂', path: 'spec', numeric: true },
]

export const COMPARE_RADAR_COLORS = ['#0f766e', '#7c3aed', '#ea580c', '#2563eb', '#db2777']
