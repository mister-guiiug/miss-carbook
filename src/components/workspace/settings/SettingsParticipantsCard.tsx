import {
  IconActionButton,
  IconEye,
  IconLogOut,
  IconPencil,
  IconShield,
  IconUserMinus,
} from '../../ui/IconActionButton';
import type { Member } from './settingsTypes';
import { useI18n } from '../../../i18n';

export function SettingsParticipantsCard({
  members,
  isAdmin,
  userId,
  onSetRole,
  onRemoveMember,
  onLeave,
}: {
  members: (Member & { display_name?: string })[];
  isAdmin: boolean;
  userId: string;
  onSetRole: (uid: string, role: Member['role']) => void;
  onRemoveMember: (uid: string) => void;
  onLeave: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="card stack" style={{ boxShadow: 'none' }}>
      <h3 style={{ margin: 0 }}>{t('settings.participants.title')}</h3>
      <ul className="settings-participants-list">
        {members.map(m => (
          <li key={m.user_id} className="settings-participants-row">
            <div className="settings-participants-identity">
              <strong>{m.display_name ?? m.user_id.slice(0, 8)}</strong>
              <span className="muted settings-participants-role">{m.role}</span>
            </div>
            {isAdmin && m.user_id !== userId ? (
              <div className="settings-participants-actions row icon-action-toolbar">
                <IconActionButton
                  variant="secondary"
                  label={t('settings.participants.assignReadRole', {
                    name: m.display_name ?? m.user_id.slice(0, 8),
                  })}
                  onClick={() => void onSetRole(m.user_id, 'read')}
                >
                  <IconEye />
                </IconActionButton>
                <IconActionButton
                  variant="secondary"
                  label={t('settings.participants.assignWriteRole', {
                    name: m.display_name ?? m.user_id.slice(0, 8),
                  })}
                  onClick={() => void onSetRole(m.user_id, 'write')}
                >
                  <IconPencil />
                </IconActionButton>
                <IconActionButton
                  variant="secondary"
                  label={t('settings.participants.assignAdminRole', {
                    name: m.display_name ?? m.user_id.slice(0, 8),
                  })}
                  onClick={() => void onSetRole(m.user_id, 'admin')}
                >
                  <IconShield />
                </IconActionButton>
                <IconActionButton
                  variant="danger"
                  label={t('settings.participants.removeFromWorkspace', {
                    name: m.display_name ?? m.user_id.slice(0, 8),
                  })}
                  onClick={() => void onRemoveMember(m.user_id)}
                >
                  <IconUserMinus />
                </IconActionButton>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <IconActionButton
        variant="secondary"
        label={t('settings.participants.leave')}
        onClick={() => void onLeave()}
      >
        <IconLogOut />
      </IconActionButton>
    </div>
  );
}
