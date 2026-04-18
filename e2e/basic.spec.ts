/**
 * Exemples de tests E2E avec Playwright
 * Adapté pour tous les projets
 */

import { test, expect } from '@playwright/test'

test.describe('Navigation basique', () => {
  test("page d'accueil se charge", async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/./) // N'importe quel titre
  })

  test('navigation responsive', async ({ page, viewport }) => {
    // Test mobile
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await expect(page.locator('nav')).toBeVisible()

    // Test desktop
    await page.setViewportSize({ width: 1920, height: 1080 })
    await expect(page.locator('nav')).toBeVisible()
  })
})

test.describe('Accessibilité', () => {
  test("pas d'erreurs ARIA", async ({ page }) => {
    await page.goto('/')

    // Vérifier les attributs ARIA manquants
    const buttons = await page.locator('button').all()
    for (const button of buttons) {
      const hasLabel = await button.evaluate(
        (el) =>
          el.hasAttribute('aria-label') ||
          el.hasAttribute('aria-labelledby') ||
          !!el.textContent?.trim()
      )
      expect(hasLabel).toBeTruthy()
    }
  })

  test('navigation clavier', async ({ page }) => {
    await page.goto('/')

    // Tab sur le premier élément interactif
    await page.keyboard.press('Tab')
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName)
    expect(['BUTTON', 'A', 'INPUT']).toContain(focusedElement)
  })
})

test.describe('Performance', () => {
  test('chargement initial < 3s', async ({ page }) => {
    const startTime = Date.now()
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const loadTime = Date.now() - startTime

    expect(loadTime).toBeLessThan(3000)
  })

  test("pas d'erreurs console", async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    expect(errors).toHaveLength(0)
  })
})

test.describe('PWA', () => {
  test('service worker enregistré', async ({ page }) => {
    await page.goto('/')

    const swRegistered = await page.evaluate(() => {
      return 'serviceWorker' in navigator && !!navigator.serviceWorker.controller
    })

    expect(swRegistered).toBeTruthy()
  })

  test('manifest PWA présent', async ({ page }) => {
    const manifest = await page.request.get('/manifest.webmanifest')
    expect(manifest.ok()).toBeTruthy()
  })
})

test.describe('Internationalisation', () => {
  test('langue correcte', async ({ page }) => {
    await page.goto('/')
    const lang = await page.locator('html').getAttribute('lang')
    expect(['fr', 'en']).toContain(lang || '')
  })
})

test.describe('Sécurité', () => {
  test('headers de sécurité', async ({ page }) => {
    const response = await page.request.get('/')
    const headers = response.headers()

    // Vérifier certains headers de sécurité
    expect(headers['x-content-type-options']).toBe('nosniff')
  })

  test('pas de données sensibles en clair', async ({ page }) => {
    await page.goto('/')

    // Chercher des patterns suspects dans le HTML
    const content = await page.content()
    const sensitivePatterns = [
      /password\s*[:=]\s*["'].*["']/i,
      /api[_-]key\s*[:=]\s*["'].*["']/i,
      /secret\s*[:=]\s*["'].*["']/i,
    ]

    for (const pattern of sensitivePatterns) {
      expect(content).not.toMatch(pattern)
    }
  })
})

test.describe('Formulaires', () => {
  test('validation des champs', async ({ page }) => {
    await page.goto('/parametres')

    // Soumettre un formulaire vide
    await page.click('button[type="submit"]')

    // Vérifier les messages d'erreur
    const errorMessages = await page.locator('[role="alert"]').all()
    expect(errorMessages.length).toBeGreaterThan(0)
  })
})

test.describe('Offline', () => {
  test('fonctionne offline', async ({ page }) => {
    await page.goto('/')

    // Simuler offline
    await page.context().setOffline(true)

    // Naviguer vers une autre page
    await page.click('text=Paramètres')

    // Vérifier que la page se charge (cache)
    await expect(page).toHaveURL(/.*parametres/)
  })
})
