/**
 * Hygiène E2E de miss-carbook — chargement, accessibilité de base, PWA,
 * sécurité, hors ligne —, par opposition aux parcours de
 * `carbook-critical.spec.ts`.
 *
 * CE FICHIER ÉTAIT UN GABARIT « adapté pour tous les projets » : il visait
 * `/parametres` et un lien « Paramètres », attendait un `<nav>` à 375 px, un
 * service worker maître de la page dès la première visite et un en-tête HTTP
 * `x-content-type-options`. Sans session, miss-carbook n'affiche que sa porte
 * de connexion ; son service worker est en `registerType: 'prompt'` ; et
 * GitHub Pages ne pose aucun en-tête. Les tests portent désormais sur ce que
 * l'application fait vraiment.
 *
 * Ils restent SANS étiquette, comme chez mister-puzzle : c'est de l'hygiène,
 * que `npm run test:e2e` joue en entier. La CI ne joue que `@critical` et
 * `@a11y`.
 */
import { test, expect, type Page } from '@playwright/test';

/** React a monté la porte de connexion (le contenu servi sans JS est parti). */
async function gateReady(page: Page) {
  await expect(
    page.getByRole('button', { name: 'Recevoir le lien de connexion' })
  ).toBeVisible();
}

test.describe('Chargement', () => {
  test('titre et langue du document', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Miss Carbook/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  });

  test('ni erreur console, ni exception, au chargement', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(errors).toEqual([]);
  });

  test('chargement initial < 3s', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(3000);
  });
});

test.describe('Responsive', () => {
  // Le gabarit attendait un `<nav>` : la barre de navigation n'existe qu'après
  // connexion. Ce qui se vérifie sans session, c'est que la porte tient dans
  // la largeur, sans défilement horizontal, sur mobile comme sur bureau.
  for (const width of [375, 1920]) {
    test(`la porte de connexion tient dans ${width} px de large`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      await gateReady(page);

      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});

test.describe('Accessibilité', () => {
  test('chaque bouton a un nom accessible', async ({ page }) => {
    await page.goto('/');
    await gateReady(page);

    for (const button of await page.locator('button').all()) {
      const hasName = await button.evaluate(
        el =>
          el.hasAttribute('aria-label') ||
          el.hasAttribute('aria-labelledby') ||
          !!el.textContent?.trim()
      );
      expect(hasName).toBeTruthy();
    }
  });

  test("le premier Tab atteint le lien d'évitement, qui mène au contenu", async ({
    page,
  }) => {
    await page.goto('/');
    // Tabuler AVANT que React ait monté laisserait le focus sur `<body>`.
    await gateReady(page);

    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('link', { name: 'Aller au contenu principal' })
    ).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page.locator('#contenu-principal')).toBeFocused();
  });
});

test.describe('PWA', () => {
  test('le service worker est enregistré et activé', async ({ page }) => {
    await page.goto('/');

    // `navigator.serviceWorker.controller` est nul au PREMIER chargement : le
    // plugin PWA est en `registerType: 'prompt'` (vite.config.ts), le service
    // worker ne prend la main qu'à la navigation suivante. Ce qui se vérifie,
    // c'est qu'il est enregistré et ACTIVÉ.
    const activated = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const registration = await navigator.serviceWorker.ready;
      const worker = registration.active;
      if (!worker) return false;
      // `ready` résout dès que le worker occupe le créneau actif, parfois
      // encore en `activating` : attendre la transition.
      if (worker.state !== 'activated') {
        await new Promise<void>(resolve => {
          const onChange = () => {
            if (worker.state === 'activated') {
              worker.removeEventListener('statechange', onChange);
              resolve();
            }
          };
          worker.addEventListener('statechange', onChange);
        });
      }
      return true;
    });

    expect(activated).toBeTruthy();
  });

  test("le manifeste porte le nom de l'application", async ({ page }) => {
    const response = await page.request.get('/manifest.webmanifest');
    expect(response.ok()).toBeTruthy();

    const manifest = await response.json();
    expect(manifest).toMatchObject({
      name: 'Miss Carbook',
      short_name: 'Miss Carbook',
      lang: 'fr',
      display: 'standalone',
    });
  });

  test('le shell est précaché par le service worker', async ({ page }) => {
    await page.goto('/');

    const precached = await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      const paths: string[] = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        for (const request of await cache.keys()) {
          paths.push(new URL(request.url).pathname);
        }
      }
      return paths;
    });

    expect(precached).toContain('/index.html');
    expect(precached.some(p => /^\/assets\/.*\.js$/.test(p))).toBeTruthy();
  });
});

test.describe('Hors ligne', () => {
  // Le gabarit cliquait « Paramètres » hors ligne : sans session, il n'y a pas
  // de lien à suivre. Ce qui se vérifie, c'est que la porte revient du cache
  // et que le bandeau réseau prévient, avant toute tentative de connexion.
  test('la porte revient du cache, et le bandeau prévient', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName === 'webkit',
      'Le pilote WebKit ne sait pas recharger une page hors ligne.'
    );

    await page.goto('/');
    // Le précache doit être fini, sinon le rechargement tombe dans le vide.
    await page.evaluate(() => navigator.serviceWorker.ready);

    await page.context().setOffline(true);
    await page.reload();
    await gateReady(page);

    // Crochet stable du composant du socle ; il attend 1,5 s hors ligne
    // continu avant de s'afficher (anti-clignotement).
    const banner = page.locator('[data-dwc="connection-banner"]');
    await expect(banner).toBeVisible({ timeout: 5_000 });

    await page.context().setOffline(false);
    await expect(banner).toBeHidden();
  });
});

test.describe('Sécurité', () => {
  test('politique de sécurité du contenu posée', async ({ page }) => {
    await page.goto('/');

    // Le gabarit attendait l'en-tête `x-content-type-options` : ni
    // `vite preview` ni GitHub Pages ne posent d'en-tête. La protection passe
    // par la CSP en `<meta>` que `cspPlugin` injecte au build.
    const csp = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content');

    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    // Les scripts : soi-même et des empreintes, ni `eval` ni script inline.
    expect(csp).toMatch(/script-src [^;]*'self'/);
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).not.toMatch(/script-src [^;]*'unsafe-inline'/);
    // Supabase, en https et en wss (temps réel).
    expect(csp).toMatch(/connect-src [^;]*https:\/\/\*\.supabase\.co/);
    expect(csp).toMatch(/connect-src [^;]*wss:\/\/\*\.supabase\.co/);
  });

  test('pas de données sensibles en clair', async ({ page }) => {
    await page.goto('/');
    await gateReady(page);

    const content = await page.content();
    for (const pattern of [
      /password\s*[:=]\s*["'].*["']/i,
      /api[_-]key\s*[:=]\s*["'].*["']/i,
      /secret\s*[:=]\s*["'].*["']/i,
    ]) {
      expect(content).not.toMatch(pattern);
    }
  });
});
