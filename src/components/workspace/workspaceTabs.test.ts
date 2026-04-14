import { describe, expect, it } from 'vitest'
import { parseWorkspaceTabParam, WORKSPACE_TABS } from './workspaceTabs'

describe('parseWorkspaceTabParam', () => {
  it('retourne notepad par défaut', () => {
    expect(parseWorkspaceTabParam(null)).toBe('notepad')
    expect(parseWorkspaceTabParam('')).toBe('notepad')
  })
  it('accepte chaque id d’onglet valide', () => {
    for (const t of WORKSPACE_TABS) {
      expect(parseWorkspaceTabParam(t.id)).toBe(t.id)
    }
  })
  it('ignore les valeurs inconnues', () => {
    expect(parseWorkspaceTabParam('inventé')).toBe('notepad')
    expect(parseWorkspaceTabParam('settings_extra')).toBe('notepad')
  })
})
