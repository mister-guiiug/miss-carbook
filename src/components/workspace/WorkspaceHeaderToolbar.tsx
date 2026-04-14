import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
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

function IconGear() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
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

function IconSun() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
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

function IconMoon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
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
            className="workspace-toolbar-btn workspace-toolbar-btn-primary"
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
              className="workspace-toolbar-menu"
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
                Note (bloc-notes)
              </button>
              <button
                type="button"
                role="menuitem"
                className="workspace-toolbar-menu-item"
                disabled={!canWrite}
                title={!canWrite ? 'Lecture seule' : undefined}
                onClick={() => quickAdd('requirements')}
              >
                Exigence
              </button>
              <button
                type="button"
                role="menuitem"
                className="workspace-toolbar-menu-item"
                disabled={!canWrite}
                title={!canWrite ? 'Lecture seule' : undefined}
                onClick={() => quickAdd('reminders')}
              >
                Rappel
              </button>
              <button
                type="button"
                role="menuitem"
                className="workspace-toolbar-menu-item"
                disabled={!canWrite}
                title={!canWrite ? 'Lecture seule' : undefined}
                onClick={() => quickAdd('candidates')}
              >
                Modèle
              </button>
            </div>
          ) : null}
        </div>

        <div className="workspace-chrome-toolbar-group">
          <button
            type="button"
            className="workspace-toolbar-btn"
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
              className="workspace-toolbar-menu"
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
                Recherche (Ctrl+K)
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
                Réglages de ce dossier
              </button>
              <button
                type="button"
                role="menuitem"
                className="workspace-toolbar-menu-item"
                onClick={toggle}
              >
                <span className="workspace-toolbar-menu-row">
                  {mode === 'dark' ? <IconSun /> : <IconMoon />}
                  <span>{themeLabel}</span>
                </span>
              </button>
              <div className="workspace-toolbar-menu-sep" role="separator" aria-hidden="true" />
              <div className="workspace-toolbar-menu-label">Navigation</div>
              <Link role="menuitem" className="workspace-toolbar-menu-item" to="/" onClick={close}>
                Accueil Miss Carbook
              </Link>
              <Link
                role="menuitem"
                className="workspace-toolbar-menu-item"
                to="/parametres"
                onClick={close}
              >
                Paramètres généraux (compte et appli)
              </Link>
            </div>
          ) : null}
        </div>

        <div className="workspace-chrome-toolbar-group">
          <button
            type="button"
            className="workspace-toolbar-avatar-btn"
            aria-expanded={open === 'user'}
            aria-haspopup="menu"
            aria-controls="workspace-menu-user"
            title={`${profileLabel} — paramètres généraux et déconnexion`}
            onClick={() => setOpen((m) => (m === 'user' ? null : 'user'))}
          >
            <span className="workspace-toolbar-avatar" aria-hidden="true">
              {loadingProfile ? '…' : initialsFromDisplayName(displayName ?? '')}
            </span>
          </button>
          {open === 'user' ? (
            <div
              id="workspace-menu-user"
              className="workspace-toolbar-menu workspace-toolbar-menu--right"
              role="menu"
              aria-label="Compte et paramètres généraux"
            >
              <div className="workspace-toolbar-menu-heading muted">{profileLabel}</div>
              <Link
                role="menuitem"
                className="workspace-toolbar-menu-item"
                to="/parametres"
                onClick={close}
              >
                Paramètres généraux
              </Link>
              <button
                type="button"
                role="menuitem"
                className="workspace-toolbar-menu-item danger"
                onClick={signOut}
              >
                Déconnexion
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
