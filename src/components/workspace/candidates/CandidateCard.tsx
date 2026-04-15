import type { Dispatch, SetStateAction } from 'react'
import { displayVersionLabel, formatCandidateListLabel } from '../../../lib/candidateLabel'
import { formatPriceEur } from '../../../lib/formatPrice'
import {
  IconActionButton,
  IconChevronDown,
  IconChevronUp,
  IconDuplicate,
  IconGripVertical,
  IconTrash,
} from '../../ui/IconActionButton'
import { CandidateDetail } from './CandidateDetail'
import type { CandidateRow } from './candidateTypes'
import { statusLabels } from './candidateTypes'

export function CandidateCard({
  candidate: c,
  nested,
  /** Complément dont le parent n’existe plus dans le dossier (à rattacher). */
  hierarchyDetached,
  openId,
  onToggleDetail,
  onDuplicate,
  onRequestDelete,
  rootCandidatesForParent,
  variationCount,
  childrenOf,
  workspaceId,
  canWrite,
  userId,
  onChanged,
  garageSuggestions,
  reorder,
}: {
  candidate: CandidateRow
  nested?: boolean
  hierarchyDetached?: boolean
  openId: string | null
  /** Ouvre le détail de ce candidat ou le ferme s’il est déjà ouvert. */
  onToggleDetail: (id: string) => void
  onDuplicate: (c: CandidateRow) => void
  /** Ouvre la confirmation de suppression (fiche + compléments le cas échéant). */
  onRequestDelete?: (c: CandidateRow) => void
  rootCandidatesForParent: CandidateRow[]
  variationCount?: number
  childrenOf: (parentId: string) => CandidateRow[]
  workspaceId: string
  canWrite: boolean
  userId: string
  onChanged: () => void
  garageSuggestions: string[]
  reorder?: {
    canReorder: boolean
    draggingId: string | null
    dragOverId: string | null
    setDraggingId: Dispatch<SetStateAction<string | null>>
    setDragOverId: Dispatch<SetStateAction<string | null>>
    onDrop: (targetId: string, draggedId: string) => void
  }
}) {
  const open = openId === c.id
  const childCount = variationCount ?? childrenOf(c.id).length
  const isRoot = !c.parent_candidate_id
  const rootMultiVariant = isRoot && childCount >= 2
  const periodLabel = c.event_date?.trim() ? String(c.event_date).trim() : ''

  const ro = reorder
  const canReorder = ro?.canReorder ?? false

  return (
    <li
      className={`card candidate-card${nested ? ' candidate-tree-child' : ''}${
        ro && ro.draggingId === c.id ? ' candidate-card--dragging' : ''
      }${ro && ro.dragOverId === c.id ? ' candidate-card--drag-target' : ''}`}
      style={{ boxShadow: 'none' }}
      onDragOver={
        ro && canReorder
          ? (e) => {
              if (![...e.dataTransfer.types].includes('text/plain')) return
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              ro.setDragOverId(c.id)
            }
          : undefined
      }
      onDragLeave={
        ro && canReorder
          ? (e) => {
              const next = e.relatedTarget as Node | null
              if (next && e.currentTarget.contains(next)) return
              ro.setDragOverId((cur) => (cur === c.id ? null : cur))
            }
          : undefined
      }
      onDrop={
        ro && canReorder
          ? (e) => {
              e.preventDefault()
              const draggedId = e.dataTransfer.getData('text/plain')
              ro.setDragOverId(null)
              if (draggedId) ro.onDrop(c.id, draggedId)
            }
          : undefined
      }
    >
      <div className="candidate-card-head row">
        <div
          className="requirement-card-view-with-handle"
          style={{ flex: '1 1 200px', minWidth: 0 }}
        >
          {ro && canReorder ? (
            <button
              type="button"
              className="reorder-drag-handle"
              draggable
              aria-label={`Réordonner : ${formatCandidateListLabel(c)}`}
              title="Glisser pour réordonner"
              onDragStart={(e) => {
                ro.setDraggingId(c.id)
                e.dataTransfer.setData('text/plain', c.id)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragEnd={() => {
                ro.setDraggingId(null)
                ro.setDragOverId(null)
              }}
            >
              <IconGripVertical />
            </button>
          ) : null}
          <div className="candidate-card-title requirement-card-body">
            <strong>{formatCandidateListLabel(c)}</strong>{' '}
            <span className={`badge candidate-status-badge candidate-status-badge--${c.status}`}>
              {statusLabels[c.status]}
            </span>
            {c.parent_candidate_id ? (
              <span className="muted" style={{ marginLeft: '0.35rem', fontSize: '0.8rem' }}>
                {hierarchyDetached ? 'complément orphelin' : 'complément'}
              </span>
            ) : null}
            {hierarchyDetached ? (
              <span
                className="badge candidate-status-badge"
                style={{ marginLeft: '0.35rem', background: 'var(--warn-bg, #4a3a00)' }}
                title="Le parent référencé est absent : rattachez cette fiche à une racine dans le détail."
              >
                Parent manquant
              </span>
            ) : null}
            <div className="muted">
              {nested ? (
                <>
                  <span className="candidate-version-line-prefix">Complément · </span>
                  {[
                    displayVersionLabel(c),
                    c.engine?.trim(),
                    c.price != null ? formatPriceEur(c.price) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </>
              ) : rootMultiVariant ? (
                <>{[displayVersionLabel(c), periodLabel].filter(Boolean).join(' · ')}</>
              ) : (
                <>
                  {[
                    displayVersionLabel(c),
                    c.engine?.trim(),
                    c.price != null ? formatPriceEur(c.price) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </>
              )}
            </div>
          </div>
        </div>
        <div className="candidate-card-toolbar row icon-action-toolbar">
          <IconActionButton
            variant="secondary"
            label="Dupliquer ce modèle"
            onClick={() => void onDuplicate(c)}
          >
            <IconDuplicate />
          </IconActionButton>
          {canWrite && onRequestDelete ? (
            <IconActionButton
              variant="danger"
              label={`Supprimer la fiche « ${formatCandidateListLabel(c)} »`}
              onClick={() => onRequestDelete(c)}
            >
              <IconTrash />
            </IconActionButton>
          ) : null}
          <IconActionButton
            variant="secondary"
            label={open ? 'Fermer le détail' : 'Afficher le détail'}
            onClick={() => onToggleDetail(c.id)}
          >
            {open ? <IconChevronUp /> : <IconChevronDown />}
          </IconActionButton>
        </div>
      </div>
      {open ? (
        <CandidateDetail
          candidate={c}
          rootCandidates={rootCandidatesForParent}
          variationCount={childCount}
          workspaceId={workspaceId}
          canWrite={canWrite}
          userId={userId}
          onChanged={onChanged}
          garageSuggestions={garageSuggestions}
        />
      ) : null}
    </li>
  )
}
