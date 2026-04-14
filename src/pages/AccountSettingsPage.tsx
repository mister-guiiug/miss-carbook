import { useEffect, useState } from 'react'
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
    <div className="shell">
      <p style={{ marginTop: 0 }}>
        <Link to="/">← Retour à l’accueil</Link>
      </p>
      <header className="account-settings-header" style={{ marginBottom: '1rem' }}>
        <span className="settings-scope-badge settings-scope-badge--global">
          Toute l’application
        </span>
        <h1 style={{ margin: '0.35rem 0 0' }}>Paramètres généraux</h1>
        <p className="muted" style={{ marginBottom: 0, marginTop: '0.35rem' }}>
          Compte Miss Carbook, apparence sur cet appareil et version de l’app. Rien ici ne modifie
          un dossier de recherche véhicule ouvert depuis l’accueil — pour cela, ouvrez le dossier
          puis l’onglet <strong>Réglages</strong>.
        </p>
      </header>

      <div className="card stack">
        <h2 style={{ marginTop: 0 }}>Visite guidée (mobile / PWA)</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: '0.9rem' }}>
          Réinitialise les écrans « déjà vus » (accueil, arrivée par invitation, premier passage
          dans un nouveau dossier sur petit écran). Ensuite, rouvrez l’accueil sur téléphone ou
          lancez la visite ci-dessous.
        </p>
        <div className="row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
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

      <div className="card stack">
        <h2 style={{ marginTop: 0 }}>Pseudo</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: '0.9rem' }}>
          Actuellement&nbsp;: <strong>{displayName?.trim() || '—'}</strong>. {displayNameRules}
        </p>
        <form onSubmit={savePseudo} className="stack">
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
          <button type="submit" disabled={pseudoBusy}>
            {pseudoBusy ? 'Enregistrement…' : 'Enregistrer le pseudo'}
          </button>
        </form>
      </div>

      <div className="card stack">
        <h2 style={{ marginTop: 0 }}>Apparence</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: '0.9rem' }}>
          Choix enregistré sur cet appareil (stockage local).
        </p>
        <div className="row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
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
      </div>

      <div className="card stack">
        <h2 style={{ marginTop: 0 }}>Application</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: '0.9rem' }}>
          Après une mise en ligne du site, rechargez pour utiliser la dernière version (interface,
          correctifs). Sur navigateur ou PWA, cela réapplique aussi le cache du service worker
          lorsque c’est nécessaire.
        </p>
        {needRefresh ? (
          <p className="muted" style={{ marginTop: 0, fontSize: '0.9rem' }}>
            <strong>Mise à jour disponible</strong> — le bouton ci-dessous installera la nouvelle
            version puis rechargera la page.
          </p>
        ) : null}
        <button type="button" disabled={reloadBusy} onClick={onReloadLatest}>
          {reloadBusy ? 'Rechargement…' : 'Recharger vers la dernière version'}
        </button>
      </div>

      <div className="card stack">
        <h2 style={{ marginTop: 0 }}>Adresse e-mail</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: '0.9rem' }}>
          Compte Supabase Auth. Identifiant actuel&nbsp;:{' '}
          {user.email ? (
            <code>{user.email}</code>
          ) : (
            <span>non renseigné (session sans e-mail)</span>
          )}
        </p>
        {user.email ? (
          <>
            <p className="muted" style={{ marginTop: 0, fontSize: '0.85rem' }}>
              Pour vous reconnecter sur un autre appareil sans mot de passe, vous pouvez renvoyer un
              lien magique sur l’adresse actuelle.
            </p>
            <div className="row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
              <button
                type="button"
                className="secondary"
                disabled={busyMagic}
                onClick={() => void resendMagicLink()}
              >
                {busyMagic ? 'Envoi…' : 'Renvoyer un lien magique'}
              </button>
            </div>
          </>
        ) : null}
        <form onSubmit={saveEmail} className="stack" style={{ marginTop: '0.75rem' }}>
          <div>
            <label htmlFor="settings-email">Nouvelle adresse e-mail</label>
            <input
              id="settings-email"
              type="email"
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              autoComplete="email"
            />
          </div>
          {emailFeedback ? (
            <p className={emailFeedback.variant === 'error' ? 'error' : 'muted'}>
              {emailFeedback.text}
            </p>
          ) : null}
          <button type="submit" disabled={emailBusy}>
            {emailBusy ? 'Envoi…' : 'Demander le changement d’e-mail'}
          </button>
        </form>
      </div>
    </div>
  )
}
