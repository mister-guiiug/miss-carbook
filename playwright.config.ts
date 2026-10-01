import { defineConfig, devices } from '@playwright/test';
import { definePwaPlaywrightConfig } from '@mister-guiiug/dev-pwa-config/playwright-base';

// Factory famille : matrice navigateurs, reporters, snapshots, reducedMotion.
// `preview: true` (dev-pwa-config 3.x) : les e2e testent un BUILD de prod
// (service worker, minification, cache réels). VITE_BASE_PATH=/ neutralise le
// base path GitHub Pages ; port 4173 pour ne pas collisionner avec un dev
// server (5173).
//
// UN SUPABASE FACTICE, POSÉ ICI. `AuthProvider` demande le client pendant le
// rendu (App.tsx) : sans `VITE_SUPABASE_*`, l'application entière cède la
// place à l'écran de l'ErrorBoundary, et c'est ce que la suite trouvait au
// lieu de l'accueil. Le job E2E du socle n'injecte pas le `build-env` de
// ci.yml : les valeurs vivent donc dans la commande, pour que le build soit le
// même en local et en CI. Aucun test ne joint cet hôte : les appels
// d'authentification sont interceptés (`page.route`), et une page sans session
// n'en émet aucun d'elle-même.
//
// `locale: 'fr-FR'` : sans elle, la langue suit `navigator.language` — en-US
// sous Playwright — et les libellés attendus par les tests changeraient.
//
// `webServer.timeout` à 5 min. Le serveur ne répond qu'une fois le build de
// production fini (`tsc -b`, `vite build`, budget) : mesuré à 2 min 03 s le
// 01/10/2026 sur un poste Windows chargé, au-delà des 120 s de la fabrique —
// la suite échouait avant le premier test. `overrides.webServer` REMPLACE
// l'objet de la fabrique, d'où ses quatre champs repris ici.
const port = 4173;
const command =
  'cross-env VITE_BASE_PATH=/ VITE_SUPABASE_URL=https://e2e-factice.supabase.co VITE_SUPABASE_ANON_KEY=e2e-factice npm run build && cross-env VITE_BASE_PATH=/ vite preview --port 4173 --strictPort';

export default defineConfig(
  definePwaPlaywrightConfig({
    devices,
    preview: true,
    port,
    command,
    overrides: {
      use: { locale: 'fr-FR' },
      webServer: {
        command,
        url: `http://localhost:${port}`,
        reuseExistingServer: false,
        timeout: 300_000,
      },
    },
  })
);
