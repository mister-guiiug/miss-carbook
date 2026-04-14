import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activity'
import { currentVehicleSchema } from '../../lib/validation/schemas'
import type { Database } from '../../types/database'
import { ExportWorkspaceButton } from './ExportWorkspaceButton'
import { useErrorDialog } from '../../contexts/ErrorDialogContext'
import { useToast } from '../../contexts/ToastContext'

type Ws = Database['public']['Tables']['workspaces']['Row']

type Member = {
  user_id: string
  role: Database['public']['Tables']['workspace_members']['Row']['role']
}

type InviteRow = {
  id: string
  token: string
  role: string
  expires_at: string
  used_at: string | null
}

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
  const [members, setMembers] = useState<(Member & { display_name?: string })[]>([])
  const [invites, setInvites] = useState<InviteRow[]>([])
  const [vehicle, setVehicle] = useState({
    brand: '',
    model: '',
    engine: '',
    year: '' as string | number,
    options: '',
  })
  const [vehicleId, setVehicleId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [inviteRole, setInviteRole] = useState<'read' | 'write' | 'admin'>('read')
  const [inviteDays, setInviteDays] = useState(7)
  const [lastToken, setLastToken] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<{ id: string; label: string }[]>([])
  const [decisionCand, setDecisionCand] = useState<string>('')
  const [decisionNotes, setDecisionNotes] = useState('')

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const base = import.meta.env.BASE_URL
  const inviteUrl = `${origin}${base}`.replace(/([^:]\/)\/+/g, '$1') + `w/${workspace.id}`

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
        .select('id, brand, model')
        .eq('workspace_id', workspace.id)
      setCandidates(
        (cand ?? []).map((c) => ({
          id: c.id,
          label: `${c.brand} ${c.model}`.trim(),
        }))
      )
    })()
  }, [workspace.id, reportException, loadInvites])

  useEffect(() => {
    setDecisionCand(workspace.selected_candidate_id ?? '')
    setDecisionNotes(workspace.decision_notes ?? '')
  }, [workspace.selected_candidate_id, workspace.decision_notes])

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
        setVehicle({
          brand: data.brand,
          model: data.model,
          engine: data.engine,
          year: data.year ?? '',
          options: data.options,
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

  return (
    <div className="stack">
      <div className="card stack" style={{ boxShadow: 'none' }}>
        <h3 style={{ margin: 0 }}>Décision</h3>
        <p className="muted">Modèle retenu (visible en bannière dans l’en-tête du dossier).</p>
        {canWrite ? (
          <form onSubmit={saveDecision} className="stack">
            <label>Modèle retenu</label>
            <select value={decisionCand} onChange={(e) => setDecisionCand(e.target.value)}>
              <option value="">— Aucun —</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <label>Notes / motif</label>
            <textarea value={decisionNotes} onChange={(e) => setDecisionNotes(e.target.value)} />
            <button type="submit">Enregistrer la décision</button>
          </form>
        ) : (
          <p className="muted">Lecture seule.</p>
        )}
      </div>

      <div className="card stack" style={{ boxShadow: 'none' }}>
        <h3 style={{ margin: 0 }}>Partage classique</h3>
        <p>
          Code court&nbsp;: <code>{workspace.share_code}</code>
        </p>
        <p className="muted" style={{ wordBreak: 'break-all' }}>
          Lien d’invitation&nbsp;: {inviteUrl}
        </p>
        <button type="button" className="secondary" onClick={() => void copy()}>
          Copier le lien
        </button>
      </div>

      {isAdmin ? (
        <div className="card stack" style={{ boxShadow: 'none' }}>
          <h3 style={{ margin: 0 }}>Invitations avec rôle & expiration</h3>
          <p className="muted">
            Lien à usage unique (après acceptation). Copié dans le presse-papiers à la création.
          </p>
          <div className="row">
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
            >
              <option value="read">Lecture</option>
              <option value="write">Écriture</option>
              <option value="admin">Admin</option>
            </select>
            <input
              type="number"
              min={1}
              max={90}
              value={inviteDays}
              onChange={(e) => setInviteDays(Number(e.target.value))}
              style={{ width: '5rem' }}
            />
            <span className="muted">jours</span>
            <button type="button" onClick={() => void createInvite()}>
              Créer invitation
            </button>
          </div>
          {lastToken ? (
            <p className="muted" style={{ wordBreak: 'break-all' }}>
              Dernier lien :{' '}
              <code>{`${origin}${base}?invite=${lastToken}`.replace(/([^:]\/)\/+/g, '$1')}</code>
            </p>
          ) : null}
          <ul style={{ paddingLeft: '1.1rem' }}>
            {invites.map((i) => (
              <li key={i.id}>
                <code>{i.token.slice(0, 8)}…</code> — {i.role} — exp.{' '}
                {new Date(i.expires_at).toLocaleDateString('fr-FR')}
                {i.used_at ? ' — utilisée' : ''}
                {!i.used_at ? (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => void revokeInvite(i.id)}
                  >
                    Révoquer
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="card stack" style={{ boxShadow: 'none' }}>
        <h3 style={{ margin: 0 }}>Participants</h3>
        <ul style={{ paddingLeft: '1.1rem' }}>
          {members.map((m) => (
            <li key={m.user_id}>
              <strong>{m.display_name ?? m.user_id.slice(0, 8)}</strong> — {m.role}
              {isAdmin && m.user_id !== userId ? (
                <>
                  <span className="row" style={{ marginLeft: '0.5rem', gap: '0.35rem' }}>
                    {(['read', 'write', 'admin'] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        className="secondary"
                        style={{ padding: '0.2rem 0.45rem', fontSize: '0.75rem' }}
                        onClick={() => void setRole(m.user_id, r)}
                      >
                        {r}
                      </button>
                    ))}
                  </span>
                  <button
                    type="button"
                    className="secondary"
                    style={{ marginLeft: '0.5rem' }}
                    onClick={() => void removeMember(m.user_id)}
                  >
                    Retirer
                  </button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
        <button type="button" className="secondary" onClick={() => void leave()}>
          Quitter ce dossier
        </button>
      </div>

      <div className="card stack" style={{ boxShadow: 'none' }}>
        <h3 style={{ margin: 0 }}>Export dossier</h3>
        <ExportWorkspaceButton workspaceId={workspace.id} />
      </div>

      {workspace.replacement_enabled ? (
        <form onSubmit={saveVehicle} className="card stack" style={{ boxShadow: 'none' }}>
          <h3 style={{ margin: 0 }}>Véhicule actuel (remplacement)</h3>
          {!canWrite ? <p className="muted">Lecture seule</p> : null}
          <div className="row">
            <div style={{ flex: '1 1 140px' }}>
              <label>Marque</label>
              <input
                value={vehicle.brand}
                onChange={(e) => setVehicle((v) => ({ ...v, brand: e.target.value }))}
                disabled={!canWrite}
              />
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label>Modèle</label>
              <input
                value={vehicle.model}
                onChange={(e) => setVehicle((v) => ({ ...v, model: e.target.value }))}
                disabled={!canWrite}
              />
            </div>
          </div>
          <div className="row">
            <div style={{ flex: '1 1 140px' }}>
              <label>Motorisation</label>
              <input
                value={vehicle.engine}
                onChange={(e) => setVehicle((v) => ({ ...v, engine: e.target.value }))}
                disabled={!canWrite}
              />
            </div>
            <div style={{ flex: '1 1 120px' }}>
              <label>Année</label>
              <input
                type="number"
                value={vehicle.year}
                onChange={(e) => setVehicle((v) => ({ ...v, year: e.target.value }))}
                disabled={!canWrite}
              />
            </div>
          </div>
          <div>
            <label>Options</label>
            <textarea
              value={vehicle.options}
              onChange={(e) => setVehicle((v) => ({ ...v, options: e.target.value }))}
              disabled={!canWrite}
            />
          </div>
          {canWrite ? (
            <button type="submit" disabled={busy}>
              {busy ? '…' : 'Enregistrer le véhicule actuel'}
            </button>
          ) : null}
        </form>
      ) : null}
    </div>
  )
}
