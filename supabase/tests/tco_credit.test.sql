-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ La durée du crédit saisie compte — pgTAP.                                ║
-- ║                                                                          ║
-- ║ `calculate_candidate_tco` lit `tco_parameters.loan_months` depuis sa     ║
-- ║ création, mais aucun champ ne la saisissait : le crédit courait toujours ║
-- ║ sur 60 mois. L'onglet Budget a désormais ce champ. Ce fichier fixe ce    ║
-- ║ que la base en fait, avec l'exemple de la page                           ║
-- ║ cout-total-de-possession-voiture.md (20 000 € sur 48 mois à 5 % :        ║
-- ║ 2 108 € d'intérêts), et les bornes que l'écran vérifie avant d'écrire.   ║
-- ║                                                                          ║
-- ║ Mêmes précautions que `rpc_droits.test.sql` : on se fait passer pour le  ║
-- ║ membre comme PostgREST (rôle + `sub` du jeton), et on rend `postgres`    ║
-- ║ avant chaque assertion.                                                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

begin;
select plan(7);

-- ── Décor : un membre, un espace, deux modèles à crédit ────────────────────
insert into auth.users (id, email)
values ('c1111111-1111-4111-8111-111111111111', 'carbook.credit@exemple.test');

insert into workspaces (id, name, created_by)
values ('c2222222-2222-4222-8222-222222222222', 'Dossier crédit',
        'c1111111-1111-4111-8111-111111111111');

-- 20 000 €, revendus 100 % de leur prix, sans autre frais : leur total est
-- leur seul crédit.
insert into candidates (id, workspace_id, brand, model, price)
values
  ('c3333333-3333-4333-8333-333333333333', 'c2222222-2222-4222-8222-222222222222',
   'Marque fictive', 'Crédit sur 48 mois', 20000),
  ('c4444444-4444-4444-8444-444444444444', 'c2222222-2222-4222-8222-222222222222',
   'Marque fictive', 'Crédit, durée non saisie', 20000);

insert into tco_parameters (workspace_id, candidate_id, annual_km, ownership_years,
                            residual_value_percent, loan_interest_rate, loan_months)
values
  ('c2222222-2222-4222-8222-222222222222', 'c3333333-3333-4333-8333-333333333333',
   15000, 5, 100, 5, 48),
  ('c2222222-2222-4222-8222-222222222222', 'c4444444-4444-4444-8444-444444444444',
   15000, 5, 100, 5, null);

create or replace function devenir_credit (who uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', who, 'role', 'authenticated')::text, true);
end $$;

create or replace function redevenir_postgres_credit () returns void
language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '{}', true);
end $$;

select devenir_credit('c1111111-1111-4111-8111-111111111111');
select set_config('t.credit_48',
  public.calculate_candidate_tco('c3333333-3333-4333-8333-333333333333')::text, true);
select set_config('t.credit_defaut',
  public.calculate_candidate_tco('c4444444-4444-4444-8444-444444444444')::text, true);
select redevenir_postgres_credit();

-- ── 1. La durée saisie est celle du calcul ─────────────────────────────────
select is(
  round((current_setting('t.credit_48')::json->'breakdown'->>'financing_cost')::numeric),
  2108::numeric,
  '20 000 € sur 48 mois à 5 % : 2 108 € d''intérêts, comme l''exemple de la page'
);
select is(
  (current_setting('t.credit_48')::json->>'total_tco')::numeric,
  (current_setting('t.credit_48')::json->'breakdown'->>'financing_cost')::numeric,
  '... et ils forment tout le coût de ce modèle'
);

-- ── 2. Sans durée saisie, la base compte 60 mois ───────────────────────────
select is(
  round((current_setting('t.credit_defaut')::json->'breakdown'->>'financing_cost')::numeric),
  2645::numeric,
  'sans durée saisie : 60 mois, 2 645 € d''intérêts'
);

-- ── 3. Les bornes que l'écran vérifie (LOAN_MONTHS_MIN / MAX de BudgetTab) ─
-- Hors de ces bornes, la base refuse par une violation de contrainte
-- (23514), que l'application afficherait « Pseudo refusé par la base ».
select lives_ok(
  $$update tco_parameters set loan_months = 12
     where candidate_id = 'c3333333-3333-4333-8333-333333333333'$$,
  '12 mois sont acceptés'
);
select throws_ok(
  $$update tco_parameters set loan_months = 11
     where candidate_id = 'c3333333-3333-4333-8333-333333333333'$$,
  '23514',
  null,
  '11 mois sont refusés'
);
select lives_ok(
  $$update tco_parameters set loan_months = 96
     where candidate_id = 'c3333333-3333-4333-8333-333333333333'$$,
  '96 mois sont acceptés'
);
select throws_ok(
  $$update tco_parameters set loan_months = 97
     where candidate_id = 'c3333333-3333-4333-8333-333333333333'$$,
  '23514',
  null,
  '97 mois sont refusés'
);

select * from finish();
rollback;
