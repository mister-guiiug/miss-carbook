import { Fragment, useState } from 'react'
import { useErrorDialog } from '../../contexts/ErrorDialogContext'
import { CandidateCard } from './candidates/CandidateCard'
import { CandidatesAddSection } from './candidates/CandidatesAddSection'
import { useAddCandidateForm } from './candidates/useAddCandidateForm'
import { useCandidateMutations } from './candidates/useCandidateMutations'
import { useCandidatesQuickAdd } from './candidates/useCandidatesQuickAdd'
import { useWorkspaceCandidates } from './candidates/useWorkspaceCandidates'

export function CandidatesTab({
  workspaceId,
  canWrite,
  userId,
}: {
  workspaceId: string
  canWrite: boolean
  userId: string
}) {
  const { reportException, reportMessage } = useErrorDialog()
  const { candidates, reviews, load, rootCandidates, childrenOf } = useWorkspaceCandidates(
    workspaceId,
    reportException
  )
  const [open, setOpen] = useState<string | null>(null)

  useCandidatesQuickAdd()

  const { duplicateOne, importCsv } = useCandidateMutations({
    workspaceId,
    canWrite,
    load,
    reportException,
  })

  const { form, setForm, addCandidate } = useAddCandidateForm({
    workspaceId,
    canWrite,
    load,
    reportException,
    reportMessage,
  })

  const toggleDetail = (id: string) => {
    setOpen((o) => (o === id ? null : id))
  }

  return (
    <div className="stack candidates-tab">
      <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
        Le <strong>modèle racine</strong> affiche une <strong>version de base</strong> (« Générique »
        si le champ est vide) ; chaque <strong>complément</strong> porte une version complémentaire.
        Tant qu’il n’y a pas <strong>plusieurs compléments</strong>, les détails (motorisation, prix,
        etc.) restent sur la même fiche ; avec au moins deux compléments, seules ces lignes portent
        les détails comparables.
      </p>

      {canWrite ? (
        <CandidatesAddSection
          form={form}
          setForm={setForm}
          addCandidate={addCandidate}
          importCsv={importCsv}
          rootCandidates={rootCandidates}
          candidates={candidates}
        />
      ) : null}

      <ul className="stack candidate-tree" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {rootCandidates.map((root) => (
          <Fragment key={root.id}>
            <CandidateCard
              candidate={root}
              openId={open}
              onToggleDetail={toggleDetail}
              onDuplicate={duplicateOne}
              rootCandidatesForParent={rootCandidates.filter((x) => x.id !== root.id)}
              childrenOf={childrenOf}
              workspaceId={workspaceId}
              canWrite={canWrite}
              userId={userId}
              onChanged={load}
            />
            {childrenOf(root.id).map((child) => (
              <CandidateCard
                key={child.id}
                candidate={child}
                nested
                openId={open}
                onToggleDetail={toggleDetail}
                onDuplicate={duplicateOne}
                rootCandidatesForParent={rootCandidates.filter((x) => x.id !== child.id)}
                childrenOf={childrenOf}
                workspaceId={workspaceId}
                canWrite={canWrite}
                userId={userId}
                onChanged={load}
              />
            ))}
          </Fragment>
        ))}
        {candidates
          .filter(
            (c) => c.parent_candidate_id && !candidates.some((p) => p.id === c.parent_candidate_id)
          )
          .map((c) => (
            <Fragment key={`orphan-${c.id}`}>
              <CandidateCard
                candidate={c}
                openId={open}
                onToggleDetail={toggleDetail}
                onDuplicate={duplicateOne}
                rootCandidatesForParent={rootCandidates.filter((x) => x.id !== c.id)}
                childrenOf={childrenOf}
                workspaceId={workspaceId}
                canWrite={canWrite}
                userId={userId}
                onChanged={load}
              />
            </Fragment>
          ))}
      </ul>

      <p className="muted">
        Les avis agrégés pour la comparaison proviennent des notes saisies ci-dessous (
        {reviews.length} entrées chargées).
      </p>
    </div>
  )
}
