import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AssistantFullscreenLayout } from '../components/assistant/AssistantFullscreenLayout';
import { setGlobalAssistantDone } from '../lib/assistantStorage';
import { useI18n } from '../i18n';

const STEP_COUNT = 5;

export function AssistantWelcomePage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [step, setStep] = useState(0);

  const goHome = useCallback(() => {
    navigate('/', { replace: true });
  }, [navigate]);

  const finishCompleted = useCallback(() => {
    setGlobalAssistantDone();
    goHome();
  }, [goHome]);

  const passAll = useCallback(() => {
    goHome();
  }, [goHome]);

  const neverShow = useCallback(() => {
    setGlobalAssistantDone();
    goHome();
  }, [goHome]);

  const titles = [
    t('assistant.welcomeTitle'),
    t('assistant.whatTitle'),
    t('assistant.accountTitle'),
    t('assistant.createTitle'),
    t('assistant.doneTitle'),
  ];

  const bodies: { titleId: string; content: ReactNode }[] = [
    {
      titleId: 'assistant-welcome-title',
      content: (
        <p className="muted" style={{ marginTop: 0 }}>
          {t('assistant.welcomeBody')}
        </p>
      ),
    },
    {
      titleId: 'assistant-what-title',
      content: (
        <ul className="assistant-bullet-list">
          <li>
            <strong>{t('assistant.reqLabel')}</strong>
            {t('assistant.whatReqText')}
          </li>
          <li>
            <strong>{t('assistant.modelsLabel')}</strong>
            {t('assistant.whatModelsText')}
          </li>
          <li>
            <strong>{t('assistant.whatCompareLabel')}</strong>
            {t('assistant.whatCompareText')}
          </li>
        </ul>
      ),
    },
    {
      titleId: 'assistant-account-title',
      content: (
        <p className="muted" style={{ marginTop: 0 }}>
          {t('assistant.accountBody1')}
          <strong>{t('assistant.accountPseudo')}</strong>
          {t('assistant.accountBody2')}
          <strong>{t('assistant.accountEmail')}</strong>
          {t('assistant.accountBody3')}
        </p>
      ),
    },
    {
      titleId: 'assistant-create-title',
      content: (
        <p className="muted" style={{ marginTop: 0 }}>
          {t('assistant.createBody1')}
          <strong>{t('assistant.createHome')}</strong>
          {t('assistant.createBody2')}
          <strong>{t('assistant.createShareCode')}</strong>
          {t('assistant.createBody3')}
        </p>
      ),
    },
    {
      titleId: 'assistant-done-title',
      content: (
        <p className="muted" style={{ marginTop: 0 }}>
          {t('assistant.doneBody')}
        </p>
      ),
    },
  ];

  const primary =
    step < STEP_COUNT - 1 ? () => setStep(s => s + 1) : finishCompleted;
  const primaryLabel =
    step < STEP_COUNT - 1 ? t('assistant.next') : t('assistant.goHome');

  // Garde noUncheckedIndexedAccess : `step` est borné par la navigation,
  // mais l'accès indexé reste `T | undefined` pour le compilateur.
  const currentBody = bodies[step];
  const currentTitle = titles[step];
  if (!currentBody || currentTitle === undefined) return null;

  return (
    <AssistantFullscreenLayout
      stepIndex={step}
      stepCount={STEP_COUNT}
      titleId={currentBody.titleId}
      title={currentTitle}
      showBack={step > 0}
      onBack={() => setStep(s => Math.max(0, s - 1))}
      onPrimary={primary}
      primaryLabel={primaryLabel}
      onPassAll={passAll}
      onNeverShowAgain={neverShow}
    >
      {currentBody.content}
    </AssistantFullscreenLayout>
  );
}
