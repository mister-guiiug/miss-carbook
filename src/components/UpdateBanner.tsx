import { registerSW } from 'virtual:pwa-register';
import { useUpdatePrompt } from '@mister-guiiug/dev-wpa-config/react/use-update-prompt';
import { useI18n } from '../i18n';

export function UpdateBanner() {
  const { needRefresh, update } = useUpdatePrompt({ registerSW });
  const { t } = useI18n();

  if (!needRefresh) return null;

  return (
    <div className="pwa-update-banner" role="status" aria-live="polite">
      <p className="pwa-update-banner-text">{t('app.updateAvailable')}</p>
      <button type="button" onClick={() => void update()}>
        {t('common.update')}
      </button>
    </div>
  );
}
