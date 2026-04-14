import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Piège le focus dans `containerRef` quand `active` (Tab / Shift+Tab).
 */
export function useFocusTrap(containerRef: RefObject<HTMLElement | null>, active: boolean) {
  const prevFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!active || !containerRef.current) return
    prevFocus.current = document.activeElement as HTMLElement | null
    const root = containerRef.current
    const first = root.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !root) return
      const nodes = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      )
      if (!nodes.length) return
      const i = nodes.indexOf(document.activeElement as HTMLElement)
      if (e.shiftKey) {
        if (i <= 0) {
          e.preventDefault()
          nodes[nodes.length - 1]?.focus()
        }
      } else if (i === -1 || i >= nodes.length - 1) {
        e.preventDefault()
        nodes[0]?.focus()
      }
    }
    root.addEventListener('keydown', onKey)
    return () => {
      root.removeEventListener('keydown', onKey)
      prevFocus.current?.focus?.()
    }
  }, [active, containerRef])
}
