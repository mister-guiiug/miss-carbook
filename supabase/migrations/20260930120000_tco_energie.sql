-- Carbook — le poste énergie du coût de possession lit enfin les données
-- constructeur.
--
-- LE DÉFAUT, relevé le 29/09/2026, présent depuis la création de la fonction
-- (20260424150000_budget_tco.sql) et repris à l'identique par
-- 20260925120000_rpc_droits.sql puis 20260928120000_tco_mensualites.sql :
-- `calculate_candidate_tco` lisait `specs->>'consumption'` et
-- `specs->>'fuelType'`. L'interface n'écrit aucune de ces deux clés : les
-- données constructeur (`candidateSpecsShape`, src/lib/validation/schemas.ts)
-- portent `consumptionL100` et `consumptionKwh100`, et il n'existe aucun champ
-- `fuelType`. La consommation valait donc 0 pour tous les modèles : le poste
-- énergie (`fuel_cost`) valait toujours 0, et le « Prix carburant » des
-- paramètres n'avait aucun effet.
--
-- LE REMÈDE : l'énergie se déduit de la consommation RÉELLEMENT SAISIE, et
-- chaque consommation est comptée à son prix. On n'ajoute pas de champ
-- `fuelType` : il ferait doublon avec le champ libre « Énergie / carburant »
-- de la fiche, et n'apprendrait rien que les consommations ne disent déjà.
--   - `consumptionL100` (L/100 km) est comptée au prix du carburant ;
--   - `consumptionKwh100` (kWh/100 km) est comptée au prix de l'électricité.
--     Si elle manque, on prend `consumptionKwh100Mixed`, la consommation
--     électrique mixte que l'interface propose juste à côté. Sans ce repli,
--     une voiture électrique décrite par ce seul champ resterait à 0 ;
--   - une hybride rechargeable compte les deux : la norme WLTP publie pour
--     elle une consommation de carburant et une consommation électrique
--     PONDÉRÉES, qui s'additionnent.
-- Seul un nombre positif compte, comme dans le formulaire, qui n'affiche
-- qu'un nombre. Une valeur d'un autre type est ignorée ; avant, elle faisait
-- échouer la conversion en `numeric`, et la fonction avec elle. Le poste garde
-- son nom, `fuel_cost` : `BudgetTab`, le seul appelant, le lit ainsi.
--
-- TOUT LE RESTE EST IDENTIQUE à 20260928120000_tco_mensualites.sql : les prix
-- par défaut (1,80 €/L, 0,22 €/kWh), l'énergie comptée seulement quand le
-- modèle a des paramètres TCO enregistrés, les autres postes, la garde
-- d'appartenance et les droits d'exécution. Rejouable sans effet de bord.
--
-- Exemple, sur cinq ans et 12 000 km/an : 16 kWh/100 km à 0,20 € font
-- 384 €/an, donc `fuel_cost` = 1 920 € (il valait 0).

CREATE OR REPLACE FUNCTION public.calculate_candidate_tco (
  p_candidate_id uuid,
  p_annual_km int DEFAULT 15000,
  p_ownership_years int DEFAULT 5
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id uuid;
  v_price numeric;
  -- Consommations des données constructeur, NULL quand rien n'est saisi.
  v_consumption_l100 numeric;
  v_consumption_kwh100 numeric;
  v_consumption_kwh100_mixed numeric;
  v_tco_params RECORD;
  v_one_time_cost numeric := 0;
  -- Montants PAR AN (ou par km), avant d'être portés sur la durée.
  v_annual_cost numeric := 0;
  v_per_km_cost numeric := 0;
  v_fuel_cost numeric := 0;
  v_insurance_cost numeric := 0;
  -- Montants sur TOUTE la durée de possession : ce que renvoie le détail.
  v_recurring_total numeric := 0;
  v_per_km_total numeric := 0;
  v_fuel_total numeric := 0;
  v_insurance_total numeric := 0;
  v_depreciation numeric := 0;
  v_financing_cost numeric := 0;
  v_total_tco numeric := 0;
  v_result json;
BEGIN
  -- Get candidate info. Les consommations sont lues sous les clés qu'écrit
  -- l'interface, et seulement si la valeur est un nombre.
  SELECT c.workspace_id, c.price,
         CASE WHEN jsonb_typeof(cs.specs->'consumptionL100') = 'number'
              THEN (cs.specs->>'consumptionL100')::numeric END,
         CASE WHEN jsonb_typeof(cs.specs->'consumptionKwh100') = 'number'
              THEN (cs.specs->>'consumptionKwh100')::numeric END,
         CASE WHEN jsonb_typeof(cs.specs->'consumptionKwh100Mixed') = 'number'
              THEN (cs.specs->>'consumptionKwh100Mixed')::numeric END
  INTO v_workspace_id, v_price,
       v_consumption_l100, v_consumption_kwh100, v_consumption_kwh100_mixed
  FROM candidates c
  LEFT JOIN candidate_specs cs ON cs.candidate_id = c.id
  WHERE c.id = p_candidate_id;

  IF v_workspace_id IS NULL THEN
    RETURN '{"error": "candidate_not_found"}'::json;
  END IF;

  -- Un candidat d'un AUTRE espace répond comme un candidat inexistant (voir
  -- 20260925120000_rpc_droits.sql) : pas d'oracle d'existence.
  IF NOT public.is_workspace_member(v_workspace_id) THEN
    RETURN '{"error": "candidate_not_found"}'::json;
  END IF;

  -- Get TCO parameters
  SELECT * INTO v_tco_params
  FROM tco_parameters
  WHERE candidate_id = p_candidate_id;

  IF v_tco_params.id IS NOT NULL THEN
    p_annual_km := COALESCE(v_tco_params.annual_km, p_annual_km);
    p_ownership_years := COALESCE(v_tco_params.ownership_years, p_ownership_years);
  END IF;

  -- Calculate one-time costs
  SELECT COALESCE(SUM(amount), 0)
  INTO v_one_time_cost
  FROM budget_items
  WHERE candidate_id = p_candidate_id
    AND frequency = 'one_time';

  -- Coûts récurrents, PAR AN : douze fois chaque mensualité, une fois chaque
  -- annuité. Une seule somme, chaque ligne comptée une seule fois.
  SELECT COALESCE(SUM(CASE frequency
                        WHEN 'monthly' THEN amount * 12
                        WHEN 'annual' THEN amount
                      END), 0)
  INTO v_annual_cost
  FROM budget_items
  WHERE candidate_id = p_candidate_id
    AND frequency IN ('monthly', 'annual');

  -- Calculate per-km costs
  SELECT COALESCE(SUM(amount), 0)
  INTO v_per_km_cost
  FROM budget_items
  WHERE candidate_id = p_candidate_id
    AND frequency = 'per_km';

  -- Énergie, PAR AN : chaque consommation saisie, au prix de son énergie.
  -- `v_fuel_cost` garde son nom : c'est le poste `fuel_cost` du détail.
  IF v_tco_params.id IS NOT NULL THEN
    IF v_consumption_l100 > 0 THEN
      v_fuel_cost := v_fuel_cost
        + (v_consumption_l100 / 100) * p_annual_km * COALESCE(v_tco_params.fuel_price, 1.8);
    END IF;
    -- La consommation électrique mixte ne sert qu'à défaut de l'autre.
    IF COALESCE(v_consumption_kwh100, 0) <= 0 THEN
      v_consumption_kwh100 := v_consumption_kwh100_mixed;
    END IF;
    IF v_consumption_kwh100 > 0 THEN
      v_fuel_cost := v_fuel_cost
        + (v_consumption_kwh100 / 100) * p_annual_km * COALESCE(v_tco_params.electricity_price, 0.22);
    END IF;
  END IF;

  -- Calculate insurance cost
  IF v_tco_params.id IS NOT NULL AND v_tco_params.insurance_cost IS NOT NULL THEN
    v_insurance_cost := v_tco_params.insurance_cost;
  END IF;

  -- Calculate depreciation
  IF v_price IS NOT NULL THEN
    IF v_tco_params.id IS NOT NULL AND v_tco_params.residual_value_percent IS NOT NULL THEN
      v_depreciation := v_price * (1 - v_tco_params.residual_value_percent / 100);
    ELSE
      -- Default: 15% depreciation per year compounded
      v_depreciation := v_price * (1 - POWER(0.85, p_ownership_years));
    END IF;
  END IF;

  -- Calculate financing cost
  IF v_price IS NOT NULL AND v_tco_params.id IS NOT NULL AND v_tco_params.loan_interest_rate IS NOT NULL THEN
    DECLARE
      v_monthly_rate numeric;
      v_monthly_payment numeric;
      v_total_payments numeric;
    BEGIN
      v_monthly_rate := v_tco_params.loan_interest_rate / 100 / 12;
      IF v_monthly_rate > 0 THEN
        v_monthly_payment := v_price * v_monthly_rate / (1 - POWER(1 + v_monthly_rate, -COALESCE(v_tco_params.loan_months, 60)));
        v_total_payments := v_monthly_payment * COALESCE(v_tco_params.loan_months, 60);
        v_financing_cost := v_total_payments - v_price;
      END IF;
    END;
  END IF;

  -- Chaque poste sur toute la durée de possession.
  v_recurring_total := v_annual_cost * p_ownership_years;
  v_per_km_total := v_per_km_cost * p_annual_km * p_ownership_years;
  v_fuel_total := v_fuel_cost * p_ownership_years;
  v_insurance_total := v_insurance_cost * p_ownership_years;

  -- Le total est la somme EXACTE des postes du détail (hors prix d'achat).
  v_total_tco := v_one_time_cost
               + v_recurring_total
               + v_per_km_total
               + v_fuel_total
               + v_insurance_total
               + v_depreciation
               + v_financing_cost;

  -- Build result
  v_result := json_build_object(
    'candidate_id', p_candidate_id,
    'total_tco', ROUND(v_total_tco::numeric, 2),
    'breakdown', json_build_object(
      'purchase_price', COALESCE(v_price, 0),
      'one_time_costs', ROUND(v_one_time_cost::numeric, 2),
      'annual_costs', ROUND(v_recurring_total::numeric, 2),
      'per_km_costs', ROUND(v_per_km_total::numeric, 2),
      'fuel_cost', ROUND(v_fuel_total::numeric, 2),
      'insurance_cost', ROUND(v_insurance_total::numeric, 2),
      'depreciation', ROUND(v_depreciation::numeric, 2),
      'financing_cost', ROUND(v_financing_cost::numeric, 2)
    ),
    'parameters', json_build_object(
      'annual_km', p_annual_km,
      'ownership_years', p_ownership_years,
      'total_km', p_annual_km * p_ownership_years
    )
  );

  RETURN v_result;
END;
$$;

-- Droits inchangés : `CREATE OR REPLACE` les conserve. Reposés quand même,
-- pour que ce fichier dise à lui seul qui peut appeler la fonction.
REVOKE EXECUTE ON FUNCTION public.calculate_candidate_tco (uuid, int, int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.calculate_candidate_tco (uuid, int, int) TO authenticated;
