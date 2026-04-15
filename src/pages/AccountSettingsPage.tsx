import { useEffect, useMemo, useState } from 'react'
import { useUpdatePrompt } from '../hooks/useUpdatePrompt'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { authEmailRedirectUrl } from '../lib/authRedirect'
import { formatAuthCredentialError, formatAuthEmailSendError } from '../lib/authEmailErrors'
import { notifyProfileUpdated } from '../lib/profileEvents'
import { formatProfileSaveError } from '../lib/profileErrors'
import { resetAllAssistantFlags } from '../lib/assistantStorage'
import { changeEmailSchema, displayNameRules, displayNameSchema } from '../lib/validation/schemas'
import { useErrorDialog } from '../contexts/ErrorDialogContext'
import { useToast } from '../contexts/ToastContext'
import type { ThemeMode } from '../lib/theme'

export function AccountSettingsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { mode, setMode } = useTheme()
  const { needRefresh, reloadToLatest } = useUpdatePrompt()
  const { reportException, reportMessage } = useErrorDialog()
  const { showToast } = useToast()
  const [reloadBusy, setReloadBusy] = useState(false)

  const [displayName, setDisplayName] = useState<string | null>(null)
  const [pseudoDraft, setPseudoDraft] = useState('')
  const [pseudoBusy, setPseudoBusy] = useState(false)

  const [emailDraft, setEmailDraft] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailFeedback, setEmailFeedback] = useState<{
    variant: 'info' | 'error'
    text: string
  } | null>(null)

  const [busyMagic, setBusyMagic] = useState(false)

  useEffect(() => {
    if (!user) return
    void supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const n = data?.display_name ?? null
        setDisplayName(n)
        setPseudoDraft(n?.trim() ?? '')
      })
  }, [user])

  useEffect(() => {
    setEmailDraft(user?.email ?? '')
  }, [user?.email])

  const pseudoDirty = useMemo(() => {
    return pseudoDraft.trim() !== (displayName?.trim() ?? '')
  }, [pseudoDraft, displayName])

  const emailUnchanged = useMemo(() => {
    const cur = (user?.email ?? '').trim()
    return (emailDraft.trim() || '') === cur
  }, [emailDraft, user?.email])

  const savePseudo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    const parsed = displayNameSchema.safeParse(pseudoDraft)
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? 'Pseudo invalide'
      reportMessage(msg, JSON.stringify(parsed.error.flatten(), null, 2))
      return
    }
    setPseudoBusy(true)
    try {
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        display_name: parsed.data,
      })
      if (error) throw error
      setDisplayName(parsed.data)
      notifyProfileUpdated()
      showToast('Pseudo mis à jour')
    } catch (err: unknown) {
      reportMessage(formatProfileSaveError(err), String(err))
    } finally {
      setPseudoBusy(false)
    }
  }

  const saveEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setEmailFeedback(null)
    const parsed = changeEmailSchema.safeParse({ email: emailDraft })
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? 'E-mail invalide'
      reportMessage(msg, JSON.stringify(parsed.error.flatten(), null, 2))
      return
    }
    const next = parsed.data.email
    if (next === user.email) {
      setEmailFeedback({ variant: 'info', text: 'C’est déjà l’adresse enregistrée sur ce compte.' })
      return
    }
    setEmailBusy(true)
    try {
      const { error } = await supabase.auth.updateUser(
        { email: next },
        { emailRedirectTo: authEmailRedirectUrl() }
      )
      if (error) throw error
      setEmailFeedback({
        variant: 'info',
        text: 'Si le projet l’exige, un e-mail de confirmation sera envoyé à la nouvelle adresse (et parfois à l’ancienne). Ouvrez le lien pour finaliser le changement.',
      })
      showToast('Demande de changement d’e-mail envoyée')
    } catch (err: unknown) {
      const friendly = formatAuthCredentialError(err) ?? formatAuthEmailSendError(err)
      if (friendly) {
        setEmailFeedback({ variant: 'error', text: friendly })
      } else {
        reportException(err, 'Changement d’adresse e-mail')
      }
    } finally {
      setEmailBusy(false)
    }
  }

  const resendMagicLink = async () => {
    if (!user?.email) return
    setEmailFeedback(null)
    setBusyMagic(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: user.email,
        options: { emailRedirectTo: authEmailRedirectUrl() },
      })
      if (error) throw error
      setEmailFeedback({
        variant: 'info',
        text: 'Nouveau lien magique envoyé sur votre adresse actuelle.',
      })
      showToast('Lien magique envoyé')
    } catch (err: unknown) {
      const friendly = formatAuthEmailSendError(err)
      if (friendly) {
        setEmailFeedback({ variant: 'error', text: friendly })
      } else {
        reportException(err, 'Renvoi du lien magique')
      }
    } finally {
      setBusyMagic(false)
    }
  }

  const applyTheme = (next: ThemeMode) => {
    setMode(next)
  }

  const onReloadLatest = () => {
    setReloadBusy(true)
    void reloadToLatest()
  }

  if (!user) {
    return (
      <div className="shell">
        <p className="muted">Chargement…</p>
      </div>
    )
  }

  return (
    <div className="shell settings-page">
      <nav className="settings-back" aria-label="Navigation">
        <Link to="/">← Retour à l’accueil</Link>
      </nav>

      <header className="account-settings-header">
        <span className="settings-scope-badge settings-scope-badge--global">
          Toute l’application
        </span>
        <h1>Paramètres généraux</h1>
        <p className="muted settings-lead">
          Compte, affichage sur cet appareil et outils d’application. Les dossiers de recherche se
          configurent dans chaque dossier, onglet <strong>Réglages</strong>.
        </p>
      </header>

      <div className="settings-page-stack">
        <section className="card stack settings-card" aria-labelledby="settings-account-heading">
          <h2 id="settings-account-heading">Compte</h2>

          <div className="settings-subsection">
            <h3 className="settings-subsection-title" id="settings-pseudo-title">
              Pseudo
            </h3>
            <p className="muted settings-hint">
              Visible dans les dossiers et les commentaires. {displayNameRules}
            </p>
            <form onSubmit={savePseudo} className="stack" aria-labelledby="settings-pseudo-title">
              <div>
                <label htmlFor="settings-pseudo">Pseudo affiché</label>
                <input
                  id="settings-pseudo"
                  value={pseudoDraft}
                  onChange={(e) => setPseudoDraft(e.target.value)}
                  autoComplete="nickname"
                  maxLength={30}
                />
              </div>
              <button type="submit" disabled={pseudoBusy || !pseudoDirty}>
                {pseudoBusy ? 'Enregistrement…' : 'Enregistrer le pseudo'}
              </button>
            </form>
          </div>

          <hr className="settings-divider" />

          <div className="settings-subsection">
            <h3 className="settings-subsection-title" id="settings-email-title">
              E-mail et connexion
            </h3>
            <p className="muted settings-hint">
              Identifiant du compte&nbsp;:{' '}
              {user.email ? <code>{user.email}</code> : <span>non renseigné</span>}
            </p>
            {user.email ? (
              <div className="settings-actions-row">
                <button
                  type="button"
                  className="secondary"
                  disabled={busyMagic}
                  onClick={() => void resendMagicLink()}
                >
                  {busyMagic ? 'Envoi…' : 'Renvoyer un lien magique'}
                </button>
              </div>
            ) : null}
            <form onSubmit={saveEmail} className="stack" aria-labelledby="settings-email-title">
              <div>
                <label htmlFor="settings-email">Nouvelle adresse e-mail</label>
                <input
                  id="settings-email"
                  type="email"
                  value={emailDraft}
                  onChange={(e) => {
                    setEmailDraft(e.target.value)
                    setEmailFeedback(null)
                  }}
                  autoComplete="email"
                />
              </div>
              {emailFeedback ? (
                <p
                  role="status"
                  className={
                    emailFeedback.variant === 'error'
                      ? 'settings-feedback error'
                      : 'settings-feedback muted'
                  }
                >
                  {emailFeedback.text}
                </p>
              ) : null}
              <button type="submit" disabled={emailBusy || emailUnchanged}>
                {emailBusy ? 'Envoi…' : 'Demander le changement d’e-mail'}
              </button>
            </form>
          </div>
        </section>

        <section className="card stack settings-card" aria-labelledby="settings-display-heading">
          <h2 id="settings-display-heading">Affichage</h2>
          <p className="muted settings-hint">
            Thème enregistré localement sur cet appareil (clair ou sombre).
          </p>
          <div
            className="settings-theme-row"
            role="group"
            aria-label="Choix du thème"
          >
            <button
              type="button"
              className={mode === 'light' ? undefined : 'secondary'}
              onClick={() => applyTheme('light')}
            >
              Clair
            </button>
            <button
              type="button"
              className={mode === 'dark' ? undefined : 'secondary'}
              onClick={() => applyTheme('dark')}
            >
              Sombre
            </button>
          </div>
        </section>

        <section className="card stack settings-card" aria-labelledby="settings-app-heading">
          <h2 id="settings-app-heading">Application</h2>

          <div className="settings-subsection">
            <h3 className="settings-subsection-title">Mise à jour</h3>
            <p className="muted settings-hint">
              Après une mise en ligne du site, rechargez pour bénéficier de la dernière version.
              Sur navigateur ou PWA, le cache du service worker est réappliqué si nécessaire.
            </p>
            {needRefresh ? (
              <p className="muted settings-hint" role="status">
                <strong>Mise à jour disponible</strong> — le bouton ci-dessous installera la
                nouvelle version puis rechargera la page.
              </p>
            ) : null}
            <button type="button" disabled={reloadBusy} onClick={onReloadLatest}>
              {reloadBusy ? 'Rechargement…' : 'Recharger vers la dernière version'}
            </button>
          </div>

          <hr className="settings-divider" />

          <div className="settings-subsection">
            <h3 className="settings-subsection-title">Visite guidée</h3>
            <p className="muted settings-hint">
              Réinitialise les écrans « déjà vus » (accueil, invitation, premier passage dans un
              dossier sur petit écran). Puis rouvrez l’accueil ou lancez la visite ci-dessous.
            </p>
            <div className="settings-actions-row">
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  resetAllAssistantFlags()
                  try {
                    sessionStorage.removeItem('mc_invite_welcome')
                  } catch {
                    /* ignore */
                  }
                  showToast('Visite guidée réinitialisée.')
                }}
              >
                Réinitialiser les indicateurs
              </button>
              <button type="button" onClick={() => navigate('/assistant')}>
                Lancer la visite d’accueil
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
