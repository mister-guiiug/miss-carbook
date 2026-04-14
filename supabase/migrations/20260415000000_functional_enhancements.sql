-- Améliorations fonctionnelles : décision, invitations, évaluations, votes MoSCoW, rappels, presets comparaison, RPC sociale
-- Idempotent : ré-exécution / base déjà partiellement à jour → pas d’échec sur objets existants.

-- --- Décision dossier (modèle retenu) ---
ALTER TABLE public.workspaces
ADD COLUMN IF NOT EXISTS selected_candidate_id uuid REFERENCES public.candidates (id) ON DELETE SET NULL;

ALTER TABLE public.workspaces
ADD COLUMN IF NOT EXISTS decision_notes text NOT NULL DEFAULT '';

ALTER TABLE public.workspaces
ADD COLUMN IF NOT EXISTS decision_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_workspaces_selected_candidate ON public.workspaces (selected_candidate_id);

-- --- Invitations avec rôle + expiration ---
CREATE TABLE IF NOT EXISTS public.workspace_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode (gen_random_bytes (16), 'hex'),
  role public.member_role NOT NULL DEFAULT 'read',
  expires_at timestamptz NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now ()
);

CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace ON public.workspace_invites (workspace_id);

CREATE INDEX IF NOT EXISTS idx_workspace_invites_token ON public.workspace_invites (token);

-- --- Exigence × candidat (satisfaction) ---
CREATE TABLE IF NOT EXISTS public.requirement_candidate_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  requirement_id uuid NOT NULL REFERENCES public.requirements (id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.candidates (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'unknown' CHECK (
    status IN ('unknown', 'ok', 'partial', 'ko')
  ),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 1000),
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now (),
  UNIQUE (requirement_id, candidate_id)
);

CREATE INDEX IF NOT EXISTS idx_rce_requirement ON public.requirement_candidate_evaluations (requirement_id);

CREATE INDEX IF NOT EXISTS idx_rce_candidate ON public.requirement_candidate_evaluations (candidate_id);

-- --- Vote MoSCoW par exigence (agrégation côté app) ---
CREATE TABLE IF NOT EXISTS public.requirement_priority_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  requirement_id uuid NOT NULL REFERENCES public.requirements (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  vote text NOT NULL CHECK (vote IN ('must', 'should', 'could', 'wont')),
  updated_at timestamptz NOT NULL DEFAULT now (),
  UNIQUE (requirement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_rpv_requirement ON public.requirement_priority_votes (requirement_id);

-- --- Rappels / prochaines étapes ---
CREATE TABLE IF NOT EXISTS public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 200),
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 2000),
  due_at timestamptz,
  done boolean NOT NULL DEFAULT false,
  candidate_id uuid REFERENCES public.candidates (id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now ()
);

CREATE INDEX IF NOT EXISTS idx_reminders_workspace ON public.reminders (workspace_id, done, due_at);

-- --- Profils de critères (comparaison) ---
CREATE TABLE IF NOT EXISTS public.comparison_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 80),
  criteria_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now ()
);

CREATE INDEX IF NOT EXISTS idx_comparison_presets_ws ON public.comparison_presets (workspace_id);

-- Forcer created_by / user_id / updated_by côté serveur
CREATE OR REPLACE FUNCTION public.reminders_set_creator ()
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

DROP TRIGGER IF EXISTS trg_reminders_creator ON public.reminders;

CREATE TRIGGER trg_reminders_creator BEFORE INSERT ON public.reminders FOR EACH ROW
EXECUTE FUNCTION public.reminders_set_creator ();

CREATE OR REPLACE FUNCTION public.rpv_set_user ()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.user_id := auth.uid ();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rpv_user ON public.requirement_priority_votes;

CREATE TRIGGER trg_rpv_user BEFORE INSERT OR
UPDATE ON public.requirement_priority_votes FOR EACH ROW
EXECUTE FUNCTION public.rpv_set_user ();

CREATE OR REPLACE FUNCTION public.rce_set_updated ()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_by := auth.uid ();
  NEW.updated_at := now ();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rce_updated ON public.requirement_candidate_evaluations;

CREATE TRIGGER trg_rce_updated BEFORE INSERT OR
UPDATE ON public.requirement_candidate_evaluations FOR EACH ROW
EXECUTE FUNCTION public.rce_set_updated ();

-- RLS
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.requirement_candidate_evaluations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.requirement_priority_votes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.comparison_presets ENABLE ROW LEVEL SECURITY;

-- workspace_invites : lecture / création admin uniquement
DROP POLICY IF EXISTS wi_select ON public.workspace_invites;

CREATE POLICY wi_select ON public.workspace_invites FOR
SELECT USING (public.is_workspace_admin (workspace_id));

DROP POLICY IF EXISTS wi_insert ON public.workspace_invites;

CREATE POLICY wi_insert ON public.workspace_invites FOR INSERT
WITH CHECK (
  public.is_workspace_admin (workspace_id)
  AND created_by = auth.uid ()
);

DROP POLICY IF EXISTS wi_update ON public.workspace_invites;

CREATE POLICY wi_update ON public.workspace_invites FOR
UPDATE USING (public.is_workspace_admin (workspace_id));

DROP POLICY IF EXISTS wi_delete ON public.workspace_invites;

CREATE POLICY wi_delete ON public.workspace_invites FOR DELETE USING (public.is_workspace_admin (workspace_id));

-- requirement_candidate_evaluations
DROP POLICY IF EXISTS rce_select ON public.requirement_candidate_evaluations;

CREATE POLICY rce_select ON public.requirement_candidate_evaluations FOR
SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.requirements r
      WHERE
        r.id = requirement_candidate_evaluations.requirement_id
        AND public.is_workspace_member (r.workspace_id)
    )
  );

DROP POLICY IF EXISTS rce_write ON public.requirement_candidate_evaluations;

CREATE POLICY rce_write ON public.requirement_candidate_evaluations FOR ALL USING (
  EXISTS (
    SELECT 1
    FROM public.requirements r
    WHERE
      r.id = requirement_candidate_evaluations.requirement_id
      AND public.can_write_workspace (r.workspace_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.requirements r
    WHERE
      r.id = requirement_candidate_evaluations.requirement_id
      AND public.can_write_workspace (r.workspace_id)
  )
);

-- requirement_priority_votes
DROP POLICY IF EXISTS rpv_select ON public.requirement_priority_votes;

CREATE POLICY rpv_select ON public.requirement_priority_votes FOR
SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.requirements r
      WHERE
        r.id = requirement_priority_votes.requirement_id
        AND public.is_workspace_member (r.workspace_id)
    )
  );

DROP POLICY IF EXISTS rpv_insert ON public.requirement_priority_votes;

CREATE POLICY rpv_insert ON public.requirement_priority_votes FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.requirements r
    WHERE
      r.id = requirement_priority_votes.requirement_id
      AND public.can_write_workspace (r.workspace_id)
  )
);

DROP POLICY IF EXISTS rpv_update ON public.requirement_priority_votes;

CREATE POLICY rpv_update ON public.requirement_priority_votes FOR
UPDATE USING (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.requirements r
    WHERE
      r.id = requirement_priority_votes.requirement_id
      AND public.can_write_workspace (r.workspace_id)
  )
)
WITH CHECK (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.requirements r
    WHERE
      r.id = requirement_priority_votes.requirement_id
      AND public.can_write_workspace (r.workspace_id)
  )
);

DROP POLICY IF EXISTS rpv_delete ON public.requirement_priority_votes;

CREATE POLICY rpv_delete ON public.requirement_priority_votes FOR DELETE USING (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.requirements r
    WHERE
      r.id = requirement_priority_votes.requirement_id
      AND public.can_write_workspace (r.workspace_id)
  )
);

-- reminders
DROP POLICY IF EXISTS rem_select ON public.reminders;

CREATE POLICY rem_select ON public.reminders FOR
SELECT USING (public.is_workspace_member (workspace_id));

DROP POLICY IF EXISTS rem_insert ON public.reminders;

CREATE POLICY rem_insert ON public.reminders FOR INSERT
WITH CHECK (public.can_write_workspace (workspace_id));

DROP POLICY IF EXISTS rem_update ON public.reminders;

CREATE POLICY rem_update ON public.reminders FOR
UPDATE USING (public.can_write_workspace (workspace_id))
WITH CHECK (public.can_write_workspace (workspace_id));

DROP POLICY IF EXISTS rem_delete ON public.reminders;

CREATE POLICY rem_delete ON public.reminders FOR DELETE USING (public.can_write_workspace (workspace_id));

-- comparison_presets
DROP POLICY IF EXISTS cp_select ON public.comparison_presets;

CREATE POLICY cp_select ON public.comparison_presets FOR
SELECT USING (public.is_workspace_member (workspace_id));

DROP POLICY IF EXISTS cp_insert ON public.comparison_presets;

CREATE POLICY cp_insert ON public.comparison_presets FOR INSERT
WITH CHECK (
  public.can_write_workspace (workspace_id)
  AND created_by = auth.uid ()
);

DROP POLICY IF EXISTS cp_update ON public.comparison_presets;

CREATE POLICY cp_update ON public.comparison_presets FOR
UPDATE USING (public.can_write_workspace (workspace_id))
WITH CHECK (public.can_write_workspace (workspace_id));

DROP POLICY IF EXISTS cp_delete ON public.comparison_presets;

CREATE POLICY cp_delete ON public.comparison_presets FOR DELETE USING (public.can_write_workspace (workspace_id));

-- RPC : décision (writers+)
CREATE OR REPLACE FUNCTION public.update_workspace_decision (
  p_workspace_id uuid,
  p_candidate_id uuid,
  p_notes text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid () IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT public.can_write_workspace (p_workspace_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_candidate_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
 FROM public.candidates c
    WHERE c.id = p_candidate_id
      AND c.workspace_id = p_workspace_id
  ) THEN
    RAISE EXCEPTION 'invalid_candidate';
  END IF;
  UPDATE public.workspaces
  SET
    selected_candidate_id = p_candidate_id,
    decision_notes = COALESCE(p_notes, ''),
    decision_at = CASE
      WHEN p_candidate_id IS NOT NULL THEN now()
      ELSE NULL
    END
  WHERE
    id = p_workspace_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_workspace_decision (uuid, uuid, text) TO authenticated;

-- RPC : invitation
CREATE OR REPLACE FUNCTION public.create_workspace_invite (
  p_workspace_id uuid,
  p_role public.member_role,
  p_ttl_days int DEFAULT 7
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tok text;
  ttl int := p_ttl_days;
BEGIN
  IF auth.uid () IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT public.is_workspace_admin (p_workspace_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF ttl IS NULL OR ttl < 1 THEN
    ttl := 7;
  END IF;
  IF ttl > 90 THEN
    ttl := 90;
  END IF;
  INSERT INTO public.workspace_invites (workspace_id, role, expires_at, created_by)
  VALUES (
    p_workspace_id,
    p_role,
    now() + (ttl::text || ' days')::interval,
    auth.uid ()
  )
  RETURNING
    token INTO tok;
  RETURN tok;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_workspace_invite (uuid, public.member_role, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_workspace_invite (p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.workspace_invites%ROWTYPE;
BEGIN
  IF auth.uid () IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  SELECT
    * INTO inv
  FROM
    public.workspace_invites
  WHERE
    token = trim(p_token)
    AND used_at IS NULL
    AND expires_at > now();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_or_expired_invite';
  END IF;
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (inv.workspace_id, auth.uid (), inv.role)
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  UPDATE public.workspace_invites
  SET
    used_at = now()
  WHERE
    id = inv.id;
  RETURN inv.workspace_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_workspace_invite (text) TO authenticated;

-- RPC : quitter le dossier
CREATE OR REPLACE FUNCTION public.leave_workspace (p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n_admin int;
  my_role public.member_role;
BEGIN
  IF auth.uid () IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  SELECT
    wm.role INTO my_role
  FROM
    public.workspace_members wm
  WHERE
    wm.workspace_id = p_workspace_id
    AND wm.user_id = auth.uid ();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_member';
  END IF;
  IF my_role = 'admin' THEN
    SELECT
      count(*) INTO n_admin
    FROM
      public.workspace_members wm
    WHERE
      wm.workspace_id = p_workspace_id
      AND wm.role = 'admin';
    IF n_admin <= 1 THEN
      RAISE EXCEPTION 'last_admin_cannot_leave';
    END IF;
  END IF;
  DELETE FROM public.workspace_members wm
  WHERE
    wm.workspace_id = p_workspace_id
    AND wm.user_id = auth.uid ();
END;
$$;

GRANT EXECUTE ON FUNCTION public.leave_workspace (uuid) TO authenticated;

-- RPC : retirer un membre (admin)
CREATE OR REPLACE FUNCTION public.remove_workspace_member (p_workspace_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n_admin int;
  target_role public.member_role;
BEGIN
  IF auth.uid () IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT public.is_workspace_admin (p_workspace_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_user_id = auth.uid () THEN
    RAISE EXCEPTION 'use_leave_workspace';
  END IF;
  SELECT
    wm.role INTO target_role
  FROM
    public.workspace_members wm
  WHERE
    wm.workspace_id = p_workspace_id
    AND wm.user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_member';
  END IF;
  IF target_role = 'admin' THEN
    SELECT
      count(*) INTO n_admin
    FROM
      public.workspace_members wm
    WHERE
      wm.workspace_id = p_workspace_id
      AND wm.role = 'admin';
    IF n_admin <= 1 THEN
      RAISE EXCEPTION 'last_admin';
    END IF;
  END IF;
  DELETE FROM public.workspace_members wm
  WHERE
    wm.workspace_id = p_workspace_id
    AND wm.user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_workspace_member (uuid, uuid) TO authenticated;

-- Realtime (optionnel)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE
      pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'reminders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reminders;
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
      AND tablename = 'requirement_candidate_evaluations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.requirement_candidate_evaluations;
  END IF;
END;
$$;
