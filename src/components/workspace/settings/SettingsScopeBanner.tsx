import { Link } from 'react-router-dom'

export function SettingsScopeBanner({ workspaceName }: { workspaceName: string }) {
  return (
    <div className="settings-scope-banner stack" role="region" aria-label="Périmètre des réglages">
      <p className="settings-scope-banner-text" style={{ margin: 0 }}>
        <span className="settings-scope-badge settings-scope-badge--workspace">Ce dossier</span>{' '}
        <strong>« {workspaceName} »</strong> — compte et app :{' '}
        <Link to="/parametres">paramètres généraux</Link>.
      </p>
    </div>
  )
}
