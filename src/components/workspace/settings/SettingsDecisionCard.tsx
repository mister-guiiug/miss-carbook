import { formatCandidateListLabel } from '../../../lib/candidateLabel';
import type { CandidateOption } from './settingsTypes';
import { useI18n } from '../../../i18n';

export function SettingsDecisionCard({
  canWrite,
  candidates,
  decisionCand,
  setDecisionCand,
  decisionNotes,
  setDecisionNotes,
  onSave,
}: {
  canWrite: boolean;
  candidates: CandidateOption[];
  decisionCand: string;
  setDecisionCand: (v: string) => void;
  decisionNotes: string;
  setDecisionNotes: (v: string) => void;
  onSave: (e: React.FormEvent) => void;
}) {
  const { t } = useI18n();
  return (
    <div
      id="workspace-settings-decision"
      className="card stack"
      style={{ boxShadow: 'none' }}
    >
      <h3 style={{ margin: 0 }}>{t('settings.decision.title')}</h3>
      <p className="muted settings-card-lead" style={{ margin: 0 }}>
        {t('settings.decision.lead')}
      </p>
      {canWrite ? (
        <form onSubmit={onSave} className="stack">
          <div>
            <label htmlFor="ws-settings-decision-cand">
              {t('settings.decision.selectLabel')}
            </label>
            <select
              id="ws-settings-decision-cand"
              value={decisionCand}
              onChange={e => setDecisionCand(e.target.value)}
            >
              <option value="">{t('settings.decision.optionNone')}</option>
              {candidates.map(c => (
                <option key={c.id} value={c.id}>
                  {formatCandidateListLabel(c)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ws-settings-decision-notes">
              {t('settings.decision.notesLabel')}
            </label>
            <textarea
              id="ws-settings-decision-notes"
              value={decisionNotes}
              onChange={e => setDecisionNotes(e.target.value)}
              rows={3}
            />
          </div>
          <button type="submit">{t('common.save')}</button>
        </form>
      ) : (
        <p className="muted">{t('settings.decision.readOnly')}</p>
      )}
    </div>
  );
}
