import { useEffect, useState } from 'react';
import { getSupabase } from '../../lib/supabase';
import { useErrorDialog } from '../../contexts/ErrorDialogContext';
import type { TabId } from './workspaceTabs';
import { useI18n } from '../../i18n';

/** Synthèse rapide : décision, rappels ouverts, liens vers les sections utiles. */
export function WorkspaceDecisionSummaryCard({
  workspaceId,
  hasRecordedDecision,
  setTab,
}: {
  workspaceId: string;
  hasRecordedDecision: boolean;
  setTab: (id: TabId) => void;
}) {
  const { reportException } = useErrorDialog();
  const { t } = useI18n();
  const [pendingReminders, setPendingReminders] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { count, error } = await getSupabase()
        .from('reminders')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('done', false);
      if (cancelled) return;
      if (error) {
        reportException(error, t('workspace.ctxSummaryReminders'));
        setPendingReminders(null);
        return;
      }
      setPendingReminders(count ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, reportException, t]);

  return (
    <div
      className="card workspace-summary-card stack"
      style={{ boxShadow: 'none' }}
    >
      <h2 className="workspace-summary-title">{t('workspace.overview')}</h2>
      <ul className="workspace-summary-list">
        <li>
          <strong>{t('workspace.decision')}</strong>
          {t('workspace.colon')}{' '}
          {hasRecordedDecision ? (
            <span className="muted">
              {t('workspace.decisionRecordedDetail')}
            </span>
          ) : (
            <>
              <span className="muted">{t('workspace.decisionNotSet')}</span>{' '}
              <button
                type="button"
                className="link-like"
                onClick={() => setTab('settings')}
              >
                {t('workspace.saveInSettings')}
              </button>
            </>
          )}
        </li>
        <li>
          <strong>{t('workspace.pendingReminders')}</strong>
          {t('workspace.colon')}{' '}
          {pendingReminders === null ? (
            <span className="muted">…</span>
          ) : (
            <>
              {pendingReminders}{' '}
              {pendingReminders > 0 ? (
                <button
                  type="button"
                  className="link-like"
                  onClick={() => setTab('reminders')}
                >
                  {t('workspace.view')}
                </button>
              ) : (
                <span className="muted">{t('workspace.none')}</span>
              )}
            </>
          )}
        </li>
        <li>
          <strong>{t('workspace.matrix')}</strong>
          {t('workspace.colon')}{' '}
          <button
            type="button"
            className="link-like"
            onClick={() => setTab('evaluations')}
          >
            {t('workspace.matrixLink')}
          </button>
        </li>
      </ul>
    </div>
  );
}
