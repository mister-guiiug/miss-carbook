import type { ReactNode } from 'react'

export function AssistantFullscreenLayout({
  stepIndex,
  stepCount,
  titleId,
  title,
  children,
  onBack,
  onPrimary,
  primaryLabel,
  showBack,
  onPassAll,
  onNeverShowAgain,
}: {
  stepIndex: number
  stepCount: number
  titleId: string
  title: string
  children: ReactNode
  onBack?: () => void
  onPrimary: () => void
  primaryLabel: string
  showBack: boolean
  onPassAll: () => void
  onNeverShowAgain: () => void
}) {
  return (
    <div
      className="assistant-fullscreen"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-live="polite"
    >
      <div className="assistant-fullscreen-inner">
        <p className="assistant-step-meta muted">
          Étape {stepIndex + 1} sur {stepCount}
        </p>
        <div className="assistant-progress" aria-hidden="true">
          {Array.from({ length: stepCount }, (_, i) => (
            <span
              key={i}
              className={`assistant-progress-dot${i === stepIndex ? ' assistant-progress-dot--active' : ''}`}
            />
          ))}
        </div>
        <h2 className="assistant-title" id={titleId}>
          {title}
        </h2>
        <div className="assistant-body">{children}</div>
        <div className="assistant-actions">
          {showBack ? (
            <button type="button" className="secondary assistant-btn" onClick={onBack}>
              Retour
            </button>
          ) : (
            <span className="assistant-actions-spacer" />
          )}
          <button type="button" className="assistant-btn assistant-btn-primary" onClick={onPrimary}>
            {primaryLabel}
          </button>
        </div>
        <div className="assistant-footer-links">
          <button type="button" className="link-like" onClick={onPassAll}>
            Passer tout
          </button>
          <span aria-hidden="true"> · </span>
          <button type="button" className="link-like" onClick={onNeverShowAgain}>
            Ne plus proposer
          </button>
        </div>
      </div>
    </div>
  )
}
