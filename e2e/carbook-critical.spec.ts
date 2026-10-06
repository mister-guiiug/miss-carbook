/**
 * Parcours critiques de miss-carbook : ce que la CI famille joue
 * (`run-e2e: true` dans ci.yml, filtre `@critical|@a11y`, projet chromium).
 *
 * CE FICHIER ÉTAIT UN GABARIT, et il supposait une application ouverte à
 * tous : un `<nav>` visible à 375 px, un lien « Accueil », une redirection des
 * adresses inconnues. Rien de cela n'existe pour un visiteur sans session :
 * `AuthGate` (PseudoGate.tsx) ne rend QUE la carte de connexion — ni la barre
 * du haut, ni le `<main>` de l'application, ni ses routes. Les tests échouaient
 * pour cette raison, et la CI n'en jouait aucun (`run-e2e: false`).
 *
 * LE BACKEND. Le build pointe vers un Supabase factice (playwright.config.ts).
 * Les appels d'authentification sont INTERCEPTÉS (`page.route`) : on vérifie
 * ce que l'application envoie et ce qu'elle fait de la réponse, sans serveur.
 * Les écrans d'après connexion (dossiers, modèles, budget…) demandent un vrai
 * backend : Vitest et pgTAP les couvrent, pas ces tests.
 */
import { test, expect, type Page } from '@playwright/test';

/** L'hôte du Supabase factice du build E2E (playwright.config.ts). */
const SUPABASE = 'https://e2e-factice.supabase.co';

/** Note chaque requête émise vers Supabase pendant le test. */
function supabaseRequests(page: Page): string[] {
  const requests: string[] = [];
  page.on('request', r => {
    // L'ORIGINE, pas un préfixe : `startsWith` laisserait passer
    // https://e2e-factice.supabase.co.ailleurs.example (CodeQL, alerte #1).
    if (new URL(r.url()).origin === SUPABASE)
      requests.push(`${r.method()} ${r.url()}`);
  });
  return requests;
}

/** La porte de connexion, et rien de l'application derrière elle. */
async function expectSignInGate(page: Page) {
  await expect(
    page.getByRole('heading', { level: 1, name: 'Miss Carbook', exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('tablist', { name: 'Méthode de connexion' })
  ).toBeVisible();
  await expect(page.locator('.app-main')).toHaveCount(0);
}

test.describe('Porte de connexion @critical', () => {
  test("l'application démarre sur la porte de connexion", async ({ page }) => {
    const requests = supabaseRequests(page);
    await page.goto('/');

    await expectSignInGate(page);
    await expect(
      page.getByRole('tab', { name: 'Lien magique', exact: true })
    ).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByLabel('E-mail')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Recevoir le lien de connexion' })
    ).toBeEnabled();
    // Sans session, la page n'a rien à demander à Supabase.
    expect(requests).toEqual([]);
  });

  test("aucune adresse ne s'ouvre sans session", async ({ page }) => {
    // Le gabarit attendait une redirection des adresses inconnues : elle vit
    // dans les routes, que la porte ne rend pas. Ce qui compte, c'est que
    // chaque adresse, privée ou inconnue, s'arrête à la porte.
    for (const path of [
      '/parametres',
      '/assistant',
      '/w/dossier-inconnu',
      '/page-inconnue',
    ]) {
      await page.goto(path);
      await expectSignInGate(page);
    }
  });

  test('les trois méthodes de connexion se succèdent', async ({ page }) => {
    await page.goto('/');
    const password = page.getByLabel('Mot de passe', { exact: true });
    const confirm = page.getByLabel('Confirmer le mot de passe');
    await expect(password).toHaveCount(0);

    await page.getByRole('tab', { name: 'Mot de passe', exact: true }).click();
    await expect(
      page.getByRole('tab', { name: 'Mot de passe', exact: true })
    ).toHaveAttribute('aria-selected', 'true');
    await expect(password).toBeVisible();
    await expect(confirm).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Se connecter' })
    ).toBeVisible();

    await page
      .getByRole('tab', { name: 'Créer un compte', exact: true })
      .click();
    await expect(confirm).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Créer le compte' })
    ).toBeVisible();

    await page.getByRole('tab', { name: 'Lien magique', exact: true }).click();
    await expect(password).toHaveCount(0);
  });

  test('une adresse sans domaine complet est refusée avant tout envoi', async ({
    page,
  }) => {
    const requests = supabaseRequests(page);
    await page.goto('/');

    // « a@b » passe le contrôle du navigateur (`type="email"`), pas celui de
    // l'application, qui exige un domaine avec un point.
    await page.getByLabel('E-mail').fill('a@b');
    await page
      .getByRole('button', { name: 'Recevoir le lien de connexion' })
      .click();

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText('Adresse e-mail invalide');
    await dialog.getByRole('button', { name: 'OK' }).click();
    await expect(dialog).toBeHidden();
    expect(requests).toEqual([]);
  });

  test("le lien magique part vers Supabase avec l'adresse saisie", async ({
    page,
  }) => {
    const envois: unknown[] = [];
    await page.route(`${SUPABASE}/auth/v1/otp**`, async route => {
      envois.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{}',
      });
    });
    await page.goto('/');

    await page.getByLabel('E-mail').fill('membre@exemple.test');
    await page
      .getByRole('button', { name: 'Recevoir le lien de connexion' })
      .click();

    await expect(
      page.getByText(
        'Lien envoyé : ouvrez l’e-mail et cliquez sur le lien pour vous connecter.'
      )
    ).toBeVisible();
    expect(envois).toHaveLength(1);
    expect(envois[0]).toMatchObject({ email: 'membre@exemple.test' });
    // L'adresse ne reste pas affichée dans le champ.
    await expect(page.getByLabel('E-mail')).toHaveValue('');
  });

  test('un mot de passe refusé affiche un message clair', async ({ page }) => {
    // La réponse de GoTrue à de mauvais identifiants.
    await page.route(`${SUPABASE}/auth/v1/token**`, route =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 400,
          error_code: 'invalid_credentials',
          msg: 'Invalid login credentials',
        }),
      })
    );
    await page.goto('/');

    await page.getByRole('tab', { name: 'Mot de passe', exact: true }).click();
    await page.getByLabel('E-mail').fill('membre@exemple.test');
    await page
      .getByLabel('Mot de passe', { exact: true })
      .fill('mauvais-mot-de-passe');
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(
      page.getByText('E-mail ou mot de passe incorrect.')
    ).toBeVisible();
    await expectSignInGate(page);
  });

  test("l'inscription refuse un mot de passe trop court, puis mal confirmé", async ({
    page,
  }) => {
    const requests = supabaseRequests(page);
    await page.goto('/');
    await page
      .getByRole('tab', { name: 'Créer un compte', exact: true })
      .click();
    await page.getByLabel('E-mail').fill('nouveau@exemple.test');
    const password = page.getByLabel('Mot de passe', { exact: true });
    const confirm = page.getByLabel('Confirmer le mot de passe');
    const create = page.getByRole('button', { name: 'Créer le compte' });
    const dialog = page.getByRole('alertdialog');

    await password.fill('court');
    await confirm.fill('court');
    await create.click();
    await expect(dialog).toContainText('Au moins 8 caractères');
    await dialog.getByRole('button', { name: 'OK' }).click();
    await expect(dialog).toBeHidden();

    await password.fill('assez-long-1');
    await confirm.fill('assez-long-2');
    await create.click();
    await expect(dialog).toContainText(
      'Les mots de passe ne correspondent pas'
    );

    // Refusé par l'application : rien n'est parti vers Supabase.
    expect(requests).toEqual([]);
  });
});
