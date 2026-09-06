-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ `delete_my_account()` — pgTAP                                            ║
-- ║                                                                          ║
-- ║ Ce que ces assertions établissent, dans l'ordre où on s'en soucie :       ║
-- ║                                                                          ║
-- ║ 1. APRÈS SUPPRESSION, PLUS UNE LIGNE. Ni dans `auth.users`, ni dans      ║
-- ║    `profiles`, ni dans `workspace_members`, ni dans `comments`.          ║
-- ║ 2. UN DOSSIER PARTAGÉ N'EST JAMAIS ORPHELIN. `workspaces.created_by`     ║
-- ║    est en `ON DELETE CASCADE` : sans la règle du dernier administrateur, ║
-- ║    supprimer le compte du créateur emporterait le dossier ENTIER de ses  ║
-- ║    coéquipiers. Les assertions 5 à 17 sont là pour ça.                   ║
-- ║ 3. UN DOSSIER SANS PERSONNE EST SUPPRIMÉ, et non laissé invisible.       ║
-- ║                                                                          ║
-- ║ ── COMMENT LE JOUER ──────────────────────────────────────────────────── ║
-- ║ Docker ne démarre pas sur le poste de développement, donc pas de         ║
-- ║ `supabase test db`. Le même fichier se joue contre la base LIÉE :        ║
-- ║                                                                          ║
-- ║   npm run test:account:remote      (migration déjà poussée)              ║
-- ║   npm run test:account:pending     (migration pas encore poussée : elle  ║
-- ║                                     est créée DANS la transaction, donc  ║
-- ║                                     défaite par le `rollback` final)     ║
-- ║                                                                          ║
-- ║ ── CE QUI N'A PAS PU ÊTRE JOUÉ, ET POURQUOI ─────────────────────────── ║
-- ║ Le jeton d'accès Supabase disponible sur ce poste ne donne accès qu'aux  ║
-- ║ projets `mister-miss-koh` et `mister-molkky` : `supabase link` sur le    ║
-- ║ projet de Miss Carbook répond « does not have the necessary             ║
-- ║ privileges ». Ce fichier est donc LIVRÉ, PAS ENCORE EXÉCUTÉ.            ║
-- ║                                                                          ║
-- ║ L'hypothèse dont tout dépend — « une fonction `security definer`        ║
-- ║ appartenant à `postgres` peut effacer dans `auth.users` sur un projet    ║
-- ║ hébergé » — a, elle, été vérifiée le 06/09/2026 par une sonde EN         ║
-- ║ LECTURE SEULE sur un projet hébergé de la famille :                      ║
-- ║   postgres : superutilisateur = false, BYPASSRLS = true,                ║
-- ║              DELETE sur auth.users = true                               ║
-- ║   auth.users : propriétaire supabase_auth_admin, RLS activée, FORCE      ║
-- ║              non posée, ZÉRO politique                                   ║
-- ║   authenticated : DELETE sur auth.users = false                          ║
-- ║ Donc : le rôle de l'API ne peut pas, `postgres` peut, et la RLS sans     ║
-- ║ politique ne l'arrête pas puisqu'il la contourne. Le chemin existe.      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
begin;

select plan(21);

-- ── Décor ─────────────────────────────────────────────────────────────────
-- Quatre comptes fictifs, quatre dossiers qui couvrent les quatre cas de la
-- règle. « Donnée fictive de démonstration » : aucun de ces noms n'est réel.
--
-- `handle_new_user` crée le profil à l'insertion dans `auth.users` : rien à
-- insérer dans `profiles`, et c'est bien le comportement réel qu'on éprouve.
insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'carbook.alpha@exemple.test'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'carbook.beta@exemple.test'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'carbook.gamma@exemple.test'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'carbook.delta@exemple.test');

-- Le déclencheur `add_creator_as_admin` inscrit le créateur comme `admin` :
-- les insertions de membres ci-dessous ne font qu'ajouter les autres.
insert into workspaces (id, name, created_by)
values
  ('11111111-1111-4111-8111-111111111111', 'Dossier partagé', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('22222222-2222-4222-8222-222222222222', 'Dossier solo', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  ('33333333-3333-4333-8333-333333333333', 'Dossier quitté', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('44444444-4444-4444-8444-444444444444', 'Dossier à deux admins', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

-- W1 : A administre, B écrit. B est le SEUL successeur possible.
insert into workspace_members (workspace_id, user_id, role, joined_at)
values ('11111111-1111-4111-8111-111111111111', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'write', '2026-01-01');

-- W3 : A l'a créé PUIS quitté. `created_by` pointe toujours sur lui — c'est le
-- cas que la boucle rate si elle ne lit que `workspace_members`.
delete from workspace_members
where workspace_id = '33333333-3333-4333-8333-333333333333'
  and user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

insert into workspace_members (workspace_id, user_id, role, joined_at)
values ('33333333-3333-4333-8333-333333333333', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'admin', '2026-01-01');

-- W4 : B est arrivé AVANT D, mais D est administrateur. Si l'ordre de
-- succession se contentait de l'ancienneté, il choisirait B — et le dossier
-- gagnerait un administrateur de plus sans nécessité.
insert into workspace_members (workspace_id, user_id, role, joined_at)
values
  ('44444444-4444-4444-8444-444444444444', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'write', '2026-01-01'),
  ('44444444-4444-4444-8444-444444444444', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'admin', '2026-02-01');

-- Du contenu dans W1 : c'est lui qui doit survivre au départ de A.
insert into requirements (id, workspace_id, label)
values ('aa000001-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Coffre de 400 litres');

insert into candidates (id, workspace_id, brand, model)
values ('aa000002-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Marque fictive', 'Modèle fictif');

insert into comments (id, candidate_id, user_id, body)
values
  ('aa000003-0000-4000-8000-000000000003', 'aa000002-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Commentaire de A'),
  ('aa000004-0000-4000-8000-000000000004', 'aa000002-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Commentaire de B');

insert into activity_log (id, workspace_id, user_id, action_type, entity_type)
values ('aa000005-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'candidate.create', 'candidate');

insert into requirements (id, workspace_id, label)
values ('aa000006-0000-4000-8000-000000000006', '22222222-2222-4222-8222-222222222222', 'Exigence du dossier solo');

-- Se faire passer pour un compte : rôle + revendication `sub` du jeton,
-- exactement ce que PostgREST met en place à chaque requête.
create or replace function devenir (who uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', who, 'role', 'authenticated')::text, true);
end $$;

create or replace function redevenir_postgres () returns void
language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '{}', true);
end $$;

-- `throws_ok` n'est pas domptable ici (le message dépend de la locale du
-- serveur) : on capture le SQLSTATE et on le compare, ce qui dit la même
-- chose sans dépendre d'un texte.
create or replace function tentative_sans_session () returns text
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{}', true);
  perform public.delete_my_account();
  return 'AUTORISE';
exception
  when others then
    return sqlstate;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Sans session, rien
-- ════════════════════════════════════════════════════════════════════════════
select is(
  tentative_sans_session(), '28000',
  'sans session authentifiée, la fonction refuse au lieu d''effacer au hasard'
);

select redevenir_postgres();

-- ════════════════════════════════════════════════════════════════════════════
-- 2. A supprime son compte : plus une ligne de lui
-- ════════════════════════════════════════════════════════════════════════════
select devenir('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

select public.delete_my_account();

select redevenir_postgres();

select is(
  (select count(*)::int from auth.users where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 0,
  'après suppression, plus une ligne dans auth.users'
);

select is(
  (select count(*)::int from profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 0,
  'après suppression, plus une ligne dans profiles'
);

select is(
  (select count(*)::int from workspace_members where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 0,
  'après suppression, plus une ligne dans workspace_members'
);

select is(
  (select count(*)::int from comments where id = 'aa000003-0000-4000-8000-000000000003'), 0,
  'ses commentaires partent avec lui'
);

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Le dossier partagé survit — c'est le bug que la règle empêche
-- ════════════════════════════════════════════════════════════════════════════
select is(
  (select count(*)::int from workspaces where id = '11111111-1111-4111-8111-111111111111'), 1,
  'le dossier partagé survit au départ de son créateur'
);

select is(
  (select created_by from workspaces where id = '11111111-1111-4111-8111-111111111111'),
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
  'created_by est transféré au successeur, ce qui désamorce la cascade'
);

select is(
  (select role::text from workspace_members
   where workspace_id = '11111111-1111-4111-8111-111111111111'
     and user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  'admin',
  'le dernier administrateur parti, le successeur est promu'
);

select is(
  (select count(*)::int from requirements where workspace_id = '11111111-1111-4111-8111-111111111111'), 1,
  'les exigences du dossier partagé sont intactes'
);

select is(
  (select count(*)::int from candidates where workspace_id = '11111111-1111-4111-8111-111111111111'), 1,
  'les modèles du dossier partagé sont intacts'
);

select is(
  (select count(*)::int from comments where id = 'aa000004-0000-4000-8000-000000000004'), 1,
  'le commentaire de l''autre participant est intact'
);

select is(
  (select count(*)::int from activity_log where id = 'aa000005-0000-4000-8000-000000000005'), 1,
  'le journal du dossier survit'
);

select is(
  (select user_id from activity_log where id = 'aa000005-0000-4000-8000-000000000005'),
  null::uuid,
  'le journal survit ANONYMISÉ : l''histoire reste, le nom s''efface'
);

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Le dossier créé puis quitté, et celui qui garde un administrateur
-- ════════════════════════════════════════════════════════════════════════════
select is(
  (select created_by from workspaces where id = '33333333-3333-4333-8333-333333333333'),
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
  'un dossier créé puis quitté est transféré lui aussi (sinon la cascade l''emporte)'
);

select is(
  (select created_by from workspaces where id = '44444444-4444-4444-8444-444444444444'),
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid,
  'la succession va à un administrateur restant avant d''aller au plus ancien'
);

select is(
  (select role::text from workspace_members
   where workspace_id = '44444444-4444-4444-8444-444444444444'
     and user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  'write',
  'tant qu''il reste un administrateur, personne n''est promu sans raison'
);

-- ════════════════════════════════════════════════════════════════════════════
-- 5. Les invariants — bornés au décor, pour ne rien affirmer sur les vraies
--    données de la base
-- ════════════════════════════════════════════════════════════════════════════
select is(
  (select count(*)::int from workspaces w
   where w.id in ('11111111-1111-4111-8111-111111111111',
                  '33333333-3333-4333-8333-333333333333',
                  '44444444-4444-4444-8444-444444444444')
     and not exists (select 1 from workspace_members m where m.workspace_id = w.id)), 0,
  'aucun dossier survivant sans participant'
);

select is(
  (select count(*)::int from workspaces w
   where w.id in ('11111111-1111-4111-8111-111111111111',
                  '33333333-3333-4333-8333-333333333333',
                  '44444444-4444-4444-8444-444444444444')
     and not exists (select 1 from workspace_members m
                     where m.workspace_id = w.id and m.role = 'admin')), 0,
  'aucun dossier survivant sans administrateur'
);

select is(
  (select count(*)::int from workspaces w
   where w.id in ('11111111-1111-4111-8111-111111111111',
                  '33333333-3333-4333-8333-333333333333',
                  '44444444-4444-4444-8444-444444444444')
     and not exists (select 1 from workspace_members m
                     where m.workspace_id = w.id and m.user_id = w.created_by)), 0,
  'created_by désigne toujours un participant du dossier'
);

-- ════════════════════════════════════════════════════════════════════════════
-- 6. Le dossier dont on était seul : supprimé, pas laissé invisible
-- ════════════════════════════════════════════════════════════════════════════
select devenir('cccccccc-cccc-4ccc-8ccc-cccccccccccc');

select public.delete_my_account();

select redevenir_postgres();

select is(
  (select count(*)::int from workspaces where id = '22222222-2222-4222-8222-222222222222'), 0,
  'le dossier dont le partant était le seul membre est supprimé'
);

select is(
  (select count(*)::int from requirements where id = 'aa000006-0000-4000-8000-000000000006'), 0,
  'son contenu part avec lui, sans laisser de lignes que personne ne verrait'
);

select * from finish();

rollback;
