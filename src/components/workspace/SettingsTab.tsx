import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activity'
import { currentVehicleSchema } from '../../lib/validation/schemas'
import type { Database } from '../../types/database'

type Ws = Database['public']['Tables']['workspaces']['Row']

type Member = {
  user_id: string
  role: Database['public']['Tables']['workspace_members']['Row']['role']
}

export function SettingsTab({
  workspace,
  canWrite,
  isAdmin,
  onWorkspaceRefresh,
}: {
  workspace: Ws
  canWrite: boolean
  isAdmin: boolean
  onWorkspaceRefresh: () => void
}) {
  const [members, setMembers] = useState<(Member & { display_name?: string })[]>([])
  const [vehicle, setVehicle] = useState({
    brand: '',
    model: '',
    engine: '',
    year: '' as string | number,
    options: '',
  })
  const [vehicleId, setVehicleId] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const base = import.meta.env.BASE_URL
  const inviteUrl = `${origin}${base}`.replace(/([^:]\/)\/+/g, '$1') + `w/${workspace.id}`

  useEffect(() => {
    void (async () => {
      const { data: mems, error } = await supabase
        .from('workspace_members')
        .select('user_id, role')
        .eq('workspace_id', workspace.id)
      if (error) {
        setErr(error.message)
        return
      }
      const list = (mems ?? []) as Member[]
      const ids = list.map((m) => m.user_id)
      const { data: profs } = await supabase.from('profiles').select('id, display_name').in('id', ids)
      const names: Record<string, string> = {}
      for (const p of profs ?? []) names[p.id] = p.display_name
      setMembers(list.map((m) => ({ ...m, display_name: names[m.user_id] })))
    })()
  }, [workspace.id])

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
    setErr(null)
    const parsed = currentVehicleSchema.safeParse({
      ...vehicle,
      year: vehicle.year === '' ? undefined : Number(vehicle.year),
    })
    if (!parsed.success) {
      setErr(parsed.error.errors[0]?.message ?? 'Invalide')
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
        const { data, error } = await supabase.from('current_vehicle').insert(row).select('id').single()
        if (error) throw error
        setVehicleId(data.id)
      }
      await logActivity(workspace.id, 'current_vehicle.upsert', 'current_vehicle', vehicleId, {})
      onWorkspaceRefresh()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Sauvegarde impossible')
    } finally {
      setBusy(false)
    }
  }

  const setRole = async (userId: string, role: Member['role']) => {
    if (!isAdmin) return
    const { error } = await supabase
      .from('workspace_members')
      .update({ role })
      .eq('workspace_id', workspace.id)
      .eq('user_id', userId)
    if (error) setErr(error.message)
    else {
      setMembers((m) => m.map((x) => (x.user_id === userId ? { ...x, role } : x)))
      await logActivity(workspace.id, 'member.role_change', 'workspace_member', userId, { role })
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
    } catch {
      setErr('Copie impossible — sélectionnez le lien manuellement.')
    }
  }

  return (
    <div className="stack">
      <div className="card stack" style={{ boxShadow: 'none' }}>
        <h3 style={{ margin: 0 }}>Partage</h3>
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

      <div className="card stack" style={{ boxShadow: 'none' }}>
        <h3 style={{ margin: 0 }}>Participants</h3>
        <ul style={{ paddingLeft: '1.1rem' }}>
          {members.map((m) => (
            <li key={m.user_id}>
              <strong>{m.display_name ?? m.user_id.slice(0, 8)}</strong> — {m.role}
              {isAdmin ? (
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
              ) : null}
            </li>
          ))}
        </ul>
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

      {err ? <p className="error">{err}</p> : null}
    </div>
  )
}
