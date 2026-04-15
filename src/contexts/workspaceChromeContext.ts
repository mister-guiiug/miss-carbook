import { createContext } from 'react'
import type { TabId } from '../components/workspace/workspaceTabs'

export type WorkspaceChromeApi = {
  canWrite: boolean
  setTab: (id: TabId) => void
  openSearch: () => void
}

export type WorkspaceChromeCtxValue = {
  api: WorkspaceChromeApi | null
  setWorkspaceChrome: (api: WorkspaceChromeApi | null) => void
}

export const WorkspaceChromeContext = createContext<WorkspaceChromeCtxValue | null>(null)
