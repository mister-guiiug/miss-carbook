import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activity'
import {
  WORKSPACE_QUICK_ADD_EVENT,
  type WorkspaceQuickAddDetail,
} from '../../lib/workspaceHeaderEvents'
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

type SavingState = null | { kind: 'add' } | { kind: 'edit'; id: string }

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
  const [saving, setSaving] = useState<SavingState>(null)

  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editLevel, setEditLevel] = useState<RequirementLevel>('discuss')
  const [editWeight, setEditWeight] = useState('')
  const [editTags, setEditTags] = useState('')

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

  useEffect(() => {
    if (rows.length === 0) setShowAddForm(true)
  }, [rows.length])

  useEffect(() => {
    const onQuick = (ev: Event) => {
      const d = (ev as CustomEvent<WorkspaceQuickAddDetail>).detail
      if (d?.tab !== 'requirements') return
      setShowAddForm(true)
      requestAnimationFrame(() => {
        document.getElementById('rq-label')?.focus()
      })
    }
    window.addEventListener(WORKSPACE_QUICK_ADD_EVENT, onQuick)
    return () => window.removeEventListener(WORKSPACE_QUICK_ADD_EVENT, onQuick)
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
  }, [])

  useEffect(() => {
    if (!editingId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelEdit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editingId, cancelEdit])

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

  const startEdit = (r: Req) => {
    setEditingId(r.id)
    setEditLabel(r.label)
    setEditDescription(r.description ?? '')
    setEditLevel(r.level)
    setEditWeight(r.weight != null ? String(r.weight) : '')
    setEditTags(r.tags?.length ? r.tags.join(', ') : '')
  }

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canWrite) return
    setSaving({ kind: 'add' })
    const parsed = requirementSchema.safeParse({ label, description, level, weight, tags })
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? 'Invalide'
      reportMessage(msg, JSON.stringify(parsed.error.flatten(), null, 2))
      setSaving(null)
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
      setShowAddForm(false)
      await load()
      await logActivity(workspaceId, 'requirement.create', 'requirement', data?.id ?? null, {})
      showToast('Exigence ajoutée')
    } catch (e: unknown) {
      reportException(e, 'Ajout d’une exigence')
    } finally {
      setSaving(null)
    }
  }

  const saveEdit = async (e: React.FormEvent, id: string) => {
    e.preventDefault()
    if (!canWrite || !editingId) return
    setSaving({ kind: 'edit', id })
    const parsed = requirementSchema.safeParse({
      label: editLabel,
      description: editDescription,
      level: editLevel,
      weight: editWeight,
      tags: editTags,
    })
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? 'Invalide'
      reportMessage(msg, JSON.stringify(parsed.error.flatten(), null, 2))
      setSaving(null)
      return
    }
    try {
      const { error } = await supabase
        .from('requirements')
        .update({
          label: parsed.data.label,
          description: parsed.data.description,
          level: parsed.data.level,
          weight: parsed.data.weight ?? null,
          tags: parsed.data.tags ?? [],
        })
        .eq('id', id)
        .eq('workspace_id', workspaceId)
      if (error) throw error
      cancelEdit()
      await load()
      await logActivity(workspaceId, 'requirement.update', 'requirement', id, {})
      showToast('Exigence mise à jour')
    } catch (e: unknown) {
      reportException(e, 'Mise à jour d’une exigence')
    } finally {
      setSaving(null)
    }
  }

  const remove = async (id: string) => {
    if (!canWrite) return
    if (!confirm('Supprimer cette exigence ? Les notes de matrice liées seront aussi supprimées.'))
      return
    const { error } = await supabase.from('requirements').delete().eq('id', id)
    if (error) reportException(error, 'Suppression d’une exigence')
    else {
      if (editingId === id) cancelEdit()
      await load()
      await logActivity(workspaceId, 'requirement.delete', 'requirement', id, {})
      showToast('Exigence supprimée')
    }
  }

  const filterPill = (value: typeof filter, label: string) => (
    <button
      type="button"
      className={filter === value ? 'req-filter-pill active' : 'req-filter-pill'}
      aria-pressed={filter === value}
      onClick={() => setFilter(value)}
    >
      {label}
    </button>
  )

  return (
    <div className="stack requirements-tab">
      <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
        Définissez les critères du projet. Vous pouvez les modifier à tout moment ; la matrice
        d’évaluation et les votes suivent les libellés et niveaux à jour.
      </p>

      <div
        className="row req-summary-bar"
        style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}
      >
        <div className="muted" style={{ fontSize: '0.9rem' }}>
          <strong>{counts.total}</strong> exigence{counts.total === 1 ? '' : 's'} ·{' '}
          <strong>{counts.mandatory}</strong> obligatoire{counts.mandatory === 1 ? '' : 's'} ·{' '}
          <strong>{counts.discuss}</strong> à discuter
        </div>
        <div className="req-filter-pills row" role="group" aria-label="Filtrer par niveau">
          {filterPill('all', 'Toutes')}
          {filterPill('mandatory', 'Obligatoires')}
          {filterPill('discuss', 'À discuter')}
        </div>
      </div>

      {canWrite && rows.length > 0 && !showAddForm ? (
        <button type="button" className="secondary" onClick={() => setShowAddForm(true)}>
          + Ajouter une exigence
        </button>
      ) : null}

      {canWrite && showAddForm ? (
        <form onSubmit={add} className="card stack rq-add-form" style={{ boxShadow: 'none' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Nouvelle exigence</h3>
            {rows.length > 0 ? (
              <button type="button" className="secondary" onClick={() => setShowAddForm(false)}>
                Fermer
              </button>
            ) : null}
          </div>
          <div>
            <label htmlFor="rq-label">Libellé</label>
            <input
              id="rq-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              maxLength={200}
            />
          </div>
          <div>
            <label htmlFor="rq-desc">Description</label>
            <textarea
              id="rq-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={4000}
            />
          </div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 160px' }}>
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
                min={0}
                max={1000}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label htmlFor="rq-tags">Tags (virgules)</label>
            <input id="rq-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>
          <button type="submit" disabled={saving?.kind === 'add'}>
            {saving?.kind === 'add' ? 'Ajout…' : 'Ajouter'}
          </button>
        </form>
      ) : null}

      {rows.length === 0 ? (
        <div className="empty-state">
          <p className="muted" style={{ margin: 0 }}>
            Aucune exigence encore. Utilisez le formulaire ci-dessus pour ajouter des critères
            (obligatoires ou à discuter) et structurer la comparaison des modèles.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p className="muted" style={{ margin: 0 }}>
            Aucune exigence pour ce filtre. Changez de filtre ou créez une entrée de ce niveau.
          </p>
        </div>
      ) : (
        <ul className="stack requirement-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {filtered.map((r) => {
            const isEditing = editingId === r.id
            const editBusy = saving?.kind === 'edit' && saving.id === r.id
            return (
              <li
                key={r.id}
                className={`card requirement-card${isEditing ? ' requirement-card--editing' : ''}`}
                style={{ boxShadow: 'none' }}
              >
                {isEditing ? (
                  <form
                    className="stack"
                    onSubmit={(e) => {
                      void saveEdit(e, r.id)
                    }}
                    aria-label={`Modifier ${r.label}`}
                  >
                    <div
                      className="row"
                      style={{ flexWrap: 'wrap', justifyContent: 'space-between' }}
                    >
                      <span className="muted" style={{ fontSize: '0.85rem' }}>
                        Modification · <kbd>Échap</kbd> pour annuler
                      </span>
                    </div>
                    <div>
                      <label htmlFor={`rq-edit-label-${r.id}`}>Libellé</label>
                      <input
                        id={`rq-edit-label-${r.id}`}
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        required
                        maxLength={200}
                        autoFocus
                      />
                    </div>
                    <div>
                      <label htmlFor={`rq-edit-desc-${r.id}`}>Description</label>
                      <textarea
                        id={`rq-edit-desc-${r.id}`}
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        rows={3}
                        maxLength={4000}
                      />
                    </div>
                    <div className="row" style={{ flexWrap: 'wrap' }}>
                      <div style={{ flex: '1 1 160px' }}>
                        <label htmlFor={`rq-edit-level-${r.id}`}>Niveau</label>
                        <select
                          id={`rq-edit-level-${r.id}`}
                          value={editLevel}
                          onChange={(e) => setEditLevel(e.target.value as RequirementLevel)}
                        >
                          <option value="mandatory">Obligatoire</option>
                          <option value="discuss">À discuter</option>
                        </select>
                      </div>
                      <div style={{ flex: '1 1 140px' }}>
                        <label htmlFor={`rq-edit-weight-${r.id}`}>Poids (optionnel)</label>
                        <input
                          id={`rq-edit-weight-${r.id}`}
                          type="number"
                          step="0.01"
                          min={0}
                          max={1000}
                          value={editWeight}
                          onChange={(e) => setEditWeight(e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor={`rq-edit-tags-${r.id}`}>Tags (virgules)</label>
                      <input
                        id={`rq-edit-tags-${r.id}`}
                        value={editTags}
                        onChange={(e) => setEditTags(e.target.value)}
                      />
                    </div>
                    <div className="row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button type="submit" disabled={editBusy}>
                        {editBusy ? 'Enregistrement…' : 'Enregistrer'}
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={cancelEdit}
                        disabled={editBusy}
                      >
                        Annuler
                      </button>
                    </div>
                  </form>
                ) : (
                  <div
                    className="row requirement-card-view"
                    style={{
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                      <span className={`badge ${r.level}`}>
                        {r.level === 'mandatory' ? 'Obligatoire' : 'À discuter'}
                      </span>{' '}
                      <strong>{r.label}</strong>
                      {r.weight != null ? <span className="muted"> · poids {r.weight}</span> : null}
                      {r.tags?.length ? (
                        <div className="muted" style={{ marginTop: '0.25rem', fontSize: '0.9rem' }}>
                          Tags : {r.tags.join(', ')}
                        </div>
                      ) : null}
                      {r.description ? (
                        <p className="requirement-desc" style={{ margin: '0.5rem 0 0' }}>
                          {r.description}
                        </p>
                      ) : (
                        <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
                          Sans description
                        </p>
                      )}
                    </div>
                    {canWrite ? (
                      <div className="requirement-card-actions">
                        <button type="button" onClick={() => startEdit(r)}>
                          Modifier
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => void remove(r.id)}
                        >
                          Supprimer
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
