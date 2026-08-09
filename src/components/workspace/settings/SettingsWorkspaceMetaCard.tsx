import type { Ws } from './settingsTypes';
import { useI18n } from '../../../i18n';

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
  workspace: Ws;
  isAdmin: boolean;
  wsName: string;
  setWsName: (v: string) => void;
  wsDesc: string;
  setWsDesc: (v: string) => void;
  busyWorkspaceMeta: boolean;
  onSave: (e: React.FormEvent) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="card stack" style={{ boxShadow: 'none' }}>
      <h3 style={{ margin: 0 }}>{t('settings.meta.title')}</h3>
      <p className="muted settings-card-lead" style={{ margin: 0 }}>
        {t('settings.meta.lead')}
      </p>
      {isAdmin ? (
        <form onSubmit={onSave} className="stack">
          <div>
            <label htmlFor="ws-settings-name">
              {t('settings.meta.nameLabel')}
            </label>
            <input
              id="ws-settings-name"
              value={wsName}
              onChange={e => setWsName(e.target.value)}
              maxLength={120}
              required
            />
          </div>
          <div>
            <label htmlFor="ws-settings-desc">{t('common.description')}</label>
            <textarea
              id="ws-settings-desc"
              value={wsDesc}
              onChange={e => setWsDesc(e.target.value)}
              rows={4}
              maxLength={4000}
            />
          </div>
          <button type="submit" disabled={busyWorkspaceMeta}>
            {busyWorkspaceMeta ? t('common.saving') : t('common.save')}
          </button>
        </form>
      ) : (
        <div className="stack">
          <p style={{ margin: 0 }}>
            <strong>{workspace.name}</strong>
          </p>
          <p className="muted" style={{ margin: 0 }}>
            {workspace.description?.trim()
              ? workspace.description
              : t('settings.meta.noDescription')}
          </p>
        </div>
      )}
    </div>
  );
}
