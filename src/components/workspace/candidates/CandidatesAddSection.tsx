import { useRef } from 'react';
import { useI18n } from '../../../i18n';
import {
  displayVersionLabel,
  formatCandidateListLabel,
} from '../../../lib/candidateLabel';
import { CANDIDATE_HIERARCHY_HELP_FR } from '../../../lib/candidateTree';
import {
  formatPriceInputDisplay,
  parsePriceInput,
} from '../../../lib/formatPrice';
import type { CandidateStatus } from '../../../types/database';
import type { AddCandidateFormState } from './useAddCandidateForm';
import type { CandidateRow } from './candidateTypes';
import { statusLabels } from './candidateTypes';
import { GarageLocationInput } from './GarageLocationInput';
import { ManufacturerLinksEditor } from './ManufacturerLinksEditor';

export function CandidatesAddSection({
  form,
  setForm,
  addCandidate,
  importCsv,
  rootCandidates,
  candidates,
  garageSuggestions,
}: {
  form: AddCandidateFormState;
  setForm: React.Dispatch<React.SetStateAction<AddCandidateFormState>>;
  addCandidate: (e: React.FormEvent) => void;
  importCsv: (file: File | null) => void;
  rootCandidates: CandidateRow[];
  candidates: CandidateRow[];
  garageSuggestions: string[];
}) {
  const { t } = useI18n();
  const isVariation = Boolean(form.parent_id);
  const parent = form.parent_id
    ? (candidates.find(x => x.id === form.parent_id) ?? null)
    : null;
  const rootDraftRef = useRef<{
    brand: string;
    model: string;
    event_date: string;
  } | null>(null);

  return (
    <div className="candidates-panels row">
      <details
        className="card candidates-menu-panel"
        style={{ boxShadow: 'none' }}
      >
        <summary>{t('candidates.add.importCsvSummary')}</summary>
        <div className="stack" style={{ marginTop: '0.75rem' }}>
          <p className="muted" style={{ margin: 0 }}>
            {t('candidates.add.csvHint')}
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={e => void importCsv(e.target.files?.[0] ?? null)}
          />
        </div>
      </details>

      <details
        id="workspace-candidates-add-details"
        className="card candidates-menu-panel"
        style={{ boxShadow: 'none' }}
      >
        <summary>{t('candidates.add.newModelSummary')}</summary>
        <form
          onSubmit={addCandidate}
          className="stack"
          style={{ marginTop: '0.75rem' }}
        >
          <div>
            <label htmlFor="cand-parent">
              {t('candidates.add.parentLabel')}
            </label>
            <select
              id="cand-parent"
              value={form.parent_id}
              onChange={e => {
                const pid = e.target.value;
                setForm(f => {
                  if (!pid) {
                    const draft = rootDraftRef.current;
                    rootDraftRef.current = null;
                    return {
                      ...f,
                      parent_id: '',
                      brand: draft?.brand ?? f.brand,
                      model: draft?.model ?? f.model,
                      event_date: draft?.event_date ?? f.event_date,
                    };
                  }
                  const p = candidates.find(x => x.id === pid);
                  if (!f.parent_id) {
                    rootDraftRef.current = {
                      brand: f.brand,
                      model: f.model,
                      event_date: f.event_date,
                    };
                  }
                  return {
                    ...f,
                    parent_id: pid,
                    brand: p?.brand ?? f.brand,
                    model: p?.model ?? f.model,
                    event_date: p?.event_date ?? '',
                  };
                });
              }}
            >
              <option value="">{t('candidates.add.parentNone')}</option>
              {rootCandidates.map(p => (
                <option key={p.id} value={p.id}>
                  {formatCandidateListLabel(p)}
                </option>
              ))}
            </select>
            <p
              className="muted"
              style={{ margin: '0.25rem 0 0', fontSize: '0.8rem' }}
            >
              {CANDIDATE_HIERARCHY_HELP_FR}{' '}
              {isVariation
                ? t('candidates.add.parentHelpVariation')
                : t('candidates.add.parentHelpRoot')}
            </p>
          </div>

          <div className="candidate-fiche-identity stack">
            <h5 className="candidate-fiche-subtitle">
              {t('candidates.add.sectionIdentity')}
            </h5>
            <div className="row">
              <div style={{ flex: '1 1 160px' }}>
                <label htmlFor="cand-brand">{t('candidates.add.brand')}</label>
                <input
                  id="cand-brand"
                  value={form.brand}
                  onChange={e =>
                    setForm(f => ({ ...f, brand: e.target.value }))
                  }
                  readOnly={isVariation}
                  disabled={isVariation}
                  title={
                    isVariation
                      ? t('candidates.add.inheritedFromRoot')
                      : undefined
                  }
                />
              </div>
              <div style={{ flex: '1 1 160px' }}>
                <label htmlFor="cand-model">{t('candidates.add.model')}</label>
                <input
                  id="cand-model"
                  value={form.model}
                  onChange={e =>
                    setForm(f => ({ ...f, model: e.target.value }))
                  }
                  readOnly={isVariation}
                  disabled={isVariation}
                  title={
                    isVariation
                      ? t('candidates.add.inheritedFromRoot')
                      : undefined
                  }
                />
              </div>
            </div>
            {isVariation && parent ? (
              <>
                <div className="row">
                  <div style={{ flex: '1 1 160px' }}>
                    <label htmlFor="cand-base-ver">
                      {t('candidates.add.baseVersion')}
                    </label>
                    <input
                      id="cand-base-ver"
                      className="candidate-field-readonly"
                      readOnly
                      value={displayVersionLabel({
                        trim: parent.trim,
                        parent_candidate_id: null,
                      })}
                      tabIndex={-1}
                    />
                  </div>
                  <div style={{ flex: '1 1 160px' }}>
                    <label htmlFor="cand-period-ro">
                      {t('candidates.add.periodLabel')}
                    </label>
                    <input
                      id="cand-period-ro"
                      className="candidate-field-readonly"
                      readOnly
                      value={parent.event_date ?? ''}
                      tabIndex={-1}
                    />
                  </div>
                </div>
                <div className="row">
                  <div style={{ flex: '1 1 100%' }}>
                    <label htmlFor="cand-trim">
                      {t('candidates.add.extraVersion')}
                    </label>
                    <input
                      id="cand-trim"
                      value={form.trim}
                      onChange={e =>
                        setForm(f => ({ ...f, trim: e.target.value }))
                      }
                      placeholder={t('candidates.add.trimPlaceholder')}
                    />
                  </div>
                </div>
              </>
            ) : !isVariation ? (
              <div className="row">
                <div style={{ flex: '1 1 160px' }}>
                  <label htmlFor="cand-trim">
                    {t('candidates.add.baseVersion')}
                  </label>
                  <input
                    id="cand-trim"
                    value={form.trim}
                    onChange={e =>
                      setForm(f => ({ ...f, trim: e.target.value }))
                    }
                    placeholder={t('candidates.add.baseVersionPlaceholder')}
                  />
                </div>
                <div style={{ flex: '1 1 160px' }}>
                  <label htmlFor="cand-event-date">
                    {t('candidates.add.periodLabel')}
                  </label>
                  <input
                    id="cand-event-date"
                    type="text"
                    autoComplete="off"
                    value={form.event_date}
                    onChange={e =>
                      setForm(f => ({ ...f, event_date: e.target.value }))
                    }
                    placeholder={t('candidates.add.periodPlaceholder')}
                  />
                </div>
              </div>
            ) : (
              <>
                <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                  {t('candidates.add.orphanParentHint')}
                </p>
                <div className="row">
                  <div style={{ flex: '1 1 100%' }}>
                    <label htmlFor="cand-trim-orphan">
                      {t('candidates.add.extraVersion')}
                    </label>
                    <input
                      id="cand-trim-orphan"
                      value={form.trim}
                      onChange={e =>
                        setForm(f => ({ ...f, trim: e.target.value }))
                      }
                      placeholder={t('candidates.add.trimPlaceholder')}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {isVariation ? (
            <div className="candidate-fiche-details-attached stack">
              <h5 className="candidate-fiche-subtitle">
                {t('candidates.add.sectionVariationDetails')}
              </h5>
              <div className="row">
                <div style={{ flex: '1 1 160px' }}>
                  <label htmlFor="cand-engine">
                    {t('candidates.add.engine')}
                  </label>
                  <input
                    id="cand-engine"
                    value={form.engine}
                    onChange={e =>
                      setForm(f => ({ ...f, engine: e.target.value }))
                    }
                  />
                </div>
                <div style={{ flex: '1 1 160px' }}>
                  <label htmlFor="cand-price">{t('candidates.add.price')}</label>
                  <input
                    id="cand-price"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={form.price}
                    onChange={e =>
                      setForm(f => ({ ...f, price: e.target.value }))
                    }
                    onFocus={() => {
                      const n = parsePriceInput(form.price);
                      setForm(f => ({
                        ...f,
                        price: n != null ? String(n).replace('.', ',') : '',
                      }));
                    }}
                    onBlur={() => {
                      const n = parsePriceInput(form.price);
                      setForm(f => ({
                        ...f,
                        price: n != null ? formatPriceInputDisplay(n) : '',
                      }));
                    }}
                  />
                </div>
              </div>
              <div>
                <GarageLocationInput
                  id="cand-garage"
                  label={t('candidates.add.garageLabel')}
                  value={form.garage_location}
                  onChange={v => setForm(f => ({ ...f, garage_location: v }))}
                  suggestions={garageSuggestions}
                  placeholder={t('candidates.add.garagePlaceholder')}
                />
              </div>
              <ManufacturerLinksEditor
                idPrefix="cand-add-links"
                value={form.manufacturer_links}
                onChange={manufacturer_links =>
                  setForm(f => ({ ...f, manufacturer_links }))
                }
              />
              <div>
                <label htmlFor="cand-opt">{t('candidates.add.options')}</label>
                <textarea
                  id="cand-opt"
                  value={form.options}
                  onChange={e =>
                    setForm(f => ({ ...f, options: e.target.value }))
                  }
                />
              </div>
              <div className="row">
                <div style={{ flex: '1 1 200px' }}>
                  <label htmlFor="cand-st">{t('candidates.add.status')}</label>
                  <select
                    id="cand-st"
                    value={form.status}
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        status: e.target.value as CandidateStatus,
                      }))
                    }
                  >
                    {(Object.keys(statusLabels) as CandidateStatus[]).map(k => (
                      <option key={k} value={k}>
                        {statusLabels[k]}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label htmlFor="cand-rej">
                    {t('candidates.add.rejectReason')}
                  </label>
                  <input
                    id="cand-rej"
                    value={form.reject_reason}
                    onChange={e =>
                      setForm(f => ({ ...f, reject_reason: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="candidate-fiche-details-attached stack">
              <p
                className="muted"
                style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.45 }}
              >
                {t('candidates.add.rootNoDetails')}
              </p>
              <div className="row">
                <div style={{ flex: '1 1 200px' }}>
                  <label htmlFor="cand-st-root">
                    {t('candidates.add.status')}
                  </label>
                  <select
                    id="cand-st-root"
                    value={form.status}
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        status: e.target.value as CandidateStatus,
                      }))
                    }
                  >
                    {(Object.keys(statusLabels) as CandidateStatus[]).map(k => (
                      <option key={k} value={k}>
                        {statusLabels[k]}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label htmlFor="cand-rej-root">
                    {t('candidates.add.rejectReason')}
                  </label>
                  <input
                    id="cand-rej-root"
                    value={form.reject_reason}
                    onChange={e =>
                      setForm(f => ({ ...f, reject_reason: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>
          )}

          <button type="submit">{t('common.add')}</button>
        </form>
      </details>
    </div>
  );
}
