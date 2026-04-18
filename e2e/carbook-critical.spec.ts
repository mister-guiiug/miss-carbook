/**
 * Tests E2E critiques pour miss-carbook
 */

import { test, expect } from '@playwright/test'

test.describe(' miss-carbook - Fonctionnalités critiques', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test("page d'accueil se charge correctement", async ({ page }) => {
    await expect(page.locator('h1, h2, .app-shell')).toBeVisible()
  })

  test('navigation responsive', async ({ page }) => {
    // Test mobile
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await expect(page.locator('nav, .topbar, header')).toBeVisible()

    // Test desktop
    await page.setViewportSize({ width: 1920, height: 1080 })
    await expect(page.locator('nav, .topbar, header')).toBeVisible()
  })

  test('accessibilité - navigation clavier', async ({ page }) => {
    await page.goto('/')

    // Tab sur le premier élément interactif
    await page.keyboard.press('Tab')
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName)
    expect(['BUTTON', 'A', 'INPUT']).toContain(focusedElement)

    // Vérifier qu'on peut naviguer avec Entrée
    await page.keyboard.press('Enter')
    // Ne devrait pas planter
  })

  test('performance - chargement initial < 4s', async ({ page }) => {
    const startTime = Date.now()
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const loadTime = Date.now() - startTime

    expect(loadTime).toBeLessThan(4000)
  })

  test("pas d'erreurs console", async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    expect(errors.length).toBe(0)
  })

  test('PWA - manifest présent', async ({ page }) => {
    const response = await page.request.get('/manifest.webmanifest')
    expect(response.ok()).toBeTruthy()
  })

  test('PWA - offline functionality', async ({ page }) => {
    await page.goto('/')

    // Simuler offline
    await page.context().setOffline(true)

    // Naviguer vers une autre page
    await page.click('text=Accueil')

    // Ne devrait pas avoir d'erreur fatale
    await expect(page.locator('body')).toBeVisible()
  })

  test('gestion des erreurs - composants ErrorBoundary', async ({ page }) => {
    // Tester qu'il n'y a pas d'erreurs React non gérées
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.toString()))

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    expect(errors.length).toBe(0)
  })

  test('thème - toggle light/dark', async ({ page }) => {
    await page.goto('/')

    // Trouver le bouton de thème s'il existe
    const themeButton = page
      .locator('[aria-label*="thème"], [aria-label*="theme"], button:has-text("Thème")')
      .first()

    if (await themeButton.isVisible()) {
      await themeButton.click()
      // Vérifier que le thème a changé
      const html = page.locator('html')
      await expect(html).toHaveAttribute('data-theme', /light|dark/)
    }
  })
})

test.describe('miss-carbook - Navigation et routes', () => {
  test('routes principales accessibles', async ({ page }) => {
    const routes = ['/', '/parametres', '/assistant']

    for (const route of routes) {
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('redirection 404 vers home', async ({ page }) => {
    await page.goto('/page-inconnue')
    await page.waitForLoadState('networkidle')

    // Devrait rediriger vers l'accueil ou afficher une page 404
    const url = page.url()
    expect(url).toMatch(/(\/$|\/\?.*404|\/not-found)/)
  })
})

test.describe('miss-carbook - Formulaires et validation', () => {
  test('connexion email valide', async ({ page }) => {
    await page.goto('/parametres')

    // Trouver le champ email s'il existe
    const emailInput = page.locator('input[type="email"], input[name="email"]').first()

    if (await emailInput.isVisible()) {
      await emailInput.fill('invalid-email')
      await page.click('button[type="submit"], button:has-text("Sauvegarder")')

      // Devrait afficher une erreur de validation
      await expect(
        page.locator('text=invalid, text=incorrect, text=erreur, [role="alert"]')
      ).toBeVisible()
    }
  })
})
