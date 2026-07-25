// Primitives d'interface : visionneuse photo, bascule de thème.
export const uiFr = {
  toDarkMode: 'Passer au mode sombre',
  toLightMode: 'Passer au mode clair',
  darkMode: 'Mode sombre',
  lightMode: 'Mode clair',
  closeViewer: 'Fermer la visionneuse',
  prevPhoto: 'Photo précédente',
  nextPhoto: 'Photo suivante',
  viewerAria: 'Visionneuse photo {index} sur {total}',
  photoAlt: 'Photo {index} sur {total}',
  viewerHintMany:
    '{index} / {total} — flèches du clavier pour défiler · Échap pour fermer',
  viewerHintOne: 'Échap pour fermer',
} as const;

export const uiEn = {
  toDarkMode: 'Switch to dark mode',
  toLightMode: 'Switch to light mode',
  darkMode: 'Dark mode',
  lightMode: 'Light mode',
  closeViewer: 'Close the viewer',
  prevPhoto: 'Previous photo',
  nextPhoto: 'Next photo',
  viewerAria: 'Photo viewer {index} of {total}',
  photoAlt: 'Photo {index} of {total}',
  viewerHintMany:
    '{index} / {total} — arrow keys to scroll · Esc to close',
  viewerHintOne: 'Esc to close',
} as const;
