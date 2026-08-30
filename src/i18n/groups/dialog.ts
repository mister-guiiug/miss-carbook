// Boîte de dialogue d'erreur partagée (ErrorDialogProvider).
// Le libellé de l'action unique vient du socle (« OK », clé `confirm.ok`,
// identique en français et en anglais) : il n'a pas de clé ici.
export const dialogFr = {
  title: 'Problème',
  hideDetails: 'Masquer les détails techniques',
  showDetails: 'Afficher les détails techniques (copie support)',
  copied: 'Détails copiés dans le presse-papiers',
  copyDetails: 'Copier les détails techniques dans le presse-papiers',
} as const;

export const dialogEn = {
  title: 'Problem',
  hideDetails: 'Hide technical details',
  showDetails: 'Show technical details (support copy)',
  copied: 'Details copied to clipboard',
  copyDetails: 'Copy technical details to clipboard',
} as const;
