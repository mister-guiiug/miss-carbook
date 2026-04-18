interface ProgressIndicatorProps {
  current: number
  total: number
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'compact'
}

export function ProgressIndicator({
  current,
  total,
  showLabel = true,
  size = 'md',
  variant = 'default',
}: ProgressIndicatorProps) {
  const percentage = Math.min(100, Math.max(0, (current / total) * 100))

  if (variant === 'compact') {
    return (
      <div className="completion-indicator" data-state={getCompletionState(percentage)}>
        <svg className="completion-indicator-icon" viewBox="0 0 16 16" fill="currentColor">
          {percentage === 100 ? (
            <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
          ) : (
            <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z" />
          )}
        </svg>
        <span>
          {current}/{total}
        </span>
      </div>
    )
  }

  return (
    <div className={`progress-container progress-container--${size}`}>
      <div className="progress-header">
        {showLabel && (
          <span className="progress-label">
            Progression : {current}/{total}
          </span>
        )}
        <span className="progress-percentage">{Math.round(percentage)}%</span>
      </div>
      <div className="progress-bar-container">
        <div className="progress-bar" style={{ width: `${percentage}%` }} role="progressbar" />
      </div>
    </div>
  )
}

function getCompletionState(percentage: number): 'filling' | 'complete' | undefined {
  if (percentage === 100) return 'complete'
  if (percentage > 0) return 'filling'
  return undefined
}

interface ProgressStepsProps {
  steps: Array<{ id: string; label: string; completed?: boolean; active?: boolean }>
}

export function ProgressSteps({ steps }: ProgressStepsProps) {
  return (
    <div className="progress-steps">
      {steps.map((step) => (
        <div
          key={step.id}
          className={`progress-step ${step.completed ? 'completed' : ''} ${step.active ? 'active' : ''}`}
        >
          <span className="progress-step-dot" />
          <span>{step.label}</span>
        </div>
      ))}
    </div>
  )
}
