-- Weighted Voting System Migration
-- Allows users to assign weights to their votes on requirements and candidates

-- Table for weighted votes on requirements (replaces simple MoSCoW)
CREATE TABLE IF NOT EXISTS public.weighted_requirement_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  requirement_id uuid NOT NULL REFERENCES public.requirements (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  weight numeric(5, 2) NOT NULL DEFAULT 1 CHECK (weight >= 0 AND weight <= 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requirement_id, user_id)
);

CREATE INDEX IF NOT EXISTS EXISTS idx_wrv_requirement ON public.weighted_requirement_votes (requirement_id);
CREATE INDEX IF NOT EXISTS EXISTS idx_wrv_user ON public.weighted_requirement_votes (user_id);

-- Table for weighted votes on candidates (overall scoring)
CREATE TABLE IF NOT EXISTS public.weighted_candidate_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  candidate_id uuid NOT NULL REFERENCES public.candidates (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  weight numeric(5, 2) NOT NULL DEFAULT 1 CHECK (weight >= 0 AND weight <= 10),
  category text NOT NULL DEFAULT 'overall' CHECK (category IN ('overall', 'design', 'performance', 'comfort', 'value', 'reliability')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, user_id, category)
);

CREATE INDEX IF NOT EXISTS EXISTS idx_wcv_candidate ON public.weighted_candidate_votes (candidate_id);
CREATE INDEX IF NOT EXISTS EXISTS idx_wcv_user ON public.weighted_candidate_votes (user_id);

-- Table for user weights (workspace members can have different voting weights)
CREATE TABLE IF NOT EXISTS public.workspace_voting_weights (
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  voting_weight numeric(4, 2) NOT NULL DEFAULT 1 CHECK (voting_weight >= 0 AND voting_weight <= 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS EXISTS idx_wvw_workspace ON public.workspace_voting_weights (workspace_id);

-- Trigger for updated_at on weighted_requirement_votes
DROP TRIGGER IF EXISTS trg_wrv_updated ON public.weighted_requirement_votes;

CREATE TRIGGER trg_wrv_updated BEFORE UPDATE ON public.weighted_requirement_votes FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Trigger for updated_at on weighted_candidate_votes
DROP TRIGGER IF EXISTS trg_wcv_updated ON public.weighted_candidate_votes;

CREATE TRIGGER trg_wcv_updated BEFORE UPDATE ON public.weighted_candidate_votes FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Trigger for updated_at on workspace_voting_weights
DROP TRIGGER IF EXISTS trg_wvw_updated ON public.workspace_voting_weights;

CREATE TRIGGER trg_wvw_updated BEFORE UPDATE ON public.workspace_voting_weights FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS
ALTER TABLE public.weighted_requirement_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weighted_candidate_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_voting_weights ENABLE ROW LEVEL SECURITY;

-- RLS Policies for weighted_requirement_votes
DROP POLICY IF EXISTS wrv_select ON public.weighted_requirement_votes;

CREATE POLICY wrv_select ON public.weighted_requirement_votes FOR
SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.requirements r
      WHERE
        r.id = weighted_requirement_votes.requirement_id
        AND public.is_workspace_member(r.workspace_id)
    )
  );

DROP POLICY IF EXISTS wrv_insert ON public.weighted_requirement_votes;

CREATE POLICY wrv_insert ON public.weighted_requirement_votes FOR INSERT
WITH CHECK (
    user_id = auth.uid ()
    AND EXISTS (
      SELECT 1
      FROM public.requirements r
      WHERE
        r.id = weighted_requirement_votes.requirement_id
        AND public.can_write_workspace(r.workspace_id)
    )
  );

DROP POLICY IF EXISTS wrv_update_own ON public.weighted_requirement_votes;

CREATE POLICY wrv_update_own ON public.weighted_requirement_votes FOR
UPDATE USING (
    user_id = auth.uid ()
    AND EXISTS (
      SELECT 1
      FROM public.requirements r
      WHERE
        r.id = weighted_requirement_votes.requirement_id
        AND public.can_write_workspace(r.workspace_id)
    )
  )
WITH CHECK (
    user_id = auth.uid ()
  );

DROP POLICY IF EXISTS wrv_delete_own ON public.weighted_requirement_votes;

CREATE POLICY wrv_delete_own ON public.weighted_requirement_votes FOR DELETE USING (
    user_id = auth.uid ()
  );

-- RLS Policies for weighted_candidate_votes
DROP POLICY IF EXISTS wcv_select ON public.weighted_candidate_votes;

CREATE POLICY wcv_select ON public.weighted_candidate_votes FOR
SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.candidates c
      WHERE
        c.id = weighted_candidate_votes.candidate_id
        AND public.is_workspace_member(c.workspace_id)
    )
  );

DROP POLICY IF EXISTS wcv_insert ON public.weighted_candidate_votes;

CREATE POLICY wcv_insert ON public.weighted_candidate_votes FOR INSERT
WITH CHECK (
    user_id = auth.uid ()
    AND EXISTS (
      SELECT 1
      FROM public.candidates c
      WHERE
        c.id = weighted_candidate_votes.candidate_id
        AND public.can_write_workspace(c.workspace_id)
    )
  );

DROP POLICY IF EXISTS wcv_update_own ON public.weighted_candidate_votes;

CREATE POLICY wcv_update_own ON public.weighted_candidate_votes FOR
UPDATE USING (
    user_id = auth.uid ()
    AND EXISTS (
      SELECT 1
      FROM public.candidates c
      WHERE
        c.id = weighted_candidate_votes.candidate_id
        AND public.can_write_workspace(c.workspace_id)
    )
  )
WITH CHECK (
    user_id = auth.uid ()
  );

DROP POLICY IF EXISTS wcv_delete_own ON public.weighted_candidate_votes;

CREATE POLICY wcv_delete_own ON public.weighted_candidate_votes FOR DELETE USING (
    user_id = auth.uid ()
  );

-- RLS Policies for workspace_voting_weights
DROP POLICY IF EXISTS wvw_select ON public.workspace_voting_weights;

CREATE POLICY wvw_select ON public.workspace_voting_weights FOR
SELECT USING (public.is_workspace_member (workspace_id));

DROP POLICY IF EXISTS wvw_write_admin ON public.workspace_voting_weights;

CREATE POLICY wvw_write_admin ON public.workspace_voting_weights FOR ALL
USING (public.is_workspace_admin (workspace_id))
WITH CHECK (public.is_workspace_admin (workspace_id));

-- Function to calculate weighted score for a requirement
CREATE OR REPLACE FUNCTION public.requirement_weighted_score (p_requirement_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(w.weight * COALESCE(vw.voting_weight, 1)) / NULLIF(SUM(COALESCE(vw.voting_weight, 1)), 0), 0)
  FROM public.weighted_requirement_votes w
  LEFT JOIN public.requirements r ON r.id = w.requirement_id
  LEFT JOIN public.workspace_voting_weights vw ON vw.workspace_id = r.workspace_id AND vw.user_id = w.user_id
  WHERE w.requirement_id = p_requirement_id;
$$;

-- Function to calculate weighted score for a candidate
CREATE OR REPLACE FUNCTION public.candidate_weighted_score (p_candidate_id uuid, p_category text DEFAULT 'overall')
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(w.weight * COALESCE(vw.voting_weight, 1)) / NULLIF(SUM(COALESCE(vw.voting_weight, 1)), 0), 0)
  FROM public.weighted_candidate_votes w
  LEFT JOIN public.candidates c ON c.id = w.candidate_id
  LEFT JOIN public.workspace_voting_weights vw ON vw.workspace_id = c.workspace_id AND vw.user_id = w.user_id
  WHERE w.candidate_id = p_candidate_id AND w.category = p_category;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.requirement_weighted_score (uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.candidate_weighted_score (uuid, text) TO authenticated;

-- Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE
      pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'weighted_requirement_votes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.weighted_requirement_votes;
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
      AND tablename = 'weighted_candidate_votes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.weighted_candidate_votes;
  END IF;
END;
$$;
