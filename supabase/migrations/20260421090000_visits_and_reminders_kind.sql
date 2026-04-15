-- Visites + catégorisation des rappels (kind)
-- Idempotent : ré-exécution / base partiellement à jour → pas d’échec.

-- --- Visites (historique) ---
CREATE TABLE IF NOT EXISTS public.visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  candidate_id uuid REFERENCES public.candidates (id) ON DELETE SET NULL,
  visit_at timestamptz NOT NULL,
  location text NOT NULL DEFAULT '' CHECK (char_length(location) <= 500),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 4000),
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now ()
);

CREATE INDEX IF NOT EXISTS idx_visits_workspace_at ON public.visits (workspace_id, visit_at DESC);
CREATE INDEX IF NOT EXISTS idx_visits_candidate_at ON public.visits (candidate_id, visit_at DESC);

-- Forcer created_by côté serveur
CREATE OR REPLACE FUNCTION public.visits_set_creator ()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.created_by := auth.uid ();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_visits_creator ON public.visits;
CREATE TRIGGER trg_visits_creator BEFORE INSERT ON public.visits FOR EACH ROW
EXECUTE FUNCTION public.visits_set_creator ();

ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS visits_select ON public.visits;
CREATE POLICY visits_select ON public.visits FOR
SELECT USING (public.is_workspace_member (workspace_id));

DROP POLICY IF EXISTS visits_insert ON public.visits;
CREATE POLICY visits_insert ON public.visits FOR INSERT
WITH CHECK (public.can_write_workspace (workspace_id));

DROP POLICY IF EXISTS visits_update ON public.visits;
CREATE POLICY visits_update ON public.visits FOR
UPDATE USING (public.can_write_workspace (workspace_id))
WITH CHECK (public.can_write_workspace (workspace_id));

DROP POLICY IF EXISTS visits_delete ON public.visits;
CREATE POLICY visits_delete ON public.visits FOR DELETE USING (public.can_write_workspace (workspace_id));

-- Realtime (optionnel)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE
      pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'visits'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.visits;
  END IF;
END;
$$;

-- --- Rappels : catégories (kind) ---
ALTER TABLE public.reminders
ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'other' CHECK (
  kind IN ('contact', 'visit', 'appointment', 'other')
);

CREATE INDEX IF NOT EXISTS idx_reminders_workspace_kind ON public.reminders (workspace_id, kind);

