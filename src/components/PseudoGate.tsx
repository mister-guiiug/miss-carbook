import { type ReactNode, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { authEmailRedirectUrl } from '../lib/authRedirect'
import { formatAuthCredentialError, formatAuthEmailSendError } from '../lib/authEmailErrors'
import { authPasswordLoginSchema, authPasswordSignUpSchema } from '../lib/validation/schemas'
import { useErrorDialog } from '../contexts/ErrorDialogContext'

type GateMode = 'magic' | 'password_login' | 'password_signup'

type Feedback = { variant: 'success' | 'error'; text: string } | null

export function PseudoGate({ children }: { children: ReactNode }) {
  const { reportException, reportMessage } = useErrorDialog()
  const { user, loading } = useAuth()
  const [gateMode, setGateMode] = useState<GateMode>('magic')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [busyMagic, setBusyMagic] = useState(false)
  const [magicFeedback, setMagicFeedback] = useState<Feedback>(null)

  const [busyPassword, setBusyPassword] = useState(false)
  const [passwordFeedback, setPasswordFeedback] = useState<Feedback>(null)

  const setMode = (mode: GateMode) => {
    setGateMode(mode)
    setMagicFeedback(null)
    setPasswordFeedback(null)
    if (mode === 'magic') {
      setPassword('')
      setConfirmPassword('')
    }
  }

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setMagicFeedback(null)
    const trimmed = email.trim()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      reportMessage('Adresse e-mail invalide', `Saisie : ${JSON.stringify(trimmed)}`)
      return
    }
    setBusyMagic(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { emailRedirectTo: authEmailRedirectUrl() },
      })
      if (error) throw error
      setMagicFeedback({
        variant: 'success',
        text: 'Lien envoyé : ouvrez l’e-mail et cliquez sur le lien pour vous connecter.',
      })
      setEmail('')
    } catch (e: unknown) {
      const friendly = formatAuthEmailSendError(e)
      if (friendly) {
        setMagicFeedback({ variant: 'error', text: friendly })
      } else {
        reportException(e, 'Envoi du lien magique (connexion)')
      }
    } finally {
      setBusyMagic(false)
    }
  }

  const signInWithPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordFeedback(null)
    const parsed = authPasswordLoginSchema.safeParse({ email, password })
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? 'Formulaire invalide'
      reportMessage(msg, JSON.stringify(parsed.error.flatten(), null, 2))
      return
    }
    setBusyPassword(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      })
      if (error) throw error
      setPassword('')
      setConfirmPassword('')
    } catch (e: unknown) {
      const friendly = formatAuthCredentialError(e)
      if (friendly) {
        setPasswordFeedback({ variant: 'error', text: friendly })
      } else {
        reportException(e, 'Connexion par mot de passe')
      }
    } finally {
      setBusyPassword(false)
    }
  }

  const signUpWithPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordFeedback(null)
    const parsed = authPasswordSignUpSchema.safeParse({ email, password, confirmPassword })
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? 'Formulaire invalide'
      reportMessage(msg, JSON.stringify(parsed.error.flatten(), null, 2))
      return
    }
    setBusyPassword(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: { emailRedirectTo: authEmailRedirectUrl() },
      })
      if (error) throw error
      setPassword('')
      setConfirmPassword('')
      if (data.session) {
        setPasswordFeedback({
          variant: 'success',
          text: 'Compte créé : vous êtes connecté.',
        })
        setEmail('')
      } else {
        setPasswordFeedback({
          variant: 'success',
          text: 'Compte créé. Si le projet exige une confirmation par e-mail, ouvrez le lien reçu avant de vous connecter avec le mot de passe.',
        })
      }
    } catch (e: unknown) {
      const friendly = formatAuthCredentialError(e)
      if (friendly) {
        setPasswordFeedback({ variant: 'error', text: friendly })
      } else {
        reportException(e, 'Inscription par mot de passe')
      }
    } finally {
      setBusyPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="shell">
        <p className="muted">Chargement…</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="shell">
        <div className="card stack">
          <h1>Miss Carbook</h1>
          <p className="muted">
            Carnet collaboratif pour choisir un véhicule. Choisissez une méthode de connexion
            ci-dessous.
          </p>

          <div className="auth-gate-tabs row" role="tablist" aria-label="Méthode de connexion">
            <button
              type="button"
              className={gateMode === 'magic' ? undefined : 'secondary'}
              role="tab"
              aria-selected={gateMode === 'magic'}
              onClick={() => setMode('magic')}
            >
              Lien magique
            </button>
            <button
              type="button"
              className={gateMode === 'password_login' ? undefined : 'secondary'}
              role="tab"
              aria-selected={gateMode === 'password_login'}
              onClick={() => setMode('password_login')}
            >
              Mot de passe
            </button>
            <button
              type="button"
              className={gateMode === 'password_signup' ? undefined : 'secondary'}
              role="tab"
              aria-selected={gateMode === 'password_signup'}
              onClick={() => setMode('password_signup')}
            >
              Créer un compte
            </button>
          </div>

          {gateMode === 'magic' ? (
            <form onSubmit={sendMagicLink} className="stack">
              <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                Sans mot de passe : vous recevrez un lien sécurisé par e-mail.
              </p>
              <div>
                <label htmlFor="gate-email">E-mail</label>
                <input
                  id="gate-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="vous@exemple.com"
                  required
                />
              </div>
              {magicFeedback ? (
                <p className={magicFeedback.variant === 'error' ? 'error' : 'muted'}>
                  {magicFeedback.text}
                </p>
              ) : null}
              <button type="submit" disabled={busyMagic}>
                {busyMagic ? 'Envoi…' : 'Recevoir le lien de connexion'}
              </button>
            </form>
          ) : (
            <form
              onSubmit={gateMode === 'password_login' ? signInWithPassword : signUpWithPassword}
              className="stack"
            >
              <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                {gateMode === 'password_login'
                  ? 'Connectez-vous avec l’e-mail et le mot de passe enregistrés sur ce projet.'
                  : 'Création d’un compte avec mot de passe (8 caractères minimum côté application).'}
              </p>
              <div>
                <label htmlFor="gate-pw-email">E-mail</label>
                <input
                  id="gate-pw-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="vous@exemple.com"
                  required
                />
              </div>
              <div>
                <label htmlFor="gate-pw-password">Mot de passe</label>
                <input
                  id="gate-pw-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={gateMode === 'password_login' ? 'current-password' : 'new-password'}
                  required
                />
              </div>
              {gateMode === 'password_signup' ? (
                <div>
                  <label htmlFor="gate-pw-confirm">Confirmer le mot de passe</label>
                  <input
                    id="gate-pw-confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
              ) : null}
              {passwordFeedback ? (
                <p className={passwordFeedback.variant === 'error' ? 'error' : 'muted'}>
                  {passwordFeedback.text}
                </p>
              ) : null}
              <button type="submit" disabled={busyPassword}>
                {busyPassword
                  ? 'Patientez…'
                  : gateMode === 'password_login'
                    ? 'Se connecter'
                    : 'Créer le compte'}
              </button>
            </form>
          )}

          <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
            Le fournisseur « E-mail » et l’option mot de passe doivent être activés dans Supabase
            (Authentication → Providers). La confirmation par e-mail à l’inscription dépend des
            réglages du projet.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
