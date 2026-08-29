import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from '@mister-guiiug/dev-wpa-config/react';
import {
  installErrorReporter,
  initSentry,
  recordError,
} from '@mister-guiiug/dev-wpa-config/react/observability';
import { initWebVitals } from '@mister-guiiug/dev-wpa-config/web-vitals';
import App from './App';
import { I18nProvider } from './i18n';
import { initTheme } from './lib/theme';
import './index.css';

// Observabilité partagée : ring-buffer localStorage + listeners globaux.
installErrorReporter();
void initSentry({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  loader: () => import('@sentry/react'),
});

// Initialiser le thème
initTheme();

// Web Vitals via le socle (INP au lieu de FID, métriques indépendantes) :
// journal en dev uniquement — pas d'analytics tiers dans cette app.
void initWebVitals({
  loader: () => import('web-vitals'),
  onMetric: metric => {
    if (import.meta.env.DEV) {
      console.log('[Web Vitals]', metric);
    }
  },
});

const base = import.meta.env.BASE_URL;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary
      onError={error => {
        recordError(error, { source: 'error-boundary' });
      }}
    >
      <I18nProvider>
        <BrowserRouter basename={base}>
          <App />
        </BrowserRouter>
      </I18nProvider>
    </ErrorBoundary>
  </StrictMode>
);
