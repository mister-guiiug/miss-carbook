import {
  IconActionButton,
  IconEye,
  IconLogOut,
  IconPencil,
  IconShield,
  IconUserMinus,
} from '../../ui/IconActionButton'
import type { Member } from './settingsTypes'

export function SettingsParticipantsCard({
  members,
  isAdmin,
  userId,
  onSetRole,
  onRemoveMember,
  onLeave,
}: {
  members: (Member & { display_name?: string })[]
  isAdmin: boolean
  userId: string
  onSetRole: (uid: string, role: Member['role']) => void
  onRemoveMember: (uid: string) => void
  onLeave: () => void
}) {
  return (
    <div className="card stack" style={{ boxShadow: 'none' }}>
      <h3 style={{ margin: 0 }}>Participants</h3>
      <ul style={{ paddingLeft: '1.1rem' }}>
        {members.map((m) => (
          <li key={m.user_id}>
            <strong>{m.display_name ?? m.user_id.slice(0, 8)}</strong> — {m.role}
            {isAdmin && m.user_id !== userId ? (
              <>
                <span className="row icon-action-toolbar" style={{ marginLeft: '0.5rem' }}>
                  <IconActionButton
                    variant="secondary"
                    label={`Attribuer le rôle lecture à ${m.display_name ?? m.user_id.slice(0, 8)}`}
                    onClick={() => void onSetRole(m.user_id, 'read')}
                  >
                    <IconEye />
                  </IconActionButton>
                  <IconActionButton
                    variant="secondary"
                    label={`Attribuer le rôle écriture à ${m.display_name ?? m.user_id.slice(0, 8)}`}
                    onClick={() => void onSetRole(m.user_id, 'write')}
                  >
                    <IconPencil />
                  </IconActionButton>
                  <IconActionButton
                    variant="secondary"
                    label={`Attribuer le rôle administrateur à ${m.display_name ?? m.user_id.slice(0, 8)}`}
                    onClick={() => void onSetRole(m.user_id, 'admin')}
                  >
                    <IconShield />
                  </IconActionButton>
                </span>
                <IconActionButton
                  variant="danger"
                  label={`Retirer ${m.display_name ?? m.user_id.slice(0, 8)} du dossier`}
                  style={{ marginLeft: '0.5rem' }}
                  onClick={() => void onRemoveMember(m.user_id)}
                >
                  <IconUserMinus />
                </IconActionButton>
              </>
            ) : null}
          </li>
        ))}
      </ul>
      <IconActionButton
        variant="secondary"
        label="Quitter ce dossier"
        onClick={() => void onLeave()}
      >
        <IconLogOut />
      </IconActionButton>
    </div>
  )
}
