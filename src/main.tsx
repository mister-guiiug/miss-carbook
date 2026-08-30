import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import {
  ErrorBoundary,
  ThemeProvider,
} from '@mister-guiiug/dev-wpa-config/react';
import {
  installErrorReporter,
  initSentry,
  recordError,
} from '@mister-guiiug/dev-wpa-config/react/observability';
import { initWebVitals } from '@mister-guiiug/dev-wpa-config/web-vitals';
import App from './App';
import { I18nProvider } from './i18n';
import { THEME_LEGACY_KEYS } from './lib/theme';
import './index.css';

// Observabilité partagée : ring-buffer localStorage + listeners globaux.
installErrorReporter();
void initSentry({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  loader: () => import('@sentry/react'),
});

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
      {/* Avant React, le thème est posé par le script anti-FOUC injecté au
          build (pwaSeoPlugin themeBoot) ; ThemeProvider prend ensuite le
          relais : état partagé, persistance, écoute du thème système. UN SEUL
          écrivain de `data-theme` — les trois écrans qui montrent le thème
          lisent `useThemeContext()`, ils n'appellent pas `useTheme()` chacun
          de leur côté. Pas d'appId : aucune palette --dwc-* n'est peinte,
          index.css garde la main sur les jetons. */}
      <ThemeProvider legacyKeys={THEME_LEGACY_KEYS}>
        <I18nProvider>
          <BrowserRouter basename={base}>
            <App />
          </BrowserRouter>
        </I18nProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>
);
