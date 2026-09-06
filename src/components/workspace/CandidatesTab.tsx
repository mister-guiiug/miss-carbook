import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ConfirmDialog } from '@mister-guiiug/dev-pwa-config/react/confirm-dialog';
import { useActionGuard } from '@mister-guiiug/dev-pwa-config/react/use-action-guard';
import { useErrorDialog } from '../../contexts/ErrorDialogContext';
import { TOAST_UNDO_MS, useToast } from '../../contexts/ToastContext';
import { useI18n } from '../../i18n';
import { logActivity } from '../../lib/activity';
import { formatCandidateListLabel } from '../../lib/candidateLabel';
import {
  CANDIDATE_HIERARCHY_HELP_FR,
  postOrderDeleteIds,
} from '../../lib/candidateTree';
import { getSupabase } from '../../lib/supabase';
import { useRealtimeTable } from '../../hooks/useRealtimeTable';
import { CandidateCard } from './candidates/CandidateCard';
import { CandidatesAddSection } from './candidates/CandidatesAddSection';
import { useAddCandidateForm } from './candidates/useAddCandidateForm';
import { useCandidateMutations } from './candidates/useCandidateMutations';
import { useCandidatesQuickAdd } from './candidates/useCandidatesQuickAdd';
import { useWorkspaceCandidates } from './candidates/useWorkspaceCandidates';
import type { CandidateRow } from './candidates/candidateTypes';
import { getDefaultLocale } from '@mister-guiiug/dev-pwa-config/format';

/** Une suppression en sursis : masquée à l'écran, pas encore jouée sur le serveur. */
type PendingDelete = {
  workspaceId: string;
  ids: string[];
  rootId: string;
  timer: ReturnType<typeof setTimeout>;
};

/**
 * Les lignes partent une par une, des feuilles vers la racine — c'est l'ordre
 * que `postOrderDeleteIds` calcule. Fonction de module, sans état React :
 * elle doit rester appelable depuis un démontage, quand plus aucun `setState`
 * n'a de sens.
 */
async function deleteCandidateRows(workspaceId: string, ids: string[]) {
  for (const id of ids) {
    const { error } = await getSupabase()
      .from('candidates')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId);
    if (error) throw error;
  }
}

export function CandidatesTab({
  workspaceId,
  canWrite,
  userId,
}: {
  workspaceId: string;
  canWrite: boolean;
  userId: string;
}) {
  const { t } = useI18n();
  const { reportException, reportMessage } = useErrorDialog();
  const { showToast } = useToast();
  /**
   * SUPPRIMER, PUIS POUVOIR SE RAVISER. Les fiches d'une suppression confirmée
   * disparaissent d'abord de l'écran SEULEMENT : rien ne part au serveur avant
   * huit secondes. Pendant ce sursis, « Annuler » les rend intactes — avec
   * leurs compléments, leurs commentaires, leurs avis et leurs photos, que le
   * `ON DELETE CASCADE` aurait emportés sans retour possible. Réinsérer après
   * coup aurait rendu une coquille ; ne rien avoir supprimé rend tout.
   *
   * Le prix, dit franchement : fermer l'onglet du navigateur pendant ces huit
   * secondes annule la suppression au lieu de la jouer. Le geste manqué est du
   * bon côté — on garde une fiche de trop, jamais une de moins. Quitter
   * l'onglet Modèles, lui, la joue immédiatement (voir le démontage).
   */
  const [hiddenIds, setHiddenIds] = useState<readonly string[]>([]);
  const {
    candidates,
    reviews,
    load,
    rootCandidates,
    childrenOf,
    orphanVariations,
  } = useWorkspaceCandidates(workspaceId, reportException, hiddenIds);
  const [open, setOpen] = useState<string | null>(null);
  const [garageSuggestions, setGarageSuggestions] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState<CandidateRow | null>(
    null
  );
  const pendingRef = useRef<PendingDelete | null>(null);

  /**
   * La suppression reste une affaire de RÉSEAU, une requête par ligne, même en
   * sursis : hors connexion, la première échouerait — après avoir demandé
   * confirmation d'un geste impossible, et après avoir fait disparaître les
   * fiches de l'écran. Le garde est calculé UNE fois ici et descendu aux
   * cartes : `useActionGuard` pose un écouteur `online`/`offline`, il serait
   * dommage d'en poser un par candidat affiché.
   */
  const deleteGuard = useActionGuard({ online: true });

  const refreshGarageSuggestions = useMemo(() => {
    return async () => {
      const { data, error } = await getSupabase()
        .from('reminders')
        .select('place')
        .eq('workspace_id', workspaceId);
      if (error) return;
      const uniq = new Set<string>();
      for (const r of data ?? []) {
        const t = String((r as { place?: string | null }).place ?? '').trim();
        if (t) uniq.add(t);
      }
      setGarageSuggestions(
        [...uniq].sort((a, b) => a.localeCompare(b, getDefaultLocale()))
      );
    };
  }, [workspaceId]);

  useEffect(() => {
    void refreshGarageSuggestions();
  }, [refreshGarageSuggestions]);

  useRealtimeTable({
    table: 'reminders',
    filter: `workspace_id=eq.${workspaceId}`,
    // Les suggestions sont un agrégat de toute la table : un changement, quel
    // qu'il soit, se répercute par un rechargement — la reconnexion aussi.
    onChange: () => void refreshGarageSuggestions(),
    onResync: () => void refreshGarageSuggestions(),
  });

  useCandidatesQuickAdd();

  const { duplicateOne, importCsv } = useCandidateMutations({
    workspaceId,
    canWrite,
    load,
    reportException,
  });

  const { form, setForm, addCandidate } = useAddCandidateForm({
    workspaceId,
    canWrite,
    load,
    reportException,
    reportMessage,
  });

  const toggleDetail = (id: string) => {
    setOpen(o => (o === id ? null : id));
  };

  const dismissDeleteConfirm = useCallback(() => {
    setConfirmingDelete(null);
  }, []);

  const subtreeDeleteIds = useMemo(() => {
    if (!confirmingDelete) return [];
    return postOrderDeleteIds(confirmingDelete, candidates);
  }, [confirmingDelete, candidates]);

  /** Le sursis expire (ou on le force) : les lignes partent pour de bon. */
  const commitDelete = useCallback(
    async (pending: PendingDelete) => {
      try {
        await deleteCandidateRows(pending.workspaceId, pending.ids);
        await logActivity(
          pending.workspaceId,
          'candidate.delete',
          'candidate',
          pending.rootId,
          { subtree_count: pending.ids.length }
        );
      } catch (e: unknown) {
        // Échec : les fiches sont toujours en base, elles doivent revenir à
        // l'écran. Sans ce démasquage, elles resteraient invisibles jusqu'au
        // prochain rechargement — un mensonge de plus qu'une erreur.
        reportException(e, t('candidates.tab.ctxDelete'));
      } finally {
        await load();
        setHiddenIds(prev => prev.filter(id => !pending.ids.includes(id)));
      }
    },
    // `t` suit la locale mais son identité change à chaque rendu du
    // fournisseur : l'inclure recréerait la fonction sans rien y gagner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [load, reportException]
  );

  /** Une seule suppression en sursis à la fois : la précédente est jouée. */
  const flushPending = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingRef.current = null;
    void commitDelete(pending);
  }, [commitDelete]);

  const undoPending = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingRef.current = null;
    setHiddenIds(prev => prev.filter(id => !pending.ids.includes(id)));
    showToast(t('candidates.tab.toastDeleteUndone'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showToast]);

  const confirmDeleteCandidate = useCallback(() => {
    if (!confirmingDelete || !canWrite) return;
    const root = confirmingDelete;
    const ids = postOrderDeleteIds(root, candidates);

    flushPending();
    setConfirmingDelete(null);
    setOpen(o => (o && ids.includes(o) ? null : o));
    setHiddenIds(prev => [...prev, ...ids]);

    const timer = setTimeout(() => {
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending) void commitDelete(pending);
    }, TOAST_UNDO_MS);
    pendingRef.current = { workspaceId, ids, rootId: root.id, timer };

    showToast(
      ids.length > 1
        ? t('candidates.tab.toastDeletedSubtree', { count: ids.length - 1 })
        : t('candidates.tab.toastDeleted'),
      { action: { label: t('common.undo'), onAction: undoPending } }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    confirmingDelete,
    canWrite,
    candidates,
    workspaceId,
    flushPending,
    commitDelete,
    showToast,
    undoPending,
  ]);

  /**
   * QUITTER L'ONGLET JOUE LA SUPPRESSION. Sans ce démontage, changer d'onglet
   * laisserait une fiche invisible ici et bien vivante pour les autres
   * participants — l'écart le plus perfide dans un dossier partagé. Tout est
   * lu dans la ref : aucune valeur du premier rendu n'est figée dans cette
   * fermeture, et aucun `setState` n'est tenté sur un composant démonté.
   */
  useEffect(() => {
    return () => {
      const pending = pendingRef.current;
      if (!pending) return;
      clearTimeout(pending.timer);
      pendingRef.current = null;
      void deleteCandidateRows(pending.workspaceId, pending.ids)
        .then(() =>
          logActivity(
            pending.workspaceId,
            'candidate.delete',
            'candidate',
            pending.rootId,
            { subtree_count: pending.ids.length }
          )
        )
        .catch(() => {
          /* Plus d'écran pour porter l'erreur ; la fiche reste, c'est le repli sûr. */
        });
    };
  }, []);

  const persistCandidateOrder = useCallback(
    async (orderedIds: string[]) => {
      if (!canWrite) return;
      setReordering(true);
      try {
        const results = await Promise.all(
          orderedIds.map((id, sort_order) =>
            getSupabase()
              .from('candidates')
              .update({ sort_order })
              .eq('id', id)
              .eq('workspace_id', workspaceId)
          )
        );
        const failed = results.find(x => x.error);
        if (failed?.error) throw failed.error;
        await load();
        showToast(t('candidates.tab.toastOrderUpdated'));
      } catch (e: unknown) {
        reportException(e, t('candidates.tab.ctxReorder'));
        await load();
      } finally {
        setReordering(false);
        setDraggingId(null);
        setDragOverId(null);
      }
    },
    [canWrite, workspaceId, load, reportException, showToast]
  );

  const onDropReorder = useCallback(
    (targetId: string, draggedId: string, siblingIds: string[]) => {
      if (!canWrite || reordering || draggedId === targetId) return;
      const dragged = candidates.find(c => c.id === draggedId);
      const target = candidates.find(c => c.id === targetId);
      if (!dragged || !target) return;
      if (dragged.parent_candidate_id !== target.parent_candidate_id) return;
      const ids = [...siblingIds];
      const from = ids.indexOf(draggedId);
      const to = ids.indexOf(targetId);
      if (from === -1 || to === -1) return;
      const next = [...ids];
      next.splice(from, 1);
      next.splice(to, 0, draggedId);
      void persistCandidateOrder(next);
    },
    [canWrite, reordering, candidates, persistCandidateOrder]
  );

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
  );

  const orphanSiblingsSorted = useCallback(
    (c: CandidateRow) =>
      candidates
        .filter(x => x.parent_candidate_id === c.parent_candidate_id)
        .sort((a, b) => {
          if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
          return (a.trim ?? '').localeCompare(b.trim ?? '', getDefaultLocale());
        }),
    [candidates]
  );

  return (
    <div className="stack candidates-tab">
      <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
        {t('candidates.tab.helpRootPrefix')}
        <strong>{t('candidates.tab.helpRootWord')}</strong>
        {t('candidates.tab.helpShows')}{' '}
        <strong>{t('candidates.tab.helpBaseWord')}</strong>
        {t('candidates.tab.helpGenericMid')}
        <strong>{t('candidates.tab.helpComplementWord')}</strong>
        {t('candidates.tab.helpCarries')}
        <strong>{t('candidates.tab.helpMultipleWord')}</strong>
        {t('candidates.tab.helpDetailsSuffix')} {CANDIDATE_HIERARCHY_HELP_FR}
        {canWrite ? (
          <>
            {' '}
            <strong>{t('candidates.tab.helpDragWord')}</strong>
            {t('candidates.tab.helpDragSuffix')}
          </>
        ) : null}
      </p>

      {orphanVariations.length ? (
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          <strong>{t('candidates.tab.warnLabel')}</strong>
          {t('candidates.tab.orphanWarn', { count: orphanVariations.length })}
        </p>
      ) : null}

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

      <ul
        className="stack candidate-tree"
        style={{ listStyle: 'none', padding: 0, margin: 0 }}
      >
        {rootCandidates.map(root => (
          <Fragment key={root.id}>
            <CandidateCard
              candidate={root}
              openId={open}
              onToggleDetail={toggleDetail}
              onDuplicate={duplicateOne}
              onRequestDelete={
                canWrite ? c => setConfirmingDelete(c) : undefined
              }
              deleteGuard={deleteGuard}
              rootCandidatesForParent={rootCandidates.filter(
                x => x.id !== root.id
              )}
              childrenOf={childrenOf}
              workspaceId={workspaceId}
              canWrite={canWrite}
              userId={userId}
              onChanged={load}
              garageSuggestions={garageSuggestions}
              reorder={reorderBundle(rootCandidates.map(r => r.id))}
            />
            {childrenOf(root.id).map(child => (
              <CandidateCard
                key={child.id}
                candidate={child}
                nested
                openId={open}
                onToggleDetail={toggleDetail}
                onDuplicate={duplicateOne}
                onRequestDelete={
                  canWrite ? c => setConfirmingDelete(c) : undefined
                }
                deleteGuard={deleteGuard}
                rootCandidatesForParent={rootCandidates.filter(
                  x => x.id !== child.id
                )}
                childrenOf={childrenOf}
                workspaceId={workspaceId}
                canWrite={canWrite}
                userId={userId}
                onChanged={load}
                garageSuggestions={garageSuggestions}
                reorder={reorderBundle(childrenOf(root.id).map(ch => ch.id))}
              />
            ))}
          </Fragment>
        ))}
        {orphanVariations.map(c => (
          <Fragment key={`orphan-${c.id}`}>
            <CandidateCard
              candidate={c}
              hierarchyDetached
              openId={open}
              onToggleDetail={toggleDetail}
              onDuplicate={duplicateOne}
              onRequestDelete={
                canWrite ? row => setConfirmingDelete(row) : undefined
              }
              deleteGuard={deleteGuard}
              rootCandidatesForParent={rootCandidates.filter(
                x => x.id !== c.id
              )}
              childrenOf={childrenOf}
              workspaceId={workspaceId}
              canWrite={canWrite}
              userId={userId}
              onChanged={load}
              garageSuggestions={garageSuggestions}
              reorder={reorderBundle(orphanSiblingsSorted(c).map(x => x.id))}
            />
          </Fragment>
        ))}
      </ul>

      <p className="muted">
        {t('candidates.tab.reviewsNote', { count: reviews.length })}
      </p>

      {/* Suppression d'une fiche : confirmation à DEUX actions, et destructive
          — la fiche part, son sous-arbre avec elle. La boîte ne fait plus
          d'aller-retour réseau, donc plus d'état `loading` : elle se ferme
          aussitôt et laisse la main au sursis de huit secondes. Échap, le clic
          sur le fond, le focus initial sur « Annuler » (le choix sûr, que la
          copie locale posait à la main), le piège de focus et la restitution du
          focus viennent du socle. */}
      <ConfirmDialog
        open={!!confirmingDelete}
        title={t('candidates.tab.confirmDeleteTitle')}
        destructive
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={deleteGuard.wrap(() => confirmDeleteCandidate())}
        onCancel={dismissDeleteConfirm}
      >
        {confirmingDelete ? (
          <>
            {/* Le réseau peut tomber PENDANT que la boîte est ouverte : le
                motif s'affiche alors ici, et `wrap` rend « Supprimer » inerte
                — la boîte ne se referme pas sur une erreur inutile. */}
            {deleteGuard.reason ? (
              <p role="status" className="muted" style={{ margin: 0 }}>
                {deleteGuard.reason}
              </p>
            ) : null}
            <p style={{ margin: 0 }}>
              {t('candidates.tab.confirmDeletePrefix')}{' '}
              <strong>{formatCandidateListLabel(confirmingDelete)}</strong>
              {t('candidates.tab.confirmDeleteSuffix')}
            </p>
            {subtreeDeleteIds.length > 1 ? (
              <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                {t('candidates.tab.subtreeDeleteNote', {
                  count: subtreeDeleteIds.length,
                })}
              </p>
            ) : null}
          </>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
