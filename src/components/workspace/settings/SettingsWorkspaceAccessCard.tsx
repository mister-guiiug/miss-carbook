import type { Dispatch, SetStateAction } from 'react';
import { useActionGuard } from '@mister-guiiug/dev-pwa-config/react/use-action-guard';
import {
  IconActionButton,
  IconBan,
  IconCopy,
  IconPlus,
} from '../../ui/IconActionButton';
import type { InviteRow, Ws } from './settingsTypes';
import { useI18n } from '../../../i18n';
import { getDefaultLocale } from '@mister-guiiug/dev-pwa-config/format';

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
  workspace: Ws;
  inviteUrl: string;
  onCopy: () => void;
  isAdmin: boolean;
  origin: string;
  base: string;
  inviteRole: 'read' | 'write' | 'admin';
  setInviteRole: Dispatch<SetStateAction<'read' | 'write' | 'admin'>>;
  inviteDays: number;
  setInviteDays: Dispatch<SetStateAction<number>>;
  lastToken: string | null;
  invites: InviteRow[];
  onCreateInvite: () => void;
  onRevokeInvite: (id: string) => void;
}) {
  const { t } = useI18n();

  /**
   * Créer une invitation appelle `create_workspace_invite`, la révoquer
   * supprime la ligne : deux allers-retours réseau, aucun repli local. Hors
   * connexion, un jeton « créé » n'existerait nulle part — et le code affiché
   * serait un mensonge. Copier le lien permanent, en revanche, reste possible :
   * c'est du texte déjà en mémoire, aucun réseau n'est nécessaire.
   */
  const guard = useActionGuard({ online: true });

  const lastLink = lastToken
    ? `${origin}${base}?invite=${lastToken}`.replace(/([^:]\/)\/+/g, '$1')
    : null;

  return (
    <div
      className="card stack settings-access-card"
      style={{ boxShadow: 'none' }}
    >
      <h3 style={{ margin: 0 }}>{t('settings.access.title')}</h3>

      <div className="settings-access-block stack">
        <h4 className="settings-access-subtitle">
          {t('settings.access.permaTitle')}
        </h4>
        <p className="muted settings-access-lead" style={{ margin: 0 }}>
          {t('settings.access.codePrefix')}
          <code>{workspace.share_code}</code>
          {t('settings.access.codeSuffix')}
        </p>
        <p className="settings-access-url muted" title={inviteUrl}>
          {inviteUrl}
        </p>
        <div>
          <IconActionButton
            variant="secondary"
            label={t('settings.access.copyLink')}
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
            <h4 className="settings-access-subtitle">
              {t('settings.access.invitesTitle')}
            </h4>
            <p className="muted settings-access-lead" style={{ margin: 0 }}>
              {t('settings.access.invitesLead')}
            </p>
            <div className="settings-invite-toolbar row">
              <select
                value={inviteRole}
                onChange={e =>
                  setInviteRole(e.target.value as typeof inviteRole)
                }
                aria-label={t('settings.access.roleAria')}
              >
                <option value="read">{t('settings.access.roleRead')}</option>
                <option value="write">{t('settings.access.roleWrite')}</option>
                <option value="admin">{t('settings.access.roleAdmin')}</option>
              </select>
              <div
                className="settings-invite-days row"
                style={{ alignItems: 'center', gap: '0.35rem' }}
              >
                <span className="muted" style={{ fontSize: '0.85rem' }}>
                  {t('settings.access.expiresIn')}
                </span>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={inviteDays}
                  onChange={e => setInviteDays(Number(e.target.value))}
                  style={{ width: '4.25rem' }}
                  aria-label={t('settings.access.daysAria')}
                />
                <span className="muted" style={{ fontSize: '0.85rem' }}>
                  {t('settings.access.daysUnit')}
                </span>
              </div>
              <IconActionButton
                variant="primary"
                label={guard.reason ?? t('settings.access.createInvite')}
                {...guard.disabledProps}
                onClick={guard.wrap(() => void onCreateInvite())}
              >
                <IconPlus />
              </IconActionButton>
            </div>
            {lastLink ? (
              <p
                className="muted settings-access-url"
                style={{ margin: 0 }}
                title={lastLink}
              >
                {t('settings.access.lastPrefix')}
                <code>{lastLink}</code>
              </p>
            ) : null}
            <ul className="settings-invite-list">
              {invites.map(i => (
                <li key={i.id} className="settings-invite-list-item">
                  <span className="settings-invite-list-meta">
                    <code>{i.token.slice(0, 8)}…</code>
                    <span className="muted">{i.role}</span>
                    <span className="muted">
                      {t('settings.access.expPrefix')}
                      {new Date(i.expires_at).toLocaleDateString(
                        getDefaultLocale()
                      )}
                      {i.used_at ? t('settings.access.used') : ''}
                    </span>
                  </span>
                  {!i.used_at ? (
                    <IconActionButton
                      variant="danger"
                      label={
                        guard.reason ??
                        t('settings.access.revokeInvite', {
                          token: i.token.slice(0, 8),
                        })
                      }
                      {...guard.disabledProps}
                      onClick={guard.wrap(() => void onRevokeInvite(i.id))}
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
  );
}
