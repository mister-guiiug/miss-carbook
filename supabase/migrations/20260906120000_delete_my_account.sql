-- Miss Carbook — supprimer son compte, depuis l'application (RGPD, art. 17).
--
-- POURQUOI UNE FONCTION SERVEUR. Le client parle à Postgres avec la clé `anon`
-- et le rôle `authenticated`. Ce rôle n'a AUCUN droit sur `auth.users` : la
-- sonde du 06/09/2026 sur un projet hébergé rend
-- `has_table_privilege('authenticated', 'auth.users', 'DELETE') = false`.
-- Seul `postgres` le peut — il n'est pas superutilisateur, mais il porte
-- `BYPASSRLS` et le droit `DELETE` sur cette table, dont la RLS est active
-- avec ZÉRO politique. Une fonction `security definer` appartenant à
-- `postgres` est donc le seul chemin, et elle fonctionne : c'est ce
-- qu'établit `supabase/tests/delete_my_account.test.sql`.
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ LA RÈGLE DU DERNIER ADMINISTRATEUR                                       ║
-- ║                                                                          ║
-- ║ Un dossier n'est JAMAIS orphelin. `workspaces.created_by` référence      ║
-- ║ `auth.users` en `ON DELETE CASCADE` : sans la règle ci-dessous, la       ║
-- ║ suppression du compte de la personne qui a CRÉÉ un dossier partagé       ║
-- ║ emporterait ce dossier entier — exigences, modèles, photos, journal —    ║
-- ║ pour tous les autres participants, qui n'ont rien demandé. C'est le bug  ║
-- ║ que cette fonction existe d'abord pour empêcher.                        ║
-- ║                                                                          ║
-- ║ Pour CHAQUE dossier où le partant est membre, ou qu'il a créé :          ║
-- ║                                                                          ║
-- ║ 1. IL RESTE QUELQU'UN → le dossier VIT.                                  ║
-- ║    `created_by` est transféré au successeur, ce qui désamorce la         ║
-- ║    cascade ; et si le partant était le dernier `admin`, le successeur    ║
-- ║    est promu `admin`, sans quoi le dossier deviendrait ingérable         ║
-- ║    (personne pour inviter, renommer ou supprimer).                       ║
-- ║    Successeur = un `admin` restant s'il y en a un, sinon le plus ancien  ║
-- ║    membre (`joined_at`, puis `user_id` pour départager) : le choix est   ║
-- ║    déterministe, donc testable.                                          ║
-- ║                                                                          ║
-- ║ 2. IL NE RESTE PERSONNE → le dossier est SUPPRIMÉ, avec son contenu.     ║
-- ║    Le garder ferait pire que rien : la RLS ne montre un dossier qu'à ses ║
-- ║    membres, il serait donc invisible pour tout le monde et supprimable   ║
-- ║    par personne. Un déchet, pas une sauvegarde.                          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- CE QUI PART AVEC LE PARTANT, dans les dossiers qui survivent. Les tables où
-- son identifiant est `NOT NULL ... ON DELETE CASCADE` perdent ses lignes :
-- profil, avis, commentaires, votes, notes personnelles, rappels, presets de
-- comparaison, visites, lignes de budget, pièces jointes qu'il a envoyées.
-- C'est ce que le droit à l'effacement demande, et le schéma le disait déjà.
-- Ce qui NE part pas : le journal d'activité et le bloc-notes, dont les
-- colonnes sont `ON DELETE SET NULL` — l'histoire du dossier reste, le nom
-- s'efface.
--
-- LIMITE CONNUE, dite ici plutôt que découverte plus tard : supprimer les
-- lignes de `public.attachments` ne supprime pas les FICHIERS du bucket
-- `workspace-media`. Les objets orphelins restent à purger côté Storage.

-- ── La fonction ────────────────────────────────────────────────────────────
-- `search_path = ''` : tout est qualifié, rien ne peut être détourné par un
-- schéma que l'appelant contrôlerait.
CREATE OR REPLACE FUNCTION public.delete_my_account ()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid ();
  v_ws uuid;
  v_heir uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'delete_my_account : aucune session authentifiée'
      USING ERRCODE = '28000';
  END IF;

  FOR v_ws IN
    SELECT wm.workspace_id
    FROM public.workspace_members wm
    WHERE wm.user_id = v_uid
    UNION
    SELECT w.id
    FROM public.workspaces w
    WHERE w.created_by = v_uid
  LOOP
    SELECT wm.user_id
    INTO v_heir
    FROM public.workspace_members wm
    WHERE wm.workspace_id = v_ws
      AND wm.user_id <> v_uid
    ORDER BY (wm.role = 'admin') DESC, wm.joined_at, wm.user_id
    LIMIT 1;

    IF v_heir IS NULL THEN
      DELETE FROM public.workspaces WHERE id = v_ws;
    ELSE
      UPDATE public.workspaces
      SET created_by = v_heir
      WHERE id = v_ws
        AND created_by = v_uid;

      IF NOT EXISTS (
        SELECT 1
        FROM public.workspace_members wm
        WHERE wm.workspace_id = v_ws
          AND wm.user_id <> v_uid
          AND wm.role = 'admin'
      ) THEN
        UPDATE public.workspace_members
        SET role = 'admin'
        WHERE workspace_id = v_ws
          AND user_id = v_heir;
      END IF;
    END IF;
  END LOOP;

  -- Le compte lui-même. Tout ce qui le référence part par cascade, y compris
  -- ses sessions et ses jetons de rafraîchissement (schéma `auth`) : la
  -- session en cours ne survit pas à l'expiration de son jeton d'accès.
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

-- Personne d'autre qu'un compte connecté n'a affaire à cette fonction : `anon`
-- ne doit même pas pouvoir la voir s'exécuter (elle échouerait, mais autant
-- refuser le droit plutôt que compter sur l'échec).
REVOKE ALL ON FUNCTION public.delete_my_account () FROM PUBLIC;

REVOKE ALL ON FUNCTION public.delete_my_account () FROM anon;

GRANT EXECUTE ON FUNCTION public.delete_my_account () TO authenticated;

COMMENT ON FUNCTION public.delete_my_account () IS 'Supprime le compte connecté et ses données. Transmet les dossiers partagés au participant restant le plus ancien (promu admin si besoin) ; supprime les dossiers dont le partant était le seul membre.';
