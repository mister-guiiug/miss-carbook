import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useErrorDialog } from '../contexts/ErrorDialogContext'
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

type Ws = Database['public']['Tables']['workspaces']['Row']
type Role = Database['public']['Tables']['workspace_members']['Row']['role']

const tabs = [
  { id: 'notepad', label: 'Bloc-notes' },
  { id: 'requirements', label: 'Exigences' },
  { id: 'evaluations', label: 'Évaluations' },
  { id: 'candidates', label: 'Modèles' },
  { id: 'compare', label: 'Comparer' },
  { id: 'reminders', label: 'Rappels' },
  { id: 'activity', label: 'Activité' },
  { id: 'settings', label: 'Paramètres' },
] as const

type TabId = (typeof tabs)[number]['id']

export function WorkspacePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const { user } = useAuth()
  const { reportException, reportMessage } = useErrorDialog()
  const [workspace, setWorkspace] = useState<Ws | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [tab, setTab] = useState<TabId>('notepad')
  const [accessBlocked, setAccessBlocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const [decisionLabel, setDecisionLabel] = useState<string | null>(null)
  const [, bump] = useState(0)

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
          .select('brand, model')
          .eq('id', sid)
          .maybeSingle()
        setDecisionLabel(cand ? `${cand.brand} ${cand.model}`.trim() : null)
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
        <p className="muted">Chargement du dossier…</p>
        <Link to="/">← Retour</Link>
      </div>
    )
  }

  if (accessBlocked || !workspace || !role) {
    return (
      <div className="shell stack">
        <p className="muted">
          Consultez la fenêtre d’erreur si besoin, ou retournez à l’accueil pour ouvrir un autre dossier.
        </p>
        <Link to="/">← Retour</Link>
      </div>
    )
  }

  const canWrite = role === 'write' || role === 'admin'
  const isAdmin = role === 'admin'

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

      {workspace.selected_candidate_id && decisionLabel ? (
        <div className="card decision-banner stack" style={{ boxShadow: 'none' }}>
          <strong>Décision enregistrée</strong> : modèle retenu « {decisionLabel} »
          {workspace.decision_notes ? (
            <span className="muted"> — {workspace.decision_notes}</span>
          ) : null}
        </div>
      ) : null}

      <header className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ margin: '0 0 0.25rem' }}>{workspace.name}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {workspace.description || 'Sans description'}
          </p>
        </div>
        <div className="row">
          <button type="button" className="secondary" onClick={() => setSearchOpen(true)}>
            Recherche
          </button>
          <Link className="btn secondary" to="/">
            Accueil
          </Link>
        </div>
      </header>

      <ul className="tabs">
        {tabs.map((t) => (
          <li key={t.id}>
            <button type="button" className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          </li>
        ))}
      </ul>

      <div className="card">
        {tab === 'notepad' ? (
          <NotepadTab workspaceId={workspaceId} canWrite={canWrite} />
        ) : null}
        {tab === 'requirements' ? (
          <RequirementsTab workspaceId={workspaceId} canWrite={canWrite} />
        ) : null}
        {tab === 'evaluations' ? (
          <EvaluationsTab workspaceId={workspaceId} canWrite={canWrite} userId={user.id} />
        ) : null}
        {tab === 'candidates' ? (
          <CandidatesTab workspaceId={workspaceId} canWrite={canWrite} userId={user.id} />
        ) : null}
        {tab === 'compare' ? (
          <CompareTab workspaceId={workspaceId} canWrite={canWrite} />
        ) : null}
        {tab === 'reminders' ? <RemindersTab workspaceId={workspaceId} canWrite={canWrite} /> : null}
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
