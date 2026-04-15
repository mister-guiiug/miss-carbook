import type { Ws } from './settingsTypes'

export function SettingsWorkspaceMetaCard({
  workspace,
  isAdmin,
  wsName,
  setWsName,
  wsDesc,
  setWsDesc,
  busyWorkspaceMeta,
  onSave,
}: {
  workspace: Ws
  isAdmin: boolean
  wsName: string
  setWsName: (v: string) => void
  wsDesc: string
  setWsDesc: (v: string) => void
  busyWorkspaceMeta: boolean
  onSave: (e: React.FormEvent) => void
}) {
  return (
    <div className="card stack" style={{ boxShadow: 'none' }}>
      <h3 style={{ margin: 0 }}>Identité</h3>
      <p className="muted settings-card-lead" style={{ margin: 0 }}>
        En-tête et accueil — modification réservée aux administrateurs.
      </p>
      {isAdmin ? (
        <form onSubmit={onSave} className="stack">
          <div>
            <label htmlFor="ws-settings-name">Nom du dossier</label>
            <input
              id="ws-settings-name"
              value={wsName}
              onChange={(e) => setWsName(e.target.value)}
              maxLength={120}
              required
            />
          </div>
          <div>
            <label htmlFor="ws-settings-desc">Description</label>
            <textarea
              id="ws-settings-desc"
              value={wsDesc}
              onChange={(e) => setWsDesc(e.target.value)}
              rows={4}
              maxLength={4000}
            />
          </div>
          <button type="submit" disabled={busyWorkspaceMeta}>
            {busyWorkspaceMeta ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </form>
      ) : (
        <div className="stack">
          <p style={{ margin: 0 }}>
            <strong>{workspace.name}</strong>
          </p>
          <p className="muted" style={{ margin: 0 }}>
            {workspace.description?.trim() ? workspace.description : 'Sans description'}
          </p>
        </div>
      )}
    </div>
  )
}
