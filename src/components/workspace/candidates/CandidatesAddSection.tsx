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
              Si vous choisissez un racine, marque et modèle sont préremplis ; précisez la variation
              dans «&nbsp;Finition&nbsp;» ou «&nbsp;Motorisation&nbsp;».
            </p>
          </div>
          <div className="row">
            <div style={{ flex: '1 1 160px' }}>
              <label htmlFor="cand-brand">Marque</label>
              <input
                id="cand-brand"
                value={form.brand}
                onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
              />
            </div>
            <div style={{ flex: '1 1 160px' }}>
              <label htmlFor="cand-model">Modèle</label>
              <input
                id="cand-model"
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              />
            </div>
          </div>
          <div className="row">
            <div style={{ flex: '1 1 160px' }}>
              <label>Finition</label>
              <input
                value={form.trim}
                onChange={(e) => setForm((f) => ({ ...f, trim: e.target.value }))}
              />
            </div>
            <div style={{ flex: '1 1 160px' }}>
              <label>Motorisation</label>
              <input
                value={form.engine}
                onChange={(e) => setForm((f) => ({ ...f, engine: e.target.value }))}
              />
            </div>
          </div>
          <div className="row">
            <div style={{ flex: '1 1 160px' }}>
              <label>Prix</label>
              <input
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              />
            </div>
            <div style={{ flex: '1 1 160px' }}>
              <label>Date (essai / devis)</label>
              <input
                type="date"
                value={form.event_date}
                onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label>Garage / lieu</label>
            <input
              value={form.garage_location}
              onChange={(e) => setForm((f) => ({ ...f, garage_location: e.target.value }))}
            />
          </div>
          <div>
            <label>Lien constructeur</label>
            <input
              value={form.manufacturer_url}
              onChange={(e) => setForm((f) => ({ ...f, manufacturer_url: e.target.value }))}
            />
          </div>
          <div>
            <label>Options</label>
            <textarea
              value={form.options}
              onChange={(e) => setForm((f) => ({ ...f, options: e.target.value }))}
            />
          </div>
          <div className="row">
            <div style={{ flex: '1 1 200px' }}>
              <label>Statut</label>
              <select
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
              <label>Raison si rejet</label>
              <input
                value={form.reject_reason}
                onChange={(e) => setForm((f) => ({ ...f, reject_reason: e.target.value }))}
              />
            </div>
          </div>
          <button type="submit">Ajouter</button>
        </form>
      </details>
    </div>
  )
}
