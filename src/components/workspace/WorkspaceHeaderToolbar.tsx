import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { useTheme } from '../../hooks/useTheme'
import { PROFILE_UPDATED_EVENT } from '../../lib/profileEvents'
import { useErrorDialog } from '../../contexts/ErrorDialogContext'
import { emitWorkspaceQuickAdd, type WorkspaceQuickAddTab } from '../../lib/workspaceHeaderEvents'
import type { TabId } from './workspaceTabs'

function IconPlus() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2.2"
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

function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IconHome({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 10.5L12 3l9 7.5V20a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 20V10.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M9 21.5V12h6v9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IconFolderSettings({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6.5h5l1.5 2H19a1 1 0 0 1 1 1V9H4V6.5zM4 9v8a1 1 0 0 0 1 1h5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="17" cy="15" r="2.25" stroke="currentColor" strokeWidth="2" />
      <path
        d="M17 12.6v-1.1M17 18.5v-1.1M14.35 15h-1.1M20.25 15h-1.1M15.2 13.2l-.8-.8M19.6 17.6l-.8-.8M15.2 16.8l-.8.8M19.6 12.4l-.8.8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconNote({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 4h10a1 1 0 0 1 1 1v14l-3-2-3 2-3-2-3 2V5a1 1 0 0 1 1-1z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M9 8h6M9 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IconClipboard({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 5h6l1 2h3v14H5V7h3l1-2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IconBell({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2zM18 16V11a6 6 0 1 0-12 0v5l-2 2h16l-2-2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconModel({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" stroke="currentColor" strokeWidth="2" />
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

const flyoutSvg = 'app-topbar-flyout-svg'

function initialsFromDisplayName(name: string) {
  const t = name.trim()
  if (!t) return '?'
  const parts = t.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2)
  return t.slice(0, 2).toUpperCase()
}

type Menu = 'plus' | 'gear' | 'user' | null

export function WorkspaceHeaderToolbar({
  canWrite,
  onOpenTab,
  onOpenSearch,
}: {
  canWrite: boolean
  onOpenTab: (id: TabId) => void
  onOpenSearch: () => void
}) {
  const navigate = useNavigate()
  const { mode, toggle } = useTheme()
  const online = useOnlineStatus()
  const { reportException } = useErrorDialog()
  const [open, setOpen] = useState<Menu>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const wrapRef = useRef<HTMLDivElement>(null)

  const loadProfile = useCallback(async () => {
    setLoadingProfile(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setDisplayName(null)
      setLoadingProfile(false)
      return
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .maybeSingle()
    if (error) {
      reportException(error, 'Chargement du pseudo (barre dossier)')
      setDisplayName(null)
    } else {
      setDisplayName(data?.display_name ?? null)
    }
    setLoadingProfile(false)
  }, [reportException])

  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  useEffect(() => {
    const onUpdate = () => void loadProfile()
    window.addEventListener(PROFILE_UPDATED_EVENT, onUpdate)
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, onUpdate)
  }, [loadProfile])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const el = wrapRef.current
      if (el && !el.contains(e.target as Node)) setOpen(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const close = () => setOpen(null)

  const quickAdd = (tab: WorkspaceQuickAddTab) => {
    const map: Record<WorkspaceQuickAddTab, TabId> = {
      notepad: 'notepad',
      requirements: 'requirements',
      reminders: 'reminders',
      candidates: 'candidates',
    }
    onOpenTab(map[tab])
    close()
    queueMicrotask(() => emitWorkspaceQuickAdd(tab))
  }

  const signOut = () => {
    close()
    void supabase.auth.signOut().then(() => navigate('/', { replace: true }))
  }

  const profileLabel = loadingProfile ? '…' : displayName?.trim() || 'Profil'
  const themeLabel = mode === 'dark' ? 'Thème clair' : 'Thème sombre'

  return (
    <div ref={wrapRef} className="workspace-chrome-toolbar" role="presentation">
      <div className="workspace-chrome-toolbar-inner row">
        <div className="workspace-chrome-toolbar-group">
          <button
            type="button"
            className={`workspace-toolbar-btn workspace-toolbar-btn-primary${open === 'plus' ? ' workspace-toolbar-btn--open' : ''}`}
            aria-expanded={open === 'plus'}
            aria-haspopup="menu"
            aria-controls="workspace-menu-plus"
            title="Ajouter dans le dossier"
            onClick={() => setOpen((m) => (m === 'plus' ? null : 'plus'))}
          >
            <IconPlus />
          </button>
          {open === 'plus' ? (
            <div
              id="workspace-menu-plus"
              className="workspace-toolbar-menu chrome-menu-panel"
              role="menu"
              aria-label="Ajouter"
            >
              <div className="workspace-toolbar-menu-label">Ajouter</div>
              <button
                type="button"
                role="menuitem"
                className="workspace-toolbar-menu-item"
                disabled={!canWrite}
                title={!canWrite ? 'Lecture seule' : undefined}
                onClick={() => quickAdd('notepad')}
              >
                <span className="workspace-toolbar-menu-ic" aria-hidden="true">
                  <IconNote />
                </span>
                <span>Note (bloc-notes)</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="workspace-toolbar-menu-item"
                disabled={!canWrite}
                title={!canWrite ? 'Lecture seule' : undefined}
                onClick={() => quickAdd('requirements')}
              >
                <span className="workspace-toolbar-menu-ic" aria-hidden="true">
                  <IconClipboard />
                </span>
                <span>Exigence</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="workspace-toolbar-menu-item"
                disabled={!canWrite}
                title={!canWrite ? 'Lecture seule' : undefined}
                onClick={() => quickAdd('reminders')}
              >
                <span className="workspace-toolbar-menu-ic" aria-hidden="true">
                  <IconBell />
                </span>
                <span>Rappel</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="workspace-toolbar-menu-item"
                disabled={!canWrite}
                title={!canWrite ? 'Lecture seule' : undefined}
                onClick={() => quickAdd('candidates')}
              >
                <span className="workspace-toolbar-menu-ic" aria-hidden="true">
                  <IconModel />
                </span>
                <span>Modèle</span>
              </button>
            </div>
          ) : null}
        </div>

        <div className="workspace-chrome-toolbar-group">
          <button
            type="button"
            className={`workspace-toolbar-btn${open === 'gear' ? ' workspace-toolbar-btn--open' : ''}`}
            aria-expanded={open === 'gear'}
            aria-haspopup="menu"
            aria-controls="workspace-menu-gear"
            title="Réglages du dossier, recherche, navigation"
            onClick={() => setOpen((m) => (m === 'gear' ? null : 'gear'))}
          >
            <IconGear />
          </button>
          {open === 'gear' ? (
            <div
              id="workspace-menu-gear"
              className="workspace-toolbar-menu chrome-menu-panel"
              role="menu"
              aria-label="Menu dossier et navigation"
            >
              <div className="workspace-toolbar-menu-label">Dossier</div>
              <button
                type="button"
                role="menuitem"
                className="workspace-toolbar-menu-item"
                onClick={() => {
                  onOpenSearch()
                  close()
                }}
              >
                <span className="workspace-toolbar-menu-ic" aria-hidden="true">
                  <IconSearch />
                </span>
                <span>Recherche (Ctrl+K)</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="workspace-toolbar-menu-item"
                onClick={() => {
                  onOpenTab('settings')
                  close()
                }}
              >
                <span className="workspace-toolbar-menu-ic" aria-hidden="true">
                  <IconFolderSettings />
                </span>
                <span>Réglages de ce dossier</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="workspace-toolbar-menu-item"
                onClick={toggle}
              >
                <span className="workspace-toolbar-menu-ic" aria-hidden="true">
                  {mode === 'dark' ? <IconSun /> : <IconMoon />}
                </span>
                <span>{themeLabel}</span>
              </button>
              <div className="workspace-toolbar-menu-sep" role="separator" aria-hidden="true" />
              <div className="workspace-toolbar-menu-label">Navigation</div>
              <Link role="menuitem" className="workspace-toolbar-menu-item" to="/" onClick={close}>
                <span className="workspace-toolbar-menu-ic" aria-hidden="true">
                  <IconHome />
                </span>
                <span>Accueil Miss Carbook</span>
              </Link>
              <Link
                role="menuitem"
                className="workspace-toolbar-menu-item"
                to="/parametres"
                onClick={close}
              >
                <span className="workspace-toolbar-menu-ic" aria-hidden="true">
                  <IconGear />
                </span>
                <span>Paramètres généraux (compte et appli)</span>
              </Link>
            </div>
          ) : null}
        </div>

        <div className="workspace-chrome-toolbar-group">
          <button
            type="button"
            className={`workspace-toolbar-avatar-btn${open === 'user' ? ' workspace-toolbar-avatar-btn--open' : ''}`}
            aria-expanded={open === 'user'}
            aria-haspopup="menu"
            aria-controls="workspace-menu-user"
            title={`${profileLabel} — paramètres généraux et déconnexion`}
            onClick={() => setOpen((m) => (m === 'user' ? null : 'user'))}
          >
            <span className="workspace-toolbar-avatar" aria-hidden="true">
              {loadingProfile ? '…' : initialsFromDisplayName(displayName ?? '')}
            </span>
            <span className="workspace-toolbar-avatar-chevron" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 9l6 6 6-6"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>
          {open === 'user' ? (
            <nav
              id="workspace-menu-user"
              className="app-topbar-account-flyout chrome-menu-panel workspace-toolbar-menu--right"
              role="menu"
              aria-label="Compte et paramètres généraux"
            >
              <div className="app-topbar-flyout-meta">
                <div className="app-topbar-flyout-ident">
                  <span className="app-topbar-flyout-name">{profileLabel}</span>
                  <span className="app-topbar-flyout-hint muted">Compte sur cet appareil</span>
                </div>
                <div
                  className="app-topbar-flyout-online"
                  title={online ? 'En ligne' : 'Hors ligne'}
                >
                  <span className={`online-dot ${online ? 'on' : 'off'}`} aria-hidden="true" />
                  <span className="app-topbar-flyout-online-txt">
                    {online ? 'En ligne' : 'Hors ligne'}
                  </span>
                </div>
              </div>
              <div className="app-topbar-flyout-list">
                <Link
                  role="menuitem"
                  to="/parametres"
                  className="app-topbar-flyout-row"
                  onClick={close}
                >
                  <span className="app-topbar-flyout-ic" aria-hidden="true">
                    <IconGear className={flyoutSvg} />
                  </span>
                  <span className="app-topbar-flyout-txt">Paramètres généraux</span>
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  className="app-topbar-flyout-row app-topbar-flyout-row--danger"
                  onClick={signOut}
                >
                  <span className="app-topbar-flyout-ic" aria-hidden="true">
                    <IconLogOut className={flyoutSvg} />
                  </span>
                  <span className="app-topbar-flyout-txt">Déconnexion</span>
                </button>
              </div>
            </nav>
          ) : null}
        </div>
      </div>
    </div>
  )
}
