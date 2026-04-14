import { describe, expect, it, beforeEach } from 'vitest'
import {
  clearGlobalAssistantDone,
  isGlobalAssistantDone,
  resetAllAssistantFlags,
  setGlobalAssistantDone,
} from './assistantStorage'

describe('assistantStorage', () => {
  beforeEach(() => {
    localStorage.clear()
    clearGlobalAssistantDone()
  })

  it('global done round-trip', () => {
    expect(isGlobalAssistantDone()).toBe(false)
    setGlobalAssistantDone()
    expect(isGlobalAssistantDone()).toBe(true)
  })

  it('resetAllAssistantFlags supprime mc_onboard_', () => {
    localStorage.setItem('mc_onboard_abc', '1')
    localStorage.setItem('mc_assistant_global_done', '1')
    resetAllAssistantFlags()
    expect(localStorage.getItem('mc_onboard_abc')).toBeNull()
    expect(isGlobalAssistantDone()).toBe(false)
  })
})
