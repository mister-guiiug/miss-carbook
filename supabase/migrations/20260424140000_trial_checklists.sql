-- Trial Checklist Migration
-- Adds trial checklists for vehicle test drives

-- Table for trial checklist templates
CREATE TABLE IF NOT EXISTS public.trial_checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 200),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS EXISTS idx_tct_workspace ON public.trial_checklist_templates (workspace_id);

-- Table for trial checklist items (within templates)
CREATE TABLE IF NOT EXISTS public.trial_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  template_id uuid NOT NULL REFERENCES public.trial_checklist_templates (id) ON DELETE CASCADE,
  label text NOT NULL CHECK (char_length(trim(label)) BETWEEN 1 AND 200),
  category text NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'exterior', 'interior', 'driving', 'comfort', 'technology', 'safety', 'performance')),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS EXISTS idx_tci_template ON public.trial_checklist_items (template_id);

-- Table for trial checklist completions (linked to visits)
CREATE TABLE IF NOT EXISTS public.trial_checklist_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  visit_id uuid NOT NULL REFERENCES public.visits (id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.trial_checklist_templates (id) ON DELETE CASCADE,
  completed_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 5000),
  UNIQUE (visit_id, template_id, completed_by)
);

CREATE INDEX IF NOT EXISTS EXISTS idx_tcc_visit ON public.trial_checklist_completions (visit_id);
CREATE INDEX IF NOT EXISTS EXISTS idx_tcc_template ON public.trial_checklist_completions (template_id);

-- Table for trial checklist item responses
CREATE TABLE IF NOT EXISTS public.trial_checklist_item_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  completion_id uuid NOT NULL REFERENCES public.trial_checklist_completions (id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.trial_checklist_items (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'pass', 'fail', 'na')),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 1000),
  photo_attachment_id uuid REFERENCES public.attachments (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (completion_id, item_id)
);

CREATE INDEX IF NOT EXISTS EXISTS idx_tcir_completion ON public.trial_checklist_item_responses (completion_id);
CREATE INDEX IF NOT EXISTS EXISTS idx_tcir_item ON public.trial_checklist_item_responses (item_id);

-- Default trial checklist template for new workspaces
CREATE OR REPLACE FUNCTION public.create_default_trial_checklist (p_workspace_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template_id uuid;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  INSERT INTO public.trial_checklist_templates (workspace_id, name, description, created_by)
  VALUES (
    p_workspace_id,
    'Checklist d''essai par défaut',
    'Checklist standard pour l''essai d''un véhicule',
    v_user_id
  )
  RETURNING id INTO v_template_id;

  -- Add default items
  INSERT INTO public.trial_checklist_items (template_id, label, category, sort_order) VALUES
    (v_template_id, 'Accessibilité facilitée (hauteur de caisse, seuils)', 'general', 1),
    (v_template_id, 'Assise réglable et confortable', 'interior', 2),
    (v_template_id, 'Visibilité vers l''avant et les rétroviseurs', 'interior', 3),
    (v_template_id, 'Angle mort et aides à la conduite', 'safety', 4),
    (v_template_id, 'Volume de coffre suffisant', 'exterior', 5),
    (v_template_id, 'Facilité de rangement des sièges arrière', 'interior', 6),
    (v_template_id, 'Qualité des matériaux et finitions', 'interior', 7),
    (v_template_id, 'Isolation phonique et vibrations', 'comfort', 8),
    (v_template_id, 'Climatisation et ventilation efficaces', 'comfort', 9),
    (v_template_id, 'Système de navigation intuitif', 'technology', 10),
    (v_template_id, 'Connectivité (Bluetooth, Android Auto, Apple CarPlay)', 'technology', 11),
    (v_template_id, 'Freinage efficace et progressif', 'safety', 12),
    (v_template_id, 'Accélération et reprises suffisantes', 'performance', 13),
    (v_template_id, 'Tenue de route en virage', 'performance', 14),
    (v_template_id, 'Confort de suspension sur bosses et pavés', 'comfort', 15),
    (v_template_id, 'Maniabilité en ville (rayon de braquage, assistance)', 'driving', 16),
    (v_template_id, 'Consommation de carburant affichée', 'performance', 17),
    (v_template_id, 'Émissions sonores (moteur, vent)', 'comfort', 18);

  RETURN v_template_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_default_trial_checklist (uuid) TO authenticated;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trg_tct_updated ON public.trial_checklist_templates;

CREATE TRIGGER trg_tct_updated BEFORE UPDATE ON public.trial_checklist_templates FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tcir_updated ON public.trial_checklist_item_responses;

CREATE TRIGGER trg_tcir_updated BEFORE UPDATE ON public.trial_checklist_item_responses FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS
ALTER TABLE public.trial_checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_checklist_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_checklist_item_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for trial_checklist_templates
DROP POLICY IF EXISTS tct_select ON public.trial_checklist_templates;

CREATE POLICY tct_select ON public.trial_checklist_templates FOR
SELECT USING (public.is_workspace_member (workspace_id));

DROP POLICY IF EXISTS tct_insert ON public.trial_checklist_templates;

CREATE POLICY tct_insert ON public.trial_checklist_templates FOR INSERT
WITH CHECK (
    created_by = auth.uid ()
    AND public.can_write_workspace(workspace_id)
  );

DROP POLICY IF EXISTS tct_update_admin ON public.trial_checklist_templates;

CREATE POLICY tct_update_admin ON public.trial_checklist_templates FOR
UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.workspaces w
      WHERE w.id = trial_checklist_templates.workspace_id
        AND public.is_workspace_admin(w.id)
    )
  )
WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.workspaces w
      WHERE w.id = trial_checklist_templates.workspace_id
        AND public.is_workspace_admin(w.id)
    )
  );

DROP POLICY IF EXISTS tct_delete_admin ON public.trial_checklist_templates;

CREATE POLICY tct_delete_admin ON public.trial_checklist_templates FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM public.workspaces w
      WHERE w.id = trial_checklist_templates.workspace_id
        AND public.is_workspace_admin(w.id)
    )
  );

-- RLS Policies for trial_checklist_items
DROP POLICY IF EXISTS tci_select ON public.trial_checklist_items;

CREATE POLICY tci_select ON public.trial_checklist_items FOR
SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.trial_checklist_templates t
      WHERE t.id = trial_checklist_items.template_id
        AND public.is_workspace_member(t.workspace_id)
    )
  );

DROP POLICY IF EXISTS tci_write ON public.trial_checklist_items FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.trial_checklist_templates t
      WHERE t.id = trial_checklist_items.template_id
        AND public.can_write_workspace(t.workspace_id)
    )
  )
WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.trial_checklist_templates t
      WHERE t.id = trial_checklist_items.template_id
        AND public.can_write_workspace(t.workspace_id)
    )
  );

-- RLS Policies for trial_checklist_completions
DROP POLICY IF EXISTS tcc_select ON public.trial_checklist_completions;

CREATE POLICY tcc_select ON public.trial_checklist_completions FOR
SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.visits v
      JOIN public.candidates c ON c.id = v.candidate_id
      WHERE v.id = trial_checklist_completions.visit_id
        AND public.is_workspace_member(c.workspace_id)
    )
  );

DROP POLICY IF EXISTS tcc_insert ON public.trial_checklist_completions;

CREATE POLICY tcc_insert ON public.trial_checklist_completions FOR INSERT
WITH CHECK (
    completed_by = auth.uid ()
    AND EXISTS (
      SELECT 1
      FROM public.visits v
      JOIN public.candidates c ON c.id = v.candidate_id
      WHERE v.id = trial_checklist_completions.visit_id
        AND public.can_write_workspace(c.workspace_id)
    )
  );

DROP POLICY IF EXISTS tcc_update_own ON public.trial_checklist_completions;

CREATE POLICY tcc_update_own ON public.trial_checklist_completions FOR
UPDATE USING (
    completed_by = auth.uid ()
    AND EXISTS (
      SELECT 1
      FROM public.visits v
      JOIN public.candidates c ON c.id = v.candidate_id
      WHERE v.id = trial_checklist_completions.visit_id
        AND public.can_write_workspace(c.workspace_id)
    )
  )
WITH CHECK (completed_by = auth.uid ());

DROP POLICY IF EXISTS tcc_delete_own ON public.trial_checklist_completions;

CREATE POLICY tcc_delete_own ON public.trial_checklist_completions FOR DELETE USING (completed_by = auth.uid ());

-- RLS Policies for trial_checklist_item_responses
DROP POLICY IF EXISTS tcir_select ON public.trial_checklist_item_responses;

CREATE POLICY tcir_select ON public.trial_checklist_item_responses FOR
SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.trial_checklist_completions cc
      JOIN public.visits v ON v.id = cc.visit_id
      JOIN public.candidates c ON c.id = v.candidate_id
      WHERE cc.id = trial_checklist_item_responses.completion_id
        AND public.is_workspace_member(c.workspace_id)
    )
  );

DROP POLICY IF EXISTS tcir_write ON public.trial_checklist_item_responses FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.trial_checklist_completions cc
      WHERE cc.id = trial_checklist_item_responses.completion_id
        AND cc.completed_by = auth.uid ()
    )
  )
WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.trial_checklist_completions cc
      WHERE cc.id = trial_checklist_item_responses.completion_id
        AND cc.completed_by = auth.uid ()
    )
  );

-- Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE
      pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'trial_checklist_completions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trial_checklist_completions;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE
      pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'trial_checklist_item_responses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trial_checklist_item_responses;
  END IF;
END;
$$;
