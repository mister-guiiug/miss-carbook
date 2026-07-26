import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatCandidateListLabel } from '../../lib/candidateLabel';
import { supabase } from '../../lib/supabase';
import { useErrorDialog } from '../../contexts/ErrorDialogContext';
import { useToast } from '../../contexts/ToastContext';
import type { CandidateStatus, RequirementLevel } from '../../types/database';
import { EmptyState } from '../ui/EmptyState';
import {
  IconActionButton,
  IconDownload,
  IconFilter,
} from '../ui/IconActionButton';
import { useI18n } from '../../i18n';

type Req = {
  id: string;
  label: string;
  level: RequirementLevel;
  weight: number | null;
  tags: string[];
  description: string;
  sort_order: number;
};

type Cand = {
  id: string;
  brand: string;
  model: string;
  trim: string;
  parent_candidate_id: string | null;
  status: CandidateStatus;
  price: number | null;
};

type EvalRow = {
  requirement_id: string;
  candidate_id: string;
  status: string;
  note: string;
};

const STATUS_VALUES: Record<string, number> = {
  unknown: 0,
  ko: 0,
  partial: 0.5,
  ok: 1,
};

const STATUS_COLORS: Record<string, string> = {
  unknown: 'muted',
  ko: 'danger',
  partial: 'warning',
  ok: 'success',
};

type MatrixView = 'full' | 'compact' | 'scores';

export function RequirementsMatrix({
  workspaceId,
  canWrite,
}: {
  workspaceId: string;
  canWrite: boolean;
}) {
  const { reportException } = useErrorDialog();
  const { showToast } = useToast();
  const { t } = useI18n();
  const statusLabels: Record<string, string> = {
    unknown: t('requirements.statusUnknown'),
    ko: t('requirements.statusKo'),
    partial: t('requirements.statusPartial'),
    ok: t('requirements.statusOk'),
  };
  const [reqs, setReqs] = useState<Req[]>([]);
  const [cands, setCands] = useState<Cand[]>([]);
  const [evals, setEvals] = useState<EvalRow[]>([]);
  const [view, setView] = useState<MatrixView>('full');
  const [showFilters, setShowFilters] = useState(false);

  const [levelFilter, setLevelFilter] = useState<'all' | RequirementLevel>(
    'all'
  );
  const [statusFilter, setStatusFilter] = useState<'all' | CandidateStatus>(
    'all'
  );
  const [hideExcluded, setHideExcluded] = useState(true);
  const [hideToSee, setHideToSee] = useState(false);

  const load = useCallback(async () => {
    const [r, c, e] = await Promise.all([
      supabase
        .from('requirements')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('candidates')
        .select('id, brand, model, trim, parent_candidate_id, status, price')
        .eq('workspace_id', workspaceId)
        .order('parent_candidate_id', { ascending: true, nullsFirst: true })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('requirement_candidate_evaluations')
        .select('requirement_id, candidate_id, status, note'),
    ]);
    const firstErr = r.error ?? c.error ?? e.error;
    if (firstErr) reportException(firstErr, t('requirements.ctxLoadMatrix'));

    setReqs((r.data ?? []) as Req[]);
    setCands((c.data ?? []) as Cand[]);
    setEvals((e.data ?? []) as EvalRow[]);
  }, [workspaceId, reportException, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredReqs = useMemo(() => {
    if (levelFilter === 'all') return reqs;
    return reqs.filter(r => r.level === levelFilter);
  }, [reqs, levelFilter]);

  const filteredCands = useMemo(() => {
    return cands.filter(c => {
      if (hideExcluded && c.status === 'rejected') return false;
      if (hideToSee && c.status === 'to_see') return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      return true;
    });
  }, [cands, hideExcluded, hideToSee, statusFilter]);

  const evalKey = (rid: string, cid: string) => `${rid}:${cid}`;
  const evalMap = useMemo(() => {
    const m = new Map<string, EvalRow>();
    for (const x of evals) m.set(evalKey(x.requirement_id, x.candidate_id), x);
    return m;
  }, [evals]);

  const setStatus = async (
    requirementId: string,
    candidateId: string,
    status: string
  ) => {
    if (!canWrite) return;
    const cur = evalMap.get(evalKey(requirementId, candidateId));
    const { error } = await supabase
      .from('requirement_candidate_evaluations')
      .upsert(
        {
          requirement_id: requirementId,
          candidate_id: candidateId,
          status,
          note: cur?.note ?? '',
        },
        { onConflict: 'requirement_id,candidate_id' }
      );
    if (error) reportException(error, t('requirements.ctxUpdateStatus'));
    else await load();
  };

  const candidateScores = useMemo(() => {
    const scores: Record<
      string,
      {
        total: number;
        weighted: number;
        maxPossible: number;
        details: Array<{
          reqId: string;
          reqLabel: string;
          score: number;
          weight: number;
        }>;
      }
    > = {};

    for (const cand of filteredCands) {
      let total = 0;
      let weighted = 0;
      let maxPossible = 0;
      const details: Array<{
        reqId: string;
        reqLabel: string;
        score: number;
        weight: number;
      }> = [];

      for (const req of filteredReqs) {
        const eval_ = evalMap.get(evalKey(req.id, cand.id));
        const score = eval_ ? (STATUS_VALUES[eval_.status] ?? 0) : 0;
        const weight = req.weight ?? 1;

        total += score;
        weighted += score * weight;
        maxPossible += weight;

        details.push({
          reqId: req.id,
          reqLabel: req.label,
          score,
          weight,
        });
      }

      scores[cand.id] = {
        total,
        weighted: maxPossible > 0 ? (weighted / maxPossible) * 100 : 0,
        maxPossible,
        details,
      };
    }

    return scores;
  }, [filteredCands, filteredReqs, evalMap]);

  const exportCsv = () => {
    const headers = [
      t('requirements.colRequirement'),
      t('requirements.colLevel'),
      t('requirements.colWeight'),
      ...filteredCands.map(c => formatCandidateListLabel(c)),
    ];
    const rows = filteredReqs.map(req => [
      req.label,
      req.level === 'mandatory'
        ? t('requirements.levelMandatory')
        : t('requirements.levelDiscuss'),
      req.weight?.toString() ?? '1',
      ...filteredCands.map(c => {
        const eval_ = evalMap.get(evalKey(req.id, c.id));
        return eval_
          ? statusLabels[eval_.status]
          : t('requirements.statusUnknown');
      }),
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `matrice-exigences-${workspaceId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t('requirements.toastCsvExported'));
  };

  if (!reqs.length || !cands.length) {
    return (
      <EmptyState
        icon="requirements"
        title={t('requirements.matrixEmptyTitle')}
        text={
          !reqs.length && !cands.length
            ? t('requirements.matrixEmptyBoth')
            : !reqs.length
              ? t('requirements.matrixEmptyReqs')
              : t('requirements.matrixEmptyCands')
        }
      />
    );
  }

  return (
    <div className="stack requirements-matrix">
      <div className="card stack" style={{ boxShadow: 'none' }}>
        <div
          className="row"
          style={{
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <h3 style={{ margin: 0 }}>{t('requirements.matrixTitle')}</h3>
          <div className="row icon-action-toolbar">
            <IconActionButton
              variant="secondary"
              label={
                showFilters
                  ? t('requirements.hideFilters')
                  : t('requirements.showFiltersLabel')
              }
              onClick={() => setShowFilters(v => !v)}
            >
              <IconFilter />
            </IconActionButton>
            <IconActionButton
              variant="secondary"
              label={t('requirements.exportCsvLabel')}
              onClick={exportCsv}
            >
              <IconDownload />
            </IconActionButton>
          </div>
        </div>

        <div className="row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <div className="tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'full'}
              className={view === 'full' ? 'active' : ''}
              onClick={() => setView('full')}
            >
              {t('requirements.viewFull')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'compact'}
              className={view === 'compact' ? 'active' : ''}
              onClick={() => setView('compact')}
            >
              {t('requirements.viewCompact')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'scores'}
              className={view === 'scores' ? 'active' : ''}
              onClick={() => setView('scores')}
            >
              {t('requirements.viewScores')}
            </button>
          </div>
        </div>

        {showFilters ? (
          <div
            className="card stack"
            style={{ boxShadow: 'none', padding: '1rem' }}
          >
            <div
              className="row"
              style={{ flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}
            >
              <div style={{ flex: '1 1 200px' }}>
                <label htmlFor="req-level-filter">
                  {t('requirements.filterLevelLabel')}
                </label>
                <select
                  id="req-level-filter"
                  value={levelFilter}
                  onChange={e =>
                    setLevelFilter(e.target.value as 'all' | RequirementLevel)
                  }
                >
                  <option value="all">{t('requirements.filterAll')}</option>
                  <option value="mandatory">
                    {t('requirements.filterMandatory')}
                  </option>
                  <option value="discuss">
                    {t('requirements.filterDiscuss')}
                  </option>
                </select>
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <label htmlFor="cand-status-filter">
                  {t('requirements.filterStatusLabel')}
                </label>
                <select
                  id="cand-status-filter"
                  value={statusFilter}
                  onChange={e =>
                    setStatusFilter(e.target.value as 'all' | CandidateStatus)
                  }
                >
                  <option value="all">{t('requirements.statusAll')}</option>
                  <option value="to_see">
                    {t('requirements.statusToSee')}
                  </option>
                  <option value="tried">{t('requirements.statusTried')}</option>
                  <option value="shortlist">
                    {t('requirements.statusShortlist')}
                  </option>
                  <option value="selected">
                    {t('requirements.statusSelected')}
                  </option>
                  <option value="rejected">
                    {t('requirements.statusRejected')}
                  </option>
                </select>
              </div>
            </div>
            <div className="row" style={{ flexWrap: 'wrap', gap: '1rem' }}>
              <label
                className="row"
                style={{ gap: '0.35rem', alignItems: 'center' }}
              >
                <input
                  type="checkbox"
                  checked={hideExcluded}
                  onChange={e => setHideExcluded(e.target.checked)}
                />
                {t('requirements.hideExcluded')}
              </label>
              <label
                className="row"
                style={{ gap: '0.35rem', alignItems: 'center' }}
              >
                <input
                  type="checkbox"
                  checked={hideToSee}
                  onChange={e => setHideToSee(e.target.checked)}
                />
                {t('requirements.hideToSee')}
              </label>
            </div>
            <p
              className="muted"
              style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}
            >
              {t('requirements.filterCounts', {
                shownReqs: filteredReqs.length,
                totalReqs: reqs.length,
                shownCands: filteredCands.length,
                totalCands: cands.length,
              })}
            </p>
          </div>
        ) : null}
      </div>

      {view === 'scores' ? (
        <div className="card stack" style={{ boxShadow: 'none' }}>
          <h4 style={{ margin: 0 }}>{t('requirements.scoresTitle')}</h4>
          <p
            className="muted"
            style={{ margin: '0.25rem 0 1rem', fontSize: '0.9rem' }}
          >
            {t('requirements.scoresHint')}
          </p>
          {filteredCands.length === 0 ? (
            <p className="muted">{t('requirements.scoresNoModels')}</p>
          ) : (
            <div className="stack" style={{ gap: '0.75rem' }}>
              {filteredCands
                .flatMap(c => {
                  const score = candidateScores[c.id];
                  return score ? [{ cand: c, score }] : [];
                })
                .sort((a, b) => b.score.weighted - a.score.weighted)
                .map(({ cand, score }) => (
                  <div
                    key={cand.id}
                    className="card"
                    style={{ boxShadow: 'none' }}
                  >
                    <div
                      className="row"
                      style={{
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <strong>{formatCandidateListLabel(cand)}</strong>
                        {cand.price != null ? (
                          <span
                            className="muted"
                            style={{ marginLeft: '0.5rem' }}
                          >
                            {new Intl.NumberFormat('fr-FR', {
                              style: 'currency',
                              currency: 'EUR',
                            }).format(cand.price)}
                          </span>
                        ) : null}
                      </div>
                      <div
                        className="row"
                        style={{ gap: '1rem', alignItems: 'center' }}
                      >
                        <span className="muted" style={{ fontSize: '0.85rem' }}>
                          {t('requirements.satisfiedCount', {
                            ok: score.details.filter(d => d.score > 0).length,
                            total: score.details.length,
                          })}
                        </span>
                        <span
                          className="badge success"
                          style={{
                            fontSize: '1.1rem',
                            padding: '0.35rem 0.75rem',
                          }}
                        >
                          {score.weighted.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div style={{ marginTop: '0.75rem' }}>
                      <div
                        style={{
                          height: '8px',
                          background: 'var(--bg-secondary)',
                          borderRadius: '4px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${score.weighted}%`,
                            background: `hsl(${(score.weighted / 100) * 120}, 70%, 45%)`,
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      ) : (
        <div className="table-wrap requirements-matrix-table-wrap">
          <table
            className={`requirements-matrix-table requirements-matrix-table--${view}`}
          >
            <thead>
              <tr>
                <th>{t('requirements.colRequirement')}</th>
                {view === 'full' && <th>{t('requirements.colLevel')}</th>}
                {view === 'full' && <th>{t('requirements.colWeight')}</th>}
                {filteredCands.map(c => (
                  <th key={c.id}>{formatCandidateListLabel(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredReqs.map(req => (
                <tr key={req.id}>
                  <td>
                    <span className={`badge ${req.level}`}>
                      {req.level === 'mandatory'
                        ? t('requirements.levelMandatoryShort')
                        : t('requirements.levelDiscussShort')}
                    </span>{' '}
                    <strong>{req.label}</strong>
                    {req.tags?.length ? (
                      <div
                        className="muted"
                        style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}
                      >
                        {req.tags.join(', ')}
                      </div>
                    ) : null}
                  </td>
                  {view === 'full' && (
                    <td>
                      <span className={`badge ${req.level}`}>
                        {req.level === 'mandatory'
                          ? t('requirements.levelMandatory')
                          : t('requirements.levelDiscuss')}
                      </span>
                    </td>
                  )}
                  {view === 'full' && (
                    <td className="muted">{req.weight?.toString() ?? '1'}</td>
                  )}
                  {filteredCands.map(c => {
                    const cell = evalMap.get(evalKey(req.id, c.id));
                    const status = cell?.status ?? 'unknown';
                    return (
                      <td key={c.id}>
                        {canWrite ? (
                          <select
                            value={status}
                            onChange={e =>
                              void setStatus(req.id, c.id, e.target.value)
                            }
                            className={`status-select status-select--${STATUS_COLORS[status]}`}
                          >
                            <option value="unknown">
                              {t('requirements.statusUnknown')}
                            </option>
                            <option value="ok">
                              {t('requirements.statusOk')}
                            </option>
                            <option value="partial">
                              {t('requirements.statusPartial')}
                            </option>
                            <option value="ko">
                              {t('requirements.statusKo')}
                            </option>
                          </select>
                        ) : (
                          <span className={`badge ${STATUS_COLORS[status]}`}>
                            {statusLabels[status]}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
