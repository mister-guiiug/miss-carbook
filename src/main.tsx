import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from '@mister-guiiug/dev-wpa-config/react';
import {
  installErrorReporter,
  initSentry,
  recordError,
} from '@mister-guiiug/dev-wpa-config/react/observability';
import App from './App';
import { I18nProvider } from './i18n';
import { initTheme } from './lib/theme';
import { initWebVitals } from './monitoring/web-vitals';
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

// Initialiser le monitoring des Web Vitals
initWebVitals();

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
