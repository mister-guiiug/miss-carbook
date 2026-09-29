-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Le poste énergie lit les consommations que saisit l'interface — pgTAP.   ║
-- ║                                                                          ║
-- ║ Migration 20260930120000_tco_energie.sql. Avant elle,                    ║
-- ║ `calculate_candidate_tco` lisait `consumption` et `fuelType`, deux clés  ║
-- ║ que l'interface n'écrit pas : l'énergie valait toujours 0, et le prix du ║
-- ║ carburant saisi ne changeait rien.                                       ║
-- ║                                                                          ║
-- ║ Chaque modèle est revendu 100 % de son prix et n'a aucun autre frais :   ║
-- ║ son total est son énergie, rien d'autre.                                 ║
-- ║                                                                          ║
-- ║ Mêmes précautions que `rpc_droits.test.sql` : on se fait passer pour un  ║
-- ║ compte comme PostgREST (rôle + `sub` du jeton), et on rend `postgres`    ║
-- ║ avant chaque assertion.                                                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

begin;
select plan(16);

-- ── Décor : un membre, un étranger, un espace chacun ───────────────────────
insert into auth.users (id, email)
values
  ('d1111111-1111-4111-8111-111111111111', 'carbook.energie@exemple.test'),
  ('d2222222-2222-4222-8222-222222222222', 'carbook.energie.etranger@exemple.test');

insert into workspaces (id, name, created_by)
values
  ('d3333333-3333-4333-8333-333333333333', 'Dossier énergie',
   'd1111111-1111-4111-8111-111111111111'),
  ('d4444444-4444-4444-8444-444444444444', 'Dossier de l''étranger',
   'd2222222-2222-4222-8222-222222222222');

-- Un modèle par cas, tous chez le membre.
insert into candidates (id, workspace_id, brand, model, price)
values
  ('d5555555-5555-4555-8555-555555555555', 'd3333333-3333-4333-8333-333333333333',
   'Marque fictive', 'Essence', 20000),
  ('d6666666-6666-4666-8666-666666666666', 'd3333333-3333-4333-8333-333333333333',
   'Marque fictive', 'Électrique', 20000),
  ('d7777777-7777-4777-8777-777777777777', 'd3333333-3333-4333-8333-333333333333',
   'Marque fictive', 'Électrique, prix par défaut', 20000),
  ('d8888888-8888-4888-8888-888888888888', 'd3333333-3333-4333-8333-333333333333',
   'Marque fictive', 'Électrique, consommation mixte seule', 20000),
  ('d9999999-9999-4999-8999-999999999999', 'd3333333-3333-4333-8333-333333333333',
   'Marque fictive', 'Hybride rechargeable', 20000),
  ('daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'd3333333-3333-4333-8333-333333333333',
   'Marque fictive', 'Sans consommation', 20000),
  ('dbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'd3333333-3333-4333-8333-333333333333',
   'Marque fictive', 'Consommation en texte', 20000),
  ('dccccccc-cccc-4ccc-8ccc-cccccccccccc', 'd3333333-3333-4333-8333-333333333333',
   'Marque fictive', 'Sans paramètres', 20000);

-- Les données constructeur, sous les clés qu'écrit l'interface
-- (`candidateSpecsShape`, src/lib/validation/schemas.ts).
insert into candidate_specs (candidate_id, specs)
values
  ('d5555555-5555-4555-8555-555555555555', '{"consumptionL100": 6}'),
  ('d6666666-6666-4666-8666-666666666666', '{"consumptionKwh100": 16}'),
  ('d7777777-7777-4777-8777-777777777777', '{"consumptionKwh100": 16}'),
  ('d8888888-8888-4888-8888-888888888888', '{"consumptionKwh100Mixed": 15}'),
  -- La consommation électrique mixte ne sert qu'à défaut de l'autre : ses
  -- 99 kWh ne comptent pas.
  ('d9999999-9999-4999-8999-999999999999',
   '{"consumptionL100": 1.5, "consumptionKwh100": 15, "consumptionKwh100Mixed": 99}'),
  ('daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{"powerKw": 110, "notes": "fiche sans consommation"}'),
  -- Du texte, que le formulaire n'affiche pas.
  ('dbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '{"consumptionL100": "6,5", "consumptionKwh100": "16"}'),
  ('dccccccc-cccc-4ccc-8ccc-cccccccccccc', '{"consumptionL100": 6}');

-- Revendu 100 % de son prix : aucune dépréciation. Le dernier modèle n'a
-- aucun paramètre enregistré.
insert into tco_parameters (workspace_id, candidate_id, annual_km, ownership_years,
                            fuel_price, electricity_price, residual_value_percent)
values
  ('d3333333-3333-4333-8333-333333333333', 'd5555555-5555-4555-8555-555555555555',
   15000, 5, 1.8, null, 100),
  ('d3333333-3333-4333-8333-333333333333', 'd6666666-6666-4666-8666-666666666666',
   12000, 5, null, 0.2, 100),
  ('d3333333-3333-4333-8333-333333333333', 'd7777777-7777-4777-8777-777777777777',
   12000, 5, null, null, 100),
  ('d3333333-3333-4333-8333-333333333333', 'd8888888-8888-4888-8888-888888888888',
   10000, 1, null, 0.25, 100),
  ('d3333333-3333-4333-8333-333333333333', 'd9999999-9999-4999-8999-999999999999',
   15000, 1, 1.8, 0.2, 100),
  ('d3333333-3333-4333-8333-333333333333', 'daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   15000, 5, 1.8, 0.2, 100),
  ('d3333333-3333-4333-8333-333333333333', 'dbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   15000, 5, 1.8, 0.2, 100);

create or replace function devenir_energie (who uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', who, 'role', 'authenticated')::text, true);
end $$;

create or replace function redevenir_postgres_energie () returns void
language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '{}', true);
end $$;

select devenir_energie('d1111111-1111-4111-8111-111111111111');
select set_config('t.essence',
  public.calculate_candidate_tco('d5555555-5555-4555-8555-555555555555')::text, true);
select set_config('t.electrique',
  public.calculate_candidate_tco('d6666666-6666-4666-8666-666666666666')::text, true);
select set_config('t.defaut',
  public.calculate_candidate_tco('d7777777-7777-4777-8777-777777777777')::text, true);
select set_config('t.mixte',
  public.calculate_candidate_tco('d8888888-8888-4888-8888-888888888888')::text, true);
select set_config('t.hybride',
  public.calculate_candidate_tco('d9999999-9999-4999-8999-999999999999')::text, true);
select set_config('t.sans_conso',
  public.calculate_candidate_tco('daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')::text, true);
select set_config('t.texte',
  public.calculate_candidate_tco('dbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')::text, true);
select set_config('t.sans_params',
  public.calculate_candidate_tco('dccccccc-cccc-4ccc-8ccc-cccccccccccc')::text, true);
select redevenir_postgres_energie();

-- ── 1. Essence : les litres, au prix du carburant ──────────────────────────
select is(
  (current_setting('t.essence')::json->'breakdown'->>'fuel_cost')::numeric,
  8100::numeric,
  'essence : 6 L/100 km × 15 000 km × 1,80 € × 5 ans = 8 100 €'
);
select is(
  (current_setting('t.essence')::json->>'total_tco')::numeric,
  8100::numeric,
  '... et l''énergie entre dans le total'
);

-- ── 2. Le prix du carburant saisi change le résultat ───────────────────────
update tco_parameters
   set fuel_price = 2
 where candidate_id = 'd5555555-5555-4555-8555-555555555555';

select devenir_energie('d1111111-1111-4111-8111-111111111111');
select set_config('t.essence_2',
  public.calculate_candidate_tco('d5555555-5555-4555-8555-555555555555')::text, true);
select redevenir_postgres_energie();

select is(
  (current_setting('t.essence_2')::json->'breakdown'->>'fuel_cost')::numeric,
  9000::numeric,
  'à 2 € le litre, le même modèle coûte 9 000 € d''énergie'
);

-- ── 3. Électrique : les kWh, au prix de l'électricité ──────────────────────
select is(
  (current_setting('t.electrique')::json->'breakdown'->>'fuel_cost')::numeric,
  1920::numeric,
  'électrique : 16 kWh/100 km × 12 000 km × 0,20 € × 5 ans = 1 920 €'
);
select is(
  (current_setting('t.defaut')::json->'breakdown'->>'fuel_cost')::numeric,
  2112::numeric,
  '... et 0,22 € le kWh quand aucun prix n''est saisi : 2 112 €'
);
select is(
  (current_setting('t.mixte')::json->'breakdown'->>'fuel_cost')::numeric,
  375::numeric,
  'la consommation électrique mixte, seule saisie, compte : 15 kWh/100 km × 10 000 km × 0,25 € = 375 €'
);

-- ── 4. Hybride rechargeable : les deux énergies s'additionnent ─────────────
select is(
  (current_setting('t.hybride')::json->'breakdown'->>'fuel_cost')::numeric,
  855::numeric,
  'hybride rechargeable : 1,5 L × 150 × 1,80 € + 15 kWh × 150 × 0,20 € = 405 + 450 = 855 €'
);
select is(
  (select sum(value::numeric)
     from json_each_text(current_setting('t.hybride')::json->'breakdown')
    where key <> 'purchase_price'),
  (current_setting('t.hybride')::json->>'total_tco')::numeric,
  'la somme des postes du détail, hors prix d''achat, égale toujours le total'
);

-- ── 5. Rien à compter ──────────────────────────────────────────────────────
select is(
  (current_setting('t.sans_conso')::json->'breakdown'->>'fuel_cost')::numeric,
  0::numeric,
  'sans consommation dans les données constructeur, pas d''énergie'
);
select is(
  current_setting('t.texte')::json->>'error',
  null,
  'une consommation écrite en texte ne fait pas échouer le calcul'
);
select is(
  (current_setting('t.texte')::json->'breakdown'->>'fuel_cost')::numeric,
  0::numeric,
  '... elle est ignorée, comme le formulaire l''ignore'
);
select is(
  (current_setting('t.sans_params')::json->'breakdown'->>'fuel_cost')::numeric,
  0::numeric,
  'sans paramètres TCO enregistrés, l''énergie n''est pas comptée (inchangé)'
);

-- ── 6. La garde d'appartenance et les droits, inchangés ────────────────────
select devenir_energie('d2222222-2222-4222-8222-222222222222');
select set_config('t.etranger',
  public.calculate_candidate_tco('d5555555-5555-4555-8555-555555555555')::text, true);
select redevenir_postgres_energie();

select is(
  current_setting('t.etranger')::jsonb,
  '{"error": "candidate_not_found"}'::jsonb,
  'un compte d''un autre espace ne reçoit que la réponse d''un candidat inexistant'
);
select ok(
  (select p.prosecdef and p.proconfig @> array['search_path=public']
     from pg_proc p
    where p.oid = 'public.calculate_candidate_tco(uuid, int, int)'::regprocedure),
  'la fonction reste SECURITY DEFINER, avec un search_path fixé'
);
select ok(
  has_function_privilege('authenticated', 'public.calculate_candidate_tco(uuid, int, int)', 'execute'),
  'un compte connecté peut l''appeler (BudgetTab)'
);
select ok(
  not has_function_privilege('anon', 'public.calculate_candidate_tco(uuid, int, int)', 'execute'),
  '... anon ne le peut pas'
);

select * from finish();
rollback;
