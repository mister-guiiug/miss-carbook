import { useCallback, useRef, useState } from 'react';
import { ConfirmDialog } from '@mister-guiiug/dev-pwa-config/react/confirm-dialog';
import { useActionGuard } from '@mister-guiiug/dev-pwa-config/react/use-action-guard';
import { useErrorDialog } from '../../contexts/ErrorDialogContext';
import { useToast } from '../../contexts/ToastContext';
import { useI18n } from '../../i18n';
import { logActivity } from '../../lib/activity';
import { getSupabase } from '../../lib/supabase';
import {
  planWorkspaceImport,
  readWorkspaceImportBundle,
  type WorkspaceImportBundle,
  type WorkspaceImportRead,
  type ZipTextEntries,
} from '../../lib/workspaceImportBundle';
import { IconArchiveUp } from '../ui/IconActionButton';

/**
 * Réimport d'un bundle ZIP produit par `ExportWorkspaceButton`.
 *
 * TROIS PROMESSES, dans cet ordre.
 * 1. Un ZIP qui n'est pas un export Miss Carbook est refusé AVANT toute
 *    écriture (`readWorkspaceImportBundle` rend un refus, pas une exception).
 * 2. L'import n'efface rien : il ajoute. Le bloc-notes du dossier n'est rempli
 *    que s'il est vide.
 * 3. Si le dossier cible contient déjà des exigences ou des modèles, on le dit
 *    et on demande confirmation — sinon on aurait mélangé deux dossiers sans
 *    prévenir.
 *
 * JSZip est chargé PARESSEUSEMENT, comme à l'export : le budget de poids de
 * cette app est serré (505 ko gzip), et une bibliothèque d'archive n'a rien à
 * faire dans le premier chargement.
 */
export function ImportWorkspaceButton({
  workspaceId,
  canWrite,
  onImported,
}: {
  workspaceId: string;
  canWrite: boolean;
  onImported?: () => void;
}) {
  const { t } = useI18n();
  const { reportException, reportMessage } = useErrorDialog();
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{
    bundle: WorkspaceImportBundle;
    existingRows: number;
  } | null>(null);

  // Une insertion hors ligne échoue à mi-parcours : mieux vaut le dire avant
  // d'ouvrir un fichier que de laisser un dossier à moitié restauré.
  const guard = useActionGuard({ online: true });

  const explainRejection = useCallback(
    (read: Extract<WorkspaceImportRead, { ok: false }>) => {
      switch (read.reason) {
        case 'not-a-carbook-export':
          reportMessage(
            t('settings.import.errNotCarbook'),
            t('settings.import.errNotCarbookDetail')
          );
          return;
        case 'unsupported-version':
          reportMessage(
            t('settings.import.errVersion', { found: read.found || '?' }),
            t('settings.import.errVersionDetail')
          );
          return;
        case 'missing-entry':
          reportMessage(
            t('settings.import.errMissing', { entry: read.entry }),
            t('settings.import.errMissingDetail')
          );
          return;
        case 'invalid-json':
          reportMessage(
            t('settings.import.errJson', { entry: read.entry }),
            t('settings.import.errJsonDetail')
          );
          return;
        default:
          reportMessage(
            t('settings.import.errShape', { entry: read.entry }),
            read.detail
          );
      }
    },
    [reportMessage, t]
  );

  const pickFile = useCallback(
    async (file: File | null) => {
      if (!file || !canWrite) return;
      setBusy(true);
      try {
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(file);

        // Seules les entrées TEXTE nous intéressent ; un ZIP quelconque plein
        // d'images est lu sans être décompressé pour rien.
        const entries: ZipTextEntries = {};
        const wanted = /(^|\/)(meta\.txt|[a-z_]+\.json)$/;
        await Promise.all(
          Object.values(zip.files)
            .filter(f => !f.dir && wanted.test(f.name))
            .map(async f => {
              entries[f.name] = await f.async('string');
            })
        );

        const read = readWorkspaceImportBundle(entries);
        if (!read.ok) {
          explainRejection(read);
          return;
        }

        // Le dossier cible est-il vide ? On compte AVANT de proposer quoi que
        // ce soit : la confirmation dépend de cette réponse.
        const [req, cand] = await Promise.all([
          getSupabase()
            .from('requirements')
            .select('id', { count: 'exact', head: true })
            .eq('workspace_id', workspaceId),
          getSupabase()
            .from('candidates')
            .select('id', { count: 'exact', head: true })
            .eq('workspace_id', workspaceId),
        ]);
        if (req.error) throw req.error;
        if (cand.error) throw cand.error;

        setPending({
          bundle: read.bundle,
          existingRows: (req.count ?? 0) + (cand.count ?? 0),
        });
      } catch (e: unknown) {
        reportException(e, t('settings.import.ctxRead'));
      } finally {
        setBusy(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [canWrite, workspaceId, explainRejection, reportException, t]
  );

  const runImport = useCallback(async () => {
    if (!pending || !canWrite || busy) return;
    setBusy(true);
    try {
      const { data: noteRow } = await getSupabase()
        .from('notes')
        .select('body')
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      const plan = planWorkspaceImport(pending.bundle, {
        workspaceId,
        newId: () => crypto.randomUUID(),
        targetNotesBody: noteRow?.body ?? '',
      });

      if (plan.requirements.length) {
        const { error } = await getSupabase()
          .from('requirements')
          .insert(plan.requirements);
        if (error) throw error;
      }
      if (plan.candidates.length) {
        // Racines d'abord (le plan les a triées) : un complément ne peut pas
        // référencer une ligne qui n'existe pas encore.
        const { error } = await getSupabase()
          .from('candidates')
          .insert(plan.candidates);
        if (error) throw error;
      }
      if (plan.candidateSpecs.length) {
        const { error } = await getSupabase()
          .from('candidate_specs')
          .insert(plan.candidateSpecs);
        if (error) throw error;
      }
      if (plan.notesBody != null) {
        const { error } = await getSupabase()
          .from('notes')
          .update({ body: plan.notesBody })
          .eq('workspace_id', workspaceId);
        if (error) throw error;
      }

      await logActivity(workspaceId, 'workspace.import', 'workspace', null, {
        requirements: plan.requirements.length,
        candidates: plan.candidates.length,
      });

      showToast(
        t('settings.import.toastDone', {
          requirements: plan.requirements.length,
          candidates: plan.candidates.length,
        })
      );
      setPending(null);
      onImported?.();
    } catch (e: unknown) {
      reportException(e, t('settings.import.ctxWrite'));
    } finally {
      setBusy(false);
    }
  }, [
    pending,
    canWrite,
    busy,
    workspaceId,
    showToast,
    reportException,
    onImported,
    t,
  ]);

  if (!canWrite) return null;

  return (
    <div className="stack">
      {/* Champ de fichier VISIBLE et étiqueté, comme l'import CSV des modèles :
          un bouton qui déclenche un `input` caché perd son étiquette pour les
          lecteurs d'écran, et l'app a déjà ce motif ailleurs. */}
      <label htmlFor="workspace-import-zip" className="row" style={{ gap: 8 }}>
        <IconArchiveUp />
        <span>
          {busy ? t('settings.import.busy') : t('settings.import.label')}
        </span>
      </label>
      <input
        id="workspace-import-zip"
        ref={inputRef}
        type="file"
        accept=".zip,application/zip"
        disabled={busy || !!guard.reason}
        onChange={e => void pickFile(e.target.files?.[0] ?? null)}
      />
      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
        {t('settings.import.desc')}
      </p>
      {guard.reason ? (
        <p role="status" className="muted" style={{ margin: 0 }}>
          {guard.reason}
        </p>
      ) : null}

      <ConfirmDialog
        open={!!pending}
        title={t('settings.import.confirmTitle')}
        loading={busy}
        confirmLabel={
          busy ? t('settings.import.busy') : t('settings.import.confirmLabel')
        }
        cancelLabel={t('common.cancel')}
        onConfirm={guard.wrap(() => void runImport())}
        onCancel={() => {
          if (!busy) setPending(null);
        }}
      >
        {pending ? (
          <>
            <p style={{ margin: 0 }}>
              {t('settings.import.confirmCounts', {
                requirements: pending.bundle.requirements.length,
                candidates: pending.bundle.candidates.length,
              })}
            </p>
            {pending.existingRows > 0 ? (
              <p style={{ margin: 0 }}>
                <strong>{t('settings.import.confirmNotEmpty')}</strong>{' '}
                {t('settings.import.confirmNotEmptyDetail', {
                  count: pending.existingRows,
                })}
              </p>
            ) : null}
            <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
              {pending.bundle.attachmentCount > 0
                ? t('settings.import.confirmPhotos', {
                    count: pending.bundle.attachmentCount,
                  })
                : t('settings.import.confirmScope')}
            </p>
          </>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
