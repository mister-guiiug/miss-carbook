/** Événement global pour rafraîchir l’affichage du profil (pseudo modifié). */
export const PROFILE_UPDATED_EVENT = 'miss-carbook-profile-updated'

export function notifyProfileUpdated() {
  window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT))
}
