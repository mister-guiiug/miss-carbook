import { useCallback, useSyncExternalStore } from 'react'
import { getStoredTheme, setTheme, type ThemeMode } from '../lib/theme'

function subscribe(cb: () => void) {
  window.addEventListener('mc-theme', cb)
  return () => window.removeEventListener('mc-theme', cb)
}

function getSnapshot(): ThemeMode {
  return getStoredTheme()
}

export function useTheme() {
  const mode = useSyncExternalStore(subscribe, getSnapshot, () => 'light' as ThemeMode)
  const toggle = useCallback(() => {
    const next: ThemeMode = mode === 'dark' ? 'light' : 'dark'
    setTheme(next)
    window.dispatchEvent(new Event('mc-theme'))
  }, [mode])
  return { mode, toggle, set: setTheme }
}
