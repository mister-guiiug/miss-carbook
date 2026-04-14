/** Extrait le code d’erreur renvoyé par l’API Auth Supabase (client). */
function authErrorCode(err: unknown): string {
  if (
    err &&
    typeof err === 'object' &&
    'code' in err &&
    typeof (err as { code?: unknown }).code === 'string'
  ) {
    return (err as { code: string }).code
  }
  return ''
}

function authErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (
    err &&
    typeof err === 'object' &&
    'message' in err &&
    typeof (err as { message?: unknown }).message === 'string'
  ) {
    return (err as { message: string }).message
  }
  return ''
}

/**
 * Message utilisateur (FR) pour les erreurs d’envoi de lien magique / OTP.
 * Retourne `null` si l’erreur n’est pas reconnue (à traiter comme erreur générique).
 */
export function formatAuthEmailSendError(err: unknown): string | null {
  const code = authErrorCode(err)
  const msg = authErrorMessage(err).toLowerCase()

  if (code === 'over_email_send_rate_limit' || msg.includes('rate limit')) {
    return 'Trop de demandes d’e-mail pour le moment (limite Supabase). Patientez plusieurs minutes, vérifiez vos courriers indésirables si un lien a déjà été envoyé, puis réessayez.'
  }

  if (code === 'email_address_invalid') {
    return 'Cette adresse e-mail est refusée ou invalide côté service d’authentification.'
  }

  if (code === 'signup_disabled') {
    return 'Les nouvelles inscriptions par e-mail sont désactivées sur ce projet.'
  }

  return null
}

/**
 * Messages utilisateur (FR) pour connexion / inscription par mot de passe.
 * Réutilise les erreurs « e-mail » connues (ex. limite d’envoi) quand c’est pertinent.
 */
export function formatAuthCredentialError(err: unknown): string | null {
  const code = authErrorCode(err)
  const msg = authErrorMessage(err).toLowerCase()

  if (
    code === 'invalid_credentials' ||
    code === 'invalid_grant' ||
    msg.includes('invalid login') ||
    msg.includes('invalid email or password')
  ) {
    return 'E-mail ou mot de passe incorrect.'
  }

  if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) {
    return 'Confirmez votre adresse e-mail (lien reçu à l’inscription) avant de vous connecter avec le mot de passe.'
  }

  if (
    code === 'user_already_registered' ||
    msg.includes('already registered') ||
    msg.includes('user already registered')
  ) {
    return 'Un compte existe déjà pour cette adresse. Connectez-vous ou utilisez le lien magique.'
  }

  if (code === 'weak_password') {
    return 'Mot de passe trop faible : augmentez la longueur et variez les caractères (lettres, chiffres, symboles).'
  }

  const fromEmail = formatAuthEmailSendError(err)
  if (fromEmail) return fromEmail

  return null
}
