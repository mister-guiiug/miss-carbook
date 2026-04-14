import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { TabId } from '../components/workspace/workspaceTabs'

export type WorkspaceChromeApi = {
  canWrite: boolean
  setTab: (id: TabId) => void
  openSearch: () => void
}

type Ctx = {
  api: WorkspaceChromeApi | null
  setWorkspaceChrome: (api: WorkspaceChromeApi | null) => void
}

const WorkspaceChromeContext = createContext<Ctx | null>(null)

export function WorkspaceChromeProvider({ children }: { children: ReactNode }) {
  const [api, setApi] = useState<WorkspaceChromeApi | null>(null)
  const setWorkspaceChrome = useCallback((next: WorkspaceChromeApi | null) => {
    setApi(next)
  }, [])
  const value = useMemo(() => ({ api, setWorkspaceChrome }), [api, setWorkspaceChrome])
  return <WorkspaceChromeContext.Provider value={value}>{children}</WorkspaceChromeContext.Provider>
}

export function useWorkspaceChrome() {
  const ctx = useContext(WorkspaceChromeContext)
  if (!ctx) {
    throw new Error('useWorkspaceChrome doit être utilisé sous WorkspaceChromeProvider')
  }
  return ctx
}
