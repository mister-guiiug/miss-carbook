import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Database } from '../types/database'
import { NotepadTab } from '../components/workspace/NotepadTab'
import { RequirementsTab } from '../components/workspace/RequirementsTab'
import { CandidatesTab } from '../components/workspace/CandidatesTab'
import { CompareTab } from '../components/workspace/CompareTab'
import { ActivityTab } from '../components/workspace/ActivityTab'
import { SettingsTab } from '../components/workspace/SettingsTab'

type Ws = Database['public']['Tables']['workspaces']['Row']
type Role = Database['public']['Tables']['workspace_members']['Row']['role']

const tabs = [
  { id: 'notepad', label: 'Bloc-notes' },
  { id: 'requirements', label: 'Exigences' },
  { id: 'candidates', label: 'Modèles' },
  { id: 'compare', label: 'Comparer' },
  { id: 'activity', label: 'Activité' },
  { id: 'settings', label: 'Paramètres' },
] as const

type TabId = (typeof tabs)[number]['id']

export function WorkspacePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const { user } = useAuth()
  const [workspace, setWorkspace] = useState<Ws | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [tab, setTab] = useState<TabId>('notepad')
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    if (!workspaceId || !user) return
    setLoading(true)
    try {
      const { data: ws, error: wErr } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', workspaceId)
        .maybeSingle()
      if (wErr) {
        setErr(wErr.message)
        return
      }
      if (!ws) {
        setErr('Dossier introuvable.')
        setWorkspace(null)
        return
      }
      setWorkspace(ws as Ws)
      const { data: mem, error: mErr } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (mErr) {
        setErr(mErr.message)
        return
      }
      if (!mem) {
        setErr('Vous n’êtes pas membre de ce dossier.')
        setRole(null)
        return
      }
      setRole(mem.role as Role)
      setErr(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
 // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, user?.id])

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

  if (err || !workspace || !role) {
    return (
      <div className="shell stack">
        <p className="error">{err ?? 'Accès impossible'}</p>
        <Link to="/">← Retour</Link>
      </div>
    )
  }

  const canWrite = role === 'write' || role === 'admin'
  const isAdmin = role === 'admin'

  return (
    <div className="shell stack">
      <header className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ margin: '0 0 0.25rem' }}>{workspace.name}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {workspace.description || 'Sans description'}
          </p>
        </div>
        <Link className="btn secondary" to="/">
          Accueil
        </Link>
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
        {tab === 'candidates' ? (
          <CandidatesTab workspaceId={workspaceId} canWrite={canWrite} userId={user.id} />
        ) : null}
        {tab === 'compare' ? <CompareTab workspaceId={workspaceId} /> : null}
        {tab === 'activity' ? <ActivityTab workspaceId={workspaceId} /> : null}
        {tab === 'settings' ? (
          <SettingsTab
            workspace={workspace}
            canWrite={canWrite}
            isAdmin={isAdmin}
            onWorkspaceRefresh={() => void refresh()}
          />
        ) : null}
      </div>
    </div>
  )
}
