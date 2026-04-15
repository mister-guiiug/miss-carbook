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
import {
  IconActionButton,
  IconGripVertical,
  IconPencil,
  IconPlus,
  IconTrash,
  IconX,
} from '../ui/IconActionButton'

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

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)

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
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
      return a.label.localeCompare(b.label)
    })
  }, [rows, filter])

  const canReorder = canWrite && filter === 'all' && !editingId && !reordering

  const applyReorder = useCallback(
    async (orderedIds: string[]) => {
      if (!canWrite) return
      setReordering(true)
      try {
        const results = await Promise.all(
          orderedIds.map((id, sort_order) =>
            supabase
              .from('requirements')
              .update({ sort_order })
              .eq('id', id)
              .eq('workspace_id', workspaceId)
          )
        )
        const failed = results.find((x) => x.error)
        if (failed?.error) throw failed.error
        setRows((prev) => {
          const m = new Map(prev.map((r) => [r.id, r]))
          return orderedIds.map((id, i) => ({ ...(m.get(id) as Req), sort_order: i }))
        })
        showToast('Ordre des exigences mis à jour')
      } catch (e: unknown) {
        reportException(e, 'Réordonnancement des exigences')
        await load()
      } finally {
        setReordering(false)
        setDraggingId(null)
        setDragOverId(null)
      }
    },
    [canWrite, workspaceId, load, reportException, showToast]
  )

  const onDropReorder = useCallback(
    (targetId: string, draggedId: string) => {
      if (!canReorder || draggedId === targetId) return
      const ids = filtered.map((r) => r.id)
      const from = ids.indexOf(draggedId)
      const to = ids.indexOf(targetId)
      if (from === -1 || to === -1) return
      const next = [...ids]
      next.splice(from, 1)
      next.splice(to, 0, draggedId)
      void applyReorder(next)
    },
    [applyReorder, canReorder, filtered]
  )

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

      {canWrite && filter !== 'all' && rows.length > 0 ? (
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Glisser-déposer pour réordonner : affichez <strong>Toutes</strong> les exigences.
        </p>
      ) : null}

      {canWrite && !showAddForm ? (
        <IconActionButton
          variant="secondary"
          label="Ajouter une exigence"
          onClick={() => setShowAddForm(true)}
        >
          <IconPlus />
        </IconActionButton>
      ) : null}

      {canWrite && showAddForm ? (
        <form onSubmit={add} className="card stack rq-add-form" style={{ boxShadow: 'none' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Nouvelle exigence</h3>
            <IconActionButton
              variant="secondary"
              label="Fermer le formulaire d’ajout"
              onClick={() => setShowAddForm(false)}
            >
              <IconX />
            </IconActionButton>
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
            Aucune exigence encore. Utilisez le bouton « Ajouter une exigence » pour créer des
            critères (obligatoires ou à discuter) et structurer la comparaison des modèles.
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
                className={`card requirement-card${isEditing ? ' requirement-card--editing' : ''}${
                  draggingId === r.id ? ' requirement-card--dragging' : ''
                }${dragOverId === r.id ? ' requirement-card--drag-target' : ''}`}
                style={{ boxShadow: 'none' }}
                onDragOver={(e) => {
                  if (!canReorder) return
                  if (![...e.dataTransfer.types].includes('text/plain')) return
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  setDragOverId(r.id)
                }}
                onDragLeave={(e) => {
                  if (!canReorder) return
                  const next = e.relatedTarget as Node | null
                  if (next && e.currentTarget.contains(next)) return
                  setDragOverId((cur) => (cur === r.id ? null : cur))
                }}
                onDrop={(e) => {
                  if (!canReorder) return
                  e.preventDefault()
                  const draggedId = e.dataTransfer.getData('text/plain')
                  setDragOverId(null)
                  if (draggedId) onDropReorder(r.id, draggedId)
                }}
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
                    <div className="row icon-action-toolbar" style={{ flexWrap: 'wrap' }}>
                      <button type="submit" disabled={editBusy}>
                        {editBusy ? 'Enregistrement…' : 'Enregistrer'}
                      </button>
                      <IconActionButton
                        variant="secondary"
                        label="Annuler la modification"
                        onClick={cancelEdit}
                        disabled={editBusy}
                      >
                        <IconX />
                      </IconActionButton>
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
                    <div className="requirement-card-view-with-handle">
                      {canWrite && !isEditing ? (
                        <button
                          type="button"
                          className="requirement-card-drag-handle"
                          draggable={canReorder}
                          disabled={!canReorder}
                          aria-label={`Réordonner : ${r.label}`}
                          title={
                            canReorder
                              ? 'Glisser pour réordonner'
                              : 'Réordonner : affichez « Toutes » les exigences'
                          }
                          onDragStart={(e) => {
                            if (!canReorder) {
                              e.preventDefault()
                              return
                            }
                            setDraggingId(r.id)
                            e.dataTransfer.setData('text/plain', r.id)
                            e.dataTransfer.effectAllowed = 'move'
                          }}
                          onDragEnd={() => {
                            setDraggingId(null)
                            setDragOverId(null)
                          }}
                        >
                          <IconGripVertical />
                        </button>
                      ) : null}
                      <div className="requirement-card-body">
                        <span className={`badge ${r.level}`}>
                          {r.level === 'mandatory' ? 'Obligatoire' : 'À discuter'}
                        </span>{' '}
                        <strong>{r.label}</strong>
                        {r.weight != null ? (
                          <span className="muted"> · poids {r.weight}</span>
                        ) : null}
                        {r.tags?.length ? (
                          <div
                            className="muted"
                            style={{ marginTop: '0.25rem', fontSize: '0.9rem' }}
                          >
                            Tags : {r.tags.join(', ')}
                          </div>
                        ) : null}
                        {r.description ? (
                          <p className="requirement-desc" style={{ margin: '0.5rem 0 0' }}>
                            {r.description}
                          </p>
                        ) : (
                          <p
                            className="muted"
                            style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}
                          >
                            Sans description
                          </p>
                        )}
                      </div>
                    </div>
                    {canWrite ? (
                      <div className="requirement-card-actions">
                        <IconActionButton
                          variant="primary"
                          label={`Modifier l’exigence « ${r.label} »`}
                          onClick={() => startEdit(r)}
                        >
                          <IconPencil />
                        </IconActionButton>
                        <IconActionButton
                          variant="danger"
                          label={`Supprimer l’exigence « ${r.label} »`}
                          onClick={() => void remove(r.id)}
                        >
                          <IconTrash />
                        </IconActionButton>
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
