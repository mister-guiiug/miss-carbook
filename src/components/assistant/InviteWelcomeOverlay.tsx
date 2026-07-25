import { useState } from 'react';
import { AssistantFullscreenLayout } from './AssistantFullscreenLayout';
import { shouldOfferAssistantUi } from '../../lib/assistantDevice';
import { isInviteTipDone, setInviteTipDone } from '../../lib/assistantStorage';
import { useI18n } from '../../i18n';

const INVITE_KEY = 'mc_invite_welcome';

export function InviteWelcomeOverlay({
  workspaceId,
  workspaceName,
  onClose,
}: {
  workspaceId: string;
  workspaceName: string;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const { t } = useI18n();

  if (typeof window === 'undefined') return null;
  if (!shouldOfferAssistantUi()) return null;
  if (isInviteTipDone(workspaceId)) {
    try {
      sessionStorage.removeItem(INVITE_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
  try {
    if (sessionStorage.getItem(INVITE_KEY) !== workspaceId) return null;
  } catch {
    return null;
  }

  const finish = () => {
    setInviteTipDone(workspaceId);
    try {
      sessionStorage.removeItem(INVITE_KEY);
    } catch {
      /* ignore */
    }
    onClose();
  };

  if (step === 0) {
    return (
      <AssistantFullscreenLayout
        stepIndex={0}
        stepCount={2}
        titleId="invite-welcome-1"
        title={t('assistant.inviteTitle1')}
        showBack={false}
        onPrimary={() => setStep(1)}
        primaryLabel={t('assistant.next')}
        onPassAll={finish}
        onNeverShowAgain={finish}
      >
        <p className="muted" style={{ marginTop: 0 }}>
          {t('assistant.inviteBody1a')}
          <strong>{workspaceName}</strong>
          {t('assistant.inviteBody1b')}
        </p>
      </AssistantFullscreenLayout>
    );
  }

  return (
    <AssistantFullscreenLayout
      stepIndex={1}
      stepCount={2}
      titleId="invite-welcome-2"
      title={t('assistant.inviteTitle2')}
      showBack
      onBack={() => setStep(0)}
      onPrimary={finish}
      primaryLabel={t('assistant.inviteExplore')}
      onPassAll={finish}
      onNeverShowAgain={finish}
    >
      <ul className="assistant-bullet-list">
        <li>
          <strong>{t('assistant.reqLabel')}</strong>
          {t('assistant.inviteReqText')}
        </li>
        <li>
          <strong>{t('assistant.modelsLabel')}</strong>
          {t('assistant.inviteModelsText')}
        </li>
        <li>
          <strong>{t('assistant.settingsLabel')}</strong>
          {t('assistant.inviteSettingsText')}
        </li>
      </ul>
    </AssistantFullscreenLayout>
  );
}
