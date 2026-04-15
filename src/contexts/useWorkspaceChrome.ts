import { useContext } from 'react'
import { WorkspaceChromeContext } from './workspaceChromeContext'

export function useWorkspaceChrome() {
  const ctx = useContext(WorkspaceChromeContext)
  if (!ctx) {
    throw new Error('useWorkspaceChrome doit être utilisé sous WorkspaceChromeProvider')
  }
  return ctx
}
