// Onglet Votes pondérés : votes par exigence / modèle et poids de vote des membres.
// fr et en de forme strictement identique ; feuilles = chaînes uniquement.
export const votingFr = {
  // toasts & contextes d'erreur
  ctxLoad: 'Chargement des votes pondérés',
  ctxUpdateVote: 'Mise à jour du vote pondéré',
  toastVoteSaved: 'Vote enregistré',
  // état vide global
  emptyTitle: 'Votes pondérés non disponibles',
  emptyText: 'Ajoutez des exigences ou des modèles pour commencer à voter.',
  // en-tête & onglets
  intro:
    'Attribuez des poids à vos votes. Les membres avec un poids de vote plus élevé ont plus d’influence sur le score final.',
  tabRequirements: 'Exigences',
  tabModels: 'Modèles',
  tabWeights: 'Poids des membres',
  myWeightBefore: 'Votre poids de vote : ',
  // sous-onglet exigences
  reqEmptyTitle: 'Aucune exigence',
  reqEmptyText: 'Ajoutez des exigences dans l’onglet Exigences pour commencer.',
  reqSectionTitle: 'Votes pondérés par exigence',
  reqSectionHint:
    'Attribuez un poids de 0 à 10 pour chaque exigence. Le score final est calculé en pondérant les votes de tous les membres.',
  levelMandatoryShort: 'Obl.',
  levelDiscussShort: 'Disc.',
  yourVoteLabel: 'Votre vote :',
  finalScoreLabel: 'Score final :',
  // sous-onglet modèles
  candEmptyTitle: 'Aucun modèle',
  candEmptyText: 'Ajoutez des modèles dans l’onglet Modèles pour commencer.',
  candSectionTitle: 'Votes pondérés par modèle',
  candSectionHint:
    'Attribuez un poids de 0 à 10 pour chaque modèle selon la catégorie choisie.',
  yourVoteCategoryLabel: 'Votre vote ({category}) :',
  // sous-onglet poids des membres
  weightsSectionTitle: 'Poids de vote des membres',
  weightsSectionHint:
    'Les administrateurs peuvent modifier le poids de vote de chaque membre. Par défaut, tous les membres ont un poids de 1.',
  youSuffix: '(vous)',
  weightLabel: 'Poids :',
  // catégories de vote par modèle
  categoryOverall: 'Global',
  categoryDesign: 'Design',
  categoryPerformance: 'Performances',
  categoryComfort: 'Confort',
  categoryValue: 'Rapport qualité/prix',
  categoryReliability: 'Fiabilité',
} as const;

export const votingEn = {
  // toasts & error contexts
  ctxLoad: 'Loading the weighted votes',
  ctxUpdateVote: 'Updating the weighted vote',
  toastVoteSaved: 'Vote saved',
  // global empty state
  emptyTitle: 'Weighted votes unavailable',
  emptyText: 'Add requirements or models to start voting.',
  // header & tabs
  intro:
    'Assign weights to your votes. Members with a higher voting weight have more influence on the final score.',
  tabRequirements: 'Requirements',
  tabModels: 'Models',
  tabWeights: 'Member weights',
  myWeightBefore: 'Your voting weight: ',
  // requirements sub-tab
  reqEmptyTitle: 'No requirements',
  reqEmptyText: 'Add requirements in the Requirements tab to get started.',
  reqSectionTitle: 'Weighted votes by requirement',
  reqSectionHint:
    'Assign a weight from 0 to 10 for each requirement. The final score is calculated by weighting all members’ votes.',
  levelMandatoryShort: 'Mand.',
  levelDiscussShort: 'Disc.',
  yourVoteLabel: 'Your vote:',
  finalScoreLabel: 'Final score:',
  // models sub-tab
  candEmptyTitle: 'No models',
  candEmptyText: 'Add models in the Models tab to get started.',
  candSectionTitle: 'Weighted votes by model',
  candSectionHint:
    'Assign a weight from 0 to 10 for each model based on the chosen category.',
  yourVoteCategoryLabel: 'Your vote ({category}):',
  // member weights sub-tab
  weightsSectionTitle: 'Members’ voting weight',
  weightsSectionHint:
    'Administrators can change each member’s voting weight. By default, all members have a weight of 1.',
  youSuffix: '(you)',
  weightLabel: 'Weight:',
  // per-model vote categories
  categoryOverall: 'Overall',
  categoryDesign: 'Design',
  categoryPerformance: 'Performance',
  categoryComfort: 'Comfort',
  categoryValue: 'Value for money',
  categoryReliability: 'Reliability',
} as const;
