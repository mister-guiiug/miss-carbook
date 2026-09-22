import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';
import { pwaSeoPlugin } from '@mister-guiiug/dev-pwa-config/vite-pwa-base';
import { cspPlugin } from '@mister-guiiug/dev-pwa-config/vite-csp';
import { versionPlugin } from '@mister-guiiug/dev-pwa-config/vite-version';

const analyze = process.env.ANALYZE === '1';

/**
 * Base path pour GitHub Pages : définir VITE_BASE_PATH=/nom-du-repo/ en CI.
 * Documentation : https://docs.github.com/en/pages/getting-started-with-github-pages
 */
const base = process.env.VITE_BASE_PATH ?? '/';

// `GTM-WMFQTNFX` A QUITTÉ CE FICHIER. Il était passé à `pwaSeoPlugin`, qui
// l'injectait à la place des marqueurs `__ANALYTICS_*__` d'`index.html` — et
// ces marqueurs ont été retirés quand `ConsentBanner` a pris la mesure en
// charge : lui n'injecte RIEN avant l'accord, là où le plugin chargeait le tag
// dès le premier rendu, `consent default` refusé ou pas.
//
// Le conteneur était donc déjà INERTE, et c'est précisément ce qui en faisait
// un piège : rétablir un marqueur aurait suffi à faire repartir GTM avant tout
// consentement, sans que personne relie les deux gestes.
//
// S'y ajoute la décision du parc, le 15/09/2026, d'abandonner GTM ; puis celle
// du 18/09 (ADR 0012) d'abandonner Google tout entier pour PostHog sur le nuage
// EUROPÉEN. Le motif n'est pas la mesure — au volume du parc, GA4 faisait le
// travail — mais une dette RGPD qu'il valait mieux supprimer que documenter.
//
// La mesure passe par `VITE_POSTHOG_KEY`, que `ConsentBanner` lit dans
// `src/App.tsx`. La balise `google-site-verification` reste statique dans
// `index.html` : elle ne mesure rien, elle prouve la propriété du site.
//
// LA CSP BOUGE, ELLE. Ce commentaire disait le contraire, et il avait raison
// tant que la mesure venait de chez Google : `www.googletagmanager.com` était
// l'hôte de `gtag.js` autant que de GTM, et le retirer aurait éteint la mesure.
// Il n'y a plus rien à y chercher : `index.html` autorise désormais
// `eu.i.posthog.com` et `eu-assets.i.posthog.com`, et rien d'autre de tiers.

export default defineConfig(({ command }) => ({
  base,
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        /*
         * LE MORCEAU SENTRY GARDE SON NOM, SANS EMPREINTE — parce qu'il est
         * exclu du précache (`globIgnores` plus bas) et qu'une URL empreintée
         * y meurt à chaque déploiement.
         *
         * Le service worker sert la coquille précachée jusqu'à ce que
         * l'utilisateur accepte la mise à jour ; cette coquille demande
         * l'ANCIENNE empreinte, que le déploiement suivant a supprimée de
         * `assets/`. Mesuré en production sur mister-qowa le 22/09/2026 :
         * HTTP 404, « Échec du chargement pour le module » dans la console.
         * `initSentry` avale l'échec (son `try/catch`), donc l'application ne
         * casse pas — elle rapporte ses erreurs à personne, sans le dire.
         *
         * Rien n'est perdu au cache : GitHub Pages répond
         * `Cache-Control: max-age=600` sur TOUS les fichiers, empreinte ou pas.
         *
         * `pwa-doctor` tient l'invariant depuis le socle 6.8.0
         * (règle `chunk-hors-precache`).
         */
        chunkFileNames: chunk =>
          chunk.name === 'sentry'
            ? 'assets/sentry.js'
            : 'assets/[name]-[hash].js',
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          const norm = id.replace(/\\/g, '/');

          // Sentry est chargé par un `import()` que `loader` rend analysable.
          // Sans cette ligne, son morceau reprend un nom automatique (`esm-*`),
          // instable d'une version à l'autre et partagé avec d'autres paquets :
          // le `globIgnores` du service worker n'aurait pas de cible fiable.
          if (norm.includes('/@sentry/')) return 'sentry';

          // Séparer React et écosystème
          if (
            norm.includes('/react-dom/') ||
            norm.includes('/node_modules/react/') ||
            norm.includes('/scheduler/')
          ) {
            return 'react-vendor';
          }

          // Supabase séparé
          if (norm.includes('/@supabase/')) {
            return 'supabase';
          }

          // Router séparé
          if (norm.includes('/react-router/')) {
            return 'router';
          }

          // Validation séparée
          if (norm.includes('/zod/')) {
            return 'validation';
          }

          // State manager
          if (norm.includes('/zustand/')) {
            return 'zustand';
          }

          // Tailwind runtime
          if (
            norm.includes('/tailwindcss/') ||
            norm.includes('/@tailwindcss/')
          ) {
            return 'tailwind';
          }

          // PAS de fourre-tout `vendor` : forcer TOUT node_modules dans un
          // chunk initial y traînait recharts et ses dépendances (d3, victory)
          // que seul l'onglet Comparer, chargé paresseusement, utilise — 95 kB
          // gzip préchargés pour rien (relevé du 02/09/2026 : 432 kB de JS
          // initial). Ce que le graphe statique n'atteint pas reste avec le
          // chunk qui l'importe ; le partagé est découpé par Rolldown.
          return undefined;
        },
      },
    },
  },
  plugins: [
    // AVANT cspPlugin : il pose un script inline dans le <head>, que la
    // CSP doit hacher après coup ; et il écrit version.json au build.
    versionPlugin({ manifest: true }),
    pwaSeoPlugin({
      // Deux <meta name="theme-color"> par schéma : la barre du navigateur suit
      // le mode sombre dès le premier rendu (relevé du 02/09/2026 : 5 apps sur 16).
      themeColor: { light: '#f8fafc', dark: '#0f172a' },
      siteName: 'Miss Carbook',
      // Script anti-FOUC engendré par le socle (theme-boot), injecté en tête
      // de <head>. Avant, le thème n'était posé que par initTheme() dans
      // main.tsx : la page s'affichait en clair le temps du bundle, puis
      // basculait en sombre.
      // `legacyKeys` doit rester aligné sur THEME_LEGACY_KEYS
      // (src/lib/theme.ts) : ce fichier s'exécute côté Node, hors du projet
      // TypeScript de l'app, il ne peut pas l'importer. Deux valeurs
      // divergentes = le script pose un thème que React repeint aussitôt.
      themeBoot: { legacyKeys: ['mc-theme'] },
    }),
    react(),
    tailwindcss(),
    // LA CSP VIENT DU SOCLE, ET PLUS D'UNE BALISE ÉCRITE À LA MAIN.
    //
    // `index.html` portait sa propre `<meta http-equiv>`, recopiée et
    // entretenue ici seule. Ce que ça a coûté : le 19/09/2026, le socle a
    // ouvert `connect-src` à l'hôte du DSN Sentry pour tout le parc — et
    // cette app ne l'a pas reçu, parce qu'aucune montée de paquet n'atteint
    // une chaîne de caractères. Elle embarque pourtant un DSN : sa remontée
    // d'erreurs était entièrement morte, et rien ne pouvait le dire.
    //
    // Le greffon apporte en prime ce que la balise ne faisait pas :
    // `script-src` par HASH des scripts inline en production, au lieu de
    // `'unsafe-inline'` — c'est-à-dire la différence entre une CSP qui
    // protège et une CSP qui en a l'air. Le seul script inline est celui
    // qu'injecte `pwaSeoPlugin` (thème anti-FOUC), d'où le placement APRÈS.
    cspPlugin({
      dev: command === 'serve',
      // Ouvre les hôtes de PostHog — le nuage EUROPÉEN (ADR 0012).
      analytics: true,
      // Supabase en https ET wss : le temps réel passe par la WebSocket, et
      // l'oublier ne se verrait qu'en console, sur le site déployé.
      connectSrc: ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co'],
    }),
    VitePWA({
      registerType: 'prompt',
      // `pwa-192.svg` et `pwa-512.svg` ont été RETIRÉS : ils portaient un
      // dessin différent de celui des PNG livrés — le commentaire de l'ancien
      // générateur le constatait déjà. `favicon.svg` les remplace, et c'est
      // désormais l'une des deux seules sources du jeu d'icônes.
      includeAssets: ['logo.png', 'favicon.svg', 'offline.html'],
      manifest: {
        name: 'Miss Carbook',
        short_name: 'Miss Carbook',
        description:
          'Carnet collaboratif pour comparer véhicules, exigences et avis — fonctionne hors ligne pour la coque.',
        theme_color: '#0f766e',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait-primary',
        id: base,
        start_url: base,
        scope: base,
        lang: 'fr',
        icons: [
          {
            src: `${base}pwa-192.png`,
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          // UNE IMAGE PAR USAGE. `pwa-512.png` était `any maskable` : la
          // MÊME image servait au navigateur, qui la montre telle quelle, et
          // à Android, qui la rogne à son masque. C'est une tuile arrondie
          // sur fond clair — coins coupés, liseré clair autour du vert.
          {
            src: `${base}pwa-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: `${base}pwa-maskable-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        screenshots: [
          {
            src: `${base}screenshots/mobile.png`,
            sizes: '824x1830',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Écran d’accueil sur mobile',
          },
          {
            src: `${base}screenshots/wide.png`,
            sizes: '2560x1600',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Écran d’accueil sur ordinateur',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],
        /*
         * LE MORCEAU SENTRY HORS DU PRÉCACHE. C'est la seule app du parc dont
         * le DSN est posé : elle télécharge donc vraiment le SDK, et c'est
         * voulu. Mais le précache le fait descendre à l'INSTALLATION du service
         * worker, avant toute erreur et quoi qu'il arrive ensuite. Hors
         * précache, il part au premier `initSentry` réussi — même moment utile,
         * sans bloquer la mise en cache de la coquille.
         *
         * Sur les apps sans DSN, l'écart est plus net encore : mesuré le
         * 16/09/2026 sur miss-contraction et mister-puzzle, 345 et 463 KiB
         * téléchargés par chaque visiteur pour une observabilité éteinte.
         */
        globIgnores: ['**/sentry.js', '**/sentry-*.js'],
        navigateFallback: `${base}index.html`,
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
    ...(analyze
      ? [
          visualizer({
            filename: 'dist/stats.html',
            gzipSize: true,
            brotliSize: true,
            open: !process.env.CI,
          }) as PluginOption,
        ]
      : []),
  ],
}));
