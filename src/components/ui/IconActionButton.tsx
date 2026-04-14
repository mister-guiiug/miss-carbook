import type { ButtonHTMLAttributes, ReactNode } from 'react'

const ic = { width: 20, height: 20, viewBox: '0 0 24 24' as const, fill: 'none' as const }

export function IconActionButton({
  label,
  variant = 'secondary',
  nativeType = 'button',
  className = '',
  children,
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'aria-label' | 'title' | 'children'> & {
  label: string
  variant?: 'primary' | 'secondary' | 'danger'
  nativeType?: 'button' | 'submit'
  children: ReactNode
}) {
  const mods = ['icon-action-btn']
  if (variant === 'secondary') mods.push('icon-action-btn--secondary')
  else if (variant === 'danger') mods.push('icon-action-btn--danger')
  else mods.push('icon-action-btn--primary')
  return (
    <button
      {...rest}
      type={nativeType}
      className={[...mods, className].filter(Boolean).join(' ')}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  )
}

export function IconPlus() {
  return (
    <svg {...ic} aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconX() {
  return (
    <svg {...ic} aria-hidden>
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconPencil() {
  return (
    <svg {...ic} aria-hidden>
      <path
        d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L8 18l-4 1 1-4L16.5 3.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconTrash() {
  return (
    <svg {...ic} aria-hidden>
      <path
        d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconCheck() {
  return (
    <svg {...ic} aria-hidden>
      <path
        d="M20 6L9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconRotateCcw() {
  return (
    <svg {...ic} aria-hidden>
      <path
        d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M3 3v5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function IconDuplicate() {
  return (
    <svg {...ic} aria-hidden>
      <rect x="8" y="8" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
      <path
        d="M4 16V6a2 2 0 012-2h10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconChevronDown() {
  return (
    <svg {...ic} aria-hidden>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

export function IconChevronUp() {
  return (
    <svg {...ic} aria-hidden>
      <path d="M6 15l6-6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

export function IconChevronRight() {
  return (
    <svg {...ic} aria-hidden>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

export function IconJson() {
  return (
    <svg {...ic} aria-hidden>
      <path
        d="M8 9l-3 3 3 3M16 9l3 3-3 3M13 7l-2 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconTable() {
  return (
    <svg {...ic} aria-hidden>
      <path
        d="M4 6h16v12H4V6zm0 4h16M4 14h16M10 6v12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconPrinter() {
  return (
    <svg {...ic} aria-hidden>
      <path
        d="M7 17h10v5H7v-5zM6 9V5h12v4M6 9h12v8H6V9z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6 13h12" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

export function IconSave() {
  return (
    <svg {...ic} aria-hidden>
      <path
        d="M5 20h14a1 1 0 001-1V8l-3-3H5a1 1 0 00-1 1v13a1 1 0 001 1z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M9 17h6M9 13h6M9 5v4h6V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function IconArchiveDown() {
  return (
    <svg {...ic} aria-hidden>
      <path
        d="M4 8h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V8zM4 8V6a1 1 0 011-1h3l1-2h8l1 2h3a1 1 0 011 1v2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M12 11v6m0 0l-2.5-2.5M12 17l2.5-2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function IconCopy() {
  return (
    <svg {...ic} aria-hidden>
      <rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
      <path
        d="M4 16V6a2 2 0 012-2h10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconBan() {
  return (
    <svg {...ic} aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M5 5l14 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function IconUserMinus() {
  return (
    <svg {...ic} aria-hidden>
      <path
        d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 11h-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconEye() {
  return (
    <svg {...ic} aria-hidden>
      <path
        d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

export function IconShield() {
  return (
    <svg {...ic} aria-hidden>
      <path
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconLogOut() {
  return (
    <svg {...ic} aria-hidden>
      <path
        d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconSend() {
  return (
    <svg {...ic} aria-hidden>
      <path
        d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Document / contexte pour assistant. */
export function IconPromptFile() {
  return (
    <svg {...ic} aria-hidden>
      <path
        d="M6 3h9l3 3v15a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M8 10h8M8 14h8M8 18h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
