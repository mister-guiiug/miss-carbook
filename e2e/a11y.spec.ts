// Suite a11y minimale (axe-core + Playwright) — template dev-pwa-config.
// Le tag @a11y permet de filtrer : `playwright test --grep @a11y`.
//
// Sans session, l'application se résume à sa porte de connexion
// (PseudoGate.tsx) : c'est elle que l'on contrôle, dans son état le plus
// chargé aussi — l'inscription, et ses trois champs.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expectNoA11yViolations } from '@mister-guiiug/dev-pwa-config/playwright-a11y';

test.describe('@a11y accessibilité', () => {
  test("page d'accueil sans violation WCAG A/AA", async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('button', { name: 'Recevoir le lien de connexion' })
    ).toBeVisible();
    await expectNoA11yViolations(page, AxeBuilder, expect);
  });

  test('formulaire d’inscription sans violation WCAG A/AA', async ({
    page,
  }) => {
    await page.goto('/');
    await page
      .getByRole('tab', { name: 'Créer un compte', exact: true })
      .click();
    await expect(page.getByLabel('Confirmer le mot de passe')).toBeVisible();
    await expectNoA11yViolations(page, AxeBuilder, expect);
  });
});
