import { ExportWorkspaceButton } from '../ExportWorkspaceButton'
import { ExportWorkspacePromptButton } from '../ExportWorkspacePromptButton'

export function SettingsExportCard({ workspaceId }: { workspaceId: string }) {
  return (
    <div className="card stack" style={{ boxShadow: 'none' }}>
      <h3 style={{ margin: 0 }}>Export</h3>
      <p className="muted settings-card-lead" style={{ margin: 0 }}>
        Archive JSON ou texte pour l’assistant.
      </p>
      <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-start', gap: '1.25rem' }}>
        <ExportWorkspaceButton workspaceId={workspaceId} />
        <ExportWorkspacePromptButton workspaceId={workspaceId} />
      </div>
    </div>
  )
}
