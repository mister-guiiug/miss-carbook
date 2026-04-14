import { useEffect, useRef, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

export function useUpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const updateSWRef = useRef<((reload?: boolean) => Promise<void>) | undefined>(undefined)

  useEffect(() => {
    updateSWRef.current = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(true)
      },
      onOfflineReady() {
        console.info('[PWA] Cache prêt — coque disponible hors ligne.')
      },
    })
  }, [])

  const update = () => updateSWRef.current?.(true)

  return { needRefresh, update }
}
