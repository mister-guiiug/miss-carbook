import { useUpdatePrompt } from '../hooks/useUpdatePrompt';
import { useI18n } from '../i18n';

export function UpdateBanner() {
  const { needRefresh, reloadToLatest } = useUpdatePrompt();
  const { t } = useI18n();

  if (!needRefresh) return null;

  return (
    <div className="pwa-update-banner" role="status" aria-live="polite">
      <p className="pwa-update-banner-text">{t('app.updateAvailable')}</p>
      <button type="button" onClick={() => void reloadToLatest()}>
        {t('common.update')}
      </button>
    </div>
  );
}
