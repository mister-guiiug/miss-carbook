/** Émis après changement d’onglet pour focaliser un formulaire d’ajout. */
export const WORKSPACE_QUICK_ADD_EVENT = 'miss-carbook:workspace-quick-add' as const

export type WorkspaceQuickAddTab = 'notepad' | 'requirements' | 'reminders' | 'candidates'

export type WorkspaceQuickAddDetail = { tab: WorkspaceQuickAddTab }

export function emitWorkspaceQuickAdd(tab: WorkspaceQuickAddTab) {
  window.dispatchEvent(new CustomEvent(WORKSPACE_QUICK_ADD_EVENT, { detail: { tab } }))
}
