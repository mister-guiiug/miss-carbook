import { useState } from 'react';
import { useErrorDialog } from '../../contexts/ErrorDialogContext';
import { useToast } from '../../contexts/ToastContext';
import { fetchWorkspaceExportBundle } from '../../lib/workspaceExportBundle';
import { buildWorkspacePromptMarkdown } from '../../lib/buildWorkspacePromptMarkdown';
import { IconActionButton, IconPromptFile } from '../ui/IconActionButton';
import { useI18n } from '../../i18n';

export function ExportWorkspacePromptButton({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const { reportException } = useErrorDialog();
  const { showToast } = useToast();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const bundle = await fetchWorkspaceExportBundle(workspaceId);
      const md = buildWorkspacePromptMarkdown(bundle);
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `miss-carbook-contexte-ia-${workspaceId.slice(0, 8)}.md`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(t('workspace.toastMarkdownExported'));
    } catch (e: unknown) {
      reportException(e, t('workspace.ctxExportPrompt'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <IconActionButton
        variant="secondary"
        label={
          busy
            ? t('workspace.exportPromptBusy')
            : t('workspace.exportPromptLabel')
        }
        disabled={busy}
        onClick={() => void run()}
      >
        <IconPromptFile />
      </IconActionButton>
      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
        {t('workspace.exportPromptDescA')}
        <strong>.md</strong>
        {t('workspace.exportPromptDescB')}
      </p>
    </div>
  );
}
