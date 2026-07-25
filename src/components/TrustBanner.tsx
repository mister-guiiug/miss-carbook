import { useState } from 'react';
import { useI18n } from '../i18n';

const KEY = 'mc-trust-banner-dismissed';

export function TrustBanner() {
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem(KEY) === '1' : false
  );

  if (dismissed) return null;

  return (
    <div className="trust-banner" role="note">
      <p>
        <strong>{t('app.trustTitle')}</strong> {t('app.trustBody')}
      </p>
      <button
        type="button"
        className="secondary trust-banner-close"
        onClick={() => {
          localStorage.setItem(KEY, '1');
          setDismissed(true);
        }}
      >
        {t('app.trustDismiss')}
      </button>
    </div>
  );
}
