// Paramètres généraux (compte, affichage, application, langue, visite guidée).
export const accountFr = {
  backHome: 'Retour à l’accueil',
  navAria: 'Navigation',
  scopeGlobal: 'Toute l’application',
  title: 'Paramètres généraux',
  leadBefore:
    'Compte, affichage sur cet appareil et outils d’application. Les dossiers de recherche se configurent dans chaque dossier, onglet ',
  leadSettingsTab: 'Réglages',
  leadAfter: '.',
  sectionAccount: 'Compte',
  pseudoTitle: 'Pseudo',
  pseudoHint: 'Visible dans les dossiers et les commentaires. ',
  pseudoLabel: 'Pseudo affiché',
  savePseudo: 'Enregistrer le pseudo',
  emailTitle: 'E-mail et connexion',
  emailIdentifier: 'Identifiant du compte',
  emailNotSet: 'non renseigné',
  resendMagic: 'Renvoyer un lien magique',
  newEmailLabel: 'Nouvelle adresse e-mail',
  requestEmailChange: 'Demander le changement d’e-mail',
  sectionDisplay: 'Affichage',
  themeHint:
    'Thème enregistré localement sur cet appareil. « Système » suit le réglage de votre appareil.',
  themeGroupAria: 'Choix du thème',
  themeLight: 'Clair',
  themeDark: 'Sombre',
  themeSystem: 'Système',
  languageTitle: 'Langue',
  languageHint: 'Langue de l’interface, enregistrée sur cet appareil.',
  languageGroupAria: 'Choix de la langue',
  langFr: 'Français',
  langEn: 'English',
  sectionApp: 'Application',
  updateTitle: 'Mise à jour',
  updateHint:
    'Après une mise en ligne du site, rechargez pour bénéficier de la dernière version. Sur navigateur ou PWA, le cache du service worker est réappliqué si nécessaire.',
  updateReadyTitle: 'Mise à jour disponible',
  updateReadyNote:
    ' — le bouton ci-dessous installera la nouvelle version puis rechargera la page.',
  reloading: 'Rechargement…',
  reloadLatest: 'Recharger vers la dernière version',
  tourTitle: 'Visite guidée',
  tourHint:
    'Réinitialise les écrans « déjà vus » (accueil, invitation, premier passage dans un dossier sur petit écran). Puis rouvrez l’accueil ou lancez la visite ci-dessous.',
  tourReset: 'Réinitialiser les indicateurs',
  tourStart: 'Lancer la visite d’accueil',
  otherApps: 'Nos autres applications',
  toastPseudoSaved: 'Pseudo mis à jour',
  toastEmailRequested: 'Demande de changement d’e-mail envoyée',
  toastMagicSent: 'Lien magique envoyé',
  toastTourReset: 'Visite guidée réinitialisée.',
  emailAlready: 'C’est déjà l’adresse enregistrée sur ce compte.',
  emailConfirmSent:
    'Si le projet l’exige, un e-mail de confirmation sera envoyé à la nouvelle adresse (et parfois à l’ancienne). Ouvrez le lien pour finaliser le changement.',
  magicResent: 'Nouveau lien magique envoyé sur votre adresse actuelle.',
  errPseudoInvalid: 'Pseudo invalide',
  errEmailInvalid: 'E-mail invalide',
  ctxEmailChange: 'Changement d’adresse e-mail',
  ctxMagicResend: 'Renvoi du lien magique',
  // Zone dangereuse. Le texte DIT la règle du dernier administrateur avant le
  // clic : découvrir après coup que son dossier a changé de main serait la
  // même surprise qu'un dossier perdu.
  dangerTitle: 'Zone dangereuse',
  dangerLead:
    'Supprimer votre compte est définitif : ni nous ni vous ne pourrons le rétablir. Voici exactement ce qui se passe.',
  dangerBulletMine:
    'Votre compte, votre pseudo, vos avis, commentaires, votes, notes personnelles et photos envoyées sont supprimés.',
  dangerBulletShared:
    'Un dossier partagé où quelqu’un reste n’est PAS supprimé : il est transmis à un participant restant, promu administrateur si vous étiez le dernier.',
  dangerBulletAlone:
    'Un dossier dont vous étiez le seul participant est supprimé avec son contenu — plus personne ne pourrait l’ouvrir.',
  dangerBulletLog:
    'Le journal d’activité et le bloc-notes des dossiers transmis restent, sans votre nom.',
  dangerWord: 'SUPPRIMER',
  dangerTypeLabel: 'Pour continuer, recopiez {word}',
  dangerButton: 'Supprimer mon compte',
  dangerBusy: 'Suppression…',
  dangerConfirmTitle: 'Supprimer définitivement ce compte ?',
  dangerConfirmBody:
    'Dernière étape. Votre session sera fermée immédiatement et vous reviendrez à l’accueil, déconnecté.',
  dangerConfirmLabel: 'Supprimer mon compte',
  ctxAccountDelete: 'Suppression du compte',
} as const;

export const accountEn = {
  backHome: 'Back to home',
  navAria: 'Navigation',
  scopeGlobal: 'Whole app',
  title: 'General settings',
  leadBefore:
    'Account, display on this device and app tools. Search workspaces are configured inside each workspace, in the ',
  leadSettingsTab: 'Settings',
  leadAfter: ' tab.',
  sectionAccount: 'Account',
  pseudoTitle: 'Nickname',
  pseudoHint: 'Visible in workspaces and comments. ',
  pseudoLabel: 'Display nickname',
  savePseudo: 'Save nickname',
  emailTitle: 'Email and sign-in',
  emailIdentifier: 'Account identifier',
  emailNotSet: 'not set',
  resendMagic: 'Resend a magic link',
  newEmailLabel: 'New email address',
  requestEmailChange: 'Request email change',
  sectionDisplay: 'Display',
  themeHint:
    'Theme saved locally on this device. “System” follows your device setting.',
  themeGroupAria: 'Theme choice',
  themeLight: 'Light',
  themeDark: 'Dark',
  themeSystem: 'System',
  languageTitle: 'Language',
  languageHint: 'Interface language, saved on this device.',
  languageGroupAria: 'Language choice',
  langFr: 'Français',
  langEn: 'English',
  sectionApp: 'App',
  updateTitle: 'Update',
  updateHint:
    'After the site is deployed, reload to get the latest version. In the browser or as a PWA, the service worker cache is reapplied if needed.',
  updateReadyTitle: 'Update available',
  updateReadyNote:
    ' — the button below will install the new version then reload the page.',
  reloading: 'Reloading…',
  reloadLatest: 'Reload to the latest version',
  tourTitle: 'Guided tour',
  tourHint:
    'Resets the “already seen” screens (home, invitation, first time in a workspace on a small screen). Then reopen home or start the tour below.',
  tourReset: 'Reset the indicators',
  tourStart: 'Start the welcome tour',
  otherApps: 'Our other apps',
  toastPseudoSaved: 'Nickname updated',
  toastEmailRequested: 'Email change request sent',
  toastMagicSent: 'Magic link sent',
  toastTourReset: 'Guided tour reset.',
  emailAlready: 'That’s already the address saved on this account.',
  emailConfirmSent:
    'If the project requires it, a confirmation email will be sent to the new address (and sometimes the old one). Open the link to finalise the change.',
  magicResent: 'A new magic link was sent to your current address.',
  errPseudoInvalid: 'Invalid nickname',
  errEmailInvalid: 'Invalid email',
  ctxEmailChange: 'Email address change',
  ctxMagicResend: 'Resending the magic link',
  dangerTitle: 'Danger zone',
  dangerLead:
    'Deleting your account is permanent: neither you nor we can bring it back. Here is exactly what happens.',
  dangerBulletMine:
    'Your account, nickname, reviews, comments, votes, personal notes and uploaded photos are deleted.',
  dangerBulletShared:
    'A shared workspace where someone remains is NOT deleted: it is handed over to a remaining participant, promoted to admin if you were the last one.',
  dangerBulletAlone:
    'A workspace where you were the only participant is deleted along with its content — nobody could open it any more.',
  dangerBulletLog:
    'The activity log and notepad of handed-over workspaces remain, without your name.',
  dangerWord: 'DELETE',
  dangerTypeLabel: 'To continue, type {word}',
  dangerButton: 'Delete my account',
  dangerBusy: 'Deleting…',
  dangerConfirmTitle: 'Permanently delete this account?',
  dangerConfirmBody:
    'Last step. Your session will close immediately and you will return to the home page, signed out.',
  dangerConfirmLabel: 'Delete my account',
  ctxAccountDelete: 'Account deletion',
} as const;
