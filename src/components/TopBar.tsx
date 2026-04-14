import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useTheme } from '../hooks/useTheme'
import { PROFILE_UPDATED_EVENT } from '../lib/profileEvents'

const logoSrc = `${import.meta.env.BASE_URL}favicon.svg`

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

  if (!user) return null

  const label = loading ? '…' : displayName?.trim() || 'Profil'

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
        <div className="app-topbar-right">
          <div className="app-topbar-tools">
            <span
              className={`online-dot ${online ? 'on' : 'off'}`}
              title={online ? 'En ligne' : 'Hors ligne'}
            />
            <button
              type="button"
              className="secondary theme-toggle"
              onClick={toggle}
              title={mode === 'dark' ? 'Mode clair' : 'Mode sombre'}
            >
              {mode === 'dark' ? 'Clair' : 'Sombre'}
            </button>
            <button
              type="button"
              className="secondary"
              title="Fermer la session sur cet appareil"
              onClick={() => {
                void supabase.auth.signOut().then(() => navigate('/', { replace: true }))
              }}
            >
              Déconnexion
            </button>
          </div>
          <div className="app-profile-chip" title={`Connecté : ${label}`}>
            <span className="app-profile-avatar" aria-hidden="true">
              {loading ? '…' : initialsFromDisplayName(displayName ?? '')}
            </span>
            <span className="app-profile-name">{label}</span>
          </div>
        </div>
      </div>
    </header>
  )
}
