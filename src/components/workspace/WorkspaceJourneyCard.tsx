import { useEffect, useState } from 'react'
import type { TabId } from './workspaceTabs'

const key = (workspaceId: string) => `mc_ws_journey_${workspaceId}`

export function WorkspaceJourneyCard({
  workspaceId,
  setTab,
}: {
  workspaceId: string
  setTab: (id: TabId) => void
}) {
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(key(workspaceId)) === '1')
    } catch {
      setHidden(false)
    }
  }, [workspaceId])

  if (hidden) return null
  if (typeof window !== 'undefined' && sessionStorage.getItem('mc_new_ws') === workspaceId) {
    return null
  }

  const dismiss = () => {
    try {
      localStorage.setItem(key(workspaceId), '1')
    } catch {
      /* ignore */
    }
    setHidden(true)
  }

  const go = (id: TabId) => () => setTab(id)

  return (
    <div className="card workspace-journey stack" style={{ boxShadow: 'none' }}>
      <div className="workspace-journey-head row">
        <p className="workspace-journey-title">Parcours suggéré</p>
        <button type="button" className="secondary" onClick={dismiss}>
          Masquer
        </button>
      </div>
      <ol className="workspace-journey-steps">
        <li>
          <button type="button" className="workspace-journey-link" onClick={go('requirements')}>
            1. Exigences
          </button>{' '}
          — définir vos critères
        </li>
        <li>
          <button type="button" className="workspace-journey-link" onClick={go('candidates')}>
            2. Modèles
          </button>{' '}
          — ajouter les véhicules
        </li>
        <li>
          <button type="button" className="workspace-journey-link" onClick={go('compare')}>
            3. Comparer
          </button>{' '}
          — graphiques et synthèse
        </li>
      </ol>
    </div>
  )
}
