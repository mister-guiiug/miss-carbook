import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activity'
import { currentVehicleSchema, workspaceMetaUpdateSchema } from '../../lib/validation/schemas'
import type { Json } from '../../types/database'
import { useErrorDialog } from '../../contexts/ErrorDialogContext'
import { useToast } from '../../contexts/ToastContext'
import { SettingsCurrentVehicleForm } from './settings/SettingsCurrentVehicleForm'
import { SettingsDecisionCard } from './settings/SettingsDecisionCard'
import { SettingsExportCard } from './settings/SettingsExportCard'
import { SettingsParticipantsCard } from './settings/SettingsParticipantsCard'
import { SettingsScopeBanner } from './settings/SettingsScopeBanner'
import { SettingsWorkspaceAccessCard } from './settings/SettingsWorkspaceAccessCard'
import { SettingsWorkspaceMetaCard } from './settings/SettingsWorkspaceMetaCard'
import type { CandidateOption, InviteRow, Member, Ws } from './settings/settingsTypes'

type SettingsPanel = 'general' | 'access' | 'data'

export function SettingsTab({
  workspace,
  canWrite,
  isAdmin,
  userId,
  onWorkspaceRefresh,
}: {
  workspace: Ws
  canWrite: boolean
  isAdmin: boolean
  userId: string
  onWorkspaceRefresh: () => void
}) {
  const { reportException, reportMessage } = useErrorDialog()
  const { showToast } = useToast()
  const location = useLocation()
  const [members, setMembers] = useState<(Member & { display_name?: string })[]>([])
  const [invites, setInvites] = useState<InviteRow[]>([])
  const [vehicle, setVehicle] = useState({
    brand: '',
    model: '',
    engine: '',
    year: '' as string | number,
    options: '',
    specs: {} as Record<string, unknown>,
  })
  const [vehicleId, setVehicleId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [inviteRole, setInviteRole] = useState<'read' | 'write' | 'admin'>('read')
  const [inviteDays, setInviteDays] = useState(7)
  const [lastToken, setLastToken] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<CandidateOption[]>([])
  const [decisionCand, setDecisionCand] = useState<string>('')
  const [decisionNotes, setDecisionNotes] = useState('')

  const [wsName, setWsName] = useState(workspace.name)
  const [wsDesc, setWsDesc] = useState(workspace.description ?? '')
  const [busyWorkspaceMeta, setBusyWorkspaceMeta] = useState(false)
  const [panel, setPanel] = useState<SettingsPanel>('general')

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const base = import.meta.env.BASE_URL
  const inviteUrl = `${origin}${base}`.replace(/([^:]\/)\/+/g, '$1') + `w/${workspace.id}`

  const setVehicleSpecNum = (key: string, raw: string) => {
    setVehicle((v) => ({
      ...v,
      specs: {
        ...v.specs,
        [key]: raw === '' ? undefined : Number(raw),
      },
    }))
  }

  const setVehicleSpecStr = (key: string, value: string) => {
    setVehicle((v) => ({
      ...v,
      specs: {
        ...v.specs,
        [key]: value.trim() === '' ? undefined : value,
      },
    }))
  }

  const loadInvites = useCallback(async () => {
    const { data } = await supabase
      .from('workspace_invites')
      .select('id, token, role, expires_at, used_at')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false })
    setInvites((data ?? []) as InviteRow[])
  }, [workspace.id])

  useEffect(() => {
    void (async () => {
      const { data: mems, error } = await supabase
        .from('workspace_members')
        .select('user_id, role')
        .eq('workspace_id', workspace.id)
      if (error) {
        reportException(error, 'Chargement des membres du dossier')
        return
      }
      const list = (mems ?? []) as Member[]
      const ids = list.map((m) => m.user_id)
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', ids)
      const names: Record<string, string> = {}
      for (const p of profs ?? []) names[p.id] = p.display_name
      setMembers(list.map((m) => ({ ...m, display_name: names[m.user_id] })))
    })()
    void loadInvites()
    void (async () => {
      const { data: cand } = await supabase
        .from('candidates')
        .select('id, brand, model, trim, parent_candidate_id')
        .eq('workspace_id', workspace.id)
        .order('parent_candidate_id', { ascending: true, nullsFirst: true })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
      setCandidates(
        (cand ?? []).map((c) => ({
          id: c.id,
          brand: c.brand,
          model: c.model,
          trim: c.trim ?? '',
          parent_candidate_id: c.parent_candidate_id ?? null,
        }))
      )
    })()
  }, [workspace.id, reportException, loadInvites])

  useEffect(() => {
    setDecisionCand(workspace.selected_candidate_id ?? '')
    setDecisionNotes(workspace.decision_notes ?? '')
  }, [workspace.selected_candidate_id, workspace.decision_notes])

  useEffect(() => {
    setWsName(workspace.name)
    setWsDesc(workspace.description ?? '')
  }, [workspace.id, workspace.name, workspace.description])

  useEffect(() => {
    if (location.hash === '#workspace-settings-decision') setPanel('general')
  }, [location.hash])

  useEffect(() => {
    if (panel !== 'general') return
    if (location.hash !== '#workspace-settings-decision') return
    requestAnimationFrame(() => {
      document
        .getElementById('workspace-settings-decision')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [panel, location.hash])

  useEffect(() => {
    if (!workspace.replacement_enabled) return
    void (async () => {
      const { data } = await supabase
        .from('current_vehicle')
        .select('*')
        .eq('workspace_id', workspace.id)
        .maybeSingle()
      if (data) {
        setVehicleId(data.id)
        const rawSpecs = data.specs
        const specs =
          rawSpecs != null && typeof rawSpecs === 'object' && !Array.isArray(rawSpecs)
            ? (rawSpecs as Record<string, unknown>)
            : {}
        setVehicle({
          brand: data.brand,
          model: data.model,
          engine: data.engine,
          year: data.year ?? '',
          options: data.options,
          specs,
        })
      }
    })()
  }, [workspace.id, workspace.replacement_enabled])

  const saveVehicle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canWrite || !workspace.replacement_enabled) return
    setBusy(true)
    const parsed = currentVehicleSchema.safeParse({
      ...vehicle,
      year: vehicle.year === '' ? undefined : Number(vehicle.year),
      specs: vehicle.specs,
    })
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? 'Invalide'
      reportMessage(msg, JSON.stringify(parsed.error.flatten(), null, 2))
      setBusy(false)
      return
    }
    try {
      const row = {
        workspace_id: workspace.id,
        brand: parsed.data.brand,
        model: parsed.data.model,
        engine: parsed.data.engine,
        year: parsed.data.year,
        options: parsed.data.options,
        specs: parsed.data.specs as Json,
      }
      if (vehicleId) {
        const { error } = await supabase.from('current_vehicle').update(row).eq('id', vehicleId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('current_vehicle')
          .insert(row)
          .select('id')
          .single()
        if (error) throw error
        setVehicleId(data.id)
      }
      await logActivity(workspace.id, 'current_vehicle.upsert', 'current_vehicle', vehicleId, {})
      onWorkspaceRefresh()
      showToast('Véhicule actuel enregistré')
    } catch (e: unknown) {
      reportException(e, 'Sauvegarde du véhicule actuel')
    } finally {
      setBusy(false)
    }
  }

  const setRole = async (uid: string, role: Member['role']) => {
    if (!isAdmin) return
    const { error } = await supabase
      .from('workspace_members')
      .update({ role })
      .eq('workspace_id', workspace.id)
      .eq('user_id', uid)
    if (error) reportException(error, 'Changement de rôle d’un membre')
    else {
      setMembers((m) => m.map((x) => (x.user_id === uid ? { ...x, role } : x)))
      await logActivity(workspace.id, 'member.role_change', 'workspace_member', uid, { role })
      showToast('Rôle mis à jour')
    }
  }

  const createInvite = async () => {
    if (!isAdmin) return
    const { data, error } = await supabase.rpc('create_workspace_invite', {
      p_workspace_id: workspace.id,
      p_role: inviteRole,
      p_ttl_days: inviteDays,
    })
    if (error) reportException(error, 'Création d’une invitation au dossier')
    else {
      setLastToken(data as string)
      await loadInvites()
      const link = `${origin}${base}?invite=${data as string}`.replace(/([^:]\/)\/+/g, '$1')
      try {
        await navigator.clipboard.writeText(link)
        showToast('Invitation créée — lien copié')
      } catch {
        showToast('Invitation créée — copiez le lien affiché ci-dessous')
      }
    }
  }

  const revokeInvite = async (id: string) => {
    if (!isAdmin) return
    await supabase.from('workspace_invites').delete().eq('id', id)
    await loadInvites()
    showToast('Invitation révoquée')
  }

  const leave = async () => {
    if (!confirm('Quitter ce dossier ?')) return
    const { error } = await supabase.rpc('leave_workspace', { p_workspace_id: workspace.id })
    if (error) reportException(error, 'Quitter le dossier')
    else window.location.assign(`${origin}${base}`.replace(/([^:]\/)\/+/g, '$1'))
  }

  const removeMember = async (uid: string) => {
    if (!isAdmin || !confirm('Retirer ce participant ?')) return
    const { error } = await supabase.rpc('remove_workspace_member', {
      p_workspace_id: workspace.id,
      p_user_id: uid,
    })
    if (error) reportException(error, 'Retrait d’un membre du dossier')
    else {
      setMembers((m) => m.filter((x) => x.user_id !== uid))
      await logActivity(workspace.id, 'member.removed', 'workspace_member', uid, {})
      showToast('Membre retiré')
    }
  }

  const saveDecision = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canWrite) return
    const cid = decisionCand || null
    const { error } = await supabase.rpc('update_workspace_decision', {
      p_workspace_id: workspace.id,
      p_candidate_id: cid,
      p_notes: decisionNotes,
    })
    if (error) reportException(error, 'Enregistrement de la décision (modèle retenu)')
    else {
      await logActivity(workspace.id, 'workspace.decision', 'workspace', workspace.id, {})
      onWorkspaceRefresh()
      showToast('Décision enregistrée')
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      showToast('Lien copié')
    } catch {
      reportMessage(
        'Copie impossible — sélectionnez le lien manuellement.',
        'navigator.clipboard.writeText a échoué (permissions navigateur ou contexte non sécurisé)'
      )
    }
  }

  const saveWorkspaceMeta = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdmin) return
    const parsed = workspaceMetaUpdateSchema.safeParse({ name: wsName, description: wsDesc })
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? 'Données invalides'
      reportMessage(msg, JSON.stringify(parsed.error.flatten(), null, 2))
      return
    }
    setBusyWorkspaceMeta(true)
    try {
      const { error } = await supabase
        .from('workspaces')
        .update({
          name: parsed.data.name,
          description: parsed.data.description,
        })
        .eq('id', workspace.id)
      if (error) throw error
      await logActivity(workspace.id, 'workspace.update_meta', 'workspace', workspace.id, {
        name: parsed.data.name,
      })
      onWorkspaceRefresh()
      showToast('Nom et description enregistrés')
    } catch (err: unknown) {
      reportException(err, 'Mise à jour du nom ou de la description du dossier')
    } finally {
      setBusyWorkspaceMeta(false)
    }
  }

  const panels: { id: SettingsPanel; label: string }[] = [
    { id: 'general', label: 'Général' },
    { id: 'access', label: 'Partage' },
    { id: 'data', label: 'Données' },
  ]

  return (
    <div className="workspace-settings-page stack settings-tab">
      <SettingsScopeBanner workspaceName={workspace.name} />

      <div className="workspace-settings-shell card stack" style={{ boxShadow: 'none' }}>
        <h2 className="workspace-settings-page-title" id="workspace-settings-main-heading">
          Réglages du dossier
        </h2>
        <div
          className="workspace-settings-tablist"
          role="tablist"
          aria-label="Sections des réglages"
        >
          {panels.map((p, index) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              id={`workspace-settings-tab-${p.id}`}
              aria-selected={panel === p.id}
              aria-controls={`workspace-settings-panel-${p.id}`}
              tabIndex={panel === p.id ? 0 : -1}
              className={panel === p.id ? 'active' : ''}
              onClick={() => setPanel(p.id)}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
                e.preventDefault()
                const dir = e.key === 'ArrowRight' ? 1 : -1
                const next = (index + dir + panels.length) % panels.length
                setPanel(panels[next].id)
                const root = e.currentTarget.closest('[role="tablist"]')
                requestAnimationFrame(() => {
                  const buttons = root?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
                  buttons?.[next]?.focus()
                })
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {panel === 'general' ? (
          <div
            id="workspace-settings-panel-general"
            role="tabpanel"
            aria-labelledby="workspace-settings-tab-general"
            className="workspace-settings-panel workspace-settings-panel--general stack"
          >
            <SettingsWorkspaceMetaCard
              workspace={workspace}
              isAdmin={isAdmin}
              wsName={wsName}
              setWsName={setWsName}
              wsDesc={wsDesc}
              setWsDesc={setWsDesc}
              busyWorkspaceMeta={busyWorkspaceMeta}
              onSave={saveWorkspaceMeta}
            />
            <SettingsDecisionCard
              canWrite={canWrite}
              candidates={candidates}
              decisionCand={decisionCand}
              setDecisionCand={setDecisionCand}
              decisionNotes={decisionNotes}
              setDecisionNotes={setDecisionNotes}
              onSave={saveDecision}
            />
          </div>
        ) : null}

        {panel === 'access' ? (
          <div
            id="workspace-settings-panel-access"
            role="tabpanel"
            aria-labelledby="workspace-settings-tab-access"
            className="workspace-settings-panel stack"
          >
            <SettingsWorkspaceAccessCard
              workspace={workspace}
              inviteUrl={inviteUrl}
              onCopy={copy}
              isAdmin={isAdmin}
              origin={origin}
              base={base}
              inviteRole={inviteRole}
              setInviteRole={setInviteRole}
              inviteDays={inviteDays}
              setInviteDays={setInviteDays}
              lastToken={lastToken}
              invites={invites}
              onCreateInvite={createInvite}
              onRevokeInvite={revokeInvite}
            />
            <SettingsParticipantsCard
              members={members}
              isAdmin={isAdmin}
              userId={userId}
              onSetRole={setRole}
              onRemoveMember={removeMember}
              onLeave={leave}
            />
          </div>
        ) : null}

        {panel === 'data' ? (
          <div
            id="workspace-settings-panel-data"
            role="tabpanel"
            aria-labelledby="workspace-settings-tab-data"
            className="workspace-settings-panel stack"
          >
            <SettingsExportCard workspaceId={workspace.id} />
            {workspace.replacement_enabled ? (
              <SettingsCurrentVehicleForm
                canWrite={canWrite}
                busy={busy}
                vehicle={vehicle}
                setVehicle={setVehicle}
                setVehicleSpecNum={setVehicleSpecNum}
                setVehicleSpecStr={setVehicleSpecStr}
                onSubmit={saveVehicle}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
