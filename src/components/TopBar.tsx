import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useTheme } from '../hooks/useTheme'
import { PROFILE_UPDATED_EVENT } from '../lib/profileEvents'
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

function IconGear({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
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
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2)
  return t.slice(0, 2).toUpperCase()
}

function isWorkspacePath(pathname: string) {
  return /^\/w\/[^/]+/.test(pathname)
}

export function TopBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { mode, toggle } = useTheme()
  const online = useOnlineStatus()
  const { reportException } = useErrorDialog()
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

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
      reportException(error, 'Chargement du pseudo (en-tête)')
      setDisplayName(null)
    } else {
      setDisplayName(data?.display_name ?? null)
    }
    setLoading(false)
  }, [user, reportException])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onUpdate = () => void load()
    window.addEventListener(PROFILE_UPDATED_EVENT, onUpdate)
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, onUpdate)
  }, [load])

  const signOut = () => {
    void supabase.auth.signOut().then(() => navigate('/', { replace: true }))
  }

  if (!user) return null

  const label = loading ? '…' : displayName?.trim() || 'Profil'
  const themeNextLabel = mode === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'
  const hideAccountCluster = isWorkspacePath(location.pathname)

  return (
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
        {hideAccountCluster ? (
          <div className="app-topbar-right app-topbar-right--minimal">
            <span
              className={`online-dot ${online ? 'on' : 'off'}`}
              title={online ? 'En ligne' : 'Hors ligne'}
              aria-label={online ? 'Connexion réseau active' : 'Hors ligne'}
            />
          </div>
        ) : (
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
              <Link
                to="/parametres"
                className="app-topbar-icon-btn"
                title="Paramètres du compte"
                aria-label="Paramètres du compte"
              >
                <IconGear />
              </Link>
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
            <Link
              to="/parametres"
              className="app-profile-chip app-profile-chip-action"
              title={`${label} — paramètres du compte`}
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
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}
