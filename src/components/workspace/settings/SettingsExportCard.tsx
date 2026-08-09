import { ExportWorkspaceButton } from '../ExportWorkspaceButton';
import { ExportWorkspacePromptButton } from '../ExportWorkspacePromptButton';
import { useI18n } from '../../../i18n';

export function SettingsExportCard({ workspaceId }: { workspaceId: string }) {
  const { t } = useI18n();
  return (
    <div className="card stack" style={{ boxShadow: 'none' }}>
      <h3 style={{ margin: 0 }}>{t('settings.exportCard.title')}</h3>
      <p className="muted settings-card-lead" style={{ margin: 0 }}>
        {t('settings.exportCard.lead')}
      </p>
      <div
        className="row"
        style={{ flexWrap: 'wrap', alignItems: 'flex-start', gap: '1.25rem' }}
      >
        <ExportWorkspaceButton workspaceId={workspaceId} />
        <ExportWorkspacePromptButton workspaceId={workspaceId} />
      </div>
    </div>
  );
}
