import { useState } from 'react'
import { useErrorDialog } from '../../contexts/ErrorDialogContext'
import { IconActionButton, IconArchiveDown } from '../ui/IconActionButton'
import { fetchWorkspaceExportBundle } from '../../lib/workspaceExportBundle'

const EXPORT_VERSION = '2'

export function ExportWorkspaceButton({ workspaceId }: { workspaceId: string }) {
  const { reportException } = useErrorDialog()
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      const folder = zip.folder(`miss-carbook-${workspaceId.slice(0, 8)}`)
      if (!folder) throw new Error('zip')

      const b = await fetchWorkspaceExportBundle(workspaceId)

      folder.file('workspace.json', JSON.stringify(b.workspace ?? {}, null, 2))
      folder.file('requirements.json', JSON.stringify(b.requirements, null, 2))
      folder.file('candidates.json', JSON.stringify(b.candidates, null, 2))
      folder.file('notes.json', JSON.stringify(b.notes ?? {}, null, 2))
      folder.file('activity_log.json', JSON.stringify(b.activityLog, null, 2))
      folder.file('reminders.json', JSON.stringify(b.reminders, null, 2))
      folder.file('workspace_invites.json', JSON.stringify(b.invites, null, 2))
      folder.file('workspace_members.json', JSON.stringify(b.members, null, 2))
      folder.file('comparison_presets.json', JSON.stringify(b.presets, null, 2))
      folder.file('current_vehicle.json', JSON.stringify(b.currentVehicle ?? {}, null, 2))
      folder.file(
        'requirement_candidate_evaluations.json',
        JSON.stringify(b.evaluations, null, 2)
      )
      folder.file('requirement_priority_votes.json', JSON.stringify(b.votes, null, 2))
      folder.file('comments.json', JSON.stringify(b.comments, null, 2))
      folder.file('candidate_reviews.json', JSON.stringify(b.reviews, null, 2))
      folder.file('attachments.json', JSON.stringify(b.attachments, null, 2))

      const generatedAt = new Date().toISOString()
      folder.file(
        'meta.txt',
        [
          'Export Miss Carbook',
          `export_version=${EXPORT_VERSION}`,
          `generated_at=${generatedAt}`,
          `workspace_id=${workspaceId}`,
          '',
          'Contenu : workspace, exigences, modèles (+ specs), notes, journal, rappels, invitations,',
          'membres, presets de comparaison, véhicule actuel, évaluations matrice, votes MoSCoW,',
          'commentaires, avis modèles, pièces jointes (métadonnées uniquement, pas de fichiers binaires).',
        ].join('\n')
      )

      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `miss-carbook-export-${workspaceId.slice(0, 8)}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      reportException(e, 'Export ZIP du dossier')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <IconActionButton
        variant="secondary"
        label={busy ? 'Export du dossier en cours…' : 'Exporter le dossier (archive ZIP JSON)'}
        disabled={busy}
        onClick={() => void run()}
      >
        <IconArchiveDown />
      </IconActionButton>
      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
        Archive locale : données du dossier (exigences, modèles, matrice, votes, rappels,
        invitations, membres, presets, véhicule actuel, commentaires, avis, métadonnées des pièces
        jointes). Pas de photos binaires.
      </p>
    </div>
  )
}
