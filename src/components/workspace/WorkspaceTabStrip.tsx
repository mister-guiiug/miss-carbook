import { useCallback, type KeyboardEvent } from 'react';
import {
  WORKSPACE_TABS,
  WORKSPACE_TABS_STRIP,
  type TabId,
} from './workspaceTabs';
import { WorkspaceTabIcon } from './WorkspaceTabIcons';
import { useI18n } from '../../i18n';

const TAB_IDS = WORKSPACE_TABS_STRIP.map(t => t.id);

export function WorkspaceTabStrip({
  tab,
  setTab,
  tabListLabelId,
}: {
  tab: TabId;
  setTab: (id: TabId) => void;
  tabListLabelId: string;
}) {
  const { t } = useI18n();
  const move = useCallback(
    (from: TabId, delta: number) => {
      const i = TAB_IDS.indexOf(from);
      if (i < 0) return;
      const next = TAB_IDS[(i + delta + TAB_IDS.length) % TAB_IDS.length];
      if (!next) return;
      setTab(next);
      queueMicrotask(() => {
        document.getElementById(`workspace-tab-btn-${next}`)?.focus();
      });
    },
    [setTab]
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLUListElement>) => {
      const focused = document.activeElement?.id?.replace(
        'workspace-tab-btn-',
        ''
      ) as TabId | undefined;
      const current = focused && TAB_IDS.includes(focused) ? focused : tab;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        move(current, 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        move(current, -1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        const firstTab = TAB_IDS[0];
        if (!firstTab) return;
        setTab(firstTab);
        queueMicrotask(() =>
          document.getElementById(`workspace-tab-btn-${firstTab}`)?.focus()
        );
      } else if (e.key === 'End') {
        e.preventDefault();
        const last = TAB_IDS.at(-1);
        if (!last) return;
        setTab(last);
        queueMicrotask(() =>
          document.getElementById(`workspace-tab-btn-${last}`)?.focus()
        );
      }
    },
    [move, setTab, tab]
  );

  return (
    <>
      <div className="workspace-tabs-mobile">
        <label htmlFor="workspace-tab-select" className="sr-only">
          {t('workspace.sectionSelectLabel')}
        </label>
        <select
          id="workspace-tab-select"
          className="workspace-tab-select"
          value={tab}
          aria-labelledby={tabListLabelId}
          onChange={e => setTab(e.target.value as TabId)}
        >
          {WORKSPACE_TABS_STRIP.map(tabDef => (
            <option key={tabDef.id} value={tabDef.id}>
              {t(`workspace.tab_${tabDef.id}`)}
            </option>
          ))}
          {WORKSPACE_TABS.filter(
            tabDef => tabDef.id === 'settings' || tabDef.id === 'activity'
          )
            .slice()
            .sort((a, b) =>
              a.id === 'settings' ? -1 : b.id === 'settings' ? 1 : 0
            )
            .map(tabDef => (
              <option key={tabDef.id} value={tabDef.id}>
                {t(`workspace.tab_${tabDef.id}`)}
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
        {WORKSPACE_TABS_STRIP.map(tabDef => (
          <li key={tabDef.id} role="presentation">
            <button
              type="button"
              role="tab"
              id={`workspace-tab-btn-${tabDef.id}`}
              aria-selected={tab === tabDef.id}
              aria-controls="workspace-main-panel"
              tabIndex={tab === tabDef.id ? 0 : -1}
              className={
                tab === tabDef.id
                  ? 'active workspace-tab-btn'
                  : 'workspace-tab-btn'
              }
              onClick={() => setTab(tabDef.id)}
            >
              <span className="workspace-tab-btn-inner" aria-hidden="true">
                <WorkspaceTabIcon tabId={tabDef.id} />
              </span>
              <span className="workspace-tab-btn-label">
                {t(`workspace.tab_${tabDef.id}`)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
