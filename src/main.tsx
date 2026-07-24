import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from '@mister-guiiug/dev-wpa-config/react';
import {
  installErrorReporter,
  recordError,
} from '@mister-guiiug/dev-wpa-config/react/observability';
import App from './App';
import { initTheme } from './lib/theme';
import { initWebVitals } from './monitoring/web-vitals';
import './index.css';

// Observabilité partagée : ring-buffer localStorage + listeners globaux.
installErrorReporter();

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
      <BrowserRouter basename={base}>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);
