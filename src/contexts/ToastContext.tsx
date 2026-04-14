import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

type ToastContextValue = {
  showToast: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

// eslint-disable-next-line react-refresh/only-export-components -- hook + provider
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast doit être utilisé dans ToastProvider')
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setMessage(msg)
  }, [])

  useEffect(() => {
    if (!message) return
    const t = window.setTimeout(() => setMessage(null), 3200)
    return () => window.clearTimeout(t)
  }, [message])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="toast-region"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-relevant="additions text"
      >
        {message ? <div className="toast-card">{message}</div> : null}
      </div>
    </ToastContext.Provider>
  )
}
