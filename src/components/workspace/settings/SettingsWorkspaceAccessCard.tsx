import type { Dispatch, SetStateAction } from 'react'
import { IconActionButton, IconBan, IconCopy, IconPlus } from '../../ui/IconActionButton'
import type { InviteRow, Ws } from './settingsTypes'

/** Lien permanent + invitations (admin), regroupés pour limiter le défilement. */
export function SettingsWorkspaceAccessCard({
  workspace,
  inviteUrl,
  onCopy,
  isAdmin,
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
  workspace: Ws
  inviteUrl: string
  onCopy: () => void
  isAdmin: boolean
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
  const lastLink = lastToken
    ? `${origin}${base}?invite=${lastToken}`.replace(/([^:]\/)\/+/g, '$1')
    : null

  return (
    <div className="card stack settings-access-card" style={{ boxShadow: 'none' }}>
      <h3 style={{ margin: 0 }}>Accès au dossier</h3>

      <div className="settings-access-block stack">
        <h4 className="settings-access-subtitle">Lien permanent</h4>
        <p className="muted settings-access-lead" style={{ margin: 0 }}>
          Code <code>{workspace.share_code}</code> — tout membre déjà connecté peut rejoindre avec
          ce lien.
        </p>
        <p className="settings-access-url muted" title={inviteUrl}>
          {inviteUrl}
        </p>
        <div>
          <IconActionButton
            variant="secondary"
            label="Copier le lien"
            onClick={() => void onCopy()}
          >
            <IconCopy />
          </IconActionButton>
        </div>
      </div>

      {isAdmin ? (
        <>
          <hr className="settings-access-sep" />
          <div className="settings-access-block stack">
            <h4 className="settings-access-subtitle">Invitations (lien à usage unique)</h4>
            <p className="muted settings-access-lead" style={{ margin: 0 }}>
              Rôle + expiration. Le lien est copié automatiquement à la création.
            </p>
            <div className="settings-invite-toolbar row">
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
                aria-label="Rôle pour la nouvelle invitation"
              >
                <option value="read">Lecture</option>
                <option value="write">Écriture</option>
                <option value="admin">Admin</option>
              </select>
              <div
                className="settings-invite-days row"
                style={{ alignItems: 'center', gap: '0.35rem' }}
              >
                <span className="muted" style={{ fontSize: '0.85rem' }}>
                  Expire dans
                </span>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={inviteDays}
                  onChange={(e) => setInviteDays(Number(e.target.value))}
                  style={{ width: '4.25rem' }}
                  aria-label="Durée de validité en jours"
                />
                <span className="muted" style={{ fontSize: '0.85rem' }}>
                  j
                </span>
              </div>
              <IconActionButton
                variant="primary"
                label="Créer une invitation"
                onClick={() => void onCreateInvite()}
              >
                <IconPlus />
              </IconActionButton>
            </div>
            {lastLink ? (
              <p className="muted settings-access-url" style={{ margin: 0 }} title={lastLink}>
                Dernière : <code>{lastLink}</code>
              </p>
            ) : null}
            <ul className="settings-invite-list">
              {invites.map((i) => (
                <li key={i.id} className="settings-invite-list-item">
                  <span className="settings-invite-list-meta">
                    <code>{i.token.slice(0, 8)}…</code>
                    <span className="muted">{i.role}</span>
                    <span className="muted">
                      exp. {new Date(i.expires_at).toLocaleDateString('fr-FR')}
                      {i.used_at ? ' · utilisée' : ''}
                    </span>
                  </span>
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
        </>
      ) : null}
    </div>
  )
}
