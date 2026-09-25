-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Les RPC SECURITY DEFINER ne servent plus que leur espace — pgTAP.        ║
-- ║                                                                          ║
-- ║ Migration 20260925120000_rpc_droits.sql. Avant elle,                     ║
-- ║ `calculate_candidate_tco` rendait le prix et le budget de n'importe quel ║
-- ║ candidat à qui en connaissait l'identifiant, et quatre autres fonctions  ║
-- ║ lisaient ou écrivaient dans n'importe quel espace.                       ║
-- ║                                                                          ║
-- ║ Mêmes précautions que `delete_my_account.test.sql` : on se fait passer   ║
-- ║ pour un compte comme PostgREST (rôle + `sub` du jeton), et on rend       ║
-- ║ `postgres` avant chaque assertion.                                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

begin;
select plan(8);

-- ── Décor : deux comptes, un espace chacun, un candidat chez le premier ────
-- `handle_new_user` crée les profils, `add_creator_as_admin` inscrit chaque
-- créateur comme administrateur de son espace.
insert into auth.users (id, email)
values
  ('e1111111-1111-4111-8111-111111111111', 'carbook.membre@exemple.test'),
  ('e2222222-2222-4222-8222-222222222222', 'carbook.etranger@exemple.test');

insert into workspaces (id, name, created_by)
values
  ('e3333333-3333-4333-8333-333333333333', 'Dossier du membre', 'e1111111-1111-4111-8111-111111111111'),
  ('e4444444-4444-4444-8444-444444444444', 'Dossier de l''étranger', 'e2222222-2222-4222-8222-222222222222');

insert into candidates (id, workspace_id, brand, model, price)
values ('e5555555-5555-4555-8555-555555555555', 'e3333333-3333-4333-8333-333333333333',
        'Marque fictive', 'Modèle fictif', 24990);

create or replace function devenir_rpc (who uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', who, 'role', 'authenticated')::text, true);
end $$;

create or replace function redevenir_postgres_rpc () returns void
language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '{}', true);
end $$;

-- ── 1. Le membre calcule le coût de son candidat ───────────────────────────
select devenir_rpc('e1111111-1111-4111-8111-111111111111');
select set_config('t.membre',
  public.calculate_candidate_tco('e5555555-5555-4555-8555-555555555555')::text, true);
select redevenir_postgres_rpc();

select is(
  current_setting('t.membre')::json->>'error',
  null,
  'le membre de l''espace obtient le coût de possession de son candidat'
);

-- ── 2. L'étranger n'obtient rien, pas même l'aveu que le candidat existe ───
select devenir_rpc('e2222222-2222-4222-8222-222222222222');
select set_config('t.etranger',
  public.calculate_candidate_tco('e5555555-5555-4555-8555-555555555555')::text, true);
select redevenir_postgres_rpc();

select is(
  current_setting('t.etranger')::json->>'error',
  'candidate_not_found',
  'un compte d''un autre espace reçoit la même réponse qu''un candidat inexistant'
);
select ok(
  current_setting('t.etranger') not like '%24990%',
  '... et le prix du candidat n''apparaît nulle part dans la réponse'
);

-- ── 3. Les droits d'exécution ──────────────────────────────────────────────
select ok(
  has_function_privilege('authenticated', 'public.calculate_candidate_tco(uuid, int, int)', 'execute'),
  'calculate_candidate_tco reste appelable par un compte connecté (BudgetTab)'
);
select ok(
  not has_function_privilege('anon', 'public.calculate_candidate_tco(uuid, int, int)', 'execute'),
  '... mais plus par anon'
);
select ok(
  not has_function_privilege('authenticated', 'public.create_default_budget_categories(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.create_default_trial_checklist(uuid)', 'execute'),
  'les deux fonctions qui écrivaient dans n''importe quel espace sont fermées'
);
select ok(
  not has_function_privilege('authenticated', 'public.candidate_weighted_score(uuid, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.requirement_weighted_score(uuid)', 'execute'),
  'les deux scores pondérés, lisibles de n''importe quel espace, sont fermés'
);
select ok(
  has_function_privilege('service_role', 'public.create_default_budget_categories(uuid)', 'execute'),
  'service_role garde la voie d''administration'
);

select * from finish();
rollback;
