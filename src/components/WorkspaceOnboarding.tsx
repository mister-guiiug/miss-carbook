import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AssistantFullscreenLayout } from './assistant/AssistantFullscreenLayout'
import { shouldOfferAssistantUi } from '../lib/assistantDevice'
import { setWorkspaceAssistantTourDone } from '../lib/assistantStorage'

const doneKey = (id: string) => `mc_onboard_${id}`

export function WorkspaceOnboarding({
  workspaceId,
  workspaceName,
  onDone,
}: {
  workspaceId: string
  workspaceName: string
  onDone: () => void
}) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    setStep(0)
  }, [workspaceId])

  if (typeof window === 'undefined') return null
  if (localStorage.getItem(doneKey(workspaceId))) return null
  if (sessionStorage.getItem('mc_new_ws') !== workspaceId) return null

  const finish = () => {
    localStorage.setItem(doneKey(workspaceId), '1')
    sessionStorage.removeItem('mc_new_ws')
    setWorkspaceAssistantTourDone(workspaceId)
    onDone()
  }

  const stepCount = 3

  const steps: { titleId: string; title: string; body: ReactNode }[] = [
    {
      titleId: 'ws-onboard-1',
      title: `Bienvenue dans « ${workspaceName} »`,
      body: (
        <p className="muted" style={{ marginTop: 0 }}>
          Ce dossier est partagé en temps réel. Invitez des participants depuis l’onglet{' '}
          <strong>Réglages</strong> (code, lien ou invitation avec rôle et date d’expiration).
        </p>
      ),
    },
    {
      titleId: 'ws-onboard-2',
      title: 'Exigences, évaluations & modèles',
      body: (
        <p className="muted" style={{ marginTop: 0 }}>
          Définissez vos critères dans <strong>Exigences</strong>, ajoutez des véhicules dans{' '}
          <strong>Modèles</strong>, reliez-les dans <strong>Évaluations</strong> (statut + votes
          MoSCoW).
        </p>
      ),
    },
    {
      titleId: 'ws-onboard-3',
      title: 'Comparer, rappels & décision',
      body: (
        <p className="muted" style={{ marginTop: 0 }}>
          <strong>Comparer</strong> : graphiques, profils de critères, impression.{' '}
          <strong>Rappels</strong> pour les prochaines actions. Décision enregistrée dans{' '}
          <strong>Réglages</strong>.
        </p>
      ),
    },
  ]

  const fullscreen = shouldOfferAssistantUi()

  if (fullscreen) {
    const s = steps[step]
    const isLast = step >= stepCount - 1
    return (
      <AssistantFullscreenLayout
        stepIndex={step}
        stepCount={stepCount}
        titleId={s.titleId}
        title={s.title}
        showBack={step > 0}
        onBack={() => setStep((x) => Math.max(0, x - 1))}
        onPrimary={isLast ? finish : () => setStep((x) => x + 1)}
        primaryLabel={isLast ? 'C’est parti' : 'Suivant'}
        onPassAll={finish}
        onNeverShowAgain={finish}
      >
        {s.body}
      </AssistantFullscreenLayout>
    )
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
        Étape {step + 1} sur {stepCount}
      </p>
      <h3 style={{ marginTop: 0 }}>{steps[step].title}</h3>
      {steps[step].body}
      <div className="row" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
        <button type="button" className="secondary" onClick={finish}>
          Ne plus afficher
        </button>
        {step < steps.length - 1 ? (
          <button type="button" onClick={() => setStep((s) => s + 1)}>
            Suivant
          </button>
        ) : (
          <button type="button" onClick={finish}>
            C’est parti
          </button>
        )}
      </div>
    </div>
  )
}
