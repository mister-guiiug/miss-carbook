import { useState } from 'react'
import { useErrorDialog } from '../../contexts/ErrorDialogContext'
import { useToast } from '../../contexts/ToastContext'
import { fetchWorkspaceExportBundle } from '../../lib/workspaceExportBundle'
import { buildWorkspacePromptMarkdown } from '../../lib/buildWorkspacePromptMarkdown'
import { IconActionButton, IconPromptFile } from '../ui/IconActionButton'

export function ExportWorkspacePromptButton({ workspaceId }: { workspaceId: string }) {
  const { reportException } = useErrorDialog()
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    try {
      const bundle = await fetchWorkspaceExportBundle(workspaceId)
      const md = buildWorkspacePromptMarkdown(bundle)
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `miss-carbook-contexte-ia-${workspaceId.slice(0, 8)}.md`
      a.click()
      URL.revokeObjectURL(url)
      showToast('Export Markdown téléchargé — prêt à coller dans une IA')
    } catch (e: unknown) {
      reportException(e, 'Export contexte IA (Markdown)')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <IconActionButton
        variant="secondary"
        label={
          busy
            ? 'Préparation du fichier pour l’IA…'
            : 'Exporter le contexte pour une IA (Markdown)'
        }
        disabled={busy}
        onClick={() => void run()}
      >
        <IconPromptFile />
      </IconActionButton>
      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
        Un seul fichier <strong>.md</strong> : exigences, modèles, matrice, votes, avis, commentaires,
        bloc-notes, rappels, journal (extrait), sans jetons d’invitation ni code de partage. Vérifiez
        ce que vous collez dans des services tiers.
      </p>
    </div>
  )
}
