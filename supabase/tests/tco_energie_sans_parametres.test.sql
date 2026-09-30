-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ L'énergie est comptée même sans paramètres TCO enregistrés — pgTAP.      ║
-- ║                                                                          ║
-- ║ Migration 20260930140000_tco_energie_sans_parametres.sql. Avant elle,    ║
-- ║ un modèle sans ligne `tco_parameters` avait un coût calculé sur          ║
-- ║ 15 000 km par an et 5 ans, mais sans énergie.                            ║
-- ║                                                                          ║
-- ║ Aucun modèle ici n'a de paramètres : tout vient des valeurs par défaut   ║
-- ║ (15 000 km/an, 5 ans, 1,80 €/L, 0,22 €/kWh, 15 % de décote par an).      ║
-- ║ La garde d'appartenance et les droits de la fonction sont éprouvés par   ║
-- ║ rpc_droits.test.sql et tco_energie.test.sql, sur sa dernière version.    ║
-- ║                                                                          ║
-- ║ Mêmes précautions que `rpc_droits.test.sql` : on se fait passer pour le  ║
-- ║ membre comme PostgREST (rôle + `sub` du jeton), et on rend `postgres`    ║
-- ║ avant chaque assertion.                                                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

begin;
select plan(5);

-- ── Décor : un membre, un espace, trois modèles sans paramètres ────────────
insert into auth.users (id, email)
values ('b1111111-1111-4111-8111-111111111111', 'carbook.defaut@exemple.test');

insert into workspaces (id, name, created_by)
values ('b2222222-2222-4222-8222-222222222222', 'Dossier sans paramètres',
        'b1111111-1111-4111-8111-111111111111');

insert into candidates (id, workspace_id, brand, model, price)
values
  ('b3333333-3333-4333-8333-333333333333', 'b2222222-2222-4222-8222-222222222222',
   'Marque fictive', 'Essence', 20000),
  ('b4444444-4444-4444-8444-444444444444', 'b2222222-2222-4222-8222-222222222222',
   'Marque fictive', 'Électrique', 20000),
  ('b5555555-5555-4555-8555-555555555555', 'b2222222-2222-4222-8222-222222222222',
   'Marque fictive', 'Hybride rechargeable', 20000);

insert into candidate_specs (candidate_id, specs)
values
  ('b3333333-3333-4333-8333-333333333333', '{"consumptionL100": 6}'),
  ('b4444444-4444-4444-8444-444444444444', '{"consumptionKwh100": 16}'),
  ('b5555555-5555-4555-8555-555555555555',
   '{"consumptionL100": 1.5, "consumptionKwh100Mixed": 15}');

create or replace function devenir_defaut (who uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', who, 'role', 'authenticated')::text, true);
end $$;

create or replace function redevenir_postgres_defaut () returns void
language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '{}', true);
end $$;

-- Comme `BudgetTab` : l'identifiant seul, le kilométrage et la durée par
-- défaut de la fonction.
select devenir_defaut('b1111111-1111-4111-8111-111111111111');
select set_config('t.essence',
  public.calculate_candidate_tco('b3333333-3333-4333-8333-333333333333')::text, true);
select set_config('t.electrique',
  public.calculate_candidate_tco('b4444444-4444-4444-8444-444444444444')::text, true);
select set_config('t.hybride',
  public.calculate_candidate_tco('b5555555-5555-4555-8555-555555555555')::text, true);
select redevenir_postgres_defaut();

-- ── 1. Chaque énergie, aux prix par défaut ─────────────────────────────────
select is(
  (current_setting('t.essence')::json->'breakdown'->>'fuel_cost')::numeric,
  8100::numeric,
  'essence : 6 L/100 km × 15 000 km × 1,80 € × 5 ans = 8 100 €'
);
select is(
  (current_setting('t.electrique')::json->'breakdown'->>'fuel_cost')::numeric,
  2640::numeric,
  'électrique : 16 kWh/100 km × 15 000 km × 0,22 € × 5 ans = 2 640 €'
);
select is(
  (current_setting('t.hybride')::json->'breakdown'->>'fuel_cost')::numeric,
  4500::numeric,
  'hybride rechargeable : (1,5 L × 150 × 1,80 € + 15 kWh × 150 × 0,22 €) × 5 ans = (405 + 495) × 5 = 4 500 €'
);

-- ── 2. Sur les kilomètres qu'affiche le calcul, et dans le total ───────────
select is(
  (current_setting('t.essence')::json->'parameters'->>'total_km')::numeric,
  75000::numeric,
  'le calcul affiche 75 000 km, et l''énergie porte sur ces kilomètres'
);
select is(
  (current_setting('t.essence')::json->>'total_tco')::numeric,
  19225.89::numeric,
  'total : 8 100 € d''énergie + 11 125,89 € de décote par défaut (20 000 × (1 − 0,85⁵))'
);

select * from finish();
rollback;
