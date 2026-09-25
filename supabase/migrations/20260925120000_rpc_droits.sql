-- Carbook — les RPC SECURITY DEFINER ne servent plus que leur espace.
--
-- LE DÉFAUT CORRIGÉ, relevé le 25/09/2026 dans une revue des fonctions
-- `security definer` du parc. Quatre fonctions agissaient sur un espace
-- désigné par son seul identifiant, sans vérifier que l'appelant en est membre,
-- et restaient exécutables par `authenticated` (et par `anon`, qui reçoit
-- d'office le droit d'exécuter toute fonction neuve de `public`) :
--
--   - `calculate_candidate_tco(uuid, int, int)` lisait le prix, les
--     caractéristiques et le budget de n'importe quel candidat ;
--   - `candidate_weighted_score` et `requirement_weighted_score` rendaient
--     les scores de vote pondérés de n'importe quel espace ;
--   - `create_default_budget_categories` (sans aucun contrôle) et
--     `create_default_trial_checklist` (authentification seulement)
--     écrivaient dans n'importe quel espace.
--
-- L'identifiant d'un candidat ou d'un espace ne se devine pas, mais il se
-- conserve : un membre sorti d'un espace le connaissait encore.
--
-- LE REMÈDE, au plus juste :
--   - `calculate_candidate_tco`, seule appelée par le client (`BudgetTab`),
--     est reprise à l'identique avec une garde d'appartenance ;
--   - les quatre autres ne sont appelées par RIEN : ni le client (qui passe par
--     les tables, sous RLS), ni une autre fonction, ni une vue. Leur droit
--     d'exécution est retiré à `public`, `anon` et `authenticated`.
--     `service_role` le garde, pour l'administration.
--
-- Rejouable sans effet de bord.

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
  v_annual_cost numeric := 0;
  v_per_km_cost numeric := 0;
  v_total_tco numeric := 0;
  v_fuel_cost numeric := 0;
  v_insurance_cost numeric := 0;
  v_depreciation numeric := 0;
  v_financing_cost numeric := 0;
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

  -- Un candidat d'un AUTRE espace répond comme un candidat inexistant : la
  -- fonction est SECURITY DEFINER, elle lit sans RLS, et sans cette garde elle
  -- rendait le prix, les caractéristiques et le budget de n'importe quel
  -- candidat à qui en connaissait l'identifiant. Même réponse que l'absence :
  -- pas d'oracle d'existence.
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

  -- Calculate annual costs
  SELECT COALESCE(SUM(amount), 0)
  INTO v_annual_cost
  FROM budget_items
  WHERE candidate_id = p_candidate_id
    AND frequency IN ('monthly', 'annual');

  -- Convert monthly to annual
  v_annual_cost := v_annual_cost + (
    SELECT COALESCE(SUM(amount) * 12, 0)
    FROM budget_items
    WHERE candidate_id = p_candidate_id
      AND frequency = 'monthly'
  );

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

  -- Calculate total TCO
  v_total_tco := v_one_time_cost
               + (v_annual_cost * p_ownership_years)
               + (v_per_km_cost * p_annual_km * p_ownership_years)
               + (v_fuel_cost * p_ownership_years)
               + (v_insurance_cost * p_ownership_years)
               + v_depreciation
               + v_financing_cost;

  -- Build result
  v_result := json_build_object(
    'candidate_id', p_candidate_id,
    'total_tco', ROUND(v_total_tco::numeric, 2),
    'breakdown', json_build_object(
      'purchase_price', COALESCE(v_price, 0),
      'one_time_costs', ROUND(v_one_time_cost::numeric, 2),
      'annual_costs', ROUND(v_annual_cost::numeric, 2),
      'per_km_costs', ROUND(v_per_km_cost::numeric, 2),
      'fuel_cost', ROUND(v_fuel_cost::numeric, 2),
      'insurance_cost', ROUND(v_insurance_cost::numeric, 2),
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

REVOKE EXECUTE ON FUNCTION public.calculate_candidate_tco (uuid, int, int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.calculate_candidate_tco (uuid, int, int) TO authenticated;

REVOKE EXECUTE ON FUNCTION
  public.candidate_weighted_score (uuid, text),
  public.requirement_weighted_score (uuid),
  public.create_default_budget_categories (uuid),
  public.create_default_trial_checklist (uuid)
FROM public, anon, authenticated;
