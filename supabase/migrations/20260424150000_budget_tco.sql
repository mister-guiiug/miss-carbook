-- Budget and TCO (Total Cost of Ownership) Migration
-- Allows tracking budget items and calculating TCO for vehicle candidates

-- Table for budget categories
CREATE TABLE IF NOT EXISTS public.budget_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 100),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
  color text NOT NULL DEFAULT 'default' CHECK (color IN ('default', 'primary', 'secondary', 'success', 'warning', 'danger', 'info')),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bc_workspace ON public.budget_categories (workspace_id);

-- Table for budget items
CREATE TABLE IF NOT EXISTS public.budget_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.budget_categories (id) ON DELETE SET NULL,
  candidate_id uuid REFERENCES public.candidates (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 200),
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  frequency text NOT NULL DEFAULT 'one_time' CHECK (frequency IN ('one_time', 'monthly', 'annual', 'per_km')),
  is_recurring boolean NOT NULL DEFAULT false,
  is_planned boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 2000),
  sort_order int NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bi_workspace ON public.budget_items (workspace_id);
CREATE INDEX IF NOT EXISTS idx_bi_category ON public.budget_items (category_id);
CREATE INDEX IF NOT EXISTS idx_bi_candidate ON public.budget_items (candidate_id);

-- Table for TCO parameters (per workspace or per candidate)
CREATE TABLE IF NOT EXISTS public.tco_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  candidate_id uuid REFERENCES public.candidates (id) ON DELETE CASCADE,
  annual_km int NOT NULL DEFAULT 15000 CHECK (annual_km >= 0 AND annual_km <= 100000),
  ownership_years int NOT NULL DEFAULT 5 CHECK (ownership_years >= 1 AND ownership_years <= 15),
  insurance_cost numeric(10, 2) CHECK (insurance_cost IS NULL OR insurance_cost >= 0),
  fuel_price numeric(6, 3) CHECK (fuel_price IS NULL OR fuel_price >= 0),
  electricity_price numeric(6, 3) CHECK (electricity_price IS NULL OR electricity_price >= 0),
  residual_value_percent numeric(5, 2) CHECK (residual_value_percent IS NULL OR (residual_value_percent >= 0 AND residual_value_percent <= 100)),
  loan_interest_rate numeric(5, 2) CHECK (loan_interest_rate IS NULL OR (loan_interest_rate >= 0 AND loan_interest_rate <= 20)),
  loan_months int CHECK (loan_months IS NULL OR (loan_months >= 12 AND loan_months <= 96)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, candidate_id)
);

CREATE INDEX IF NOT EXISTS idx_tco_workspace ON public.tco_parameters (workspace_id);
CREATE INDEX IF NOT EXISTS idx_tco_candidate ON public.tco_parameters (candidate_id);

-- Trigger for updated_at on budget_items
DROP TRIGGER IF EXISTS trg_bi_updated ON public.budget_items;

CREATE TRIGGER trg_bi_updated BEFORE UPDATE ON public.budget_items FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Trigger for updated_at on tco_parameters
DROP TRIGGER IF EXISTS trg_tco_updated ON public.tco_parameters;

CREATE TRIGGER trg_tco_updated BEFORE UPDATE ON public.tco_parameters FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS
ALTER TABLE public.budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tco_parameters ENABLE ROW LEVEL SECURITY;

-- RLS Policies for budget_categories
DROP POLICY IF EXISTS bc_select ON public.budget_categories;

CREATE POLICY bc_select ON public.budget_categories FOR
SELECT USING (public.is_workspace_member (workspace_id));

DROP POLICY IF EXISTS bc_write ON public.budget_categories;

CREATE POLICY bc_write ON public.budget_categories FOR ALL
USING (public.can_write_workspace (workspace_id))
WITH CHECK (public.can_write_workspace (workspace_id));

-- RLS Policies for budget_items
DROP POLICY IF EXISTS bi_select ON public.budget_items;

CREATE POLICY bi_select ON public.budget_items FOR
SELECT USING (public.is_workspace_member (workspace_id));

DROP POLICY IF EXISTS bi_write ON public.budget_items;

CREATE POLICY bi_write ON public.budget_items FOR ALL
USING (public.can_write_workspace (workspace_id))
WITH CHECK (public.can_write_workspace (workspace_id));

-- RLS Policies for tco_parameters
DROP POLICY IF EXISTS tco_select ON public.tco_parameters;

CREATE POLICY tco_select ON public.tco_parameters FOR
SELECT USING (public.is_workspace_member (workspace_id));

DROP POLICY IF EXISTS tco_write ON public.tco_parameters;

CREATE POLICY tco_write ON public.tco_parameters FOR ALL
USING (public.can_write_workspace (workspace_id))
WITH CHECK (public.can_write_workspace (workspace_id));

-- Function to calculate TCO for a candidate
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

GRANT EXECUTE ON FUNCTION public.calculate_candidate_tco (uuid, int, int) TO authenticated;

-- Function to get default budget categories for a workspace
CREATE OR REPLACE FUNCTION public.create_default_budget_categories (p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.budget_categories (workspace_id, name, description, color, sort_order) VALUES
    (p_workspace_id, 'Achat', 'Coûts liés à l''achat du véhicule', 'primary', 1),
    (p_workspace_id, 'Entretien', 'Entretien courant, réparations, pneus', 'warning', 2),
    (p_workspace_id, 'Carburant', 'Coûts de carburant ou recharge', 'danger', 3),
    (p_workspace_id, 'Assurance', 'Assurance automobile', 'info', 4),
    (p_workspace_id, 'Taxes', 'Carte grise, malus, taxes diverses', 'secondary', 5),
    (p_workspace_id, 'Équipements', 'Options et accessoires', 'success', 6)
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_default_budget_categories (uuid) TO authenticated;

-- Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE
      pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'budget_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.budget_items;
  END IF;
END;
$$;
