// Fiche détaillée d'un candidat (modèle / véhicule) : identité, détails
// véhicule, données constructeur, avis, commentaires et photos.
export const candidateDetailFr = {
  // Erreurs & messages
  invalid: 'Invalide',
  parentNotFound:
    'Le modèle racine choisi est introuvable dans ce dossier. Enregistrez d’abord la racine ou choisissez une autre fiche.',
  errUpdateSheet: 'Mise à jour de la fiche modèle',
  specsInvalid: 'Données constructeur invalides',
  errSaveSpecs: 'Enregistrement des données constructeur',
  reviewInvalid: 'Avis invalide',
  errSaveReview: 'Enregistrement de l’avis sur le modèle',
  commentInvalid: 'Commentaire invalide',
  errSendComment: 'Envoi d’un commentaire',
  toastPhotoCompressed: 'Photo envoyée (image compressée automatiquement)',
  typeNotAllowed: 'Type non autorisé (JPEG, PNG, WebP, GIF)',
  errUploadPhoto: 'Upload d’une photo pour le modèle',
  errCompressPhoto: 'Compression ou envoi de la photo',

  // Identité / fiche modèle
  modelSheet: 'Fiche modèle',
  attachedToRoot: 'Rattaché au modèle racine',
  rootNoParentOption: '— Racine (pas de parent) —',
  identity: 'Identité',
  brand: 'Marque',
  model: 'Modèle',
  baseVersion: 'Version de base',
  trimPlaceholderRoot: 'Vide = « Générique » (version de base)',
  yearPeriodGen: 'Année(s) / période / génération',
  datePlaceholder: 'ex. 2024, 2020-2023, printemps 2025',
  status: 'Statut',
  rejectReason: 'Raison si rejet',
  additionalVersion: 'Version complémentaire',
  trimPlaceholderChild: 'ex. finition, pack, motorisation…',
  parentMissingReadonly:
    'Parent introuvable : identité en lecture seule depuis cette ligne.',
  multipleVariations:
    'Plusieurs variations : ouvrez chaque ligne complément pour renseigner détails véhicule, données constructeur, photos et avis.',
  saveSheet: 'Enregistrer la fiche',
  links: 'Liens',

  // Détails du véhicule
  vehicleDetails: 'Détails du véhicule',
  empty: '(vide)',
  engine: 'Motorisation',
  price: 'Prix',
  mileage: 'Kilométrage (km)',
  mileagePlaceholder: 'ex. 45 000',
  firstRegistration: 'Mise en circulation',
  firstRegPlaceholder: 'ex. 12/03/2019, mars 2019…',
  energy: 'Énergie / carburant',
  energyPlaceholder: 'ex. Essence, Électrique…',
  gearbox: 'Boîte de vitesses',
  gearboxPlaceholder: 'ex. Automatique, Manuelle…',
  garageLabel: 'Garage / lieu',
  garagePlaceholder: 'Saisie libre ou choix dans la liste',
  options: 'Options',

  // Données constructeur
  manufacturerData: 'Données constructeur',
  specsHint:
    'Champs indicatifs (WLTP, NEDC ou données brochure). Les unités sont rappelées dans les libellés.',
  specsNotesPlaceholder: 'Norme, cycle, options, lien fiche PDF…',
  dimensionPlaceholder: 'ex. 4 620',
  saveSpecs: 'Enregistrer les données constructeur',

  // Avis
  myReview: 'Mon avis (0–10)',
  score: 'Note',
  reviewComment: 'Commentaire',
  pros: 'Points forts',
  cons: 'Points faibles',
  saveReview: 'Enregistrer mon avis',

  // Commentaires
  comments: 'Commentaires',
  emptySuffix: ' — vide',
  sendComment: 'Envoyer le commentaire',

  // Photos
  photosSummary:
    'Photos (max 5 Mo, JPEG/PNG/WebP/GIF — compression proposée si besoin)',
  photoCompressHint:
    'Si le fichier dépasse 5 Mo, vous pourrez le compresser automatiquement (JPEG, taille et qualité ajustées) avant envoi.',
  enlargePhoto: 'Agrandir la photo {index} sur {total}',

  // Boîte de dialogue « image trop volumineuse »
  imageTooLarge: 'Image trop volumineuse',
  oversizedIntro: 'Ce fichier fait environ',
  oversizedApproxSize: '{size} Mo',
  oversizedLimit: '(limite {limit} Mo). Vous pouvez le',
  oversizedCompressStrong: 'compresser automatiquement',
  oversizedSuffix:
    '(réduction des dimensions et qualité, export JPEG) pour l’envoyer.',
  oversizedNote:
    'Les GIF animés deviennent une image fixe. La transparence des PNG est remplacée par un fond.',
  compressing: 'Compression…',
  compressAndSend: 'Compresser et envoyer',
} as const;

export const candidateDetailEn = {
  // Errors & messages
  invalid: 'Invalid',
  parentNotFound:
    'The selected root model can’t be found in this folder. Save the root first or pick another sheet.',
  errUpdateSheet: 'Updating the model sheet',
  specsInvalid: 'Invalid manufacturer data',
  errSaveSpecs: 'Saving manufacturer data',
  reviewInvalid: 'Invalid review',
  errSaveReview: 'Saving the model review',
  commentInvalid: 'Invalid comment',
  errSendComment: 'Sending a comment',
  toastPhotoCompressed: 'Photo sent (image compressed automatically)',
  typeNotAllowed: 'Type not allowed (JPEG, PNG, WebP, GIF)',
  errUploadPhoto: 'Uploading a photo for the model',
  errCompressPhoto: 'Compressing or sending the photo',

  // Identity / model sheet
  modelSheet: 'Model sheet',
  attachedToRoot: 'Attached to root model',
  rootNoParentOption: '— Root (no parent) —',
  identity: 'Identity',
  brand: 'Brand',
  model: 'Model',
  baseVersion: 'Base version',
  trimPlaceholderRoot: 'Empty = "Generic" (base version)',
  yearPeriodGen: 'Year(s) / period / generation',
  datePlaceholder: 'e.g. 2024, 2020-2023, spring 2025',
  status: 'Status',
  rejectReason: 'Reason if rejected',
  additionalVersion: 'Additional version',
  trimPlaceholderChild: 'e.g. trim, pack, engine…',
  parentMissingReadonly:
    'Parent not found: identity is read-only from this row.',
  multipleVariations:
    'Multiple variations: open each complement row to fill in vehicle details, manufacturer data, photos and reviews.',
  saveSheet: 'Save sheet',
  links: 'Links',

  // Vehicle details
  vehicleDetails: 'Vehicle details',
  empty: '(empty)',
  engine: 'Engine',
  price: 'Price',
  mileage: 'Mileage (km)',
  mileagePlaceholder: 'e.g. 45 000',
  firstRegistration: 'First registration',
  firstRegPlaceholder: 'e.g. 12/03/2019, March 2019…',
  energy: 'Energy / fuel',
  energyPlaceholder: 'e.g. Petrol, Electric…',
  gearbox: 'Gearbox',
  gearboxPlaceholder: 'e.g. Automatic, Manual…',
  garageLabel: 'Garage / location',
  garagePlaceholder: 'Free text or pick from the list',
  options: 'Options',

  // Manufacturer data
  manufacturerData: 'Manufacturer data',
  specsHint:
    'Indicative fields (WLTP, NEDC or brochure data). Units are shown in the labels.',
  specsNotesPlaceholder: 'Standard, cycle, options, PDF sheet link…',
  dimensionPlaceholder: 'e.g. 4 620',
  saveSpecs: 'Save manufacturer data',

  // Review
  myReview: 'My review (0–10)',
  score: 'Score',
  reviewComment: 'Comment',
  pros: 'Pros',
  cons: 'Cons',
  saveReview: 'Save my review',

  // Comments
  comments: 'Comments',
  emptySuffix: ' — empty',
  sendComment: 'Send comment',

  // Photos
  photosSummary:
    'Photos (max 5 Mo, JPEG/PNG/WebP/GIF — compression offered if needed)',
  photoCompressHint:
    'If the file exceeds 5 Mo, you’ll be able to compress it automatically (JPEG, adjusted size and quality) before sending.',
  enlargePhoto: 'Enlarge photo {index} of {total}',

  // "Image too large" dialog
  imageTooLarge: 'Image too large',
  oversizedIntro: 'This file is about',
  oversizedApproxSize: '{size} Mo',
  oversizedLimit: '(limit {limit} Mo). You can',
  oversizedCompressStrong: 'automatically compress',
  oversizedSuffix:
    'it (reduced dimensions and quality, JPEG export) to send it.',
  oversizedNote:
    'Animated GIFs become a still image. PNG transparency is replaced with a background.',
  compressing: 'Compressing…',
  compressAndSend: 'Compress and send',
} as const;
