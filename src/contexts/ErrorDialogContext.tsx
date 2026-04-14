import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { explainUnknownError } from '../lib/errorReporting'

type ErrorPayload = {
  userMessage: string
  technical: string
}

type ErrorDialogContextValue = {
  reportException: (err: unknown, context?: string) => void
  /** Erreur métier ou de validation : message clair + détail optionnel pour le copier-coller. */
  reportMessage: (userMessage: string, technical?: string) => void
  dismiss: () => void
}

const ErrorDialogContext = createContext<ErrorDialogContextValue | null>(null)

// eslint-disable-next-line react-refresh/only-export-components -- hook utilisé avec ErrorDialogProvider
export function useErrorDialog() {
  const ctx = useContext(ErrorDialogContext)
  if (!ctx) {
    throw new Error('useErrorDialog doit être utilisé dans ErrorDialogProvider')
  }
  return ctx
}

export function ErrorDialogProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<ErrorPayload | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const dismiss = useCallback(() => {
    setPayload(null)
    setDetailsOpen(false)
    setCopied(false)
  }, [])

  const reportException = useCallback((err: unknown, context?: string) => {
    const { userMessage, technical } = explainUnknownError(err, context)
    setPayload({ userMessage, technical })
    setDetailsOpen(false)
    setCopied(false)
  }, [])

  const reportMessage = useCallback((userMessage: string, technical?: string) => {
    setPayload({
      userMessage,
      technical: technical ?? userMessage,
    })
    setDetailsOpen(false)
    setCopied(false)
  }, [])

  const value = useMemo(
    () => ({ reportException, reportMessage, dismiss }),
    [reportException, reportMessage, dismiss]
  )

  useEffect(() => {
    if (!payload) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [payload, dismiss])

  const copyTechnical = useCallback(async () => {
    if (!payload?.technical) return
    try {
      await navigator.clipboard.writeText(payload.technical)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }, [payload?.technical])

  return (
    <ErrorDialogContext.Provider value={value}>
      {children}
      {payload ? (
        <div
          className="error-dialog-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) dismiss()
          }}
        >
          <div
            className="error-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="error-dialog-title"
            aria-describedby="error-dialog-desc"
          >
            <h2 id="error-dialog-title" className="error-dialog-title">
              Problème
            </h2>
            <p id="error-dialog-desc" className="error-dialog-message">
              {payload.userMessage}
            </p>

            <div className="error-dialog-details">
              <button
                type="button"
                className="secondary error-dialog-details-toggle"
                onClick={() => setDetailsOpen((o) => !o)}
                aria-expanded={detailsOpen}
              >
                {detailsOpen ? 'Masquer les détails techniques' : 'Détails techniques (copie support)'}
              </button>
              {detailsOpen ? (
                <div className="error-dialog-technical-wrap">
                  <pre className="error-dialog-technical" tabIndex={0}>
                    {payload.technical}
                  </pre>
                  <button type="button" onClick={() => void copyTechnical()}>
                    {copied ? 'Copié' : 'Copier les détails'}
                  </button>
                </div>
              ) : null}
            </div>

            <div className="error-dialog-actions">
              <button type="button" className="secondary" onClick={dismiss}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ErrorDialogContext.Provider>
  )
}
