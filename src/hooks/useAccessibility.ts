/**
 * Hooks et utilitaires d'accessibilité pour React
 */

import { useEffect, useRef, useCallback } from 'react'

/**
 * Hook pour gérer les modales avec trap focus
 */
export function useFocusTrap(isActive: boolean) {
  const trappedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isActive) return

    const focusableElements =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      const modal = trappedRef.current
      if (!modal) return

      const focusable = Array.from(
        modal.querySelectorAll(focusableElements)
      ) as HTMLElement[]
      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          last.focus()
          e.preventDefault()
        }
      } else {
        if (document.activeElement === last) {
          first.focus()
          e.preventDefault()
        }
      }
    }

    document.addEventListener('keydown', handleTab)
    return () => document.removeEventListener('keydown', handleTab)
  }, [isActive])

  return trappedRef
}

/**
 * Hook pour gérer le focus quand un élément apparaît
 */
export function useAutoFocus(dependencies: any[] = []) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.focus()
    }
  }, dependencies)

  return ref
}

/**
 * Hook pour la navigation clavier avec Escape
 */
export function useEscapeHandler(onEscape: () => void, isActive = true) {
  useEffect(() => {
    if (!isActive) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onEscape()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onEscape, isActive])
}

/**
 * Hook pour sauvegarder et restorer le focus
 */
export function useFocusRestore(isActive: boolean) {
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isActive) {
      // Restaurer le focus quand on ferme
      if (previousFocusRef.current) {
        previousFocusRef.current.focus()
      }
      return
    }

    // Sauvegarder le focus actuel
    previousFocusRef.current = document.activeElement as HTMLElement
  }, [isActive])
}

/**
 * Hook pour annoncer les changements aux lecteurs d'écran
 */
export function useA11yAnnouncement(message: string | null) {
  const announcerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!message || !announcerRef.current) return

    announcerRef.current.textContent = message
  }, [message])

  return announcerRef
}

/**
 * Hook pour la préférence de mouvement réduit
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mediaQuery.addEventListener('change', handler)

    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  return prefersReducedMotion
}

/**
 * Hook pour détecter les high contrast mode
 */
export function usePrefersHighContrast(): boolean {
  const [prefersHighContrast, setPrefersHighContrast] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: high)')
    setPrefersHighContrast(mediaQuery.matches)

    const handler = (e: MediaQueryListEvent) => setPrefersHighContrast(e.matches)
    mediaQuery.addEventListener('change', handler)

    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  return prefersHighContrast
}

/**
 * Générer des attributs ARIA pour les boutons icônes
 */
export function useIconButtonProps(label: string, disabled = false) {
  return {
    'aria-label': label,
    role: 'button',
    tabIndex: disabled ? -1 : 0,
    'aria-disabled': disabled,
  }
}

/**
 * Hook pour les liens accessibles
 */
export function useAccessibleLink(href: string, external = false) {
  return {
    href,
    target: external ? '_blank' : undefined,
    rel: external ? 'noopener noreferrer' : undefined,
    'aria-label': external ? `Ouvre ${href} dans un nouvel onglet` : undefined,
  }
}

/**
 * Composant pour les annonces ARIA
 */
export function A11yAnnouncer({ message }: { message: string | null }) {
  const announcerRef = useA11yAnnouncement(message)

  return (
    <div
      ref={announcerRef}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
      style={{
        position: 'absolute',
        left: '-10000px',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
      }}
    />
  )
}