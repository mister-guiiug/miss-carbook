/** Parse une saisie prix (espaces de milliers, virgule décimale fr-FR). */
export function parsePriceInput(raw: string): number | null {
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
  return n
}

/** Affichage prix avec séparateurs de milliers (ex. 12 345,67 €). */
export function formatPriceEur(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return ''
  return (
    new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Number(value)) + ' €'
  )
}

/** Valeur pour champ de saisie après blur (sans symbole €). */
export function formatPriceInputDisplay(value: number | null): string {
  if (value == null || Number.isNaN(Number(value))) return ''
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value))
}
