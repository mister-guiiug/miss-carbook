import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useErrorDialog } from '../../contexts/ErrorDialogContext'
import { IconActionButton, IconArchiveDown } from '../ui/IconActionButton'

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

      const [ws, req, cand, notes, act, reminders, invites, members, presets, currVehicle] =
        await Promise.all([
          supabase.from('workspaces').select('*').eq('id', workspaceId).single(),
          supabase.from('requirements').select('*').eq('workspace_id', workspaceId),
          supabase
            .from('candidates')
            .select('*, candidate_specs ( specs )')
            .eq('workspace_id', workspaceId),
          supabase.from('notes').select('*').eq('workspace_id', workspaceId).maybeSingle(),
          supabase
            .from('activity_log')
            .select('*')
            .eq('workspace_id', workspaceId)
            .order('created_at', { ascending: false })
            .limit(500),
          supabase.from('reminders').select('*').eq('workspace_id', workspaceId),
          supabase.from('workspace_invites').select('*').eq('workspace_id', workspaceId),
          supabase.from('workspace_members').select('*').eq('workspace_id', workspaceId),
          supabase.from('comparison_presets').select('*').eq('workspace_id', workspaceId),
          supabase
            .from('current_vehicle')
            .select('*')
            .eq('workspace_id', workspaceId)
            .maybeSingle(),
        ])

      const requirementIds = (req.data ?? []).map((r: { id: string }) => r.id)
      const candidateIds = (cand.data ?? []).map((c: { id: string }) => c.id)

      const empty = { data: [] as unknown[], error: null as null }

      const [evals, votes, comments, reviews, attachments] = await Promise.all([
        requirementIds.length
          ? supabase
              .from('requirement_candidate_evaluations')
              .select('*')
              .in('requirement_id', requirementIds)
          : Promise.resolve(empty),
        requirementIds.length
          ? supabase
              .from('requirement_priority_votes')
              .select('*')
              .in('requirement_id', requirementIds)
          : Promise.resolve(empty),
        candidateIds.length
          ? supabase.from('comments').select('*').in('candidate_id', candidateIds)
          : Promise.resolve(empty),
        candidateIds.length
          ? supabase.from('candidate_reviews').select('*').in('candidate_id', candidateIds)
          : Promise.resolve(empty),
        supabase.from('attachments').select('*').eq('workspace_id', workspaceId),
      ])

      folder.file('workspace.json', JSON.stringify(ws.data ?? {}, null, 2))
      folder.file('requirements.json', JSON.stringify(req.data ?? [], null, 2))
      folder.file('candidates.json', JSON.stringify(cand.data ?? [], null, 2))
      folder.file('notes.json', JSON.stringify(notes.data ?? {}, null, 2))
      folder.file('activity_log.json', JSON.stringify(act.data ?? [], null, 2))
      folder.file('reminders.json', JSON.stringify(reminders.data ?? [], null, 2))
      folder.file('workspace_invites.json', JSON.stringify(invites.data ?? [], null, 2))
      folder.file('workspace_members.json', JSON.stringify(members.data ?? [], null, 2))
      folder.file('comparison_presets.json', JSON.stringify(presets.data ?? [], null, 2))
      folder.file('current_vehicle.json', JSON.stringify(currVehicle.data ?? {}, null, 2))
      folder.file(
        'requirement_candidate_evaluations.json',
        JSON.stringify(evals.data ?? [], null, 2)
      )
      folder.file('requirement_priority_votes.json', JSON.stringify(votes.data ?? [], null, 2))
      folder.file('comments.json', JSON.stringify(comments.data ?? [], null, 2))
      folder.file('candidate_reviews.json', JSON.stringify(reviews.data ?? [], null, 2))
      folder.file('attachments.json', JSON.stringify(attachments.data ?? [], null, 2))

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
