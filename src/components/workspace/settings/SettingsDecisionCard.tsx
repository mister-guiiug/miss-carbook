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
      <p className="muted settings-card-lead" style={{ margin: 0 }}>
        Modèle retenu (bannière sous l’en-tête).
      </p>
      {canWrite ? (
        <form onSubmit={onSave} className="stack">
          <div>
            <label htmlFor="ws-settings-decision-cand">Modèle retenu</label>
            <select
              id="ws-settings-decision-cand"
              value={decisionCand}
              onChange={(e) => setDecisionCand(e.target.value)}
            >
              <option value="">— Aucun —</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {formatCandidateListLabel(c)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ws-settings-decision-notes">Notes / motif</label>
            <textarea
              id="ws-settings-decision-notes"
              value={decisionNotes}
              onChange={(e) => setDecisionNotes(e.target.value)}
              rows={3}
            />
          </div>
          <button type="submit">Enregistrer</button>
        </form>
      ) : (
        <p className="muted">Lecture seule.</p>
      )}
    </div>
  )
}
