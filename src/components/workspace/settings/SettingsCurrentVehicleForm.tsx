import { useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { candidateSpecDimensionKeys, candidateSpecLabels } from '../../../lib/candidateSpecsUi'
import { formatGroupedIntegerFrDisplay, parseGroupedIntegerFrInput } from '../../../lib/formatGroupedIntegerFr'

type VehicleState = {
  brand: string
  model: string
  engine: string
  year: string | number
  options: string
  specs: Record<string, unknown>
}

export function SettingsCurrentVehicleForm({
  canWrite,
  busy,
  vehicle,
  setVehicle,
  setVehicleSpecNum,
  setVehicleSpecStr,
  onSubmit,
}: {
  canWrite: boolean
  busy: boolean
  vehicle: VehicleState
  setVehicle: Dispatch<SetStateAction<VehicleState>>
  setVehicleSpecNum: (key: string, raw: string) => void
  setVehicleSpecStr: (key: string, value: string) => void
  onSubmit: (e: FormEvent) => void
}) {
  const [dimFocus, setDimFocus] = useState<string | null>(null)
  const [dimDraft, setDimDraft] = useState<Record<string, string>>({})

  return (
    <form onSubmit={onSubmit} className="card stack" style={{ boxShadow: 'none' }}>
      <h3 style={{ margin: 0 }}>Véhicule actuel (remplacement)</h3>
      {!canWrite ? <p className="muted">Lecture seule</p> : null}
      <div className="row">
        <div style={{ flex: '1 1 140px' }}>
          <label>Marque</label>
          <input
            value={vehicle.brand}
            onChange={(e) => setVehicle((v) => ({ ...v, brand: e.target.value }))}
            disabled={!canWrite}
          />
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <label>Modèle</label>
          <input
            value={vehicle.model}
            onChange={(e) => setVehicle((v) => ({ ...v, model: e.target.value }))}
            disabled={!canWrite}
          />
        </div>
      </div>
      <div className="row">
        <div style={{ flex: '1 1 140px' }}>
          <label>Motorisation</label>
          <input
            value={vehicle.engine}
            onChange={(e) => setVehicle((v) => ({ ...v, engine: e.target.value }))}
            disabled={!canWrite}
          />
        </div>
        <div style={{ flex: '1 1 120px' }}>
          <label>Année</label>
          <input
            type="number"
            value={vehicle.year}
            onChange={(e) => setVehicle((v) => ({ ...v, year: e.target.value }))}
            disabled={!canWrite}
          />
        </div>
      </div>
      <div className="stack" style={{ gap: '0.35rem' }}>
        <h4 style={{ margin: 0, fontSize: '1rem' }}>Données techniques (flexibles)</h4>
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Même principe que les fiches modèles : champs optionnels, stockés en JSON. Les dimensions
          reprennent les valeurs catalogue (millimètres), comme sur une fiche constructeur.
        </p>
        <h5 style={{ margin: '0.35rem 0 0', fontSize: '0.95rem', fontWeight: 600 }}>
          Dimensions (constructeur, mm)
        </h5>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {candidateSpecDimensionKeys.map((k) => {
            const v = vehicle.specs[k]
            const num = typeof v === 'number' && !Number.isNaN(v) ? v : undefined
            const focused = dimFocus === k
            const display = focused
              ? (dimDraft[k] ?? '')
              : num != null
                ? formatGroupedIntegerFrDisplay(num)
                : ''
            return (
              <div key={k} style={{ flex: '1 1 140px' }}>
                <label htmlFor={`cv-spec-${k}`}>{candidateSpecLabels[k]}</label>
                <input
                  id={`cv-spec-${k}`}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="ex. 4 620"
                  value={display}
                  onFocus={() => {
                    setDimFocus(k)
                    setDimDraft((d) => ({
                      ...d,
                      [k]: num != null ? String(Math.floor(num)) : '',
                    }))
                  }}
                  onChange={(e) =>
                    setDimDraft((d) => ({
                      ...d,
                      [k]: e.target.value.replace(/[^\d\s\u00a0\u202f]/g, ''),
                    }))
                  }
                  onBlur={() => {
                    const raw = dimDraft[k] ?? ''
                    const n = parseGroupedIntegerFrInput(raw, { max: 99_999 })
                    setVehicle((prev) => ({
                      ...prev,
                      specs: { ...prev.specs, [k]: n ?? undefined },
                    }))
                    setDimFocus(null)
                    setDimDraft((d) => {
                      const next = { ...d }
                      delete next[k]
                      return next
                    })
                  }}
                  disabled={!canWrite}
                />
              </div>
            )
          })}
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 140px' }}>
            <label htmlFor="cv-spec-doors">Nombre de portes</label>
            <input
              id="cv-spec-doors"
              type="number"
              min={2}
              max={9}
              value={typeof vehicle.specs.doorCount === 'number' ? vehicle.specs.doorCount : ''}
              onChange={(e) => setVehicleSpecNum('doorCount', e.target.value)}
              disabled={!canWrite}
            />
          </div>
          <div style={{ flex: '1 1 140px' }}>
            <label htmlFor="cv-spec-hp">Puissance (ch)</label>
            <input
              id="cv-spec-hp"
              type="number"
              min={0}
              value={typeof vehicle.specs.powerHp === 'number' ? vehicle.specs.powerHp : ''}
              onChange={(e) => setVehicleSpecNum('powerHp', e.target.value)}
              disabled={!canWrite}
            />
          </div>
          <div style={{ flex: '1 1 140px' }}>
            <label htmlFor="cv-spec-fiscal">Puissance fiscale (CV)</label>
            <input
              id="cv-spec-fiscal"
              type="number"
              min={1}
              max={99}
              value={typeof vehicle.specs.fiscalCv === 'number' ? vehicle.specs.fiscalCv : ''}
              onChange={(e) => setVehicleSpecNum('fiscalCv', e.target.value)}
              disabled={!canWrite}
            />
          </div>
          <div style={{ flex: '1 1 140px' }}>
            <label htmlFor="cv-spec-trunk">Volume du coffre (L)</label>
            <input
              id="cv-spec-trunk"
              type="number"
              min={0}
              step={1}
              value={typeof vehicle.specs.trunkLiters === 'number' ? vehicle.specs.trunkLiters : ''}
              onChange={(e) => setVehicleSpecNum('trunkLiters', e.target.value)}
              disabled={!canWrite}
            />
          </div>
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 180px' }}>
            <label htmlFor="cv-spec-gearbox">Boîte de vitesses</label>
            <input
              id="cv-spec-gearbox"
              value={typeof vehicle.specs.gearbox === 'string' ? vehicle.specs.gearbox : ''}
              onChange={(e) => setVehicleSpecStr('gearbox', e.target.value)}
              placeholder="ex. Manuelle 6, BVA8…"
              disabled={!canWrite}
            />
          </div>
          <div style={{ flex: '1 1 180px' }}>
            <label htmlFor="cv-spec-color">Couleur extérieure</label>
            <input
              id="cv-spec-color"
              value={
                typeof vehicle.specs.exteriorColor === 'string' ? vehicle.specs.exteriorColor : ''
              }
              onChange={(e) => setVehicleSpecStr('exteriorColor', e.target.value)}
              disabled={!canWrite}
            />
          </div>
        </div>
      </div>
      <div>
        <label>Options</label>
        <textarea
          value={vehicle.options}
          onChange={(e) => setVehicle((v) => ({ ...v, options: e.target.value }))}
          disabled={!canWrite}
        />
      </div>
      {canWrite ? (
        <button type="submit" disabled={busy}>
          {busy ? '…' : 'Enregistrer le véhicule actuel'}
        </button>
      ) : null}
    </form>
  )
}
