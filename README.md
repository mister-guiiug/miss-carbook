# Miss Carbook

Application **PWA** (React, Vite, TypeScript) pour collaborer sur le choix d’un véhicule : dossiers partagés, exigences, modèles candidats, comparaison multi-critères, photos (Supabase Storage), journal d’activité et commentaires en temps réel. Le front est **100 % statique** et peut être servi sur **GitHub Pages** ; la collaboration passe par **Supabase** (Auth, Postgres, Realtime, Storage) avec **RLS** obligatoire et **clé anon** uniquement côté client.

Référence déploiement Pages via Actions : [Configurer une source de publication GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site#publishing-with-a-custom-github-actions-workflow).

## Prérequis

- Node.js 20+
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

### 1. Auth anonyme

Dans **Authentication → Providers**, activer **Anonymous sign-ins** pour le flux « pseudo + session » sécurisée (JWT standard, droits limités par RLS).

### 2. Schéma SQL

Exécuter le fichier de migration :

`supabase/migrations/20260414000000_initial_schema.sql`

(dans **SQL Editor** ou via [Supabase CLI](https://supabase.com/docs/guides/cli)).

Contenu principal : tables `profiles`, `workspaces`, `workspace_members`, `current_vehicle`, `requirements`, `candidates`, `candidate_specs`, `candidate_reviews`, `notes`, `comments`, `activity_log`, `attachments` ; fonctions helper RLS ; RPC `join_workspace(p_code)` ; publication Realtime ; bucket Storage `workspace-media` (5 Mo max, JPEG/PNG/WebP/GIF) et politiques sur `storage.objects` (premier segment du chemin = `workspace_id`).

### 3. Realtime

Les tables `notes`, `candidates`, `comments`, `activity_log`, `candidate_reviews` sont ajoutées à `supabase_realtime`. Vérifier dans le tableau de bord que la réplication est active si besoin.

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

1. **Créer un dossier** : accueil → pseudo → « Créer un dossier » (nom, description, option remplacement).
2. **Inviter** : onglet **Paramètres** → copier le **code** ou le **lien** ; les invités utilisent « Rejoindre avec un code ».
3. **Exigences** : onglet **Exigences** → ajouter, filtrer par niveau, tri par poids.
4. **Modèles** : onglet **Modèles** → ajouter un candidat, ouvrir le détail pour fiche technique (JSON structuré), avis, commentaires, photos.
5. **Comparer** : onglet **Comparer** → cocher des modèles et critères → export JSON/CSV.
6. **Photos** : dans le détail d’un modèle, upload (limite **5 Mo** côté client et bucket).

## Limites & bonnes pratiques

- GitHub Pages : pas de traitement serveur, pas de données hautement sensibles (CGU GitHub).
- La sécurité repose sur **RLS** et sur la **clé anon** ; ne pas désactiver RLS en production.

## Licence

Voir le fichier `LICENSE` du dépôt.
