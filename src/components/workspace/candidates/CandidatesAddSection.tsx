import { useRef } from 'react'
import { displayVersionLabel, formatCandidateListLabel } from '../../../lib/candidateLabel'
import { formatPriceInputDisplay, parsePriceInput } from '../../../lib/formatPrice'
import type { CandidateStatus } from '../../../types/database'
import type { AddCandidateFormState } from './useAddCandidateForm'
import type { CandidateRow } from './candidateTypes'
import { statusLabels } from './candidateTypes'

export function CandidatesAddSection({
  form,
  setForm,
  addCandidate,
  importCsv,
  rootCandidates,
  candidates,
}: {
  form: AddCandidateFormState
  setForm: React.Dispatch<React.SetStateAction<AddCandidateFormState>>
  addCandidate: (e: React.FormEvent) => void
  importCsv: (file: File | null) => void
  rootCandidates: CandidateRow[]
  candidates: CandidateRow[]
}) {
  const isVariation = Boolean(form.parent_id)
  const parent = form.parent_id ? (candidates.find((x) => x.id === form.parent_id) ?? null) : null
  const rootDraftRef = useRef<{ brand: string; model: string; event_date: string } | null>(null)

  return (
    <div className="candidates-panels row">
      <details className="card candidates-menu-panel" style={{ boxShadow: 'none' }}>
        <summary>Import CSV</summary>
        <div className="stack" style={{ marginTop: '0.75rem' }}>
          <p className="muted" style={{ margin: 0 }}>
            Première ligne : brand, model (obligatoires), trim, engine, price… Séparateur virgule.
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => void importCsv(e.target.files?.[0] ?? null)}
          />
        </div>
      </details>

      <details
        id="workspace-candidates-add-details"
        className="card candidates-menu-panel"
        style={{ boxShadow: 'none' }}
      >
        <summary>Nouveau modèle ou variation</summary>
        <form onSubmit={addCandidate} className="stack" style={{ marginTop: '0.75rem' }}>
          <div>
            <label htmlFor="cand-parent">Modèle racine (optionnel)</label>
            <select
              id="cand-parent"
              value={form.parent_id}
              onChange={(e) => {
                const pid = e.target.value
                setForm((f) => {
                  if (!pid) {
                    const draft = rootDraftRef.current
                    rootDraftRef.current = null
                    return {
                      ...f,
                      parent_id: '',
                      brand: draft?.brand ?? f.brand,
                      model: draft?.model ?? f.model,
                      event_date: draft?.event_date ?? f.event_date,
                    }
                  }
                  const p = candidates.find((x) => x.id === pid)
                  if (!f.parent_id) {
                    rootDraftRef.current = { brand: f.brand, model: f.model, event_date: f.event_date }
                  }
                  return {
                    ...f,
                    parent_id: pid,
                    brand: p?.brand ?? f.brand,
                    model: p?.model ?? f.model,
                    event_date: p?.event_date ?? '',
                  }
                })
              }}
            >
              <option value="">— Aucun (nouveau modèle racine) —</option>
              {rootCandidates.map((p) => (
                <option key={p.id} value={p.id}>
                  {formatCandidateListLabel(p)}
                </option>
              ))}
            </select>
            <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.8rem' }}>
              {isVariation
                ? 'Variation : la marque et le modèle viennent du racine ; précisez la version, la motorisation et le prix pour cette ligne.'
                : 'Le racine porte surtout marque, modèle et version / période ; le reste est regroupé sous « Détails » tant qu’il n’y a pas plusieurs variations.'}
            </p>
          </div>

          <div className="candidate-fiche-identity stack">
            <h5 className="candidate-fiche-subtitle">Identité</h5>
            <div className="row">
              <div style={{ flex: '1 1 160px' }}>
                <label htmlFor="cand-brand">Marque</label>
                <input
                  id="cand-brand"
                  value={form.brand}
                  onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                  readOnly={isVariation}
                  disabled={isVariation}
                  title={isVariation ? 'Hérité du modèle racine' : undefined}
                />
              </div>
              <div style={{ flex: '1 1 160px' }}>
                <label htmlFor="cand-model">Modèle</label>
                <input
                  id="cand-model"
                  value={form.model}
                  onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                  readOnly={isVariation}
                  disabled={isVariation}
                  title={isVariation ? 'Hérité du modèle racine' : undefined}
                />
              </div>
            </div>
            {isVariation && parent ? (
              <>
                <div className="row">
                  <div style={{ flex: '1 1 160px' }}>
                    <label htmlFor="cand-base-ver">Version de base</label>
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
                    <label htmlFor="cand-period-ro">Année(s) / période</label>
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
                    <label htmlFor="cand-trim">Version complémentaire</label>
                    <input
                      id="cand-trim"
                      value={form.trim}
                      onChange={(e) => setForm((f) => ({ ...f, trim: e.target.value }))}
                      placeholder="ex. finition, pack, motorisation…"
                    />
                  </div>
                </div>
              </>
            ) : !isVariation ? (
              <div className="row">
                <div style={{ flex: '1 1 160px' }}>
                  <label htmlFor="cand-trim">Version de base</label>
                  <input
                    id="cand-trim"
                    value={form.trim}
                    onChange={(e) => setForm((f) => ({ ...f, trim: e.target.value }))}
                    placeholder="Vide = « Générique » (version de base)"
                  />
                </div>
                <div style={{ flex: '1 1 160px' }}>
                  <label htmlFor="cand-event-date">Année(s) / période</label>
                  <input
                    id="cand-event-date"
                    type="text"
                    autoComplete="off"
                    value={form.event_date}
                    onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
                    placeholder="ex. 2024, 2020-2023, printemps 2025"
                  />
                </div>
              </div>
            ) : (
              <>
                <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                  Parent introuvable dans la liste : indiquez au moins la version complémentaire.
                </p>
                <div className="row">
                  <div style={{ flex: '1 1 100%' }}>
                    <label htmlFor="cand-trim-orphan">Version complémentaire</label>
                    <input
                      id="cand-trim-orphan"
                      value={form.trim}
                      onChange={(e) => setForm((f) => ({ ...f, trim: e.target.value }))}
                      placeholder="ex. finition, pack, motorisation…"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {isVariation ? (
            <div className="candidate-fiche-details-attached stack">
              <h5 className="candidate-fiche-subtitle">Détails de la variation</h5>
              <div className="row">
                <div style={{ flex: '1 1 160px' }}>
                  <label htmlFor="cand-engine">Motorisation</label>
                  <input
                    id="cand-engine"
                    value={form.engine}
                    onChange={(e) => setForm((f) => ({ ...f, engine: e.target.value }))}
                  />
                </div>
                <div style={{ flex: '1 1 160px' }}>
                  <label htmlFor="cand-price">Prix</label>
                  <input
                    id="cand-price"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    onFocus={() => {
                      const n = parsePriceInput(form.price)
                      setForm((f) => ({
                        ...f,
                        price: n != null ? String(n).replace('.', ',') : '',
                      }))
                    }}
                    onBlur={() => {
                      const n = parsePriceInput(form.price)
                      setForm((f) => ({
                        ...f,
                        price: n != null ? formatPriceInputDisplay(n) : '',
                      }))
                    }}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="cand-garage">Garage / lieu</label>
                <input
                  id="cand-garage"
                  value={form.garage_location}
                  onChange={(e) => setForm((f) => ({ ...f, garage_location: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="cand-url">Lien constructeur</label>
                <input
                  id="cand-url"
                  value={form.manufacturer_url}
                  onChange={(e) => setForm((f) => ({ ...f, manufacturer_url: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="cand-opt">Options</label>
                <textarea
                  id="cand-opt"
                  value={form.options}
                  onChange={(e) => setForm((f) => ({ ...f, options: e.target.value }))}
                />
              </div>
              <div className="row">
                <div style={{ flex: '1 1 200px' }}>
                  <label htmlFor="cand-st">Statut</label>
                  <select
                    id="cand-st"
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, status: e.target.value as CandidateStatus }))
                    }
                  >
                    {(Object.keys(statusLabels) as CandidateStatus[]).map((k) => (
                      <option key={k} value={k}>
                        {statusLabels[k]}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label htmlFor="cand-rej">Raison si rejet</label>
                  <input
                    id="cand-rej"
                    value={form.reject_reason}
                    onChange={(e) => setForm((f) => ({ ...f, reject_reason: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="candidate-fiche-details-attached stack">
              <h5 className="candidate-fiche-subtitle">Détails du véhicule</h5>
              <div className="row">
                <div style={{ flex: '1 1 160px' }}>
                  <label htmlFor="cand-engine-root">Motorisation</label>
                  <input
                    id="cand-engine-root"
                    value={form.engine}
                    onChange={(e) => setForm((f) => ({ ...f, engine: e.target.value }))}
                  />
                </div>
                <div style={{ flex: '1 1 160px' }}>
                  <label htmlFor="cand-price-root">Prix</label>
                  <input
                    id="cand-price-root"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    onFocus={() => {
                      const n = parsePriceInput(form.price)
                      setForm((f) => ({
                        ...f,
                        price: n != null ? String(n).replace('.', ',') : '',
                      }))
                    }}
                    onBlur={() => {
                      const n = parsePriceInput(form.price)
                      setForm((f) => ({
                        ...f,
                        price: n != null ? formatPriceInputDisplay(n) : '',
                      }))
                    }}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="cand-garage-root">Garage / lieu</label>
                <input
                  id="cand-garage-root"
                  value={form.garage_location}
                  onChange={(e) => setForm((f) => ({ ...f, garage_location: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="cand-url-root">Lien constructeur</label>
                <input
                  id="cand-url-root"
                  value={form.manufacturer_url}
                  onChange={(e) => setForm((f) => ({ ...f, manufacturer_url: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="cand-opt-root">Options</label>
                <textarea
                  id="cand-opt-root"
                  value={form.options}
                  onChange={(e) => setForm((f) => ({ ...f, options: e.target.value }))}
                />
              </div>
              <div className="row">
                <div style={{ flex: '1 1 200px' }}>
                  <label htmlFor="cand-st-root">Statut</label>
                  <select
                    id="cand-st-root"
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, status: e.target.value as CandidateStatus }))
                    }
                  >
                    {(Object.keys(statusLabels) as CandidateStatus[]).map((k) => (
                      <option key={k} value={k}>
                        {statusLabels[k]}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label htmlFor="cand-rej-root">Raison si rejet</label>
                  <input
                    id="cand-rej-root"
                    value={form.reject_reason}
                    onChange={(e) => setForm((f) => ({ ...f, reject_reason: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}

          <button type="submit">Ajouter</button>
        </form>
      </details>
    </div>
  )
}
