import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { useErrorDialog } from '../contexts/ErrorDialogContext';
import { useWorkspaceChrome } from '../contexts/useWorkspaceChrome';
import { WorkspaceOnboarding } from '../components/WorkspaceOnboarding';
import { WorkspaceSearchModal } from '../components/WorkspaceSearchModal';
import { NotepadTab } from '../components/workspace/NotepadTab';
import { RequirementsTab } from '../components/workspace/RequirementsTab';
import { RequirementsMatrix } from '../components/workspace/RequirementsMatrix';
import { EvaluationsTab } from '../components/workspace/EvaluationsTab';
import { WeightedVotingTab } from '../components/workspace/WeightedVotingTab';
import { CandidatesTab } from '../components/workspace/CandidatesTab';
import { CompareTab } from '../components/workspace/CompareTab';
import { SmartCompareTab } from '../components/workspace/SmartCompareTab';
import { ActivityTab } from '../components/workspace/ActivityTab';
import { RemindersTab } from '../components/workspace/RemindersTab';
import { BudgetTab } from '../components/workspace/BudgetTab';
import { SettingsTab } from '../components/workspace/SettingsTab';
import {
  WORKSPACE_TABS,
  parseWorkspaceTabParam,
  type TabId,
} from '../components/workspace/workspaceTabs';
import { WorkspaceTabIcon } from '../components/workspace/WorkspaceTabIcons';
import { WorkspaceTabStrip } from '../components/workspace/WorkspaceTabStrip';
import { WorkspaceJourneyCard } from '../components/workspace/WorkspaceJourneyCard';
import { WorkspaceDecisionSummaryCard } from '../components/workspace/WorkspaceDecisionSummaryCard';
import { InviteWelcomeOverlay } from '../components/assistant/InviteWelcomeOverlay';

function WorkspacePageSkeleton() {
  const { t } = useI18n();
  return (
    <div
      className="shell stack workspace-page-skeleton"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">{t('workspace.loadingWorkspaceSr')}</span>
      <div className="skeleton-block skeleton-breadcrumb" />
      <div className="skeleton-block skeleton-title" />
      <div className="skeleton-block skeleton-line wide" />
      <div className="skeleton-block skeleton-tabs" />
      <div className="skeleton-block skeleton-card" />
    </div>
  );
}

export function WorkspacePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { setWorkspaceChrome } = useWorkspaceChrome();
  const { reportException, reportMessage } = useErrorDialog();
  const { workspace, role, decisionLabel, loading, accessBlocked, refresh } =
    useWorkspace(workspaceId, user?.id, reportException, reportMessage);
  const { t } = useI18n();
  const tab = parseWorkspaceTabParam(searchParams.get('tab'));
  const [searchOpen, setSearchOpen] = useState(false);
  const [, bump] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelFocusSkip = useRef(true);
  const [headerHintVisible, setHeaderHintVisible] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    const key = `mc_ws_header_hint_${workspaceId}`;
    try {
      setHeaderHintVisible(localStorage.getItem(key) !== '1');
    } catch {
      setHeaderHintVisible(true);
    }
  }, [workspaceId]);

  const setTab = useCallback(
    (id: TabId) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (id === 'notepad') next.delete('tab');
          else next.set('tab', id);
          return next;
        },
        { replace: false }
      );
    },
    [setSearchParams]
  );

  useEffect(() => {
    const raw = searchParams.get('tab');
    if (raw && !WORKSPACE_TABS.some(tabDef => tabDef.id === raw)) {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          next.delete('tab');
          return next;
        },
        { replace: true }
      );
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (panelFocusSkip.current) {
      panelFocusSkip.current = false;
      return;
    }
    queueMicrotask(() => panelRef.current?.focus());
  }, [tab]);

  const openSearch = useCallback(() => setSearchOpen(true), []);

  useEffect(() => {
    if (!workspaceId || !user) {
      setWorkspaceChrome(null);
      return;
    }
    if (loading || accessBlocked || !workspace || !role) {
      setWorkspaceChrome(null);
      return;
    }
    const canW = role === 'write' || role === 'admin';
    setWorkspaceChrome({
      canWrite: canW,
      setTab,
      openSearch,
    });
    return () => setWorkspaceChrome(null);
  }, [
    workspaceId,
    user,
    loading,
    accessBlocked,
    workspace,
    role,
    setTab,
    openSearch,
    setWorkspaceChrome,
  ]);

  if (!workspaceId)
    return <p className="shell">{t('workspace.notFound')}</p>;

  if (!user) {
    return (
      <div className="shell stack">
        <p className="muted">{t('workspace.loadingSession')}</p>
        <Link to="/">{t('workspace.backArrow')}</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="shell stack">
        <WorkspacePageSkeleton />
        <Link to="/">{t('workspace.backHomeArrow')}</Link>
      </div>
    );
  }

  if (accessBlocked || !workspace || !role) {
    return (
      <div className="shell stack">
        <p className="muted">{t('workspace.accessBlockedHelp')}</p>
        <Link to="/">{t('workspace.backArrow')}</Link>
      </div>
    );
  }

  const canWrite = role === 'write' || role === 'admin';
  const isAdmin = role === 'admin';
  const isReadOnly = role === 'read';

  const dismissHeaderHint = () => {
    if (!workspaceId) return;
    try {
      localStorage.setItem(`mc_ws_header_hint_${workspaceId}`, '1');
    } catch {
      /* ignore */
    }
    setHeaderHintVisible(false);
  };

  return (
    <div className="shell stack">
      {workspace ? (
        <InviteWelcomeOverlay
          workspaceId={workspaceId!}
          workspaceName={workspace.name}
          onClose={() => {}}
        />
      ) : null}
      <WorkspaceSearchModal
        workspaceId={workspaceId}
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onPick={picked => setTab(picked as TabId)}
      />

      <WorkspaceOnboarding
        workspaceId={workspaceId}
        workspaceName={workspace.name}
        onDone={() => bump(n => n + 1)}
      />

      <WorkspaceJourneyCard workspaceId={workspaceId} setTab={setTab} />

      <WorkspaceDecisionSummaryCard
        workspaceId={workspaceId}
        hasRecordedDecision={Boolean(
          workspace.selected_candidate_id && decisionLabel
        )}
        setTab={setTab}
      />

      {isReadOnly ? (
        <div className="workspace-readonly-banner" role="status">
          <strong>{t('workspace.readOnly')}</strong>
          {t('workspace.readOnlyBannerText')}
        </div>
      ) : null}

      {workspace.selected_candidate_id && decisionLabel ? (
        <div
          className="card decision-banner workspace-decision-banner"
          style={{ boxShadow: 'none' }}
        >
          <div className="workspace-decision-banner-row">
            <div className="stack" style={{ gap: '0.25rem' }}>
              <strong>{t('workspace.decisionRecordedTitle')}</strong>
              {t('workspace.decisionBannerPrefix')}
              {decisionLabel}
              {t('workspace.decisionBannerSuffix')}
              {workspace.decision_notes ? (
                <span className="muted"> — {workspace.decision_notes}</span>
              ) : null}
            </div>
            <Link
              to="?tab=settings#workspace-settings-decision"
              className="workspace-decision-banner-link"
            >
              {t('workspace.editInSettings')}
            </Link>
          </div>
        </div>
      ) : null}

      <header className="workspace-header workspace-header--document">
        <div className="workspace-header-main">
          <nav
            className="workspace-breadcrumb muted"
            aria-label={t('workspace.breadcrumbLabel')}
          >
            <Link to="/">{t('workspace.home')}</Link>
            <span aria-hidden="true"> · </span>
            <span className="workspace-breadcrumb-current">
              {workspace.name}
            </span>
          </nav>
          <div className="workspace-header-title-row">
            <h1 className="workspace-header-title" id="workspace-title">
              {workspace.name}
            </h1>
            <div
              className="workspace-header-inline-tabs"
              role="toolbar"
              aria-label={t('workspace.activityShortcutLabel')}
            >
              <button
                type="button"
                id="workspace-tab-btn-activity"
                className={
                  tab === 'activity'
                    ? 'workspace-header-icon-tab workspace-header-icon-tab--active'
                    : 'workspace-header-icon-tab'
                }
                title={t('workspace.tab_activity_title')}
                aria-label={t('workspace.activityOfWorkspace')}
                aria-pressed={tab === 'activity'}
                onClick={() => setTab('activity')}
              >
                <WorkspaceTabIcon tabId="activity" />
              </button>
            </div>
            <span
              className={`badge workspace-role-badge workspace-role-badge--${role}`}
              title={t('workspace.yourRoleTitle')}
            >
              {role === 'admin'
                ? t('workspace.roleAdmin')
                : role === 'write'
                  ? t('workspace.roleWrite')
                  : t('workspace.readOnly')}
            </span>
          </div>
          <p className="muted workspace-header-desc">
            {workspace.description?.trim() ? (
              workspace.description
            ) : isAdmin ? (
              <>
                <span>{t('workspace.noDescription')}</span>{' '}
                <button
                  type="button"
                  className="link-like"
                  onClick={() => setTab('settings')}
                >
                  {t('workspace.addDescription')}
                </button>
              </>
            ) : (
              t('workspace.withoutDescription')
            )}
          </p>
          {headerHintVisible ? (
            <div
              className="workspace-header-hint card"
              style={{ boxShadow: 'none' }}
            >
              <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                <strong>{t('workspace.tab_settings')}</strong>
                {t('workspace.hintMid1')}
                <strong>{t('workspace.searchWord')}</strong>
                {t('workspace.hintMid2')}
                <strong>{t('workspace.tab_activity')}</strong>
                {t('workspace.hintEnd')}
              </p>
              <button
                type="button"
                className="secondary workspace-header-hint-dismiss"
                onClick={dismissHeaderHint}
              >
                {t('workspace.dontShowAgain')}
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <div className="workspace-tabs-toolbar">
        <div className="workspace-tabs-toolbar-row">
          <h2 className="workspace-tabs-heading" id="workspace-tabs-heading">
            {t('workspace.sections')}
          </h2>
          <p className="workspace-shortcuts-hint muted">
            <kbd className="kbd">Ctrl</kbd> / <kbd className="kbd">⌘</kbd> +{' '}
            <kbd className="kbd">K</kbd> · {t('workspace.searchWord')}
          </p>
        </div>
        <WorkspaceTabStrip
          tab={tab}
          setTab={setTab}
          tabListLabelId="workspace-tabs-heading"
        />
      </div>

      <div
        ref={panelRef}
        id="workspace-main-panel"
        role="tabpanel"
        tabIndex={0}
        aria-labelledby={
          tab === 'settings' || tab === 'activity'
            ? 'workspace-tabs-heading'
            : `workspace-tab-btn-${tab}`
        }
        className="card workspace-tabpanel"
      >
        {tab === 'notepad' ? (
          <NotepadTab workspaceId={workspaceId} canWrite={canWrite} />
        ) : null}
        {tab === 'requirements' ? (
          <RequirementsTab workspaceId={workspaceId} canWrite={canWrite} />
        ) : null}
        {tab === 'requirementsMatrix' ? (
          <RequirementsMatrix workspaceId={workspaceId} canWrite={canWrite} />
        ) : null}
        {tab === 'evaluations' ? (
          <EvaluationsTab
            workspaceId={workspaceId}
            canWrite={canWrite}
            userId={user.id}
          />
        ) : null}
        {tab === 'weightedVoting' ? (
          <WeightedVotingTab
            workspaceId={workspaceId}
            canWrite={canWrite}
            userId={user.id}
          />
        ) : null}
        {tab === 'candidates' ? (
          <CandidatesTab
            workspaceId={workspaceId}
            canWrite={canWrite}
            userId={user.id}
          />
        ) : null}
        {tab === 'compare' ? (
          <CompareTab workspaceId={workspaceId} canWrite={canWrite} />
        ) : null}
        {tab === 'smartCompare' ? (
          <SmartCompareTab workspaceId={workspaceId} />
        ) : null}
        {tab === 'reminders' ? (
          <RemindersTab
            workspaceId={workspaceId}
            canWrite={canWrite}
            userId={user.id}
          />
        ) : null}
        {tab === 'budget' ? (
          <BudgetTab workspaceId={workspaceId} canWrite={canWrite} />
        ) : null}
        {tab === 'activity' ? <ActivityTab workspaceId={workspaceId} /> : null}
        {tab === 'settings' ? (
          <SettingsTab
            workspace={workspace}
            canWrite={canWrite}
            isAdmin={isAdmin}
            userId={user.id}
            onWorkspaceRefresh={() => void refresh()}
          />
        ) : null}
      </div>
    </div>
  );
}
