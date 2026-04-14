import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activity'
import { requirementSchema } from '../../lib/validation/schemas'
import { useErrorDialog } from '../../contexts/ErrorDialogContext'
import { useToast } from '../../contexts/ToastContext'
import type { RequirementLevel } from '../../types/database'

type Req = {
  id: string
  label: string
  description: string
  level: RequirementLevel
  weight: number | null
  tags: string[]
  sort_order: number
}

export function RequirementsTab({
  workspaceId,
  canWrite,
}: {
  workspaceId: string
  canWrite: boolean
}) {
  const { reportException, reportMessage } = useErrorDialog()
  const { showToast } = useToast()
  const [rows, setRows] = useState<Req[]>([])
  const [filter, setFilter] = useState<'all' | RequirementLevel>('all')

  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [level, setLevel] = useState<RequirementLevel>('discuss')
  const [weight, setWeight] = useState('')
  const [tags, setTags] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('requirements')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('sort_order', { ascending: true })
    if (error) reportException(error, 'Chargement des exigences')
    else setRows((data ?? []) as Req[])
  }, [workspaceId, reportException])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const list = filter === 'all' ? rows : rows.filter((r) => r.level === filter)
    return [...list].sort((a, b) => {
      const wa = a.weight ?? -1
      const wb = b.weight ?? -1
      if (wb !== wa) return wb - wa
      return a.label.localeCompare(b.label)
    })
  }, [rows, filter])

  const counts = useMemo(() => {
    const mandatory = rows.filter((r) => r.level === 'mandatory').length
    const discuss = rows.filter((r) => r.level === 'discuss').length
    return { total: rows.length, mandatory, discuss }
  }, [rows])

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canWrite) return
    setBusy(true)
    const parsed = requirementSchema.safeParse({ label, description, level, weight, tags })
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? 'Invalide'
      reportMessage(msg, JSON.stringify(parsed.error.flatten(), null, 2))
      setBusy(false)
      return
    }
    try {
      const { data, error } = await supabase
        .from('requirements')
        .insert({
          workspace_id: workspaceId,
          label: parsed.data.label,
          description: parsed.data.description,
          level: parsed.data.level,
          weight: parsed.data.weight ?? null,
          tags: parsed.data.tags ?? [],
          sort_order: rows.length,
        })
        .select('id')
        .single()
      if (error) throw error
      setLabel('')
      setDescription('')
      setLevel('discuss')
      setWeight('')
      setTags('')
      await load()
      await logActivity(workspaceId, 'requirement.create', 'requirement', data?.id ?? null, {})
      showToast('Exigence ajoutée')
    } catch (e: unknown) {
      reportException(e, 'Ajout d’une exigence')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    if (!canWrite) return
    if (!confirm('Supprimer cette exigence ?')) return
    const { error } = await supabase.from('requirements').delete().eq('id', id)
    if (error) reportException(error, 'Suppression d’une exigence')
    else {
      await load()
      await logActivity(workspaceId, 'requirement.delete', 'requirement', id, {})
      showToast('Exigence supprimée')
    }
  }

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="muted">
          Total&nbsp;: {counts.total} · obligatoires&nbsp;: {counts.mandatory} · à discuter&nbsp;:{' '}
          {counts.discuss}
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="all">Tous niveaux</option>
          <option value="mandatory">Obligatoire</option>
          <option value="discuss">À discuter</option>
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="empty-state">
          <p className="muted" style={{ margin: 0 }}>
            Aucune exigence encore. Ajoutez des critères (obligatoires ou à discuter) pour
            structurer la comparaison des modèles.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p className="muted" style={{ margin: 0 }}>
            Aucune exigence pour le filtre choisi. Changez le filtre ou ajoutez des entrées du
            niveau concerné.
          </p>
        </div>
      ) : (
        <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {filtered.map((r) => (
            <li key={r.id} className="card" style={{ boxShadow: 'none' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <span className={`badge ${r.level}`}>
                    {r.level === 'mandatory' ? 'Obligatoire' : 'À discuter'}
                  </span>{' '}
                  <strong>{r.label}</strong>
                  {r.weight != null ? <span className="muted"> · poids {r.weight}</span> : null}
                  {r.tags?.length ? <div className="muted">tags : {r.tags.join(', ')}</div> : null}
                  {r.description ? <p style={{ margin: '0.35rem 0 0' }}>{r.description}</p> : null}
                </div>
                {canWrite ? (
                  <button type="button" className="secondary" onClick={() => void remove(r.id)}>
                    Supprimer
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canWrite ? (
        <form onSubmit={add} className="card stack" style={{ boxShadow: 'none' }}>
          <h3 style={{ margin: 0 }}>Ajouter une exigence</h3>
          <div>
            <label htmlFor="rq-label">Libellé</label>
            <input
              id="rq-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="rq-desc">Description</label>
            <textarea
              id="rq-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="row">
            <div style={{ flex: '1 1 140px' }}>
              <label htmlFor="rq-level">Niveau</label>
              <select
                id="rq-level"
                value={level}
                onChange={(e) => setLevel(e.target.value as RequirementLevel)}
              >
                <option value="mandatory">Obligatoire</option>
                <option value="discuss">À discuter</option>
              </select>
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label htmlFor="rq-weight">Poids (optionnel)</label>
              <input
                id="rq-weight"
                type="number"
                step="0.01"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label htmlFor="rq-tags">Tags (virgules)</label>
            <input id="rq-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>
          <button type="submit" disabled={busy}>
            Ajouter
          </button>
        </form>
      ) : null}
    </div>
  )
}
