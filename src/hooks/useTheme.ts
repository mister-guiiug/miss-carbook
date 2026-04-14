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
  const setMode = useCallback((next: ThemeMode) => {
    setTheme(next)
    window.dispatchEvent(new Event('mc-theme'))
  }, [])
  const toggle = useCallback(() => {
    const next: ThemeMode = mode === 'dark' ? 'light' : 'dark'
    setMode(next)
  }, [mode, setMode])
  return { mode, toggle, setMode }
}
