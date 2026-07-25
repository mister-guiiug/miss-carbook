// Onglet « Modèles candidats » d'un dossier : arbre racine / compléments,
// fiche (carte), formulaire d'ajout, éditeur de liens constructeur.
// Groupé par zone (tab, card, add, links) ; fr et en de forme identique.
export const candidatesFr = {
  tab: {
    toastDeletedSubtree: 'Fiche et {count} complément(s) supprimés',
    toastDeleted: 'Fiche modèle supprimée',
    ctxDelete: 'Suppression d’une fiche modèle',
    toastOrderUpdated: 'Ordre des modèles mis à jour',
    ctxReorder: 'Réordonnancement des modèles candidats',
    helpRootPrefix: 'Le ',
    helpRootWord: 'modèle racine',
    helpShows: ' affiche une',
    helpBaseWord: 'version de base',
    helpGenericMid: ' (« Générique » si le champ est vide) ; chaque ',
    helpComplementWord: 'complément',
    helpCarries: ' porte une version complémentaire. Tant qu’il n’y a pas ',
    helpMultipleWord: 'plusieurs compléments',
    helpDetailsSuffix:
      ', les détails (motorisation, prix, etc.) restent sur la même fiche ; avec au moins deux compléments, seules ces lignes portent les détails comparables.',
    helpDragWord: 'Glisser-déposer',
    helpDragSuffix:
      ' la poignée pour ordonner les racines entre elles ou les compléments d’un même modèle.',
    warnLabel: 'Attention :',
    orphanWarn:
      ' {count} complément(s) référencent un parent absent (supprimé ou incohérent). Rattachez-les à une racine depuis le détail ou supprimez-les.',
    reviewsNote:
      'Les avis agrégés pour la comparaison proviennent des notes saisies ci-dessous ({count} entrées chargées).',
    confirmDeleteTitle: 'Confirmer la suppression',
    confirmDeletePrefix: 'Supprimer la fiche',
    confirmDeleteSuffix: ' ? Cette action est définitive.',
    subtreeDeleteNote:
      '{count} fiche(s) au total seront supprimées (compléments et sous-fiches inclus).',
    deleting: 'Suppression en cours',
  },
  card: {
    reorderAria: 'Réordonner : {label}',
    reorderTitle: 'Glisser pour réordonner',
    orphanComplement: 'complément orphelin',
    complement: 'complément',
    missingParentTitle:
      'Le parent référencé est absent : rattachez cette fiche à une racine dans le détail.',
    missingParentBadge: 'Parent manquant',
    complementPrefix: 'Complément ·',
    duplicate: 'Dupliquer ce modèle',
    deleteAria: 'Supprimer la fiche « {label} »',
    closeDetail: 'Fermer le détail',
    showDetail: 'Afficher le détail',
  },
  add: {
    importCsvSummary: 'Import CSV',
    csvHint:
      'Première ligne : brand, model (obligatoires), trim, engine, price… Séparateur virgule.',
    newModelSummary: 'Nouveau modèle ou variation',
    parentLabel: 'Modèle racine (optionnel)',
    parentNone: '— Aucun (nouveau modèle racine) —',
    parentHelpVariation:
      'Ici : la marque et le modèle viennent du racine ; précisez la version complémentaire, la motorisation et le prix pour cette ligne.',
    parentHelpRoot:
      'Le racine porte surtout marque, modèle et version / période ; le reste est regroupé sous « Détails » tant qu’il n’y a pas plusieurs variations.',
    sectionIdentity: 'Identité',
    brand: 'Marque',
    inheritedFromRoot: 'Hérité du modèle racine',
    model: 'Modèle',
    baseVersion: 'Version de base',
    periodLabel: 'Année(s) / période / génération',
    extraVersion: 'Version complémentaire',
    trimPlaceholder: 'ex. finition, pack, motorisation…',
    baseVersionPlaceholder: 'Vide = « Générique » (version de base)',
    periodPlaceholder: 'ex. 2024, 2020-2023, printemps 2025',
    orphanParentHint:
      'Parent introuvable dans la liste : indiquez au moins la version complémentaire.',
    sectionVariationDetails: 'Détails de la variation',
    engine: 'Motorisation',
    price: 'Prix',
    garageLabel: 'Garage / lieu',
    garagePlaceholder: 'Saisie libre ou choix dans la liste',
    options: 'Options',
    status: 'Statut',
    rejectReason: 'Raison si rejet',
    rootNoDetails:
      'Pour une racine : pas de détails véhicule ni données constructeur — ajoutez des compléments pour motorisation, prix, fiche technique et photos.',
  },
  links: {
    legend: 'Liens (constructeur, fiche technique…)',
    addLink: 'Ajouter un lien',
    empty:
      'Aucun lien pour l’instant. Utilisez « Ajouter un lien » puis enregistrez la fiche.',
    labelField: 'Libellé (optionnel)',
    labelPlaceholder: 'ex. Configurateur, Brochure PDF',
    url: 'URL',
    removeLink: 'Supprimer le lien {n}',
    preview: 'Aperçu (cliquable)',
  },
} as const;

export const candidatesEn = {
  tab: {
    toastDeletedSubtree: 'Card and {count} sub-entry(ies) deleted',
    toastDeleted: 'Model card deleted',
    ctxDelete: 'Deleting a model card',
    toastOrderUpdated: 'Model order updated',
    ctxReorder: 'Reordering candidate models',
    helpRootPrefix: 'The ',
    helpRootWord: 'root model',
    helpShows: ' shows a',
    helpBaseWord: 'base version',
    helpGenericMid: ' (“Generic” if the field is empty); each ',
    helpComplementWord: 'sub-entry',
    helpCarries: ' carries an extra version. As long as there aren’t ',
    helpMultipleWord: 'multiple sub-entries',
    helpDetailsSuffix:
      ', details (engine, price, etc.) stay on the same card; with at least two sub-entries, only those rows carry the comparable details.',
    helpDragWord: 'Drag and drop',
    helpDragSuffix:
      ' the handle to order roots among themselves or sub-entries of the same model.',
    warnLabel: 'Warning:',
    orphanWarn:
      ' {count} sub-entry(ies) reference a missing parent (deleted or inconsistent). Reattach them to a root from the detail or delete them.',
    reviewsNote:
      'The aggregated reviews used for comparison come from the notes entered below ({count} entries loaded).',
    confirmDeleteTitle: 'Confirm deletion',
    confirmDeletePrefix: 'Delete the card',
    confirmDeleteSuffix: '? This action is permanent.',
    subtreeDeleteNote:
      '{count} card(s) in total will be deleted (sub-entries and sub-cards included).',
    deleting: 'Deleting',
  },
  card: {
    reorderAria: 'Reorder: {label}',
    reorderTitle: 'Drag to reorder',
    orphanComplement: 'orphan sub-entry',
    complement: 'sub-entry',
    missingParentTitle:
      'The referenced parent is missing: reattach this card to a root in the detail.',
    missingParentBadge: 'Missing parent',
    complementPrefix: 'Sub-entry ·',
    duplicate: 'Duplicate this model',
    deleteAria: 'Delete the card “{label}”',
    closeDetail: 'Close detail',
    showDetail: 'Show detail',
  },
  add: {
    importCsvSummary: 'Import CSV',
    csvHint:
      'First row: brand, model (required), trim, engine, price… Comma separator.',
    newModelSummary: 'New model or variation',
    parentLabel: 'Root model (optional)',
    parentNone: '— None (new root model) —',
    parentHelpVariation:
      'Here: the brand and model come from the root; specify the extra version, engine and price for this row.',
    parentHelpRoot:
      'The root mainly carries brand, model and version / period; the rest is grouped under “Details” until there are multiple variations.',
    sectionIdentity: 'Identity',
    brand: 'Brand',
    inheritedFromRoot: 'Inherited from the root model',
    model: 'Model',
    baseVersion: 'Base version',
    periodLabel: 'Year(s) / period / generation',
    extraVersion: 'Extra version',
    trimPlaceholder: 'e.g. trim, pack, engine…',
    baseVersionPlaceholder: 'Empty = “Generic” (base version)',
    periodPlaceholder: 'e.g. 2024, 2020-2023, spring 2025',
    orphanParentHint:
      'Parent not found in the list: enter at least the extra version.',
    sectionVariationDetails: 'Variation details',
    engine: 'Engine',
    price: 'Price',
    garageLabel: 'Garage / location',
    garagePlaceholder: 'Free text or pick from the list',
    options: 'Options',
    status: 'Status',
    rejectReason: 'Reason if rejected',
    rootNoDetails:
      'For a root: no vehicle details or manufacturer data — add sub-entries for engine, price, specs and photos.',
  },
  links: {
    legend: 'Links (manufacturer, specs…)',
    addLink: 'Add a link',
    empty: 'No links yet. Use “Add a link” then save the card.',
    labelField: 'Label (optional)',
    labelPlaceholder: 'e.g. Configurator, PDF brochure',
    url: 'URL',
    removeLink: 'Delete link {n}',
    preview: 'Preview (clickable)',
  },
} as const;
