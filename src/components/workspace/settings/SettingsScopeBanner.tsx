import { Link } from 'react-router-dom'

export function SettingsScopeBanner({ workspaceName }: { workspaceName: string }) {
  return (
    <div className="settings-scope-banner stack" role="region" aria-label="Périmètre des réglages">
      <p style={{ margin: 0, fontWeight: 600 }}>
        <span className="settings-scope-badge settings-scope-badge--workspace">Ce dossier</span>{' '}
        Tout ce qui suit ne concerne que le projet « {workspaceName} » (partage, membres, nom…).
      </p>
      <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
        Pour votre pseudo, le thème sur cet appareil ou le rechargement de l’application :{' '}
        <Link to="/parametres">paramètres généraux</Link>.
      </p>
    </div>
  )
}
