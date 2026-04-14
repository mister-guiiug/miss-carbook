import { formatCandidateListLabel } from '../../../lib/candidateLabel'
import {
  IconActionButton,
  IconChevronDown,
  IconChevronUp,
  IconDuplicate,
} from '../../ui/IconActionButton'
import { CandidateDetail } from './CandidateDetail'
import type { CandidateRow } from './candidateTypes'
import { statusLabels } from './candidateTypes'

export function CandidateCard({
  candidate: c,
  nested,
  openId,
  onToggleDetail,
  onDuplicate,
  rootCandidatesForParent,
  variationCount,
  childrenOf,
  workspaceId,
  canWrite,
  userId,
  onChanged,
}: {
  candidate: CandidateRow
  nested?: boolean
  openId: string | null
  /** Ouvre le détail de ce candidat ou le ferme s’il est déjà ouvert. */
  onToggleDetail: (id: string) => void
  onDuplicate: (c: CandidateRow) => void
  rootCandidatesForParent: CandidateRow[]
  variationCount?: number
  childrenOf: (parentId: string) => CandidateRow[]
  workspaceId: string
  canWrite: boolean
  userId: string
  onChanged: () => void
}) {
  const open = openId === c.id
  return (
    <li
      className={`card candidate-card${nested ? ' candidate-tree-child' : ''}`}
      style={{ boxShadow: 'none' }}
    >
      <div className="candidate-card-head row">
        <div className="candidate-card-title" style={{ flex: '1 1 200px', minWidth: 0 }}>
          <strong>{formatCandidateListLabel(c)}</strong>{' '}
          <span className={`badge candidate-status-badge candidate-status-badge--${c.status}`}>
            {statusLabels[c.status]}
          </span>
          {c.parent_candidate_id ? (
            <span className="muted" style={{ marginLeft: '0.35rem', fontSize: '0.8rem' }}>
              variation
            </span>
          ) : null}
          <div className="muted">
            {c.trim ? `${c.trim} · ` : ''}
            {c.engine}
            {c.price != null ? ` · ${c.price} €` : ''}
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
          variationCount={variationCount ?? childrenOf(c.id).length}
          workspaceId={workspaceId}
          canWrite={canWrite}
          userId={userId}
          onChanged={onChanged}
        />
      ) : null}
    </li>
  )
}
