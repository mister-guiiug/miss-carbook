import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useErrorDialog } from '../../contexts/ErrorDialogContext'
import type { TabId } from './workspaceTabs'

/** Synthèse rapide : décision, rappels ouverts, liens vers les sections utiles. */
export function WorkspaceDecisionSummaryCard({
  workspaceId,
  hasRecordedDecision,
  setTab,
}: {
  workspaceId: string
  hasRecordedDecision: boolean
  setTab: (id: TabId) => void
}) {
  const { reportException } = useErrorDialog()
  const [pendingReminders, setPendingReminders] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { count, error } = await supabase
        .from('reminders')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('done', false)
      if (cancelled) return
      if (error) {
        reportException(error, 'Synthèse dossier (rappels)')
        setPendingReminders(null)
        return
      }
      setPendingReminders(count ?? 0)
    })()
    return () => {
      cancelled = true
    }
  }, [workspaceId, reportException])

  return (
    <div className="card workspace-summary-card stack" style={{ boxShadow: 'none' }}>
      <h2 className="workspace-summary-title">Vue d’ensemble</h2>
      <ul className="workspace-summary-list">
        <li>
          <strong>Décision</strong> :{' '}
          {hasRecordedDecision ? (
            <span className="muted">enregistrée — détail dans la bannière ci-dessus.</span>
          ) : (
            <>
              <span className="muted">pas encore arrêtée.</span>{' '}
              <button type="button" className="link-like" onClick={() => setTab('settings')}>
                Enregistrer dans Réglages
              </button>
            </>
          )}
        </li>
        <li>
          <strong>Rappels ouverts</strong> :{' '}
          {pendingReminders === null ? (
            <span className="muted">…</span>
          ) : (
            <>
              {pendingReminders}{' '}
              {pendingReminders > 0 ? (
                <button type="button" className="link-like" onClick={() => setTab('reminders')}>
                  Voir
                </button>
              ) : (
                <span className="muted">aucun</span>
              )}
            </>
          )}
        </li>
        <li>
          <strong>Matrice</strong> :{' '}
          <button type="button" className="link-like" onClick={() => setTab('evaluations')}>
            Évaluations exigence × modèle
          </button>
        </li>
      </ul>
    </div>
  )
}
