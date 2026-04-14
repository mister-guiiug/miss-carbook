import { useEffect } from 'react'
import {
  WORKSPACE_QUICK_ADD_EVENT,
  type WorkspaceQuickAddDetail,
} from '../../../lib/workspaceHeaderEvents'

/** Ouvre le panneau « Nouveau modèle » quand la barre dossier déclenche l’ajout rapide sur cet onglet. */
export function useCandidatesQuickAdd() {
  useEffect(() => {
    const onQuick = (ev: Event) => {
      const d = (ev as CustomEvent<WorkspaceQuickAddDetail>).detail
      if (d?.tab !== 'candidates') return
      const det = document.getElementById(
        'workspace-candidates-add-details'
      ) as HTMLDetailsElement | null
      if (det) det.open = true
      requestAnimationFrame(() => {
        const root = document.getElementById('workspace-candidates-add-details')
        const first = root?.querySelector<HTMLElement>('input:not([type="file"]), select, textarea')
        first?.focus()
      })
    }
    window.addEventListener(WORKSPACE_QUICK_ADD_EVENT, onQuick)
    return () => window.removeEventListener(WORKSPACE_QUICK_ADD_EVENT, onQuick)
  }, [])
}
