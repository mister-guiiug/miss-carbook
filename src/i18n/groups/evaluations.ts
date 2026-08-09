// Onglet Évaluations : matrice exigence × modèle avec vote MoSCoW et notes.
// fr et en de forme strictement identique ; feuilles = chaînes uniquement.
export const evaluationsFr = {
  // toasts & contextes d'erreur
  ctxLoad: 'Chargement de la matrice d’évaluation',
  ctxUpdateStatus: 'Mise à jour du statut d’évaluation (exigence / modèle)',
  ctxUpdateNote: 'Mise à jour de la note d’évaluation',
  toastNoteSaved: 'Note enregistrée',
  ctxSaveVote: 'Enregistrement du vote MoSCoW',
  toastVoteSaved: 'Vote MoSCoW enregistré',
  // état vide
  emptyTitle: 'Matrice d’évaluation non disponible',
  emptyBoth:
    'Ajoutez des exigences (onglet Exigences) et des modèles (onglet Modèles) pour remplir la matrice d’évaluation.',
  emptyReqs:
    'Ajoutez des exigences (onglet Exigences) pour remplir la matrice d’évaluation.',
  emptyCands:
    'Ajoutez des modèles (onglet Modèles) pour remplir la matrice d’évaluation.',
  // en-tête & filtres
  intro:
    'Pour chaque exigence : votre vote MoSCoW (priorisation) et, par modèle, si l’exigence est satisfaite.',
  hideLabel: 'Masquer',
  hideExcluded: 'Exclus',
  hideToSee: 'À voir',
  hideParents: 'Modèles pères',
  hideChildren: 'Modèles fils',
  shownCount: '{shown} / {total} affichés',
  // tableau
  colRequirement: 'Exigence',
  colMoscowYou: 'MoSCoW (vous)',
  colVotesAggregated: 'Votes agrégés',
  levelMandatoryShort: 'Obl.',
  levelDiscussShort: 'Disc.',
  statusUnknown: '?',
  statusOk: 'OK',
  statusPartial: 'Partiel',
  statusKo: 'Non',
  notePlaceholder: 'Note',
} as const;

export const evaluationsEn = {
  // toasts & error contexts
  ctxLoad: 'Loading the evaluation matrix',
  ctxUpdateStatus: 'Updating evaluation status (requirement / model)',
  ctxUpdateNote: 'Updating the evaluation note',
  toastNoteSaved: 'Note saved',
  ctxSaveVote: 'Saving the MoSCoW vote',
  toastVoteSaved: 'MoSCoW vote saved',
  // empty state
  emptyTitle: 'Evaluation matrix unavailable',
  emptyBoth:
    'Add requirements (Requirements tab) and models (Models tab) to fill the evaluation matrix.',
  emptyReqs:
    'Add requirements (Requirements tab) to fill the evaluation matrix.',
  emptyCands: 'Add models (Models tab) to fill the evaluation matrix.',
  // header & filters
  intro:
    'For each requirement: your MoSCoW vote (prioritisation) and, per model, whether the requirement is satisfied.',
  hideLabel: 'Hide',
  hideExcluded: 'Excluded',
  hideToSee: 'To see',
  hideParents: 'Parent models',
  hideChildren: 'Child models',
  shownCount: '{shown} / {total} shown',
  // table
  colRequirement: 'Requirement',
  colMoscowYou: 'MoSCoW (you)',
  colVotesAggregated: 'Aggregated votes',
  levelMandatoryShort: 'Mand.',
  levelDiscussShort: 'Disc.',
  statusUnknown: '?',
  statusOk: 'OK',
  statusPartial: 'Partial',
  statusKo: 'No',
  notePlaceholder: 'Note',
} as const;
