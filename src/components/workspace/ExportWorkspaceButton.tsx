import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useErrorDialog } from '../../contexts/ErrorDialogContext'

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

      const [ws, req, cand, notes, act] = await Promise.all([
        supabase.from('workspaces').select('*').eq('id', workspaceId).single(),
        supabase.from('requirements').select('*').eq('workspace_id', workspaceId),
        supabase.from('candidates').select('*, candidate_specs ( specs )').eq('workspace_id', workspaceId),
        supabase.from('notes').select('*').eq('workspace_id', workspaceId).maybeSingle(),
        supabase.from('activity_log').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(500),
      ])

      folder.file('workspace.json', JSON.stringify(ws.data ?? {}, null, 2))
      folder.file('requirements.json', JSON.stringify(req.data ?? [], null, 2))
      folder.file('candidates.json', JSON.stringify(cand.data ?? [], null, 2))
      folder.file('notes.json', JSON.stringify(notes.data ?? {}, null, 2))
      folder.file('activity_log.json', JSON.stringify(act.data ?? [], null, 2))
      folder.file('meta.txt', `Export Miss Carbook\nworkspace_id=${workspaceId}\n`)

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
      <button type="button" className="secondary" disabled={busy} onClick={() => void run()}>
        {busy ? 'Export…' : 'Exporter le dossier (ZIP JSON)'}
      </button>
      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
        Archive locale : résumé workspace, exigences, modèles, notes, journal récent. Pas de photos
        binaires.
      </p>
    </div>
  )
}
