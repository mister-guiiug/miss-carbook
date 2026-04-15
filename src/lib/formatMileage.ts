/** Parse une saisie kilométrage (espaces / espaces insécables, entier km). */
export function parseMileageKmInput(raw: string): number | null {
  if (raw == null) return null
  const t = String(raw).trim()
  if (t === '') return null
  const cleaned = t
    .replace(/\u202f/g, '')
    .replace(/\u00a0/g, '')
    .replace(/ /g, '')
    .replace(',', '.')
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.min(9_999_999, Math.floor(n))
}

/** Affichage kilométrage avec séparateurs de milliers (fr-FR). */
export function formatMileageKmDisplay(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return ''
  const n = Math.floor(Number(value))
  if (n < 0 || n > 9_999_999) return ''
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(n)
}
