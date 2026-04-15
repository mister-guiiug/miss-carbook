import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { WorkspaceChromeContext, type WorkspaceChromeApi } from './workspaceChromeContext'

export function WorkspaceChromeProvider({ children }: { children: ReactNode }) {
  const [api, setApi] = useState<WorkspaceChromeApi | null>(null)
  const setWorkspaceChrome = useCallback((next: WorkspaceChromeApi | null) => {
    setApi(next)
  }, [])
  const value = useMemo(() => ({ api, setWorkspaceChrome }), [api, setWorkspaceChrome])
  return <WorkspaceChromeContext.Provider value={value}>{children}</WorkspaceChromeContext.Provider>
}
