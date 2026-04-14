# Miss Carbook

Application **PWA** (React, Vite, TypeScript) pour collaborer sur le choix d’un véhicule : dossiers partagés, exigences, modèles candidats, comparaison multi-critères, photos (Supabase Storage), journal d’activité et commentaires en temps réel. Le front est **100 % statique** et peut être servi sur **GitHub Pages** ; la collaboration passe par **Supabase** (Auth, Postgres, Realtime, Storage) avec **RLS** obligatoire et **clé anon** uniquement côté client.

Référence déploiement Pages via Actions : [Configurer une source de publication GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site#publishing-with-a-custom-github-actions-workflow).

## Prérequis

- Node.js 22+ (voir `.github/workflows`)
- Un projet Supabase (plan Free acceptable)
- Compte GitHub (Pages + Actions)

## Démarrage local

```bash
npm install
cp .env.example .env.local
# Renseigner VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY (paramètres du projet Supabase)
npm run dev
```

Scripts utiles :

- `npm run build` — build production + copie `404.html` pour le routing SPA sur Pages
- `npm run preview` — prévisualiser le build
- `npm run lint` / `npm run format`
- `npm run test` — tests Vitest (schémas Zod)

## Variables d’environnement (front)

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | URL du projet (`https://xxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Clé **anon** publique (compatible navigateur) |
| `VITE_BASE_PATH` | Chemin de base (ex. `/nom-du-repo/` sur Pages ; `/` en local) |

**Ne jamais** exposer la clé `service_role` ni d’autres secrets dans le dépôt ou le bundle.

## Configuration Supabase

### 1. Auth (e-mail uniquement)

Dans **Authentication → Providers** :

- Activer **Email** (lien magique / OTP, sans mot de passe côté app).
- **Désactiver Anonymous sign-ins** (l’application ne crée plus de session anonyme).

Dans **Authentication → URL Configuration**, renseigner **Site URL** et **Redirect URLs** pour votre déploiement (ex. `https://<user>.github.io/<repo>/` et variantes avec / sans slash final, plus `http://localhost:5173/` en local).

### 2. Schéma SQL

Exécuter les migrations **dans cet ordre** (SQL Editor ou [Supabase CLI](https://supabase.com/docs/guides/cli)) :

1. `supabase/migrations/20260414000000_initial_schema.sql` — schéma de base, RLS, `join_workspace`, Realtime, Storage.
2. `supabase/migrations/20260414180000_fix_workspace_members_first_insert_rls.sql` — correctif RLS pour la première insertion membre à la création d’un dossier.
3. `supabase/migrations/20260415000000_functional_enhancements.sql` — décision dossier, invitations, évaluations / votes MoSCoW, rappels, presets de comparaison, RPC associées (voir le fichier pour le détail des tables et policies).
4. `supabase/migrations/20260416000000_profiles_display_name_unique.sql` — unicité des pseudos (insensible à la casse), règles de caractères, trigger profil par défaut à la création du compte (`handle_new_user`).
5. `supabase/migrations/20260418120000_rpc_create_workspace.sql` — fonction RPC `create_workspace` : la création de dossier passe par le serveur (`SECURITY DEFINER`) pour éviter les refus RLS sur la table `workspaces` lorsque l’INSERT direct ne passe pas.

Sans l’étape 3, l’application affichera des erreurs API sur les onglets Paramètres (décision, invitations), Évaluations, Rappels et Comparer (presets).

**Remise à zéro complète (manuel)** : le fichier `supabase/scripts/reset_all_data_and_auth.sql` vide les tables métier, supprime les objets Storage du bucket `workspace-media` et **tous les comptes Auth**. À exécuter **à la main** dans le SQL Editor (il n’est **pas** dans `migrations/` pour éviter qu’un `supabase db push` automatique ne détruise une base en production).

**Nouveaux comptes** : le trigger crée une ligne `profiles` avec un pseudo dérivé de la partie locale de l’e-mail (ou un identifiant `u_…` si collision). L’utilisateur peut changer son pseudo depuis l’accueil.

**CI / `supabase db push`** : les fichiers du dossier `supabase/migrations/` sont rédigés pour être **ré-appliquables** si la base a déjà été créée via le SQL Editor (types / tables / policies déjà présents). Si le schéma distant est à jour mais que l’historique `supabase_migrations` ne l’est pas, on peut aussi marquer des versions comme déjà appliquées sans les ré-exécuter : `supabase migration repair --status applied <version>` (voir la doc CLI).

### 3. Realtime

Les tables `notes`, `candidates`, `comments`, `activity_log`, `candidate_reviews` sont ajoutées à `supabase_realtime`. La migration fonctionnelle ajoute notamment `requirement_candidate_evaluations` (et d’autres selon le fichier). Vérifier dans le tableau de bord que la réplication est active si besoin.

### 4. Exemples de requêtes (client)

```ts
// Liste des dossiers où l’utilisateur est membre
const { data } = await supabase
  .from('workspace_members')
  .select('workspace_id, role, workspaces ( id, name, share_code )')
  .eq('user_id', user.id)

// Rejoindre un dossier
const { data: wsId, error } = await supabase.rpc('join_workspace', { p_code: 'ABCD1234' })
```

Chemins Storage conseillés : `{workspace_id}/{candidate_id}/{uuid}-{nomfichier}`.

## Déploiement GitHub Pages

1. **Réglages du dépôt** → **Pages** → Source : **GitHub Actions**.
2. Ajouter les secrets du dépôt : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
3. Le workflow `.github/workflows/deploy.yml` définit `VITE_BASE_PATH: /${{ github.event.repository.name }}/` pour l’URL `https://<user>.github.io/<repo>/`.

Site utilisateur `https://<user>.github.io` à la racine : adapter le workflow (par ex. `VITE_BASE_PATH: /`) et la config du dépôt Pages.

## PWA & cache

- **Manifest** et **icônes** : générés par `vite-plugin-pwa` (voir `vite.config.ts`).
- **Service worker** : Workbox en mode `generateSW`, précache de l’app shell.
- **API Supabase** : stratégie **NetworkFirst** (documentée dans `vite.config.ts` — délai réseau puis cache).
- **Page offline** : `public/offline.html` (incluse dans les assets) ; la coque peut s’afficher hors ligne, les données live nécessitent le réseau.

## Alternative backend gratuite

Si Supabase n’est pas disponible : **Firebase** (plan Spark) peut remplacer Auth + Firestore/Storage + règles de sécurité analogues ; ce dépôt ne l’intègre pas par défaut.

## Guide utilisateur (court)

1. **Créer un dossier** : écran de bienvenue → e-mail → lien magique → accueil → « Créer un dossier » (nom, description, option remplacement). Ajuster le pseudo si besoin.
2. **Inviter** : onglet **Paramètres** → copier le **code** ou le **lien** ; les invités utilisent « Rejoindre avec un code ».
3. **Exigences** : onglet **Exigences** → ajouter, filtrer par niveau, tri par poids.
4. **Modèles** : onglet **Modèles** → ajouter un candidat, ouvrir le détail pour fiche technique (JSON structuré), avis, commentaires, photos.
5. **Comparer** : onglet **Comparer** → cocher des modèles et critères → export JSON/CSV.
6. **Photos** : dans le détail d’un modèle, upload (limite **5 Mo** côté client et bucket).

## Limites & bonnes pratiques

- GitHub Pages : pas de traitement serveur, pas de données hautement sensibles (CGU GitHub).
- La sécurité repose sur **RLS** et sur la **clé anon** ; ne pas désactiver RLS en production.

## Dépannage

### Création de dossier en **403** / erreur **`42501`**

**Message** `new row violates row-level security policy for table "workspaces"` : la policy `workspaces_insert_auth` exige `auth.uid() IS NOT NULL` et `created_by = auth.uid()`. Si la requête part **sans JWT utilisateur** (session expirée, mauvaise clé, onglet privé qui bloque le stockage de session), `auth.uid()` est nul et l’INSERT est refusé.

**Côté app** : la création utilise désormais la RPC **`create_workspace`** (migration `20260418120000_rpc_create_workspace.sql`) : appliquer cette migration avec `supabase db push` ou le SQL Editor.

**Autre cause fréquente** : RLS sur **`workspace_members`** — sans la policy `wm_insert_creator_first`, le trigger qui ajoute le créateur comme admin peut faire échouer toute la transaction.

**Correctif membres** : exécuter `supabase/migrations/20260414180000_fix_workspace_members_first_insert_rls.sql` si ce n’est pas déjà fait.

## Licence

Voir le fichier `LICENSE` du dépôt.
