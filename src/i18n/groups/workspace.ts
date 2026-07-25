// Espace de travail (dossier) : page, onglets, barre d'outils, recherche,
// onboarding, cartes parcours / synthèse, exports. fr et en de forme identique.
export const workspaceFr = {
  // Onglets (libellés relocalisés depuis workspaceTabs.ts ; rendus via tab_<id>).
  tab_notepad: 'Bloc-notes',
  tab_requirements: 'Exigences',
  tab_requirementsMatrix: 'Matrice exigences',
  tab_evaluations: 'Évaluations',
  tab_weightedVoting: 'Votes pondérés',
  tab_candidates: 'Modèles',
  tab_compare: 'Comparer',
  tab_smartCompare: 'Assistant',
  tab_reminders: 'Visites et rappels',
  tab_budget: 'Budget et TCO',
  tab_activity: 'Activité',
  tab_settings: 'Réglages',
  tab_settings_title:
    'Nom du dossier, membres, invitations, partage — uniquement ce projet',
  tab_activity_title: 'Activité et historique de ce dossier',

  // Mots courts réutilisés inline (badges, menus).
  requirement: 'Exigence',
  model: 'Modèle',
  reminder: 'Rappel',
  visit: 'Visite',
  searchWord: 'recherche',
  colon: ' :',

  // Divers réutilisés.
  readOnly: 'Lecture seule',
  dontShowAgain: 'Ne plus afficher',
  activityOfWorkspace: 'Activité du dossier',

  // WorkspacePage.
  loadingWorkspaceSr: 'Chargement du dossier…',
  notFound: 'Dossier introuvable.',
  loadingSession: 'Chargement session…',
  backArrow: '← Retour',
  backHomeArrow: '← Retour à l’accueil',
  accessBlockedHelp:
    'Consultez la fenêtre d’erreur si besoin, ou retournez à l’accueil pour ouvrir un autre dossier.',
  readOnlyBannerText:
    ' — vous pouvez consulter ce dossier mais pas le modifier.',
  decisionRecordedTitle: 'Décision enregistrée',
  decisionBannerPrefix: ' : modèle retenu « ',
  decisionBannerSuffix: ' »',
  editInSettings: 'Modifier dans Réglages',
  breadcrumbLabel: 'Fil d’Ariane',
  home: 'Accueil',
  activityShortcutLabel: 'Raccourci activité du dossier',
  yourRoleTitle: 'Votre rôle dans ce dossier',
  roleAdmin: 'Administrateur',
  roleWrite: 'Édition',
  noDescription: 'Aucune description.',
  addDescription: 'Ajouter une description',
  withoutDescription: 'Sans description',
  hintMid1: ' du dossier et ',
  hintMid2: ' : menu en haut à droite (icône compte) ou loupe. ',
  hintEnd:
    ' : raccourci ici ou via ce menu. Compte et thème : même menu → paramètres généraux.',
  sections: 'Sections',
  sectionSelectLabel: 'Section du dossier',

  // WorkspaceSearchModal.
  searchDialogLabel: 'Recherche dossier',
  searchInWorkspace: 'Recherche dans le dossier',
  closeSearch: 'Fermer la recherche',
  searchPlaceholder: 'Exigence, modèle, rappel, visite…',
  shortcutCtrlK: 'Raccourci : Ctrl+K',

  // WorkspaceOnboarding.
  onboardWelcomeTitle: 'Bienvenue dans « {name} »',
  onboardStep1a:
    'Ce dossier est partagé en temps réel. Invitez des participants depuis l’onglet ',
  onboardStep1b:
    ' (code, lien ou invitation avec rôle et date d’expiration).',
  onboardStep2Title: 'Exigences, évaluations & modèles',
  onboardStep2a: 'Définissez vos critères dans ',
  onboardStep2b: ', ajoutez des véhicules dans ',
  onboardStep2c: ', reliez-les dans ',
  onboardStep2d: ' (statut + votes MoSCoW).',
  onboardStep3Title: 'Comparer, suivi & décision',
  onboardStep3a: ' : graphiques, profils de critères, impression. ',
  onboardStep3b:
    ' pour le suivi (essais, rappels, rendez-vous). Décision enregistrée dans ',
  letsGo: 'C’est parti',
  next: 'Suivant',
  stepOf: 'Étape {current} sur {total}',

  // WorkspaceHeaderToolbar.
  ctxLoadProfile: 'Chargement du pseudo (barre dossier)',
  profile: 'Profil',
  themeLight: 'Thème clair',
  themeDark: 'Thème sombre',
  addToWorkspace: 'Ajouter dans le dossier',
  quickAddNote: 'Note (bloc-notes)',
  searchTitleShortcut: 'Recherche — Ctrl+K ou ⌘K',
  openSearchInWorkspace: 'Ouvrir la recherche dans ce dossier',
  accountMenuTitle: '{name} — dossier, compte et navigation',
  accountMenuLabel: 'Menu dossier et compte',
  accountOnDevice: 'Compte sur cet appareil',
  thisWorkspace: 'Ce dossier',
  workspaceSettings: 'Réglages du dossier',
  homeMissCarbook: 'Accueil Miss Carbook',
  generalSettings: 'Paramètres généraux',
  signOut: 'Déconnexion',

  // WorkspaceJourneyCard.
  journeyTitle: 'Parcours suggéré',
  hide: 'Masquer',
  journeyStep1: '1. Exigences',
  journeyStep1Desc: '— définir vos critères',
  journeyStep2: '2. Modèles',
  journeyStep2Desc: '— ajouter les véhicules',
  journeyStep3: '3. Comparer',
  journeyStep3Desc: '— graphiques et synthèse',

  // WorkspaceDecisionSummaryCard.
  ctxSummaryReminders: 'Synthèse dossier (rappels)',
  overview: 'Vue d’ensemble',
  decision: 'Décision',
  decisionRecordedDetail: 'enregistrée — détail dans la bannière ci-dessus.',
  decisionNotSet: 'pas encore arrêtée.',
  saveInSettings: 'Enregistrer dans Réglages',
  pendingReminders: 'Rappels à faire',
  view: 'Voir',
  none: 'aucun',
  matrix: 'Matrice',
  matrixLink: 'Évaluations exigence × modèle',

  // ExportWorkspaceButton.
  ctxExportZip: 'Export ZIP du dossier',
  exportBusy: 'Export du dossier en cours…',
  exportLabel: 'Exporter le dossier (archive ZIP JSON)',
  exportDesc:
    'Archive locale : données du dossier (exigences, modèles, matrice, votes, visites, rappels, invitations, membres, presets, véhicule actuel, commentaires, avis, métadonnées des pièces jointes). Pas de photos binaires.',

  // ExportWorkspacePromptButton.
  toastMarkdownExported:
    'Export Markdown téléchargé — prêt à coller dans une IA',
  ctxExportPrompt: 'Export contexte IA (Markdown)',
  exportPromptBusy: 'Préparation du fichier pour l’IA…',
  exportPromptLabel: 'Exporter le contexte pour une IA (Markdown)',
  exportPromptDescA: 'Un seul fichier ',
  exportPromptDescB:
    ' : exigences, modèles, matrice, votes, avis, commentaires, bloc-notes, rappels, journal (extrait), sans jetons d’invitation ni code de partage. Vérifiez ce que vous collez dans des services tiers.',
} as const;

export const workspaceEn = {
  // Tabs (labels relocated from workspaceTabs.ts; rendered via tab_<id>).
  tab_notepad: 'Notepad',
  tab_requirements: 'Requirements',
  tab_requirementsMatrix: 'Requirements matrix',
  tab_evaluations: 'Evaluations',
  tab_weightedVoting: 'Weighted voting',
  tab_candidates: 'Models',
  tab_compare: 'Compare',
  tab_smartCompare: 'Assistant',
  tab_reminders: 'Visits and reminders',
  tab_budget: 'Budget and TCO',
  tab_activity: 'Activity',
  tab_settings: 'Settings',
  tab_settings_title:
    'Workspace name, members, invitations, sharing — this project only',
  tab_activity_title: 'Activity and history of this workspace',

  // Short words reused inline (badges, menus).
  requirement: 'Requirement',
  model: 'Model',
  reminder: 'Reminder',
  visit: 'Visit',
  searchWord: 'search',
  colon: ':',

  // Misc reused.
  readOnly: 'Read-only',
  dontShowAgain: 'Don’t show again',
  activityOfWorkspace: 'Workspace activity',

  // WorkspacePage.
  loadingWorkspaceSr: 'Loading the workspace…',
  notFound: 'Workspace not found.',
  loadingSession: 'Loading session…',
  backArrow: '← Back',
  backHomeArrow: '← Back to home',
  accessBlockedHelp:
    'Check the error window if needed, or go back home to open another workspace.',
  readOnlyBannerText: ' — you can view this workspace but not edit it.',
  decisionRecordedTitle: 'Decision recorded',
  decisionBannerPrefix: ': retained model “ ',
  decisionBannerSuffix: ' ”',
  editInSettings: 'Edit in Settings',
  breadcrumbLabel: 'Breadcrumb',
  home: 'Home',
  activityShortcutLabel: 'Workspace activity shortcut',
  yourRoleTitle: 'Your role in this workspace',
  roleAdmin: 'Administrator',
  roleWrite: 'Editor',
  noDescription: 'No description.',
  addDescription: 'Add a description',
  withoutDescription: 'No description',
  hintMid1: ' for the workspace and ',
  hintMid2: ': top-right menu (account icon) or magnifier. ',
  hintEnd:
    ': shortcut here or via that menu. Account and theme: same menu → general settings.',
  sections: 'Sections',
  sectionSelectLabel: 'Workspace section',

  // WorkspaceSearchModal.
  searchDialogLabel: 'Workspace search',
  searchInWorkspace: 'Search in the workspace',
  closeSearch: 'Close search',
  searchPlaceholder: 'Requirement, model, reminder, visit…',
  shortcutCtrlK: 'Shortcut: Ctrl+K',

  // WorkspaceOnboarding.
  onboardWelcomeTitle: 'Welcome to “{name}”',
  onboardStep1a:
    'This workspace is shared in real time. Invite participants from the ',
  onboardStep1b:
    ' tab (code, link or invitation with role and expiry date).',
  onboardStep2Title: 'Requirements, evaluations & models',
  onboardStep2a: 'Define your criteria in ',
  onboardStep2b: ', add vehicles in ',
  onboardStep2c: ', link them in ',
  onboardStep2d: ' (status + MoSCoW votes).',
  onboardStep3Title: 'Compare, tracking & decision',
  onboardStep3a: ': charts, criteria profiles, printing. ',
  onboardStep3b:
    ' for tracking (test drives, reminders, appointments). Decision recorded in ',
  letsGo: 'Let’s go',
  next: 'Next',
  stepOf: 'Step {current} of {total}',

  // WorkspaceHeaderToolbar.
  ctxLoadProfile: 'Loading nickname (workspace bar)',
  profile: 'Profile',
  themeLight: 'Light theme',
  themeDark: 'Dark theme',
  addToWorkspace: 'Add to workspace',
  quickAddNote: 'Note (notepad)',
  searchTitleShortcut: 'Search — Ctrl+K or ⌘K',
  openSearchInWorkspace: 'Open search in this workspace',
  accountMenuTitle: '{name} — workspace, account and navigation',
  accountMenuLabel: 'Workspace and account menu',
  accountOnDevice: 'Account on this device',
  thisWorkspace: 'This workspace',
  workspaceSettings: 'Workspace settings',
  homeMissCarbook: 'Miss Carbook home',
  generalSettings: 'General settings',
  signOut: 'Sign out',

  // WorkspaceJourneyCard.
  journeyTitle: 'Suggested path',
  hide: 'Hide',
  journeyStep1: '1. Requirements',
  journeyStep1Desc: '— define your criteria',
  journeyStep2: '2. Models',
  journeyStep2Desc: '— add the vehicles',
  journeyStep3: '3. Compare',
  journeyStep3Desc: '— charts and summary',

  // WorkspaceDecisionSummaryCard.
  ctxSummaryReminders: 'Workspace summary (reminders)',
  overview: 'Overview',
  decision: 'Decision',
  decisionRecordedDetail: 'recorded — details in the banner above.',
  decisionNotSet: 'not decided yet.',
  saveInSettings: 'Save in Settings',
  pendingReminders: 'Pending reminders',
  view: 'View',
  none: 'none',
  matrix: 'Matrix',
  matrixLink: 'Requirement × model evaluations',

  // ExportWorkspaceButton.
  ctxExportZip: 'Workspace ZIP export',
  exportBusy: 'Exporting the workspace…',
  exportLabel: 'Export the workspace (ZIP JSON archive)',
  exportDesc:
    'Local archive: workspace data (requirements, models, matrix, votes, visits, reminders, invitations, members, presets, current vehicle, comments, reviews, attachment metadata). No binary photos.',

  // ExportWorkspacePromptButton.
  toastMarkdownExported:
    'Markdown export downloaded — ready to paste into an AI',
  ctxExportPrompt: 'AI context export (Markdown)',
  exportPromptBusy: 'Preparing the file for the AI…',
  exportPromptLabel: 'Export the context for an AI (Markdown)',
  exportPromptDescA: 'A single ',
  exportPromptDescB:
    ' file: requirements, models, matrix, votes, reviews, comments, notepad, reminders, activity log (excerpt), without invitation tokens or share code. Check what you paste into third-party services.',
} as const;
