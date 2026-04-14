import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AssistantFullscreenLayout } from '../components/assistant/AssistantFullscreenLayout'
import { setGlobalAssistantDone } from '../lib/assistantStorage'

const STEP_COUNT = 5

export function AssistantWelcomePage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)

  const goHome = useCallback(() => {
    navigate('/', { replace: true })
  }, [navigate])

  const finishCompleted = useCallback(() => {
    setGlobalAssistantDone()
    goHome()
  }, [goHome])

  const passAll = useCallback(() => {
    goHome()
  }, [goHome])

  const neverShow = useCallback(() => {
    setGlobalAssistantDone()
    goHome()
  }, [goHome])

  const titles = [
    'Bienvenue sur Miss Carbook',
    'Ce que vous ferez ici',
    'Votre compte',
    'Créer ou rejoindre un dossier',
    'C’est parti',
  ]

  const bodies: { titleId: string; content: ReactNode }[] = [
    {
      titleId: 'assistant-welcome-title',
      content: (
        <p className="muted" style={{ marginTop: 0 }}>
          Un carnet partagé pour comparer des véhicules, structurer vos exigences et décider à
          plusieurs sans vous perdre dans les messages.
        </p>
      ),
    },
    {
      titleId: 'assistant-what-title',
      content: (
        <ul className="assistant-bullet-list">
          <li>
            <strong>Exigences</strong> — ce qui compte vraiment pour vous.
          </li>
          <li>
            <strong>Modèles</strong> — les véhicules étudiés, photos et avis.
          </li>
          <li>
            <strong>Comparer & décider</strong> — synthèse et trace des choix.
          </li>
        </ul>
      ),
    },
    {
      titleId: 'assistant-account-title',
      content: (
        <p className="muted" style={{ marginTop: 0 }}>
          Votre <strong>pseudo</strong> est visible par les autres membres d’un dossier. Associez un{' '}
          <strong>e-mail</strong> depuis l’accueil ou les paramètres pour recevoir un lien et vous
          reconnecter sur un autre appareil.
        </p>
      ),
    },
    {
      titleId: 'assistant-create-title',
      content: (
        <p className="muted" style={{ marginTop: 0 }}>
          Sur l’<strong>accueil</strong>, créez un dossier (projet véhicule) ou rejoignez-en un avec
          un <strong>code de partage</strong>. Vous pourrez inviter d’autres personnes ensuite.
        </p>
      ),
    },
    {
      titleId: 'assistant-done-title',
      content: (
        <p className="muted" style={{ marginTop: 0 }}>
          Retournez à l’accueil pour créer votre premier dossier ou ouvrir un dossier existant.
        </p>
      ),
    },
  ]

  const primary = step < STEP_COUNT - 1 ? () => setStep((s) => s + 1) : finishCompleted
  const primaryLabel = step < STEP_COUNT - 1 ? 'Suivant' : 'Aller à l’accueil'

  return (
    <AssistantFullscreenLayout
      stepIndex={step}
      stepCount={STEP_COUNT}
      titleId={bodies[step].titleId}
      title={titles[step]}
      showBack={step > 0}
      onBack={() => setStep((s) => Math.max(0, s - 1))}
      onPrimary={primary}
      primaryLabel={primaryLabel}
      onPassAll={passAll}
      onNeverShowAgain={neverShow}
    >
      {bodies[step].content}
    </AssistantFullscreenLayout>
  )
}
