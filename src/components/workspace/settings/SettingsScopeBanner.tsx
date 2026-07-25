import { Link } from 'react-router-dom';
import { useI18n } from '../../../i18n';

export function SettingsScopeBanner({
  workspaceName,
}: {
  workspaceName: string;
}) {
  const { t } = useI18n();
  return (
    <div
      className="settings-scope-banner stack"
      role="region"
      aria-label={t('settings.scope.aria')}
    >
      <p className="settings-scope-banner-text" style={{ margin: 0 }}>
        <span className="settings-scope-badge settings-scope-badge--workspace">
          {t('settings.scope.badge')}
        </span>{' '}
        <strong>{t('settings.scope.nameQuoted', { name: workspaceName })}</strong>
        {t('settings.scope.middle')}
        <Link to="/parametres">{t('settings.scope.link')}</Link>.
      </p>
    </div>
  );
}
