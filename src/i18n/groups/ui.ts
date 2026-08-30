// Primitives d'interface : visionneuse photo.
export const uiFr = {
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
  closeViewer: 'Close the viewer',
  prevPhoto: 'Previous photo',
  nextPhoto: 'Next photo',
  viewerAria: 'Photo viewer {index} of {total}',
  photoAlt: 'Photo {index} of {total}',
  viewerHintMany: '{index} / {total} — arrow keys to scroll · Esc to close',
  viewerHintOne: 'Esc to close',
} as const;
