import { useEffect, useState, useCallback, useRef } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { formatCandidateListLabel } from '../lib/candidateLabel'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useErrorDialog } from '../contexts/ErrorDialogContext'
import { useWorkspaceChrome } from '../contexts/WorkspaceChromeContext'
import type { Database } from '../types/database'
import { WorkspaceOnboarding } from '../components/WorkspaceOnboarding'
import { WorkspaceSearchModal } from '../components/WorkspaceSearchModal'
import { NotepadTab } from '../components/workspace/NotepadTab'
import { RequirementsTab } from '../components/workspace/RequirementsTab'
import { EvaluationsTab } from '../components/workspace/EvaluationsTab'
import { CandidatesTab } from '../components/workspace/CandidatesTab'
import { CompareTab } from '../components/workspace/CompareTab'
import { ActivityTab } from '../components/workspace/ActivityTab'
import { RemindersTab } from '../components/workspace/RemindersTab'
import { SettingsTab } from '../components/workspace/SettingsTab'
import {
  WORKSPACE_TABS,
  parseWorkspaceTabParam,
  type TabId,
} from '../components/workspace/workspaceTabs'
import { WorkspaceTabStrip } from '../components/workspace/WorkspaceTabStrip'
import { WorkspaceJourneyCard } from '../components/workspace/WorkspaceJourneyCard'

type Ws = Database['public']['Tables']['workspaces']['Row']
type Role = Database['public']['Tables']['workspace_members']['Row']['role']

function WorkspacePageSkeleton() {
  return (
    <div className="shell stack workspace-page-skeleton" aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement du dossier…</span>
      <div className="skeleton-block skeleton-breadcrumb" />
      <div className="skeleton-block skeleton-title" />
      <div className="skeleton-block skeleton-line wide" />
      <div className="skeleton-block skeleton-tabs" />
      <div className="skeleton-block skeleton-card" />
    </div>
  )
}

export function WorkspacePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const { setWorkspaceChrome } = useWorkspaceChrome()
  const { reportException, reportMessage } = useErrorDialog()
  const [workspace, setWorkspace] = useState<Ws | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const tab = parseWorkspaceTabParam(searchParams.get('tab'))
  const [accessBlocked, setAccessBlocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const [decisionLabel, setDecisionLabel] = useState<string | null>(null)
  const [, bump] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelFocusSkip = useRef(true)
  const [headerHintVisible, setHeaderHintVisible] = useState(true)

  useEffect(() => {
    if (!workspaceId) return
    const key = `mc_ws_header_hint_${workspaceId}`
    try {
      setHeaderHintVisible(localStorage.getItem(key) !== '1')
    } catch {
      setHeaderHintVisible(true)
    }
  }, [workspaceId])

  const setTab = useCallback(
    (id: TabId) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (id === 'notepad') next.delete('tab')
          else next.set('tab', id)
          return next
        },
        { replace: false }
      )
    },
    [setSearchParams]
  )

  useEffect(() => {
    const raw = searchParams.get('tab')
    if (raw && !WORKSPACE_TABS.some((t) => t.id === raw)) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('tab')
          return next
        },
        { replace: true }
      )
    }
  }, [searchParams, setSearchParams])

  const refresh = async () => {
    if (!workspaceId || !user) return
    setLoading(true)
    try {
      setAccessBlocked(false)
      const { data: ws, error: wErr } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', workspaceId)
        .maybeSingle()
      if (wErr) {
        reportException(wErr, 'Chargement du dossier (workspaces)')
        setWorkspace(null)
        setRole(null)
        setAccessBlocked(true)
        return
      }
      if (!ws) {
        reportMessage(
          'Ce dossier est introuvable. Il a peut-être été supprimé ou l’identifiant dans l’URL est incorrect.',
          `workspaceId=${workspaceId} — requête sans ligne`
        )
        setWorkspace(null)
        setRole(null)
        setAccessBlocked(true)
        return
      }
      setWorkspace(ws as Ws)
      const sid = (ws as Ws).selected_candidate_id
      if (sid) {
        const { data: cand } = await supabase
          .from('candidates')
          .select('brand, model, trim, parent_candidate_id')
          .eq('id', sid)
          .maybeSingle()
        setDecisionLabel(
          cand
            ? formatCandidateListLabel({
                brand: cand.brand,
                model: cand.model,
                trim: cand.trim ?? '',
                parent_candidate_id: cand.parent_candidate_id ?? null,
              })
            : null
        )
      } else setDecisionLabel(null)

      const { data: mem, error: mErr } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (mErr) {
        reportException(mErr, 'Vérification du rôle (workspace_members)')
        setRole(null)
        setAccessBlocked(true)
        return
      }
      if (!mem) {
        reportMessage(
          'Vous n’êtes pas membre de ce dossier, ou vous n’avez plus accès.',
          `user_id=${user.id} workspace_id=${workspaceId} — aucune ligne membre`
        )
        setRole(null)
        setAccessBlocked(true)
        return
      }
      setRole(mem.role as Role)
      setAccessBlocked(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, user?.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (tab !== 'settings') return
    if (location.hash !== '#workspace-settings-decision') return
    requestAnimationFrame(() => {
      document
        .getElementById('workspace-settings-decision')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [tab, location.hash])

  useEffect(() => {
    if (panelFocusSkip.current) {
      panelFocusSkip.current = false
      return
    }
    queueMicrotask(() => panelRef.current?.focus())
  }, [tab])

  const openSearch = useCallback(() => setSearchOpen(true), [])

  useEffect(() => {
    if (!workspaceId || !user) {
      setWorkspaceChrome(null)
      return
    }
    if (loading || accessBlocked || !workspace || !role) {
      setWorkspaceChrome(null)
      return
    }
    const canW = role === 'write' || role === 'admin'
    setWorkspaceChrome({
      canWrite: canW,
      setTab,
      openSearch,
    })
    return () => setWorkspaceChrome(null)
  }, [
    workspaceId,
    user,
    loading,
    accessBlocked,
    workspace,
    role,
    setTab,
    openSearch,
    setWorkspaceChrome,
  ])

  if (!workspaceId) return <p className="shell">Dossier introuvable.</p>

  if (!user) {
    return (
      <div className="shell stack">
        <p className="muted">Chargement session…</p>
        <Link to="/">← Retour</Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="shell stack">
        <WorkspacePageSkeleton />
        <Link to="/">← Retour à l’accueil</Link>
      </div>
    )
  }

  if (accessBlocked || !workspace || !role) {
    return (
      <div className="shell stack">
        <p className="muted">
          Consultez la fenêtre d’erreur si besoin, ou retournez à l’accueil pour ouvrir un autre
          dossier.
        </p>
        <Link to="/">← Retour</Link>
      </div>
    )
  }

  const canWrite = role === 'write' || role === 'admin'
  const isAdmin = role === 'admin'
  const isReadOnly = role === 'read'

  const dismissHeaderHint = () => {
    if (!workspaceId) return
    try {
      localStorage.setItem(`mc_ws_header_hint_${workspaceId}`, '1')
    } catch {
      /* ignore */
    }
    setHeaderHintVisible(false)
  }

  return (
    <div className="shell stack">
      <WorkspaceSearchModal
        workspaceId={workspaceId}
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onPick={(t) => setTab(t as TabId)}
      />

      <WorkspaceOnboarding
        workspaceId={workspaceId}
        workspaceName={workspace.name}
        onDone={() => bump((n) => n + 1)}
      />

      <WorkspaceJourneyCard workspaceId={workspaceId} setTab={setTab} />

      {isReadOnly ? (
        <div className="workspace-readonly-banner" role="status">
          <strong>Lecture seule</strong> — vous pouvez consulter ce dossier mais pas le modifier.
        </div>
      ) : null}

      {workspace.selected_candidate_id && decisionLabel ? (
        <div
          className="card decision-banner workspace-decision-banner"
          style={{ boxShadow: 'none' }}
        >
          <div className="workspace-decision-banner-row">
            <div className="stack" style={{ gap: '0.25rem' }}>
              <strong>Décision enregistrée</strong> : modèle retenu « {decisionLabel} »
              {workspace.decision_notes ? (
                <span className="muted"> — {workspace.decision_notes}</span>
              ) : null}
            </div>
            <Link
              to="?tab=settings#workspace-settings-decision"
              className="workspace-decision-banner-link"
            >
              Modifier dans Réglages
            </Link>
          </div>
        </div>
      ) : null}

      <header className="workspace-header workspace-header--document">
        <div className="workspace-header-main">
          <nav className="workspace-breadcrumb muted" aria-label="Fil d’Ariane">
            <Link to="/">Accueil</Link>
            <span aria-hidden="true"> · </span>
            <span className="workspace-breadcrumb-current">{workspace.name}</span>
          </nav>
          <h1 className="workspace-header-title" id="workspace-title">
            {workspace.name}
          </h1>
          <p className="muted workspace-header-desc">
            {workspace.description?.trim() ? (
              workspace.description
            ) : isAdmin ? (
              <>
                <span>Aucune description.</span>{' '}
                <button type="button" className="link-like" onClick={() => setTab('settings')}>
                  Ajouter une description
                </button>
              </>
            ) : (
              'Sans description'
            )}
          </p>
          {headerHintVisible ? (
            <div className="workspace-header-hint card" style={{ boxShadow: 'none' }}>
              <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                Onglet <strong>Réglages</strong> : options de <em>ce</em> dossier. Compte, thème et
                mise à jour de l’app : menu en haut à droite (icône compte ou roue → paramètres
                généraux).
              </p>
              <button
                type="button"
                className="secondary workspace-header-hint-dismiss"
                onClick={dismissHeaderHint}
              >
                Ne plus afficher
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <div className="workspace-tabs-toolbar">
        <div className="workspace-tabs-toolbar-row">
          <h2 className="workspace-tabs-heading" id="workspace-tabs-heading">
            Sections
          </h2>
          <p className="workspace-shortcuts-hint muted">
            <kbd className="kbd">Ctrl</kbd> / <kbd className="kbd">⌘</kbd> +{' '}
            <kbd className="kbd">K</kbd> · recherche
          </p>
        </div>
        <WorkspaceTabStrip tab={tab} setTab={setTab} tabListLabelId="workspace-tabs-heading" />
      </div>

      <div
        ref={panelRef}
        id="workspace-main-panel"
        role="tabpanel"
        tabIndex={0}
        aria-labelledby={`workspace-tab-btn-${tab}`}
        className="card workspace-tabpanel"
      >
        {tab === 'notepad' ? <NotepadTab workspaceId={workspaceId} canWrite={canWrite} /> : null}
        {tab === 'requirements' ? (
          <RequirementsTab workspaceId={workspaceId} canWrite={canWrite} />
        ) : null}
        {tab === 'evaluations' ? (
          <EvaluationsTab workspaceId={workspaceId} canWrite={canWrite} userId={user.id} />
        ) : null}
        {tab === 'candidates' ? (
          <CandidatesTab workspaceId={workspaceId} canWrite={canWrite} userId={user.id} />
        ) : null}
        {tab === 'compare' ? <CompareTab workspaceId={workspaceId} canWrite={canWrite} /> : null}
        {tab === 'reminders' ? (
          <RemindersTab workspaceId={workspaceId} canWrite={canWrite} />
        ) : null}
        {tab === 'activity' ? <ActivityTab workspaceId={workspaceId} /> : null}
        {tab === 'settings' ? (
          <SettingsTab
            workspace={workspace}
            canWrite={canWrite}
            isAdmin={isAdmin}
            userId={user.id}
            onWorkspaceRefresh={() => void refresh()}
          />
        ) : null}
      </div>
    </div>
  )
}
