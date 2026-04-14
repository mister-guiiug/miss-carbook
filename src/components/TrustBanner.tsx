import { useState } from 'react'

const KEY = 'mc-trust-banner-dismissed'

export function TrustBanner() {
  const [dismissed, setDismissed] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem(KEY) === '1' : false
  )

  if (dismissed) return null

  return (
    <div className="trust-banner" role="note">
      <p>
        <strong>Usage responsable :</strong> Miss Carbook sert à organiser un choix de véhicule
        entre proches ou collègues. N’y stockez pas de données bancaires, de mots de passe ni de
        contrats signés — ce n’est pas un coffre-fort certifié.
      </p>
      <button
        type="button"
        className="secondary trust-banner-close"
        onClick={() => {
          localStorage.setItem(KEY, '1')
          setDismissed(true)
        }}
      >
        Compris
      </button>
    </div>
  )
}
