import { useCallback, useEffect, useId, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useTheme } from '../hooks/useTheme'
import { notifyProfileUpdated, PROFILE_UPDATED_EVENT } from '../lib/profileEvents'
import { displayNameRules, displayNameSchema } from '../lib/validation/schemas'
import { useErrorDialog } from '../contexts/ErrorDialogContext'

const logoSrc = `${import.meta.env.BASE_URL}favicon.svg`

function IconSun({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconMoon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconLogOut({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconPencilSquare({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function initialsFromDisplayName(name: string) {
  const t = name.trim()
  if (!t) return '?'
  const parts = t.split(/\s+/).filter(Boolean)
  if (parts.length >= 2)
    return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2)
  return t.slice(0, 2).toUpperCase()
}

export function TopBar() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { mode, toggle } = useTheme()
  const online = useOnlineStatus()
  const { reportException, reportMessage } = useErrorDialog()
  const modalTitleId = useId()
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pseudoModalOpen, setPseudoModalOpen] = useState(false)
  const [pseudoDraft, setPseudoDraft] = useState('')
  const [pseudoBusy, setPseudoBusy] = useState(false)

  const load = useCallback(async () => {
    if (!user) {
      setDisplayName(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .maybeSingle()
    if (error) {
      setDisplayName(null)
    } else {
      setDisplayName(data?.display_name ?? null)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onUpdate = () => void load()
    window.addEventListener(PROFILE_UPDATED_EVENT, onUpdate)
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, onUpdate)
  }, [load])

  useEffect(() => {
    if (pseudoModalOpen) {
      setPseudoDraft(displayName?.trim() ?? '')
    }
  }, [pseudoModalOpen, displayName])

  useEffect(() => {
    if (!pseudoModalOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPseudoModalOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pseudoModalOpen])

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
      notifyProfileUpdated()
      setPseudoModalOpen(false)
      await load()
    } catch (err: unknown) {
      reportException(err, 'Mise à jour du pseudo (en-tête)')
    } finally {
      setPseudoBusy(false)
    }
  }

  const signOut = () => {
    void supabase.auth.signOut().then(() => navigate('/', { replace: true }))
  }

  if (!user) return null

  const label = loading ? '…' : displayName?.trim() || 'Profil'
  const themeNextLabel = mode === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'

  return (
    <>
      <header className="app-topbar" role="banner">
        <div className="app-topbar-inner">
          <Link to="/" className="app-brand">
            <img
              src={logoSrc}
              alt=""
              className="app-brand-logo"
              width={36}
              height={36}
              decoding="async"
            />
            <span className="app-brand-title">Miss Carbook</span>
          </Link>
          <div className="app-topbar-spacer" aria-hidden="true" />
          <div className="app-topbar-right">
            <div className="app-topbar-tools" role="toolbar" aria-label="Actions du compte">
              <span
                className={`online-dot ${online ? 'on' : 'off'}`}
                title={online ? 'En ligne' : 'Hors ligne'}
                aria-label={online ? 'Connexion réseau active' : 'Hors ligne'}
              />
              <button
                type="button"
                className="app-topbar-icon-btn"
                onClick={toggle}
                title={themeNextLabel}
                aria-label={themeNextLabel}
              >
                {mode === 'dark' ? <IconSun /> : <IconMoon />}
              </button>
              <button
                type="button"
                className="app-topbar-icon-btn"
                onClick={() => setPseudoModalOpen(true)}
                title="Changer le pseudo"
                aria-label="Changer le pseudo"
              >
                <IconPencilSquare />
              </button>
              <button
                type="button"
                className="app-topbar-icon-btn app-topbar-icon-btn-danger"
                onClick={signOut}
                title="Déconnexion"
                aria-label="Déconnexion"
              >
                <IconLogOut />
              </button>
            </div>
            <button
              type="button"
              className="app-profile-chip app-profile-chip-action"
              title={`${label} — cliquer pour changer le pseudo`}
              onClick={() => setPseudoModalOpen(true)}
            >
              <span className="app-profile-avatar" aria-hidden="true">
                {loading ? '…' : initialsFromDisplayName(displayName ?? '')}
              </span>
              <span className="app-profile-name">{label}</span>
              <span className="app-profile-chevron" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M6 9l6 6 6-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </button>
          </div>
        </div>
      </header>

      {pseudoModalOpen ? (
        <div
          className="app-topbar-modal-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPseudoModalOpen(false)
          }}
        >
          <div
            className="app-topbar-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={modalTitleId}
          >
            <h2 id={modalTitleId} className="app-topbar-modal-title">
              Changer le pseudo
            </h2>
            <p className="muted app-topbar-modal-hint">{displayNameRules}</p>
            <form onSubmit={savePseudo} className="stack app-topbar-modal-form">
              <div>
                <label htmlFor="topbar-pseudo">Nouveau pseudo</label>
                <input
                  id="topbar-pseudo"
                  value={pseudoDraft}
                  onChange={(e) => setPseudoDraft(e.target.value)}
                  autoComplete="nickname"
                  maxLength={30}
                  autoFocus
                />
              </div>
              <div className="app-topbar-modal-actions">
                <button type="button" className="secondary" onClick={() => setPseudoModalOpen(false)}>
                  Annuler
                </button>
                <button type="submit" disabled={pseudoBusy}>
                  {pseudoBusy ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
