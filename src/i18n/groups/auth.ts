// Écran de connexion (PseudoGate) : lien magique, mot de passe, inscription.
export const authFr = {
  intro:
    'Carnet collaboratif pour choisir un véhicule. Choisissez une méthode de connexion ci-dessous.',
  methodAria: 'Méthode de connexion',
  tabMagic: 'Lien magique',
  tabPassword: 'Mot de passe',
  tabSignup: 'Créer un compte',
  magicHint: 'Sans mot de passe : vous recevrez un lien sécurisé par e-mail.',
  emailLabel: 'E-mail',
  emailPlaceholder: 'vous@exemple.com',
  receiveLink: 'Recevoir le lien de connexion',
  loginHint:
    'Connectez-vous avec l’e-mail et le mot de passe enregistrés sur ce projet.',
  signupHint:
    'Création d’un compte avec mot de passe (8 caractères minimum côté application).',
  passwordLabel: 'Mot de passe',
  confirmPasswordLabel: 'Confirmer le mot de passe',
  pleaseWait: 'Patientez…',
  signIn: 'Se connecter',
  createAccount: 'Créer le compte',
  providerNote:
    'Le fournisseur « E-mail » et l’option mot de passe doivent être activés dans Supabase (Authentication → Providers). La confirmation par e-mail à l’inscription dépend des réglages du projet.',
  errEmailInvalid: 'Adresse e-mail invalide',
  inputDetail: 'Saisie : {value}',
  magicSent:
    'Lien envoyé : ouvrez l’e-mail et cliquez sur le lien pour vous connecter.',
  accountCreatedConnected: 'Compte créé : vous êtes connecté.',
  accountCreatedConfirm:
    'Compte créé. Si le projet exige une confirmation par e-mail, ouvrez le lien reçu avant de vous connecter avec le mot de passe.',
  ctxMagicSend: 'Envoi du lien magique (connexion)',
  ctxPasswordLogin: 'Connexion par mot de passe',
  ctxPasswordSignup: 'Inscription par mot de passe',
} as const;

export const authEn = {
  intro:
    'Collaborative logbook to choose a vehicle. Pick a sign-in method below.',
  methodAria: 'Sign-in method',
  tabMagic: 'Magic link',
  tabPassword: 'Password',
  tabSignup: 'Create an account',
  magicHint: 'No password: you’ll receive a secure link by email.',
  emailLabel: 'Email',
  emailPlaceholder: 'you@example.com',
  receiveLink: 'Get the sign-in link',
  loginHint: 'Sign in with the email and password saved for this project.',
  signupHint:
    'Create a password account (minimum 8 characters on the app side).',
  passwordLabel: 'Password',
  confirmPasswordLabel: 'Confirm password',
  pleaseWait: 'Please wait…',
  signIn: 'Sign in',
  createAccount: 'Create account',
  providerNote:
    'The “Email” provider and the password option must be enabled in Supabase (Authentication → Providers). Email confirmation at sign-up depends on the project settings.',
  errEmailInvalid: 'Invalid email address',
  inputDetail: 'Input: {value}',
  magicSent: 'Link sent: open the email and click the link to sign in.',
  accountCreatedConnected: 'Account created: you’re signed in.',
  accountCreatedConfirm:
    'Account created. If the project requires email confirmation, open the link you received before signing in with your password.',
  ctxMagicSend: 'Sending the magic link (sign-in)',
  ctxPasswordLogin: 'Password sign-in',
  ctxPasswordSignup: 'Password sign-up',
} as const;
