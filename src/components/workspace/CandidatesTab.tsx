import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useErrorDialog } from '../../contexts/ErrorDialogContext'
import { useToast } from '../../contexts/ToastContext'
import { supabase } from '../../lib/supabase'
import { CandidateCard } from './candidates/CandidateCard'
import { CandidatesAddSection } from './candidates/CandidatesAddSection'
import { useAddCandidateForm } from './candidates/useAddCandidateForm'
import { useCandidateMutations } from './candidates/useCandidateMutations'
import { useCandidatesQuickAdd } from './candidates/useCandidatesQuickAdd'
import { useWorkspaceCandidates } from './candidates/useWorkspaceCandidates'
import type { CandidateRow } from './candidates/candidateTypes'

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
  const { showToast } = useToast()
  const { candidates, reviews, load, rootCandidates, childrenOf } = useWorkspaceCandidates(
    workspaceId,
    reportException
  )
  const [open, setOpen] = useState<string | null>(null)
  const [garageSuggestions, setGarageSuggestions] = useState<string[]>([])
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)

  const refreshGarageSuggestions = useMemo(() => {
    return async () => {
      const { data, error } = await supabase
        .from('reminders')
        .select('place')
        .eq('workspace_id', workspaceId)
      if (error) return
      const uniq = new Set<string>()
      for (const r of data ?? []) {
        const t = String((r as { place?: string | null }).place ?? '').trim()
        if (t) uniq.add(t)
      }
      setGarageSuggestions([...uniq].sort((a, b) => a.localeCompare(b, 'fr-FR')))
    }
  }, [workspaceId])

  useEffect(() => {
    void refreshGarageSuggestions()
    const ch = supabase
      .channel(`reminders-places-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reminders',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => void refreshGarageSuggestions()
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [workspaceId, refreshGarageSuggestions])

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

  const persistCandidateOrder = useCallback(
    async (orderedIds: string[]) => {
      if (!canWrite) return
      setReordering(true)
      try {
        const results = await Promise.all(
          orderedIds.map((id, sort_order) =>
            supabase
              .from('candidates')
              .update({ sort_order })
              .eq('id', id)
              .eq('workspace_id', workspaceId)
          )
        )
        const failed = results.find((x) => x.error)
        if (failed?.error) throw failed.error
        await load()
        showToast('Ordre des modèles mis à jour')
      } catch (e: unknown) {
        reportException(e, 'Réordonnancement des modèles candidats')
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
    (targetId: string, draggedId: string, siblingIds: string[]) => {
      if (!canWrite || reordering || draggedId === targetId) return
      const dragged = candidates.find((c) => c.id === draggedId)
      const target = candidates.find((c) => c.id === targetId)
      if (!dragged || !target) return
      if (dragged.parent_candidate_id !== target.parent_candidate_id) return
      const ids = [...siblingIds]
      const from = ids.indexOf(draggedId)
      const to = ids.indexOf(targetId)
      if (from === -1 || to === -1) return
      const next = [...ids]
      next.splice(from, 1)
      next.splice(to, 0, draggedId)
      void persistCandidateOrder(next)
    },
    [canWrite, reordering, candidates, persistCandidateOrder]
  )

  const reorderBundle = useCallback(
    (siblingIds: string[]) =>
      canWrite && siblingIds.length > 1
        ? {
            canReorder: !reordering,
            draggingId,
            dragOverId,
            setDraggingId,
            setDragOverId,
            onDrop: (targetId: string, draggedId: string) =>
              onDropReorder(targetId, draggedId, siblingIds),
          }
        : undefined,
    [canWrite, reordering, draggingId, dragOverId, onDropReorder]
  )

  const orphanSiblingsSorted = useCallback(
    (c: CandidateRow) =>
      candidates
        .filter((x) => x.parent_candidate_id === c.parent_candidate_id)
        .sort((a, b) => {
          if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
          return (a.trim ?? '').localeCompare(b.trim ?? '', 'fr-FR')
        }),
    [candidates]
  )

  return (
    <div className="stack candidates-tab">
      <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
        Le <strong>modèle racine</strong> affiche une <strong>version de base</strong> (« Générique
        » si le champ est vide) ; chaque <strong>complément</strong> porte une version
        complémentaire. Tant qu’il n’y a pas <strong>plusieurs compléments</strong>, les détails
        (motorisation, prix, etc.) restent sur la même fiche ; avec au moins deux compléments,
        seules ces lignes portent les détails comparables.
        {canWrite ? (
          <>
            {' '}
            <strong>Glisser-déposer</strong> la poignée pour ordonner les racines entre elles ou les
            compléments d’un même modèle.
          </>
        ) : null}
      </p>

      {canWrite ? (
        <CandidatesAddSection
          form={form}
          setForm={setForm}
          addCandidate={addCandidate}
          importCsv={importCsv}
          rootCandidates={rootCandidates}
          candidates={candidates}
          garageSuggestions={garageSuggestions}
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
              garageSuggestions={garageSuggestions}
              reorder={reorderBundle(rootCandidates.map((r) => r.id))}
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
                garageSuggestions={garageSuggestions}
                reorder={reorderBundle(childrenOf(root.id).map((ch) => ch.id))}
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
                garageSuggestions={garageSuggestions}
                reorder={reorderBundle(orphanSiblingsSorted(c).map((x) => x.id))}
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
