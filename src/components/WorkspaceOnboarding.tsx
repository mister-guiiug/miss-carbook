import { useEffect, useState } from 'react'

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
    onDone()
  }

  const steps = [
    <>
      <h3 style={{ marginTop: 0 }}>Bienvenue dans « {workspaceName} »</h3>
      <p className="muted">
        Ce dossier est partagé en temps réel. Invitez des participants depuis l’onglet{' '}
        <strong>Réglages</strong> (code, lien ou invitation avec rôle et date d’expiration).
      </p>
    </>,
    <>
      <h3 style={{ marginTop: 0 }}>Exigences, évaluations & modèles</h3>
      <p className="muted">
        Définissez vos critères dans <strong>Exigences</strong>, ajoutez des véhicules dans{' '}
        <strong>Modèles</strong>, reliez-les dans <strong>Évaluations</strong> (statut + votes
        MoSCoW).
      </p>
    </>,
    <>
      <h3 style={{ marginTop: 0 }}>Comparer, rappels & décision</h3>
      <p className="muted">
        <strong>Comparer</strong> : graphiques, profils de critères, impression PDF.{' '}
        <strong>Rappels</strong> pour les prochaines actions. Décision enregistrée dans{' '}
        <strong>Réglages</strong>.
      </p>
    </>,
  ]

  return (
    <div className="card onboarding-card stack">
      {steps[step]}
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
