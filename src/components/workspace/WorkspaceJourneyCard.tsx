import { useEffect, useState } from 'react';
import type { TabId } from './workspaceTabs';
import { useI18n } from '../../i18n';

const key = (workspaceId: string) => `mc_ws_journey_${workspaceId}`;

export function WorkspaceJourneyCard({
  workspaceId,
  setTab,
}: {
  workspaceId: string;
  setTab: (id: TabId) => void;
}) {
  const { t } = useI18n();
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(key(workspaceId)) === '1');
    } catch {
      setHidden(false);
    }
  }, [workspaceId]);

  if (hidden) return null;
  if (
    typeof window !== 'undefined' &&
    sessionStorage.getItem('mc_new_ws') === workspaceId
  ) {
    return null;
  }

  const dismiss = () => {
    try {
      localStorage.setItem(key(workspaceId), '1');
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  const go = (id: TabId) => () => setTab(id);

  return (
    <div className="card workspace-journey stack" style={{ boxShadow: 'none' }}>
      <div className="workspace-journey-head row">
        <p className="workspace-journey-title">{t('workspace.journeyTitle')}</p>
        <button type="button" className="secondary" onClick={dismiss}>
          {t('workspace.hide')}
        </button>
      </div>
      <ol className="workspace-journey-steps">
        <li>
          <button
            type="button"
            className="workspace-journey-link"
            onClick={go('requirements')}
          >
            {t('workspace.journeyStep1')}
          </button>{' '}
          {t('workspace.journeyStep1Desc')}
        </li>
        <li>
          <button
            type="button"
            className="workspace-journey-link"
            onClick={go('candidates')}
          >
            {t('workspace.journeyStep2')}
          </button>{' '}
          {t('workspace.journeyStep2Desc')}
        </li>
        <li>
          <button
            type="button"
            className="workspace-journey-link"
            onClick={go('compare')}
          >
            {t('workspace.journeyStep3')}
          </button>{' '}
          {t('workspace.journeyStep3Desc')}
        </li>
      </ol>
    </div>
  );
}
