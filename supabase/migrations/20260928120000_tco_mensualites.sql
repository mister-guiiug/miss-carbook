-- Carbook — le coût de possession compte douze mensualités par an, et son
-- détail s'additionne en son total.
--
-- DEUX DÉFAUTS de `calculate_candidate_tco`, présents depuis sa création
-- (20260424150000_budget_tco.sql) et repris à l'identique par
-- 20260925120000_rpc_droits.sql :
--
-- 1. TREIZE MENSUALITÉS PAR AN. La somme « annuelle » prenait
--    `frequency IN ('monthly', 'annual')`, qui compte déjà chaque mensualité
--    une fois, puis la conversion ajoutait `monthly × 12`. Un stationnement à
--    50 €/mois pesait 650 € par an au lieu de 600 €, soit 250 € de trop sur
--    cinq ans.
--
-- 2. UN DÉTAIL DANS DEUX UNITÉS. Le total multipliait bien les coûts
--    récurrents, le carburant et l'assurance par la durée de possession, et les
--    coûts au kilomètre par le kilométrage. Mais le détail renvoyait ces
--    postes PAR AN (et le tarif au km tel quel), à côté de la dépréciation et
--    du coût du crédit, eux sur toute la durée. Le client (`BudgetTab`) lit le
--    détail comme des totaux sur la durée : il affichait « soit X / an » en
--    divisant un montant déjà annuel par le nombre d'années, « soit X / km »
--    en divisant un carburant annuel par le kilométrage TOTAL, et la barre de
--    répartition rapportait des montants annuels au total sur cinq ans.
--
-- LE REMÈDE : le détail devient la décomposition exacte du total, chaque
-- poste sur toute la durée de possession (`purchase_price` reste une
-- information : le total compte la dépréciation, pas le prix d'achat). Les
-- noms des champs ne changent pas : `BudgetTab`, seul appelant, les lisait
-- déjà ainsi.
--
-- Exemple, sur cinq ans et 15 000 km/an : 50 €/mois + 300 €/an de coûts
-- récurrents font 900 €/an, donc `annual_costs` = 4 500 € (il valait 950 €,
-- ni l'un ni l'autre) ; 0,02 €/km fait `per_km_costs` = 1 500 € (il valait
-- 0,02).
--
-- Garde d'appartenance et droits d'exécution : inchangés (voir
-- 20260925120000_rpc_droits.sql). Rejouable sans effet de bord.

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
  v_consumption numeric;
  v_fuel_type text;
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
  -- Get candidate info
  SELECT c.workspace_id, c.price,
         COALESCE((cs.specs->>'consumption')::numeric, 0),
         COALESCE((cs.specs->>'fuelType')::text, 'essence')
  INTO v_workspace_id, v_price, v_consumption, v_fuel_type
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

  -- Calculate fuel cost
  IF v_tco_params.id IS NOT NULL THEN
    IF v_fuel_type IN ('essence', 'diesel', 'hybride') THEN
      v_fuel_cost := (v_consumption / 100) * p_annual_km * COALESCE(v_tco_params.fuel_price, 1.8);
    ELSIF v_fuel_type = 'électrique' THEN
      v_fuel_cost := (v_consumption / 100) * p_annual_km * COALESCE(v_tco_params.electricity_price, 0.22);
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
