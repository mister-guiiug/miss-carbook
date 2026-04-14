import { useUpdatePrompt } from '../hooks/useUpdatePrompt'

export function UpdateBanner() {
  const { needRefresh, update } = useUpdatePrompt()

  if (!needRefresh) return null

  return (
    <div className="pwa-update-banner" role="status" aria-live="polite">
      <p className="pwa-update-banner-text">
        Une nouvelle version de l’application est disponible.
      </p>
      <button type="button" onClick={update}>
        Mettre à jour
      </button>
    </div>
  )
}
