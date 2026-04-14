const KEY_GLOBAL = 'mc_assistant_global_done'
const KEY_SESSION_AUTO = 'mc_assistant_session_auto_offered'
const KEY_WS_PREFIX = 'mc_assistant_ws_done_'
const KEY_INVITE_PREFIX = 'mc_assistant_invite_tip_done_'

export function isGlobalAssistantDone(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(KEY_GLOBAL) === '1'
}

export function setGlobalAssistantDone(): void {
  try {
    localStorage.setItem(KEY_GLOBAL, '1')
  } catch {
    /* ignore */
  }
}

export function clearGlobalAssistantDone(): void {
  try {
    localStorage.removeItem(KEY_GLOBAL)
  } catch {
    /* ignore */
  }
}

/** Une fois par onglet : évite une boucle de redirection accueil → assistant. */
export function hasSessionAutoOffered(): boolean {
  if (typeof sessionStorage === 'undefined') return false
  return sessionStorage.getItem(KEY_SESSION_AUTO) === '1'
}

export function setSessionAutoOffered(): void {
  try {
    sessionStorage.setItem(KEY_SESSION_AUTO, '1')
  } catch {
    /* ignore */
  }
}

export function clearSessionAutoOffered(): void {
  try {
    sessionStorage.removeItem(KEY_SESSION_AUTO)
  } catch {
    /* ignore */
  }
}

export function isWorkspaceAssistantTourDone(workspaceId: string): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(KEY_WS_PREFIX + workspaceId) === '1'
}

export function setWorkspaceAssistantTourDone(workspaceId: string): void {
  try {
    localStorage.setItem(KEY_WS_PREFIX + workspaceId, '1')
  } catch {
    /* ignore */
  }
}

export function isInviteTipDone(workspaceId: string): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(KEY_INVITE_PREFIX + workspaceId) === '1'
}

export function setInviteTipDone(workspaceId: string): void {
  try {
    localStorage.setItem(KEY_INVITE_PREFIX + workspaceId, '1')
  } catch {
    /* ignore */
  }
}

/** Réinitialisation complète (paramètres « Relancer la visite »). */
export function resetAllAssistantFlags(): void {
  clearGlobalAssistantDone()
  clearSessionAutoOffered()
  if (typeof localStorage === 'undefined') return
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (
        k &&
        (k.startsWith(KEY_WS_PREFIX) ||
          k.startsWith(KEY_INVITE_PREFIX) ||
          k.startsWith('mc_onboard_'))
      ) {
        keys.push(k)
      }
    }
    for (const k of keys) localStorage.removeItem(k)
  } catch {
    /* ignore */
  }
}
