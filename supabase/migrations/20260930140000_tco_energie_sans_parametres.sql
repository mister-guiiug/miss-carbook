-- Carbook — le poste énergie est compté même sans paramètres TCO
-- enregistrés.
--
-- LE DÉFAUT, présent depuis la création de la fonction
-- (20260424150000_budget_tco.sql) et gardé tel quel par
-- 20260930120000_tco_energie.sql : l'énergie n'était comptée que si le modèle
-- avait une ligne dans `tco_parameters`, c'est-à-dire après un premier
-- « Calculer le TCO ». Le reste du calcul se passe pourtant de cette ligne :
-- 15 000 km par an sur 5 ans (les valeurs par défaut de la fonction, celles
-- qu'utilise `BudgetTab`), et une dépréciation de 15 % par an. Un modèle
-- dont la fiche donne une consommation affichait donc un coût « sur 5 ans /
-- 75 000 km » sans un litre ni un kWh. L'onglet Budget l'expliquait par
-- « Comptée une fois les paramètres enregistrés ».
--
-- LE REMÈDE : ce poste ne dépend plus de la ligne `tco_parameters`. Sans
-- elle, `v_tco_params` a tous ses champs à NULL, et l'énergie est comptée aux
-- prix par défaut (1,80 €/L, 0,22 €/kWh), sur le kilométrage et la durée par
-- défaut. L'assurance et le crédit, eux, demandent toujours une saisie.
--
-- TOUT LE RESTE EST IDENTIQUE à 20260930120000_tco_energie.sql : la lecture
-- des consommations, les prix par défaut, les autres postes, la garde
-- d'appartenance et les droits d'exécution. Rejouable sans effet de bord.
--
-- Exemple, sans paramètres : 6 L/100 km × 15 000 km × 1,80 € × 5 ans font
-- `fuel_cost` = 8 100 € (il valait 0).

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
  -- Comptée même sans paramètres enregistrés : `v_tco_params` a alors tous
  -- ses champs à NULL, d'où les prix par défaut, sur le kilométrage et la
  -- durée par défaut de la fonction.
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
