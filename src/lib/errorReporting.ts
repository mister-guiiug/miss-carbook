import { formatProfileSaveError } from './profileErrors'

const RLS_HINT = /row-level security|violates row-level security/i
const JWT_HINT = /jwt expired|invalid jwt|session (expired|not found)|refresh token/i

function extractMessage(err: unknown): string {
  if (err == null) return ''
  if (typeof err === 'string') return err
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && 'message' in err)
    return String((err as { message: unknown }).message)
  return ''
}

function extractCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    return String((err as { code: unknown }).code)
  }
  return ''
}

function serialized(err: unknown): string {
  if (err === null || err === undefined) return String(err)
  if (typeof err !== 'object') return String(err)
  if (err instanceof Error) {
    const base: Record<string, unknown> = {
      name: err.name,
      message: err.message,
    }
    const e = err as Error & { code?: string; details?: string; hint?: string }
    if (e.code !== undefined) base.code = e.code
    if (e.details !== undefined) base.details = e.details
    if (e.hint !== undefined) base.hint = e.hint
    if (err.stack) base.stack = err.stack
    try {
      return JSON.stringify(base, null, 2)
    } catch {
      return `${err.name}: ${err.message}\n${err.stack ?? ''}`
    }
  }
  try {
    return JSON.stringify(err, null, 2)
  } catch {
    const e = err as Record<string, unknown>
    const pick: Record<string, unknown> = {}
    for (const k of ['name', 'message', 'code', 'details', 'hint', 'status']) {
      if (k in e) pick[k] = e[k]
    }
    return JSON.stringify(pick, null, 2)
  }
}

function toUserMessage(err: unknown): string {
  const msg = extractMessage(err)
  const code = extractCode(err)

  if (typeof err === 'string') return err

  if (
    err instanceof TypeError &&
    (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network'))
  ) {
    return 'Connexion réseau impossible. Vérifiez votre connexion ou réessayez plus tard.'
  }

  if (code === '23505' || code === '23514' || msg.includes('profiles_display_name')) {
    return formatProfileSaveError(err)
  }

  if (code === '42501' || RLS_HINT.test(msg)) {
    return 'Cette action n’est pas autorisée avec votre compte ou pour ce dossier (droits d’accès).'
  }

  if (JWT_HINT.test(msg)) {
    return 'Votre session n’est plus valide. Rechargez la page ou reconnectez-vous.'
  }

  if (/duplicate key|unique constraint/i.test(msg)) {
    return 'Cette valeur existe déjà (contrainte d’unicité en base).'
  }

  if (/permission denied|not allowed|forbidden/i.test(msg)) {
    return 'Le serveur a refusé cette opération (permissions).'
  }

  if (msg && msg.length <= 220) return msg

  return 'Une erreur inattendue s’est produite. Les détails techniques permettent de la signaler.'
}

/** Message affiché à l’utilisateur + bloc copiable pour le support. */
export function explainUnknownError(
  err: unknown,
  context?: string
): { userMessage: string; technical: string } {
  const technicalParts: string[] = []
  if (context) technicalParts.push(`Contexte : ${context}`)
  technicalParts.push(serialized(err))
  return {
    userMessage: toUserMessage(err),
    technical: technicalParts.join('\n\n'),
  }
}
