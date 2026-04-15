/** Libellé affiché pour la version de base (racine) lorsque le champ est vide. */
export const ROOT_VERSION_GENERIC_LABEL = 'Générique'

/**
 * Libellé de version pour l’UI : racine → base « Générique » si vide ; fils → complément ou tiret.
 */
export function displayVersionLabel(c: {
  trim: string
  parent_candidate_id?: string | null
}): string {
  const t = (c.trim ?? '').trim()
  if (!c.parent_candidate_id) return t || ROOT_VERSION_GENERIC_LABEL
  return t || '—'
}

/** Libellé court pour listes (rappels, recherche, matrice…). */
export function formatCandidateListLabel(c: {
  brand: string
  model: string
  trim: string
  parent_candidate_id?: string | null
  event_date?: string | null
}): string {
  const base = `${c.brand} ${c.model}`.trim()
  const t = (c.trim ?? '').trim()
  const period = (c.event_date ?? '').trim()

  if (!c.parent_candidate_id) {
    if (!base) return 'Sans nom'
    const v = t || ROOT_VERSION_GENERIC_LABEL
    if (period) return `${base} · ${v} · ${period}`
    return `${base} · ${v}`
  }
  if (t) return `${base} · ${t}`
  return `${base} (complément à préciser)`
}
