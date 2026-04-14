import { describe, expect, it } from 'vitest'
import { formatAuthCredentialError, formatAuthEmailSendError } from './authEmailErrors'

describe('formatAuthEmailSendError', () => {
  it('reconnaît le plafond d’envoi d’e-mails Supabase', () => {
    expect(
      formatAuthEmailSendError({
        name: 'AuthApiError',
        message: 'email rate limit exceeded',
        code: 'over_email_send_rate_limit',
      })
    ).toBeTruthy()
    expect(
      formatAuthEmailSendError({ code: 'over_email_send_rate_limit', message: 'x' })
    ).toContain('Trop de demandes')
  })

  it('retourne null pour une erreur inconnue', () => {
    expect(formatAuthEmailSendError(new Error('network'))).toBeNull()
  })
})

describe('formatAuthCredentialError', () => {
  it('reconnaît des identifiants invalides', () => {
    expect(
      formatAuthCredentialError({
        code: 'invalid_credentials',
        message: 'Invalid login credentials',
      })
    ).toContain('incorrect')
  })

  it('délègue la limite d’e-mail au formateur envoi', () => {
    expect(
      formatAuthCredentialError({ code: 'over_email_send_rate_limit', message: 'rate limit' })
    ).toContain('Trop de demandes')
  })
})
