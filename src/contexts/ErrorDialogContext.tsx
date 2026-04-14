import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { explainUnknownError } from '../lib/errorReporting'
import { useFocusTrap } from '../hooks/useFocusTrap'
import {
  IconActionButton,
  IconCheck,
  IconChevronRight,
  IconChevronUp,
  IconCopy,
  IconX,
} from '../components/ui/IconActionButton'

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
  const panelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(panelRef, !!payload)

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
            ref={panelRef}
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
              <IconActionButton
                variant="secondary"
                className="error-dialog-details-toggle"
                label={
                  detailsOpen
                    ? 'Masquer les détails techniques'
                    : 'Afficher les détails techniques (copie support)'
                }
                onClick={() => setDetailsOpen((o) => !o)}
                aria-expanded={detailsOpen}
              >
                {detailsOpen ? <IconChevronUp /> : <IconChevronRight />}
              </IconActionButton>
              {detailsOpen ? (
                <div className="error-dialog-technical-wrap">
                  <pre className="error-dialog-technical" tabIndex={0}>
                    {payload.technical}
                  </pre>
                  <IconActionButton
                    variant="primary"
                    label={
                      copied
                        ? 'Détails copiés dans le presse-papiers'
                        : 'Copier les détails techniques dans le presse-papiers'
                    }
                    onClick={() => void copyTechnical()}
                  >
                    {copied ? <IconCheck /> : <IconCopy />}
                  </IconActionButton>
                </div>
              ) : null}
            </div>

            <div className="error-dialog-actions">
              <IconActionButton
                variant="secondary"
                label="Fermer la boîte de dialogue"
                onClick={dismiss}
              >
                <IconX />
              </IconActionButton>
            </div>
          </div>
        </div>
      ) : null}
    </ErrorDialogContext.Provider>
  )
}
