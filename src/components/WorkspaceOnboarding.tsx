import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AssistantFullscreenLayout } from './assistant/AssistantFullscreenLayout';
import { shouldOfferAssistantUi } from '../lib/assistantDevice';
import { setWorkspaceAssistantTourDone } from '../lib/assistantStorage';
import { useI18n } from '../i18n';

const doneKey = (id: string) => `mc_onboard_${id}`;

export function WorkspaceOnboarding({
  workspaceId,
  workspaceName,
  onDone,
}: {
  workspaceId: string;
  workspaceName: string;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);

  useEffect(() => {
    setStep(0);
  }, [workspaceId]);

  if (typeof window === 'undefined') return null;
  if (localStorage.getItem(doneKey(workspaceId))) return null;
  if (sessionStorage.getItem('mc_new_ws') !== workspaceId) return null;

  const finish = () => {
    localStorage.setItem(doneKey(workspaceId), '1');
    sessionStorage.removeItem('mc_new_ws');
    setWorkspaceAssistantTourDone(workspaceId);
    onDone();
  };

  const stepCount = 3;

  const steps: { titleId: string; title: string; body: ReactNode }[] = [
    {
      titleId: 'ws-onboard-1',
      title: t('workspace.onboardWelcomeTitle', { name: workspaceName }),
      body: (
        <p className="muted" style={{ marginTop: 0 }}>
          {t('workspace.onboardStep1a')}
          <strong>{t('workspace.tab_settings')}</strong>
          {t('workspace.onboardStep1b')}
        </p>
      ),
    },
    {
      titleId: 'ws-onboard-2',
      title: t('workspace.onboardStep2Title'),
      body: (
        <p className="muted" style={{ marginTop: 0 }}>
          {t('workspace.onboardStep2a')}
          <strong>{t('workspace.tab_requirements')}</strong>
          {t('workspace.onboardStep2b')}
          <strong>{t('workspace.tab_candidates')}</strong>
          {t('workspace.onboardStep2c')}
          <strong>{t('workspace.tab_evaluations')}</strong>
          {t('workspace.onboardStep2d')}
        </p>
      ),
    },
    {
      titleId: 'ws-onboard-3',
      title: t('workspace.onboardStep3Title'),
      body: (
        <p className="muted" style={{ marginTop: 0 }}>
          <strong>{t('workspace.tab_compare')}</strong>
          {t('workspace.onboardStep3a')}
          <strong>{t('workspace.tab_reminders')}</strong>
          {t('workspace.onboardStep3b')}
          <strong>{t('workspace.tab_settings')}</strong>.
        </p>
      ),
    },
  ];

  const fullscreen = shouldOfferAssistantUi();

  if (fullscreen) {
    const s = steps[step];
    const isLast = step >= stepCount - 1;
    if (!s) return null;
    return (
      <AssistantFullscreenLayout
        stepIndex={step}
        stepCount={stepCount}
        titleId={s.titleId}
        title={s.title}
        showBack={step > 0}
        onBack={() => setStep(x => Math.max(0, x - 1))}
        onPrimary={isLast ? finish : () => setStep(x => x + 1)}
        primaryLabel={isLast ? t('workspace.letsGo') : t('workspace.next')}
        onPassAll={finish}
        onNeverShowAgain={finish}
      >
        {s.body}
      </AssistantFullscreenLayout>
    );
  }

  return (
    <div className="card onboarding-card stack">
      <div className="onboarding-steps" aria-hidden="true">
        {Array.from({ length: stepCount }, (_, i) => (
          <span
            key={i}
            className={`onboarding-step-dot${i === step ? ' onboarding-step-dot--active' : ''}`}
          />
        ))}
      </div>
      <p className="onboarding-step-meta muted">
        {t('workspace.stepOf', { current: step + 1, total: stepCount })}
      </p>
      <h3 style={{ marginTop: 0 }}>{steps[step]?.title}</h3>
      {steps[step]?.body}
      <div
        className="row"
        style={{ justifyContent: 'flex-end', gap: '0.5rem' }}
      >
        <button type="button" className="secondary" onClick={finish}>
          {t('workspace.dontShowAgain')}
        </button>
        {step < steps.length - 1 ? (
          <button type="button" onClick={() => setStep(s => s + 1)}>
            {t('workspace.next')}
          </button>
        ) : (
          <button type="button" onClick={finish}>
            {t('workspace.letsGo')}
          </button>
        )}
      </div>
    </div>
  );
}
