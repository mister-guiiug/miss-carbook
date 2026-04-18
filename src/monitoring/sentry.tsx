/**
 * Configuration Sentry pour le tracking d'erreurs
 * Installer : npm install @sentry/react @sentry/tracing @sentry/replay
 */

import * as Sentry from '@sentry/react'

interface SentryConfig {
  dsn: string
  environment: 'development' | 'staging' | 'production'
  tracesSampleRate: number
  replaysSessionSampleRate: number
  replaysOnErrorSampleRate: number
}

export function initSentry(config: SentryConfig): void {
  if (!config.dsn) {
    console.warn('Sentry DSN not provided - skipping initialization')
    return
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,

    integrations: [],

    tracesSampleRate: config.tracesSampleRate,
    replaysSessionSampleRate: config.replaysSessionSampleRate,
    replaysOnErrorSampleRate: config.replaysOnErrorSampleRate,

    beforeSend(event) {
      if (config.environment === 'development') {
        console.warn('Sentry event:', event)
        return null
      }

      if (event.request) {
        delete event.request.cookies
        delete event.request.headers
      }

      return event
    },

    initialScope: {
      tags: {
        project: import.meta.env.PROJECT_NAME || 'unknown',
      },
    },
  })
}

/**
 * Envoyer une erreur manuellement à Sentry
 */
export function captureException(error: Error, context?: Record<string, unknown>): void {
  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value)
      })
    }
    Sentry.captureException(error)
  })
}

/**
 * Envoyer un message à Sentry
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): void {
  Sentry.captureMessage(message, level)
}

/**
 * Hook React pour utiliser Sentry dans les composants
 */
export function useSentry() {
  return {
    captureException,
    captureMessage,
    setUser: (user: { id: string; email?: string; username?: string }) => {
      Sentry.setUser(user)
    },
    setTag: (key: string, value: string) => {
      Sentry.setTag(key, value)
    },
    addBreadcrumb: (breadcrumb: Sentry.Breadcrumb) => {
      Sentry.addBreadcrumb(breadcrumb)
    },
  }
}
