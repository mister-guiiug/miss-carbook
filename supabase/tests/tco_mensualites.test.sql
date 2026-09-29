-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Le coût de possession compte douze mensualités par an — pgTAP.           ║
-- ║                                                                          ║
-- ║ Migration 20260928120000_tco_mensualites.sql. Avant elle,                ║
-- ║ `calculate_candidate_tco` comptait chaque mensualité TREIZE fois par an, ║
-- ║ et son détail mêlait des montants par an et sur toute la durée.          ║
-- ║                                                                          ║
-- ║ Mêmes précautions que `rpc_droits.test.sql` : on se fait passer pour le  ║
-- ║ membre comme PostgREST (rôle + `sub` du jeton), et on rend `postgres`    ║
-- ║ avant chaque assertion.                                                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

begin;
select plan(9);

-- ── Décor : un membre, un espace, deux candidats ───────────────────────────
insert into auth.users (id, email)
values ('f1111111-1111-4111-8111-111111111111', 'carbook.tco@exemple.test');

insert into workspaces (id, name, created_by)
values ('f2222222-2222-4222-8222-222222222222', 'Dossier TCO',
        'f1111111-1111-4111-8111-111111111111');

insert into candidates (id, workspace_id, brand, model, price)
values
  ('f3333333-3333-4333-8333-333333333333', 'f2222222-2222-4222-8222-222222222222',
   'Marque fictive', 'Complet', 24990),
  ('f4444444-4444-4444-8444-444444444444', 'f2222222-2222-4222-8222-222222222222',
   'Marque fictive', 'Mensualité seule', 10000);

-- Essence, 6 L/100 km, sous la clé qu'écrit l'interface. Ce décor portait
-- `consumption` et `fuelType`, les clés que lisait la fonction et que
-- l'interface n'écrit pas ; 20260930120000_tco_energie.sql lit les bonnes
-- (voir tco_energie.test.sql).
insert into candidate_specs (candidate_id, specs)
values ('f3333333-3333-4333-8333-333333333333',
        '{"consumptionL100": 6}');

-- Le candidat complet : un poste de chaque fréquence.
insert into budget_items (workspace_id, candidate_id, name, amount, frequency, created_by)
values
  ('f2222222-2222-4222-8222-222222222222', 'f3333333-3333-4333-8333-333333333333',
   'Carte grise', 800, 'one_time', 'f1111111-1111-4111-8111-111111111111'),
  ('f2222222-2222-4222-8222-222222222222', 'f3333333-3333-4333-8333-333333333333',
   'Stationnement', 50, 'monthly', 'f1111111-1111-4111-8111-111111111111'),
  ('f2222222-2222-4222-8222-222222222222', 'f3333333-3333-4333-8333-333333333333',
   'Entretien', 300, 'annual', 'f1111111-1111-4111-8111-111111111111'),
  ('f2222222-2222-4222-8222-222222222222', 'f3333333-3333-4333-8333-333333333333',
   'Pneus', 0.02, 'per_km', 'f1111111-1111-4111-8111-111111111111'),
  -- Le second : UNE mensualité, sur UN an.
  ('f2222222-2222-4222-8222-222222222222', 'f4444444-4444-4444-8444-444444444444',
   'Location de batterie', 100, 'monthly', 'f1111111-1111-4111-8111-111111111111');

insert into tco_parameters (workspace_id, candidate_id, annual_km, ownership_years,
                            insurance_cost, fuel_price, residual_value_percent)
values
  ('f2222222-2222-4222-8222-222222222222', 'f3333333-3333-4333-8333-333333333333',
   15000, 5, 600, 1.8, 50),
  ('f2222222-2222-4222-8222-222222222222', 'f4444444-4444-4444-8444-444444444444',
   15000, 1, null, null, 100);

create or replace function devenir_tco (who uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', who, 'role', 'authenticated')::text, true);
end $$;

create or replace function redevenir_postgres_tco () returns void
language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '{}', true);
end $$;

select devenir_tco('f1111111-1111-4111-8111-111111111111');
select set_config('t.seule',
  public.calculate_candidate_tco('f4444444-4444-4444-8444-444444444444')::text, true);
select set_config('t.complet',
  public.calculate_candidate_tco('f3333333-3333-4333-8333-333333333333')::text, true);
select redevenir_postgres_tco();

-- ── 1. Douze mensualités par an, pas treize ────────────────────────────────
select is(
  (current_setting('t.seule')::json->'breakdown'->>'annual_costs')::numeric,
  1200::numeric,
  '100 €/mois sur un an font 1 200 €, pas 1 300 €'
);
select is(
  (current_setting('t.seule')::json->>'total_tco')::numeric,
  1200::numeric,
  '... et c''est tout le coût, sans dépréciation (valeur résiduelle 100 %)'
);

-- ── 2. Le détail est sur toute la durée (5 ans, 15 000 km/an) ──────────────
select is(
  (current_setting('t.complet')::json->'breakdown'->>'annual_costs')::numeric,
  4500::numeric,
  'coûts récurrents : (50 × 12 + 300) × 5 = 4 500 €'
);
select is(
  (current_setting('t.complet')::json->'breakdown'->>'per_km_costs')::numeric,
  1500::numeric,
  'coûts au km : 0,02 × 15 000 × 5 = 1 500 €'
);
select is(
  (current_setting('t.complet')::json->'breakdown'->>'fuel_cost')::numeric,
  8100::numeric,
  'carburant : 6/100 × 15 000 × 1,80 × 5 = 8 100 €'
);
select is(
  (current_setting('t.complet')::json->'breakdown'->>'insurance_cost')::numeric,
  3000::numeric,
  'assurance : 600 × 5 = 3 000 €'
);
select is(
  (current_setting('t.complet')::json->'breakdown'->>'depreciation')::numeric,
  12495::numeric,
  'dépréciation : 24 990 × 50 % = 12 495 €'
);

-- ── 3. Le total est la somme du détail, prix d'achat exclu ─────────────────
select is(
  (current_setting('t.complet')::json->>'total_tco')::numeric,
  30395::numeric,
  'total : 800 + 4 500 + 1 500 + 8 100 + 3 000 + 12 495 = 30 395 €'
);
select is(
  (select sum(value::numeric)
     from json_each_text(current_setting('t.complet')::json->'breakdown')
    where key <> 'purchase_price'),
  (current_setting('t.complet')::json->>'total_tco')::numeric,
  'la somme des postes du détail, hors prix d''achat, égale le total'
);

select * from finish();
rollback;
