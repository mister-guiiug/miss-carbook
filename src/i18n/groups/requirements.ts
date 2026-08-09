// Onglet Exigences + matrice des exigences (critères, filtres, scores, export CSV).
// fr et en de forme strictement identique ; feuilles = chaînes uniquement.
export const requirementsFr = {
  // RequirementsTab — toasts & contextes d'erreur
  ctxLoad: 'Chargement des exigences',
  toastReordered: 'Ordre des exigences mis à jour',
  ctxReorder: 'Réordonnancement des exigences',
  invalid: 'Invalide',
  toastAdded: 'Exigence ajoutée',
  ctxAdd: 'Ajout d’une exigence',
  toastUpdated: 'Exigence mise à jour',
  ctxUpdate: 'Mise à jour d’une exigence',
  confirmDelete:
    'Supprimer cette exigence ? Les notes de matrice liées seront aussi supprimées.',
  ctxDelete: 'Suppression d’une exigence',
  toastDeleted: 'Exigence supprimée',
  // RequirementsTab — intro & synthèse
  intro:
    'Définissez les critères du projet. Vous pouvez les modifier à tout moment ; la matrice d’évaluation et les votes suivent les libellés et niveaux à jour.',
  summaryReqOne: 'exigence',
  summaryReqMany: 'exigences',
  summaryMandatoryOne: 'obligatoire',
  summaryMandatoryMany: 'obligatoires',
  summaryDiscuss: 'à discuter',
  // RequirementsTab — filtres
  filterAria: 'Filtrer par niveau',
  filterAll: 'Toutes',
  filterMandatory: 'Obligatoires',
  filterDiscuss: 'À discuter',
  reorderHintBefore: 'Glisser-déposer pour réordonner : affichez ',
  reorderHintAll: 'Toutes',
  reorderHintAfter: ' les exigences.',
  // RequirementsTab — formulaire
  addButton: 'Ajouter une exigence',
  addTitle: 'Nouvelle exigence',
  closeAddForm: 'Fermer le formulaire d’ajout',
  labelField: 'Libellé',
  levelField: 'Niveau',
  levelMandatory: 'Obligatoire',
  levelDiscuss: 'À discuter',
  weightField: 'Poids (optionnel)',
  tagsField: 'Tags (virgules)',
  adding: 'Ajout…',
  // RequirementsTab — états vides
  emptyTitle: 'Aucune exigence définie',
  emptyText:
    'Utilisez le bouton « Ajouter une exigence » pour créer des critères (obligatoires ou à discuter) et structurer la comparaison des modèles.',
  emptyFilterTitle: 'Aucune exigence pour ce filtre',
  emptyFilterText: 'Changez de filtre ou créez une entrée de ce niveau.',
  // RequirementsTab — édition
  editAria: 'Modifier {label}',
  editingBadgeBefore: 'Modification · ',
  editingKbd: 'Échap',
  editingBadgeAfter: ' pour annuler',
  cancelEdit: 'Annuler la modification',
  reorderAria: 'Réordonner : {label}',
  reorderTitleActive: 'Glisser pour réordonner',
  reorderTitleDisabled: 'Réordonner : affichez « Toutes » les exigences',
  weightInline: ' · poids {weight}',
  tagsInline: 'Tags : {tags}',
  noDescription: 'Sans description',
  editReqAria: 'Modifier l’exigence « {label} »',
  deleteReqAria: 'Supprimer l’exigence « {label} »',
  // RequirementsMatrix — toasts & contextes
  ctxLoadMatrix: 'Chargement de la matrice des exigences',
  ctxUpdateStatus: 'Mise à jour du statut',
  toastCsvExported: 'Export CSV téléchargé',
  // RequirementsMatrix — états vides
  matrixEmptyTitle: 'Matrice non disponible',
  matrixEmptyBoth:
    'Ajoutez des exigences (onglet Exigences) et des modèles (onglet Modèles) pour remplir la matrice.',
  matrixEmptyReqs:
    'Ajoutez des exigences (onglet Exigences) pour remplir la matrice.',
  matrixEmptyCands:
    'Ajoutez des modèles (onglet Modèles) pour remplir la matrice.',
  // RequirementsMatrix — en-tête & barre d'outils
  matrixTitle: 'Matrice des exigences',
  hideFilters: 'Masquer les filtres',
  showFiltersLabel: 'Afficher les filtres',
  exportCsvLabel: 'Exporter en CSV',
  viewFull: 'Complète',
  viewCompact: 'Compacte',
  viewScores: 'Scores',
  // RequirementsMatrix — filtres
  filterLevelLabel: 'Niveau d’exigence',
  filterStatusLabel: 'Statut des modèles',
  statusAll: 'Tous',
  statusToSee: 'À voir',
  statusTried: 'Essayés',
  statusShortlist: 'Shortlist',
  statusSelected: 'Sélectionné',
  statusRejected: 'Exclus',
  hideExcluded: 'Masquer les exclus',
  hideToSee: 'Masquer les « À voir »',
  filterCounts:
    '{shownReqs} / {totalReqs} exigences · {shownCands} / {totalCands} modèles affichés',
  // RequirementsMatrix — scores
  scoresTitle: 'Scores pondérés par modèle',
  scoresHint:
    'Score basé sur les évaluations (OK=1, Partiel=0.5, Non=0) et le poids de chaque exigence.',
  scoresNoModels: 'Aucun modèle à afficher avec les filtres actuels.',
  satisfiedCount: '{ok} / {total} satisfaites',
  // RequirementsMatrix — tableau
  colRequirement: 'Exigence',
  colLevel: 'Niveau',
  colWeight: 'Poids',
  levelMandatoryShort: 'Obl.',
  levelDiscussShort: 'Disc.',
  statusUnknown: '?',
  statusOk: 'OK',
  statusPartial: 'Partiel',
  statusKo: 'Non',
} as const;

export const requirementsEn = {
  // RequirementsTab — toasts & error contexts
  ctxLoad: 'Loading requirements',
  toastReordered: 'Requirements order updated',
  ctxReorder: 'Reordering requirements',
  invalid: 'Invalid',
  toastAdded: 'Requirement added',
  ctxAdd: 'Adding a requirement',
  toastUpdated: 'Requirement updated',
  ctxUpdate: 'Updating a requirement',
  confirmDelete:
    'Delete this requirement? Linked matrix notes will also be deleted.',
  ctxDelete: 'Deleting a requirement',
  toastDeleted: 'Requirement deleted',
  // RequirementsTab — intro & summary
  intro:
    'Define the project criteria. You can edit them at any time; the evaluation matrix and votes follow the current labels and levels.',
  summaryReqOne: 'requirement',
  summaryReqMany: 'requirements',
  summaryMandatoryOne: 'mandatory',
  summaryMandatoryMany: 'mandatory',
  summaryDiscuss: 'to discuss',
  // RequirementsTab — filters
  filterAria: 'Filter by level',
  filterAll: 'All',
  filterMandatory: 'Mandatory',
  filterDiscuss: 'To discuss',
  reorderHintBefore: 'Drag and drop to reorder: show ',
  reorderHintAll: 'All',
  reorderHintAfter: ' requirements.',
  // RequirementsTab — form
  addButton: 'Add a requirement',
  addTitle: 'New requirement',
  closeAddForm: 'Close the add form',
  labelField: 'Label',
  levelField: 'Level',
  levelMandatory: 'Mandatory',
  levelDiscuss: 'To discuss',
  weightField: 'Weight (optional)',
  tagsField: 'Tags (commas)',
  adding: 'Adding…',
  // RequirementsTab — empty states
  emptyTitle: 'No requirements defined',
  emptyText:
    'Use the “Add a requirement” button to create criteria (mandatory or to discuss) and structure the comparison of models.',
  emptyFilterTitle: 'No requirements for this filter',
  emptyFilterText: 'Change the filter or create an entry of this level.',
  // RequirementsTab — editing
  editAria: 'Edit {label}',
  editingBadgeBefore: 'Editing · ',
  editingKbd: 'Esc',
  editingBadgeAfter: ' to cancel',
  cancelEdit: 'Cancel editing',
  reorderAria: 'Reorder: {label}',
  reorderTitleActive: 'Drag to reorder',
  reorderTitleDisabled: 'Reorder: show “All” requirements',
  weightInline: ' · weight {weight}',
  tagsInline: 'Tags: {tags}',
  noDescription: 'No description',
  editReqAria: 'Edit requirement “{label}”',
  deleteReqAria: 'Delete requirement “{label}”',
  // RequirementsMatrix — toasts & contexts
  ctxLoadMatrix: 'Loading the requirements matrix',
  ctxUpdateStatus: 'Updating status',
  toastCsvExported: 'CSV export downloaded',
  // RequirementsMatrix — empty states
  matrixEmptyTitle: 'Matrix unavailable',
  matrixEmptyBoth:
    'Add requirements (Requirements tab) and models (Models tab) to fill the matrix.',
  matrixEmptyReqs: 'Add requirements (Requirements tab) to fill the matrix.',
  matrixEmptyCands: 'Add models (Models tab) to fill the matrix.',
  // RequirementsMatrix — header & toolbar
  matrixTitle: 'Requirements matrix',
  hideFilters: 'Hide filters',
  showFiltersLabel: 'Show filters',
  exportCsvLabel: 'Export to CSV',
  viewFull: 'Full',
  viewCompact: 'Compact',
  viewScores: 'Scores',
  // RequirementsMatrix — filters
  filterLevelLabel: 'Requirement level',
  filterStatusLabel: 'Model status',
  statusAll: 'All',
  statusToSee: 'To see',
  statusTried: 'Tried',
  statusShortlist: 'Shortlist',
  statusSelected: 'Selected',
  statusRejected: 'Excluded',
  hideExcluded: 'Hide excluded',
  hideToSee: 'Hide “to see”',
  filterCounts:
    '{shownReqs} / {totalReqs} requirements · {shownCands} / {totalCands} models shown',
  // RequirementsMatrix — scores
  scoresTitle: 'Weighted scores by model',
  scoresHint:
    'Score based on the evaluations (OK=1, Partial=0.5, No=0) and the weight of each requirement.',
  scoresNoModels: 'No models to show with the current filters.',
  satisfiedCount: '{ok} / {total} satisfied',
  // RequirementsMatrix — table
  colRequirement: 'Requirement',
  colLevel: 'Level',
  colWeight: 'Weight',
  levelMandatoryShort: 'Mand.',
  levelDiscussShort: 'Disc.',
  statusUnknown: '?',
  statusOk: 'OK',
  statusPartial: 'Partial',
  statusKo: 'No',
} as const;
