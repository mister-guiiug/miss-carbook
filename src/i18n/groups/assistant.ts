// Assistant d'accueil : visite guidée (5 étapes), overlay d'invitation, coquille.
export const assistantFr = {
  stepMeta: 'Étape {index} sur {count}',
  next: 'Suivant',
  goHome: 'Aller à l’accueil',
  passAll: 'Passer tout',
  neverShow: 'Ne plus proposer',
  reqLabel: 'Exigences',
  modelsLabel: 'Modèles',
  settingsLabel: 'Réglages',

  welcomeTitle: 'Bienvenue sur Miss Carbook',
  whatTitle: 'Ce que vous ferez ici',
  accountTitle: 'Votre compte',
  createTitle: 'Créer ou rejoindre un dossier',
  doneTitle: 'C’est parti',

  welcomeBody:
    'Un carnet partagé pour comparer des véhicules, structurer vos exigences et décider à plusieurs sans vous perdre dans les messages.',
  whatReqText: ' — ce qui compte vraiment pour vous.',
  whatModelsText: ' — les véhicules étudiés, photos et avis.',
  whatCompareLabel: 'Comparer & décider',
  whatCompareText: ' — synthèse et trace des choix.',
  accountBody1: 'Votre ',
  accountPseudo: 'pseudo',
  accountBody2:
    ' est visible par les autres membres d’un dossier. Associez un ',
  accountEmail: 'e-mail',
  accountBody3:
    ' depuis l’accueil ou les paramètres pour recevoir un lien et vous reconnecter sur un autre appareil.',
  createBody1: 'Sur l’',
  createHome: 'accueil',
  createBody2:
    ', créez un dossier (projet véhicule) ou rejoignez-en un avec un ',
  createShareCode: 'code de partage',
  createBody3: '. Vous pourrez inviter d’autres personnes ensuite.',
  doneBody:
    'Retournez à l’accueil pour créer votre premier dossier ou ouvrir un dossier existant.',

  inviteTitle1: 'Vous rejoignez ce dossier',
  inviteBody1a: 'Vous avez accepté une invitation pour « ',
  inviteBody1b:
    ' ». Les membres voient les mêmes exigences, modèles et messages en temps réel.',
  inviteTitle2: 'Par où commencer ?',
  inviteExplore: 'Explorer le dossier',
  inviteReqText: ' — comprendre les critères du groupe.',
  inviteModelsText: ' — voir les véhicules envisagés.',
  inviteSettingsText: ' — votre rôle, code de partage, invitations.',
} as const;

export const assistantEn = {
  stepMeta: 'Step {index} of {count}',
  next: 'Next',
  goHome: 'Go to home',
  passAll: 'Skip all',
  neverShow: 'Don’t show again',
  reqLabel: 'Requirements',
  modelsLabel: 'Models',
  settingsLabel: 'Settings',

  welcomeTitle: 'Welcome to Miss Carbook',
  whatTitle: 'What you’ll do here',
  accountTitle: 'Your account',
  createTitle: 'Create or join a workspace',
  doneTitle: 'Let’s go',

  welcomeBody:
    'A shared logbook to compare vehicles, structure your requirements and decide together without getting lost in messages.',
  whatReqText: ' — what really matters to you.',
  whatModelsText: ' — the vehicles studied, photos and reviews.',
  whatCompareLabel: 'Compare & decide',
  whatCompareText: ' — a summary and a record of choices.',
  accountBody1: 'Your ',
  accountPseudo: 'nickname',
  accountBody2:
    ' is visible to the other members of a workspace. Link an ',
  accountEmail: 'email',
  accountBody3:
    ' from home or settings to receive a link and sign back in on another device.',
  createBody1: 'On the ',
  createHome: 'home page',
  createBody2:
    ', create a workspace (vehicle project) or join one with a ',
  createShareCode: 'share code',
  createBody3: '. You can invite other people afterwards.',
  doneBody:
    'Go back to home to create your first workspace or open an existing one.',

  inviteTitle1: 'You’re joining this workspace',
  inviteBody1a: 'You’ve accepted an invitation to “',
  inviteBody1b:
    '”. Members see the same requirements, models and messages in real time.',
  inviteTitle2: 'Where to start?',
  inviteExplore: 'Explore the workspace',
  inviteReqText: ' — understand the group’s criteria.',
  inviteModelsText: ' — see the vehicles under consideration.',
  inviteSettingsText: ' — your role, share code, invitations.',
} as const;
