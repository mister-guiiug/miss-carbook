import { Link } from 'react-router-dom'

export function SettingsScopeBanner({ workspaceName }: { workspaceName: string }) {
  return (
    <div className="settings-scope-banner stack" role="region" aria-label="Périmètre des réglages">
      <p style={{ margin: 0, fontWeight: 600 }}>
        <span className="settings-scope-badge settings-scope-badge--workspace">Ce dossier</span>{' '}
        Réglages du projet « {workspaceName} » uniquement (fiche, partage, membres…).
      </p>
      <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
        Compte, thème et mise à jour de l’app : <Link to="/parametres">paramètres généraux</Link>.
      </p>
    </div>
  )
}
