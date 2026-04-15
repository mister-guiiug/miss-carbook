/** Entiers positifs avec séparateurs de milliers (fr-FR) — ex. dimensions en mm. */

const DEFAULT_MAX = 99_999_999

/** Parse une saisie avec espaces / espaces insécables (entier). */
export function parseGroupedIntegerFrInput(raw: string, options?: { max?: number }): number | null {
  if (raw == null) return null
  const t = String(raw).trim()
  if (t === '') return null
  const max = options?.max ?? DEFAULT_MAX
  const cleaned = t
    .replace(/\u202f/g, '')
    .replace(/\u00a0/g, '')
    .replace(/ /g, '')
    .replace(/,/g, '')
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.min(max, Math.floor(n))
}

export function formatGroupedIntegerFrDisplay(
  value: number | null | undefined,
  options?: { max?: number }
): string {
  if (value == null || Number.isNaN(Number(value))) return ''
  const max = options?.max ?? DEFAULT_MAX
  const n = Math.floor(Number(value))
  if (n < 0 || n > max) return ''
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(n)
}
