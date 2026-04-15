import type { ManufacturerLink } from '../../../lib/manufacturerLinks'
import { manufacturerLinksAreEmpty } from '../../../lib/manufacturerLinks'
import { IconActionButton, IconPlus, IconTrash } from '../../ui/IconActionButton'

function isHttpUrl(s: string): boolean {
  try {
    return Boolean(new URL(s).protocol.match(/^https?:$/i))
  } catch {
    return false
  }
}

export function ManufacturerLinksEditor({
  idPrefix,
  value,
  onChange,
  disabled,
}: {
  idPrefix: string
  value: ManufacturerLink[]
  onChange: (next: ManufacturerLink[]) => void
  disabled?: boolean
}) {
  const addRow = () => onChange([...value, { url: '', label: '' }])
  const updateRow = (i: number, patch: Partial<ManufacturerLink>) => {
    const next = value.map((row, j) => (j === i ? { ...row, ...patch } : row))
    onChange(next)
  }
  const removeRow = (i: number) => onChange(value.filter((_, j) => j !== i))

  const clickable = value.filter((l) => {
    const u = l.url.trim()
    return u !== '' && isHttpUrl(u)
  })

  return (
    <div className="stack" style={{ gap: '0.75rem' }}>
      <div
        className="row"
        style={{
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <span id={`${idPrefix}-legend`} style={{ fontWeight: 600 }}>
          Liens (constructeur, fiche technique…)
        </span>
        {!disabled ? (
          <IconActionButton
            nativeType="button"
            variant="secondary"
            label="Ajouter un lien"
            onClick={addRow}
          >
            <IconPlus />
          </IconActionButton>
        ) : null}
      </div>

      {!disabled && value.length === 0 ? (
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Aucun lien pour l’instant. Utilisez « Ajouter un lien » puis enregistrez la fiche.
        </p>
      ) : null}

      {value.map((row, i) => (
        <div
          key={`${idPrefix}-link-${i}`}
          className="stack"
          style={{
            gap: '0.5rem',
            padding: '0.65rem',
            border: '1px solid var(--border, rgba(255,255,255,0.12))',
            borderRadius: 8,
          }}
        >
          <div className="row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ flex: '1 1 140px' }}>
              <label htmlFor={`${idPrefix}-label-${i}`}>Libellé (optionnel)</label>
              <input
                id={`${idPrefix}-label-${i}`}
                value={row.label}
                onChange={(e) => updateRow(i, { label: e.target.value })}
                disabled={disabled}
                placeholder="ex. Configurateur, Brochure PDF"
                maxLength={120}
                autoComplete="off"
              />
            </div>
            <div style={{ flex: '2 1 220px' }}>
              <label htmlFor={`${idPrefix}-url-${i}`}>URL</label>
              <input
                id={`${idPrefix}-url-${i}`}
                type="url"
                inputMode="url"
                value={row.url}
                onChange={(e) => updateRow(i, { url: e.target.value })}
                disabled={disabled}
                placeholder="https://…"
                maxLength={2000}
                autoComplete="off"
              />
            </div>
            {!disabled ? (
              <div style={{ alignSelf: 'flex-end' }}>
                <IconActionButton
                  nativeType="button"
                  variant="danger"
                  label={`Supprimer le lien ${i + 1}`}
                  onClick={() => removeRow(i)}
                >
                  <IconTrash />
                </IconActionButton>
              </div>
            ) : null}
          </div>
        </div>
      ))}

      {!manufacturerLinksAreEmpty(value) && clickable.length > 0 ? (
        <div className="stack" style={{ gap: '0.35rem' }}>
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            Aperçu (cliquable)
          </span>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.9rem' }}>
            {clickable.map((l, i) => (
              <li key={`${l.url}-${i}`}>
                <a href={l.url.trim()} target="_blank" rel="noopener noreferrer">
                  {l.label.trim() || l.url.trim()}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
