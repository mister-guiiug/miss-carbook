import { useState } from 'react'
import { AssistantFullscreenLayout } from './AssistantFullscreenLayout'
import { shouldOfferAssistantUi } from '../../lib/assistantDevice'
import { isInviteTipDone, setInviteTipDone } from '../../lib/assistantStorage'

const INVITE_KEY = 'mc_invite_welcome'

export function InviteWelcomeOverlay({
  workspaceId,
  workspaceName,
  onClose,
}: {
  workspaceId: string
  workspaceName: string
  onClose: () => void
}) {
  const [step, setStep] = useState(0)

  if (typeof window === 'undefined') return null
  if (!shouldOfferAssistantUi()) return null
  if (isInviteTipDone(workspaceId)) {
    try {
      sessionStorage.removeItem(INVITE_KEY)
    } catch {
      /* ignore */
    }
    return null
  }
  try {
    if (sessionStorage.getItem(INVITE_KEY) !== workspaceId) return null
  } catch {
    return null
  }

  const finish = () => {
    setInviteTipDone(workspaceId)
    try {
      sessionStorage.removeItem(INVITE_KEY)
    } catch {
      /* ignore */
    }
    onClose()
  }

  if (step === 0) {
    return (
      <AssistantFullscreenLayout
        stepIndex={0}
        stepCount={2}
        titleId="invite-welcome-1"
        title="Vous rejoignez ce dossier"
        showBack={false}
        onPrimary={() => setStep(1)}
        primaryLabel="Suivant"
        onPassAll={finish}
        onNeverShowAgain={finish}
      >
        <p className="muted" style={{ marginTop: 0 }}>
          Vous avez accepté une invitation pour « <strong>{workspaceName}</strong> ». Les membres
          voient les mêmes exigences, modèles et messages en temps réel.
        </p>
      </AssistantFullscreenLayout>
    )
  }

  return (
    <AssistantFullscreenLayout
      stepIndex={1}
      stepCount={2}
      titleId="invite-welcome-2"
      title="Par où commencer ?"
      showBack
      onBack={() => setStep(0)}
      onPrimary={finish}
      primaryLabel="Explorer le dossier"
      onPassAll={finish}
      onNeverShowAgain={finish}
    >
      <ul className="assistant-bullet-list">
        <li>
          <strong>Exigences</strong> — comprendre les critères du groupe.
        </li>
        <li>
          <strong>Modèles</strong> — voir les véhicules envisagés.
        </li>
        <li>
          <strong>Réglages</strong> — votre rôle, code de partage, invitations.
        </li>
      </ul>
    </AssistantFullscreenLayout>
  )
}
