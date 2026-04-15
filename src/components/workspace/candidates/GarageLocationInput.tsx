import { useId, useMemo } from 'react'

export function GarageLocationInput({
  id,
  label,
  value,
  onChange,
  suggestions,
  disabled,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  suggestions: string[]
  disabled?: boolean
  placeholder?: string
}) {
  const autoId = useId()
  const listId = `${id}-list-${autoId}`

  const items = useMemo(() => {
    const uniq = new Set<string>()
    for (const s of suggestions ?? []) {
      const t = String(s ?? '').trim()
      if (t) uniq.add(t)
    }
    return [...uniq].sort((a, b) => a.localeCompare(b, 'fr-FR'))
  }, [suggestions])

  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={items.length ? listId : undefined}
        disabled={disabled}
        placeholder={placeholder}
      />
      {items.length ? (
        <datalist id={listId}>
          {items.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      ) : null}
    </div>
  )
}
