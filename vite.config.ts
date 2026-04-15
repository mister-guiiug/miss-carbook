import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Base path pour GitHub Pages : définir VITE_BASE_PATH=/nom-du-repo/ en CI.
 * Documentation : https://docs.github.com/en/pages/getting-started-with-github-pages
 */
const base = process.env.VITE_BASE_PATH ?? '/'

/** Google Tag Manager — conteneur */
const GTM_CONTAINER_ID = 'GTM-WMFQTNFX'

/** Google Search Console — balise meta de vérification */
const GSC_SITE_VERIFICATION = 'iUfQ7_dOztC3XoSGesC2b7IkxyNL2O9fegKXECoOg30'

/**
 * Google Analytics 4 — ID de mesure (`G-xxxxxxxxxx`).
 * Surcharge possible : variable `VITE_GA_MEASUREMENT_ID` (ex. CI / .env local).
 * Laisser vide pour désactiver le snippet gtag.js (un tag GA4 uniquement via GTM évite le double comptage).
 */
const GA4_MEASUREMENT_ID_HARDCODED = ''

const GA4_MEASUREMENT_ID =
  (process.env.VITE_GA_MEASUREMENT_ID ?? '').trim() || GA4_MEASUREMENT_ID_HARDCODED

function htmlTrackingPlugin(): Plugin {
  return {
    name: 'html-tracking-gtm-gsc-ga',
    transformIndexHtml(html) {
      const metaGsc = `    <meta name="google-site-verification" content="${GSC_SITE_VERIFICATION}" />`
      const gtmHead = `    <!-- Google Tag Manager -->
    <script>
      (function (w, d, s, l, i) {
        w[l] = w[l] || []
        w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' })
        var f = d.getElementsByTagName(s)[0],
          j = d.createElement(s),
          dl = l != 'dataLayer' ? '&l=' + l : ''
        j.async = true
        j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl
        f.parentNode.insertBefore(j, f)
      })(window, document, 'script', 'dataLayer', '${GTM_CONTAINER_ID}')
    </script>
    <!-- End Google Tag Manager -->`
      const gtmBody = `    <!-- Google Tag Manager (noscript) -->
    <noscript
      ><iframe
        src="https://www.googletagmanager.com/ns.html?id=${GTM_CONTAINER_ID}"
        height="0"
        width="0"
        style="display: none; visibility: hidden"
      ></iframe
    ></noscript>
    <!-- End Google Tag Manager (noscript) -->`

      const ga4Head =
        GA4_MEASUREMENT_ID !== ''
          ? `    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}"></script>
    <script>
      window.dataLayer = window.dataLayer || []
      function gtag() {
        dataLayer.push(arguments)
      }
      gtag('js', new Date())
      gtag('config', '${GA4_MEASUREMENT_ID}')
    </script>`
          : ''

      const headBlocks = [metaGsc, gtmHead, ga4Head].filter(Boolean).join('\n')

      return html
        .replace('<head>', `<head>\n${headBlocks}`)
        .replace('<body>', `<body>\n${gtmBody}`)
    },
  }
}

export default defineConfig({
  base,
  plugins: [
    htmlTrackingPlugin(),
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'pwa-192.svg', 'pwa-512.svg', 'offline.html'],
      manifest: {
        name: 'Miss Carbook',
        short_name: 'Carbook',
        description:
          'Carnet collaboratif pour comparer véhicules, exigences et avis — fonctionne hors ligne pour la coque.',
        theme_color: '#0f766e',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: base,
        scope: base,
        lang: 'fr',
        icons: [
          {
            src: `${base}pwa-192.svg`,
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: `${base}pwa-512.svg`,
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],
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
  ],
})
