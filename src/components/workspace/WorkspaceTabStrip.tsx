import { useCallback, type KeyboardEvent } from 'react'
import { WORKSPACE_TABS, type TabId } from './workspaceTabs'
import { WorkspaceTabIcon } from './WorkspaceTabIcons'

const TAB_IDS = WORKSPACE_TABS.map((t) => t.id)

const settingsTitle = 'Nom du dossier, membres, invitations, partage — uniquement ce projet'

export function WorkspaceTabStrip({
  tab,
  setTab,
  tabListLabelId,
}: {
  tab: TabId
  setTab: (id: TabId) => void
  tabListLabelId: string
}) {
  const move = useCallback(
    (from: TabId, delta: number) => {
      const i = TAB_IDS.indexOf(from)
      if (i < 0) return
      const next = TAB_IDS[(i + delta + TAB_IDS.length) % TAB_IDS.length]
      setTab(next)
      queueMicrotask(() => {
        document.getElementById(`workspace-tab-btn-${next}`)?.focus()
      })
    },
    [setTab]
  )

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLUListElement>) => {
      const focused = document.activeElement?.id?.replace('workspace-tab-btn-', '') as
        | TabId
        | undefined
      const current = focused && TAB_IDS.includes(focused) ? focused : tab
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        move(current, 1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        move(current, -1)
      } else if (e.key === 'Home') {
        e.preventDefault()
        setTab(TAB_IDS[0])
        queueMicrotask(() => document.getElementById(`workspace-tab-btn-${TAB_IDS[0]}`)?.focus())
      } else if (e.key === 'End') {
        e.preventDefault()
        const last = TAB_IDS[TAB_IDS.length - 1]
        setTab(last)
        queueMicrotask(() => document.getElementById(`workspace-tab-btn-${last}`)?.focus())
      }
    },
    [move, setTab, tab]
  )

  return (
    <>
      <div className="workspace-tabs-mobile">
        <label htmlFor="workspace-tab-select" className="sr-only">
          Section du dossier
        </label>
        <select
          id="workspace-tab-select"
          className="workspace-tab-select"
          value={tab}
          aria-labelledby={tabListLabelId}
          onChange={(e) => setTab(e.target.value as TabId)}
        >
          {WORKSPACE_TABS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <ul
        className="tabs workspace-tabs-desktop"
        role="tablist"
        aria-labelledby={tabListLabelId}
        onKeyDown={onKeyDown}
      >
        {WORKSPACE_TABS.map((t) => (
          <li key={t.id} role="presentation">
            <button
              type="button"
              role="tab"
              id={`workspace-tab-btn-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="workspace-main-panel"
              tabIndex={tab === t.id ? 0 : -1}
              className={tab === t.id ? 'active workspace-tab-btn' : 'workspace-tab-btn'}
              title={t.id === 'settings' ? settingsTitle : undefined}
              onClick={() => setTab(t.id)}
            >
              <span className="workspace-tab-btn-inner" aria-hidden="true">
                <WorkspaceTabIcon tabId={t.id} />
              </span>
              <span className="workspace-tab-btn-label">{t.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
