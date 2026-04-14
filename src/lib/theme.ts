const KEY = 'mc-theme'

export type ThemeMode = 'light' | 'dark'

export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light'
  const v = localStorage.getItem(KEY)
  return v === 'dark' ? 'dark' : 'light'
}

export function setTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = mode
  localStorage.setItem(KEY, mode)
}

export function initTheme() {
  setTheme(getStoredTheme())
}
