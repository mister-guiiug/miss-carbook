export type ManufacturerLink = { url: string; label: string }

/** Lit la colonne JSON + repli sur l’ancien champ texte. */
export function parseManufacturerLinksFromDb(
  raw: unknown,
  legacyUrl: string | null | undefined
): ManufacturerLink[] {
  if (Array.isArray(raw)) {
    const out: ManufacturerLink[] = []
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue
      const u = String((item as { url?: unknown }).url ?? '').trim()
      if (!u) continue
      const label = String((item as { label?: unknown }).label ?? '').trim()
      out.push({ url: u, label })
    }
    if (out.length) return out
  }
  const leg = String(legacyUrl ?? '').trim()
  if (leg) return [{ url: leg, label: '' }]
  return []
}

/** Premier URL pour la colonne legacy `manufacturer_url`. */
export function legacyManufacturerUrlFromLinks(links: ManufacturerLink[]): string {
  return links[0]?.url ?? ''
}

export function manufacturerLinksAreEmpty(links: ManufacturerLink[]): boolean {
  return links.length === 0 || links.every((l) => !String(l.url ?? '').trim())
}
