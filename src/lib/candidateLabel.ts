/** Libellé court pour listes (rappels, recherche, matrice…). */
export function formatCandidateListLabel(c: {
  brand: string
  model: string
  trim: string
  parent_candidate_id?: string | null
}): string {
  const base = `${c.brand} ${c.model}`.trim()
  if (!c.parent_candidate_id) return base || 'Sans nom'
  const t = (c.trim ?? '').trim()
  if (t) return `${base} · ${t}`
  return `${base} (variation)`
}
