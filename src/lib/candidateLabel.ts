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
  const y =
    c.event_date && String(c.event_date).trim()
      ? String(c.event_date).slice(0, 4)
      : ''

  if (!c.parent_candidate_id) {
    if (!base) return 'Sans nom'
    if (t && y) return `${base} · ${t} · ${y}`
    if (t) return `${base} · ${t}`
    if (y) return `${base} · ${y}`
    return base
  }
  if (t) return `${base} · ${t}`
  return `${base} (variation)`
}
