import { formatCandidateListLabel } from '../../../lib/candidateLabel'
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
                  if (!pid) return { ...f, parent_id: '' }
                  const p = candidates.find((x) => x.id === pid)
                  return {
                    ...f,
                    parent_id: pid,
                    brand: p?.brand ?? f.brand,
                    model: p?.model ?? f.model,
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
            <div className="row">
              <div style={{ flex: '1 1 160px' }}>
                <label htmlFor="cand-trim">Version</label>
                <input
                  id="cand-trim"
                  value={form.trim}
                  onChange={(e) => setForm((f) => ({ ...f, trim: e.target.value }))}
                  placeholder="ex. finition"
                />
              </div>
              <div style={{ flex: '1 1 160px' }}>
                <label htmlFor="cand-event-date">Année(s) / période</label>
                <input
                  id="cand-event-date"
                  type="date"
                  value={form.event_date}
                  onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
                />
              </div>
            </div>
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
                    type="number"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
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
                    type="number"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
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
