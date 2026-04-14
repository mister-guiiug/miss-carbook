import { IconActionButton, IconCopy } from '../../ui/IconActionButton'
import type { Ws } from './settingsTypes'

export function SettingsShareClassicCard({
  workspace,
  inviteUrl,
  onCopy,
}: {
  workspace: Ws
  inviteUrl: string
  onCopy: () => void
}) {
  return (
    <div className="card stack" style={{ boxShadow: 'none' }}>
      <h3 style={{ margin: 0 }}>Partage classique</h3>
      <p>
        Code court&nbsp;: <code>{workspace.share_code}</code>
      </p>
      <p className="muted" style={{ wordBreak: 'break-all' }}>
        Lien d’invitation&nbsp;: {inviteUrl}
      </p>
      <IconActionButton
        variant="secondary"
        label="Copier le lien d’invitation"
        onClick={() => void onCopy()}
      >
        <IconCopy />
      </IconActionButton>
    </div>
  )
}
