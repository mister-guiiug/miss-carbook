import { useUpdatePrompt } from '../hooks/useUpdatePrompt'

export function UpdateBanner() {
  const { needRefresh, reloadToLatest } = useUpdatePrompt()

  if (!needRefresh) return null

  return (
    <div className="pwa-update-banner" role="status" aria-live="polite">
      <p className="pwa-update-banner-text">
        Une nouvelle version de l’application est disponible.
      </p>
      <button type="button" onClick={() => void reloadToLatest()}>
        Mettre à jour
      </button>
    </div>
  )
}
