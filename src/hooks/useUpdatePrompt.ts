import { useCallback, useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

type ReloadFn = (reload?: boolean) => Promise<void>

let updateSW: ReloadFn | undefined
const needRefreshListeners = new Set<() => void>()

function ensureServiceWorkerRegistered() {
  if (updateSW) return
  const fn = registerSW({
    immediate: true,
    onNeedRefresh() {
      needRefreshListeners.forEach((l) => l())
    },
    onOfflineReady() {
      console.info('[PWA] Cache prêt — coque disponible hors ligne.')
    },
  })
  updateSW = fn as ReloadFn
}

/**
 * Active le service worker en attente (si présent) puis recharge la page.
 * Sinon, recharge simplement pour reprendre le dernier `index.html` / assets.
 */
export async function reloadToLatestApp(): Promise<void> {
  ensureServiceWorkerRegistered()
  try {
    await updateSW?.(true)
  } catch {
    /* ignore */
  }
  window.location.reload()
}

export function useUpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false)

  useEffect(() => {
    ensureServiceWorkerRegistered()
    const listener = () => setNeedRefresh(true)
    needRefreshListeners.add(listener)
    return () => {
      needRefreshListeners.delete(listener)
    }
  }, [])

  const update = useCallback(() => {
    void updateSW?.(true)
  }, [])

  const reloadToLatest = useCallback(() => reloadToLatestApp(), [])

  return { needRefresh, update, reloadToLatest }
}
