/** UI étroite ou PWA installée : on propose la visite guidée plein écran. */
export function shouldOfferAssistantUi(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (window.matchMedia('(max-width: 768px)').matches) return true
    if (window.matchMedia('(display-mode: standalone)').matches) return true
  } catch {
    /* ignore */
  }
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true
}
