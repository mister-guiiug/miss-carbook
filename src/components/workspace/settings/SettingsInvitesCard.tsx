import type { Dispatch, SetStateAction } from 'react'
import { IconActionButton, IconBan, IconPlus } from '../../ui/IconActionButton'
import type { InviteRow } from './settingsTypes'

export function SettingsInvitesCard({
  origin,
  base,
  inviteRole,
  setInviteRole,
  inviteDays,
  setInviteDays,
  lastToken,
  invites,
  onCreateInvite,
  onRevokeInvite,
}: {
  origin: string
  base: string
  inviteRole: 'read' | 'write' | 'admin'
  setInviteRole: Dispatch<SetStateAction<'read' | 'write' | 'admin'>>
  inviteDays: number
  setInviteDays: Dispatch<SetStateAction<number>>
  lastToken: string | null
  invites: InviteRow[]
  onCreateInvite: () => void
  onRevokeInvite: (id: string) => void
}) {
  return (
    <div className="card stack" style={{ boxShadow: 'none' }}>
      <h3 style={{ margin: 0 }}>Invitations avec rôle & expiration</h3>
      <p className="muted">
        Lien à usage unique (après acceptation). Copié dans le presse-papiers à la création.
      </p>
      <div className="row">
        <select
          value={inviteRole}
          onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
        >
          <option value="read">Lecture</option>
          <option value="write">Écriture</option>
          <option value="admin">Admin</option>
        </select>
        <input
          type="number"
          min={1}
          max={90}
          value={inviteDays}
          onChange={(e) => setInviteDays(Number(e.target.value))}
          style={{ width: '5rem' }}
        />
        <span className="muted">jours</span>
        <IconActionButton
          variant="primary"
          label="Créer une invitation avec rôle et expiration"
          onClick={() => void onCreateInvite()}
        >
          <IconPlus />
        </IconActionButton>
      </div>
      {lastToken ? (
        <p className="muted" style={{ wordBreak: 'break-all' }}>
          Dernier lien :{' '}
          <code>{`${origin}${base}?invite=${lastToken}`.replace(/([^:]\/)\/+/g, '$1')}</code>
        </p>
      ) : null}
      <ul style={{ paddingLeft: '1.1rem' }}>
        {invites.map((i) => (
          <li key={i.id}>
            <code>{i.token.slice(0, 8)}…</code> — {i.role} — exp.{' '}
            {new Date(i.expires_at).toLocaleDateString('fr-FR')}
            {i.used_at ? ' — utilisée' : ''}
            {!i.used_at ? (
              <IconActionButton
                variant="danger"
                label={`Révoquer l’invitation ${i.token.slice(0, 8)}…`}
                onClick={() => void onRevokeInvite(i.id)}
              >
                <IconBan />
              </IconActionButton>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
