import { formatCandidateListLabel } from '../../../lib/candidateLabel'
import type { CandidateOption } from './settingsTypes'

export function SettingsDecisionCard({
  canWrite,
  candidates,
  decisionCand,
  setDecisionCand,
  decisionNotes,
  setDecisionNotes,
  onSave,
}: {
  canWrite: boolean
  candidates: CandidateOption[]
  decisionCand: string
  setDecisionCand: (v: string) => void
  decisionNotes: string
  setDecisionNotes: (v: string) => void
  onSave: (e: React.FormEvent) => void
}) {
  return (
    <div id="workspace-settings-decision" className="card stack" style={{ boxShadow: 'none' }}>
      <h3 style={{ margin: 0 }}>Décision</h3>
      <p className="muted">Modèle retenu (visible en bannière dans l’en-tête du dossier).</p>
      {canWrite ? (
        <form onSubmit={onSave} className="stack">
          <label>Modèle retenu</label>
          <select value={decisionCand} onChange={(e) => setDecisionCand(e.target.value)}>
            <option value="">— Aucun —</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {formatCandidateListLabel(c)}
              </option>
            ))}
          </select>
          <label>Notes / motif</label>
          <textarea value={decisionNotes} onChange={(e) => setDecisionNotes(e.target.value)} />
          <button type="submit">Enregistrer la décision</button>
        </form>
      ) : (
        <p className="muted">Lecture seule.</p>
      )}
    </div>
  )
}
