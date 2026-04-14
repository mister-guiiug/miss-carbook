-- Miss Carbook — schéma initial + RLS + Storage
-- Exécuter dans Supabase SQL Editor ou via CLI : supabase db push

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Types énumérés
CREATE TYPE public.member_role AS ENUM ('read', 'write', 'admin');
CREATE TYPE public.requirement_level AS ENUM ('mandatory', 'discuss');
CREATE TYPE public.candidate_status AS ENUM (
  'to_see',
  'tried',
  'shortlist',
  'selected',
  'rejected'
);

-- Profils (1:1 auth.users) — pseudo affiché
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (char_length(trim(display_name)) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 4000),
  share_code text NOT NULL DEFAULT '' UNIQUE,
  replacement_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true
);

CREATE INDEX idx_workspaces_share_code ON public.workspaces (share_code);
CREATE INDEX idx_workspaces_created_by ON public.workspaces (created_by);

CREATE TABLE public.workspace_members (
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role public.member_role NOT NULL DEFAULT 'read',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX idx_workspace_members_user ON public.workspace_members (user_id);

CREATE TABLE public.current_vehicle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  workspace_id uuid NOT NULL UNIQUE REFERENCES public.workspaces (id) ON DELETE CASCADE,
  brand text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  engine text NOT NULL DEFAULT '',
  year smallint CHECK (year IS NULL OR (year BETWEEN 1950 AND 2100)),
  options text NOT NULL DEFAULT '',
  photo_attachment_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  label text NOT NULL CHECK (char_length(trim(label)) BETWEEN 1 AND 200),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 4000),
  level public.requirement_level NOT NULL DEFAULT 'discuss',
  weight numeric(6, 2) CHECK (weight IS NULL OR (weight >= 0 AND weight <= 1000)),
  tags text[] NOT NULL DEFAULT '{}' CHECK (array_length(tags, 1) IS NULL OR array_length(tags, 1) <= 30),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_requirements_workspace ON public.requirements (workspace_id);
CREATE INDEX idx_requirements_level ON public.requirements (workspace_id, level);

CREATE TABLE public.candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  brand text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  trim text NOT NULL DEFAULT '',
  engine text NOT NULL DEFAULT '',
  price numeric(12, 2) CHECK (price IS NULL OR price >= 0),
  options text NOT NULL DEFAULT '',
  garage_location text NOT NULL DEFAULT '',
  manufacturer_url text NOT NULL DEFAULT '',
  event_date date,
  status public.candidate_status NOT NULL DEFAULT 'to_see',
  reject_reason text NOT NULL DEFAULT '' CHECK (char_length(reject_reason) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_candidates_workspace ON public.candidates (workspace_id);
CREATE INDEX idx_candidates_status ON public.candidates (workspace_id, status);

-- Données constructeur flexibles (JSON avec schéma côté app — Zod)
CREATE TABLE public.candidate_specs (
  candidate_id uuid PRIMARY KEY REFERENCES public.candidates (id) ON DELETE CASCADE,
  specs jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Avis / ressenti par participant
CREATE TABLE public.candidate_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  candidate_id uuid NOT NULL REFERENCES public.candidates (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  score numeric(4, 1) NOT NULL CHECK (score >= 0 AND score <= 10),
  free_text text NOT NULL DEFAULT '' CHECK (char_length(free_text) <= 4000),
  pros text NOT NULL DEFAULT '' CHECK (char_length(pros) <= 2000),
  cons text NOT NULL DEFAULT '' CHECK (char_length(cons) <= 2000),
  updated_at timestamptz NOT NULL DEFAULT now (),
  UNIQUE (candidate_id, user_id)
);

CREATE INDEX idx_candidate_reviews_candidate ON public.candidate_reviews (candidate_id);

-- Bloc-notes collaboratif par dossier (last-write-wins + journal dans activity_log)
CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  workspace_id uuid NOT NULL UNIQUE REFERENCES public.workspaces (id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 100000),
  updated_at timestamptz NOT NULL DEFAULT now (),
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  edit_lock_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  edit_lock_expires_at timestamptz
);

CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  candidate_id uuid NOT NULL REFERENCES public.candidates (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now ()
);

CREATE INDEX idx_comments_candidate ON public.comments (candidate_id, created_at DESC);

CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  action_type text NOT NULL CHECK (char_length(action_type) BETWEEN 1 AND 80),
  entity_type text NOT NULL CHECK (char_length(entity_type) BETWEEN 1 AND 80),
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now ()
);

CREATE INDEX idx_activity_workspace_time ON public.activity_log (workspace_id, created_at DESC);

-- Métadonnées fichiers (chemins Storage sous {workspace_id}/...)
CREATE TABLE public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  candidate_id uuid REFERENCES public.candidates (id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE CHECK (char_length(storage_path) BETWEEN 1 AND 1024),
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0 AND size_bytes <= 5242880),
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now ()
);

CREATE INDEX idx_attachments_workspace ON public.attachments (workspace_id);
CREATE INDEX idx_attachments_candidate ON public.attachments (candidate_id);

ALTER TABLE public.current_vehicle
ADD CONSTRAINT fk_current_vehicle_photo
FOREIGN KEY (photo_attachment_id) REFERENCES public.attachments (id) ON DELETE SET NULL;

-- Triggers utilitaires
CREATE OR REPLACE FUNCTION public.set_updated_at ()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE
UPDATE ON public.profiles FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();

CREATE TRIGGER trg_candidates_updated BEFORE
UPDATE ON public.candidates FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();

CREATE TRIGGER trg_candidate_specs_updated BEFORE
UPDATE ON public.candidate_specs FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();

CREATE OR REPLACE FUNCTION public.generate_share_code ()
RETURNS text
LANGUAGE sql
AS $$
 SELECT upper(substring(replace(gen_random_uuid()::text, '-', '') FROM 1 FOR 8));
$$;

CREATE OR REPLACE FUNCTION public.workspaces_set_share_code ()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.share_code IS NULL OR NEW.share_code = '' THEN
    NEW.share_code := public.generate_share_code ();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_workspaces_share BEFORE INSERT ON public.workspaces FOR EACH ROW
EXECUTE FUNCTION public.workspaces_set_share_code ();

CREATE OR REPLACE FUNCTION public.add_creator_as_admin ()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_workspace_creator AFTER INSERT ON public.workspaces FOR EACH ROW
EXECUTE FUNCTION public.add_creator_as_admin ();

CREATE OR REPLACE FUNCTION public.ensure_note_row ()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notes (workspace_id)
  VALUES (NEW.id)
  ON CONFLICT (workspace_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_workspace_note AFTER INSERT ON public.workspaces FOR EACH ROW
EXECUTE FUNCTION public.ensure_note_row ();

CREATE OR REPLACE FUNCTION public.handle_new_user ()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(trim(split_part(COALESCE(NEW.email, ''), '@', 1)), ''),
      NULLIF(trim(NEW.raw_user_meta_data ->> 'display_name'), ''),
      'Invité'
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Profil pour auth anonyme : display_name provisoire
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user ();

-- Helpers RLS (SECURITY DEFINER, search_path fixé)
CREATE OR REPLACE FUNCTION public.workspace_role (p_workspace_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT wm.role::text
  FROM public.workspace_members wm
  WHERE wm.workspace_id = p_workspace_id
    AND wm.user_id = auth.uid ()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_member (p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = p_workspace_id
      AND wm.user_id = auth.uid ()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_write_workspace (p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
      (
        SELECT wm.role IN ('write', 'admin')
        FROM public.workspace_members wm
        WHERE wm.workspace_id = p_workspace_id
          AND wm.user_id = auth.uid ()
      ),
      false
    );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin (p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
      (
        SELECT wm.role = 'admin'
        FROM public.workspace_members wm
        WHERE wm.workspace_id = p_workspace_id
          AND wm.user_id = auth.uid ()
      ),
      false
    );
$$;

-- Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.current_vehicle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY profiles_select_shared ON public.profiles FOR
SELECT USING (
    id = auth.uid ()
    OR EXISTS (
      SELECT 1
      FROM public.workspace_members a
      JOIN public.workspace_members b ON a.workspace_id = b.workspace_id
      WHERE a.user_id = auth.uid ()
        AND b.user_id = profiles.id
    )
  );

CREATE POLICY profiles_update_own ON public.profiles FOR
UPDATE USING (id = auth.uid ())
WITH CHECK (id = auth.uid ());

CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT
WITH CHECK (id = auth.uid ());

-- workspaces
CREATE POLICY workspaces_select_member ON public.workspaces FOR
SELECT USING (public.is_workspace_member (id));

CREATE POLICY workspaces_insert_auth ON public.workspaces FOR INSERT
WITH CHECK (
  auth.uid () IS NOT NULL
 AND created_by = auth.uid ()
);

CREATE POLICY workspaces_update_admin ON public.workspaces FOR
UPDATE USING (public.is_workspace_admin (id))
WITH CHECK (public.is_workspace_admin (id));

-- workspace_members
CREATE POLICY wm_select ON public.workspace_members FOR
SELECT USING (public.is_workspace_member (workspace_id));

CREATE POLICY wm_insert_admin ON public.workspace_members FOR INSERT
WITH CHECK (public.is_workspace_admin (workspace_id));

CREATE POLICY wm_update_admin ON public.workspace_members FOR
UPDATE USING (public.is_workspace_admin (workspace_id))
WITH CHECK (public.is_workspace_admin (workspace_id));

CREATE POLICY wm_delete_admin ON public.workspace_members FOR DELETE USING (public.is_workspace_admin (workspace_id));

-- current_vehicle
CREATE POLICY cv_select ON public.current_vehicle FOR
SELECT USING (public.is_workspace_member (workspace_id));

CREATE POLICY cv_write ON public.current_vehicle FOR ALL USING (public.can_write_workspace (workspace_id))
WITH CHECK (public.can_write_workspace (workspace_id));

-- requirements
CREATE POLICY req_select ON public.requirements FOR
SELECT USING (public.is_workspace_member (workspace_id));

CREATE POLICY req_write ON public.requirements FOR ALL USING (public.can_write_workspace (workspace_id))
WITH CHECK (public.can_write_workspace (workspace_id));

-- candidates
CREATE POLICY cand_select ON public.candidates FOR
SELECT USING (public.is_workspace_member (workspace_id));

CREATE POLICY cand_write ON public.candidates FOR ALL USING (public.can_write_workspace (workspace_id))
WITH CHECK (public.can_write_workspace (workspace_id));

-- candidate_specs
CREATE POLICY cs_select ON public.candidate_specs FOR
SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.candidates c
      WHERE
        c.id = candidate_specs.candidate_id
        AND public.is_workspace_member (c.workspace_id)
    )
  );

CREATE POLICY cs_write ON public.candidate_specs FOR ALL USING (
  EXISTS (
    SELECT 1
    FROM public.candidates c
    WHERE
      c.id = candidate_specs.candidate_id
      AND public.can_write_workspace (c.workspace_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.candidates c
    WHERE
      c.id = candidate_specs.candidate_id
      AND public.can_write_workspace (c.workspace_id)
  )
);

-- candidate_reviews
CREATE POLICY cr_select ON public.candidate_reviews FOR
SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.candidates c
      WHERE
        c.id = candidate_reviews.candidate_id
        AND public.is_workspace_member (c.workspace_id)
    )
  );

CREATE POLICY cr_insert ON public.candidate_reviews FOR INSERT
WITH CHECK (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.candidates c
    WHERE
      c.id = candidate_reviews.candidate_id
      AND public.can_write_workspace (c.workspace_id)
  )
);

CREATE POLICY cr_update_own ON public.candidate_reviews FOR
UPDATE USING (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.candidates c
    WHERE
      c.id = candidate_reviews.candidate_id
      AND public.can_write_workspace (c.workspace_id)
  )
)
WITH CHECK (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM public.candidates c
    WHERE
      c.id = candidate_reviews.candidate_id
      AND public.can_write_workspace (c.workspace_id)
  )
);

CREATE POLICY cr_delete_own ON public.candidate_reviews FOR DELETE USING (user_id = auth.uid ());

-- notes
CREATE POLICY notes_select ON public.notes FOR
SELECT USING (public.is_workspace_member (workspace_id));

CREATE POLICY notes_write ON public.notes FOR ALL USING (public.can_write_workspace (workspace_id))
WITH CHECK (public.can_write_workspace (workspace_id));

-- comments
CREATE POLICY com_select ON public.comments FOR
SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.candidates c
      WHERE
        c.id = comments.candidate_id
        AND public.is_workspace_member (c.workspace_id)
    )
  );

CREATE POLICY com_insert ON public.comments FOR INSERT
WITH CHECK (
  user_id = auth.uid ()
  AND EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE
      c.id = comments.candidate_id
      AND public.can_write_workspace (c.workspace_id)
  )
);

CREATE POLICY com_delete_own ON public.comments FOR DELETE USING (user_id = auth.uid ());

-- activity_log (lecture membres ; écriture writers+)
CREATE POLICY act_select ON public.activity_log FOR
SELECT USING (public.is_workspace_member (workspace_id));

CREATE POLICY act_insert ON public.activity_log FOR INSERT
WITH CHECK (
  user_id = auth.uid ()
  AND public.can_write_workspace (workspace_id)
);

-- attachments
CREATE POLICY att_select ON public.attachments FOR
SELECT USING (public.is_workspace_member (workspace_id));

CREATE POLICY att_write ON public.attachments FOR ALL USING (public.can_write_workspace (workspace_id))
WITH CHECK (
  public.can_write_workspace (workspace_id)
  AND created_by = auth.uid ()
);

-- RPC : rejoindre un dossier via code
CREATE OR REPLACE FUNCTION public.join_workspace (p_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ws_id uuid;
BEGIN
  IF auth.uid () IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  SELECT id INTO ws_id
  FROM public.workspaces
  WHERE
    share_code = upper(trim(p_code))
    AND is_active = true;
  IF ws_id IS NULL THEN
    RAISE EXCEPTION 'invalid_code';
  END IF;
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (ws_id, auth.uid (), 'read')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  RETURN ws_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_workspace (text) TO authenticated;

-- Realtime (tables utiles)
ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;

ALTER PUBLICATION supabase_realtime ADD TABLE public.candidates;

ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;

ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;

ALTER PUBLICATION supabase_realtime ADD TABLE public.candidate_reviews;

-- Storage : bucket + policies (exécuter une fois ; ajuster si le bucket existe déjà)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'workspace-media',
    'workspace-media',
    false,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  )
ON CONFLICT (id) DO NOTHING;

CREATE POLICY storage_select_workspace ON storage.objects FOR
SELECT USING (
    bucket_id = 'workspace-media'
    AND EXISTS (
      SELECT 1
      FROM public.workspace_members wm WHERE
        wm.user_id = auth.uid ()
        AND wm.workspace_id::text = split_part(name, '/', 1)
    )
  );

CREATE POLICY storage_insert_workspace ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'workspace-media'
  AND EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE
      wm.user_id = auth.uid ()
      AND wm.role IN ('write', 'admin')
      AND wm.workspace_id::text = split_part(name, '/', 1)
  )
);

CREATE POLICY storage_update_workspace ON storage.objects FOR
UPDATE USING (
  bucket_id = 'workspace-media'
  AND EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE
      wm.user_id = auth.uid ()
      AND wm.role IN ('write', 'admin')
      AND wm.workspace_id::text = split_part(name, '/', 1)
  )
);

CREATE POLICY storage_delete_workspace ON storage.objects FOR DELETE USING (
  bucket_id = 'workspace-media'
  AND EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE
      wm.user_id = auth.uid ()
      AND wm.role IN ('write', 'admin')
      AND wm.workspace_id::text = split_part(name, '/', 1)
  )
);
