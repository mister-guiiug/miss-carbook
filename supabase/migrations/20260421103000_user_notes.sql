-- Notes par utilisateur (au lieu d'un bloc partagé unique)
-- Idempotent : ré-exécution / base partiellement à jour → pas d’échec.

CREATE TABLE IF NOT EXISTS public.user_notes (
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 100000),
  updated_at timestamptz NOT NULL DEFAULT now (),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_notes_workspace ON public.user_notes (workspace_id, updated_at DESC);

-- updated_at
DROP TRIGGER IF EXISTS trg_user_notes_updated ON public.user_notes;
CREATE TRIGGER trg_user_notes_updated BEFORE UPDATE ON public.user_notes FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();

ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;

-- Lecture : tous les membres du dossier
DROP POLICY IF EXISTS un_select ON public.user_notes;
CREATE POLICY un_select ON public.user_notes FOR
SELECT USING (public.is_workspace_member (workspace_id));

-- Écriture : uniquement l'utilisateur sur sa ligne + writers du workspace
DROP POLICY IF EXISTS un_insert ON public.user_notes;
CREATE POLICY un_insert ON public.user_notes FOR INSERT
WITH CHECK (
  user_id = auth.uid ()
  AND public.can_write_workspace (workspace_id)
);

DROP POLICY IF EXISTS un_update ON public.user_notes;
CREATE POLICY un_update ON public.user_notes FOR
UPDATE USING (
  user_id = auth.uid ()
  AND public.can_write_workspace (workspace_id)
)
WITH CHECK (
  user_id = auth.uid ()
  AND public.can_write_workspace (workspace_id)
);

DROP POLICY IF EXISTS un_delete ON public.user_notes;
CREATE POLICY un_delete ON public.user_notes FOR DELETE USING (
  user_id = auth.uid ()
  AND public.can_write_workspace (workspace_id)
);

-- Migration best-effort : copier l'ancien bloc partagé dans la note du dernier éditeur,
-- sinon du créateur du dossier. (Ne supprime pas public.notes.)
INSERT INTO public.user_notes (workspace_id, user_id, body)
SELECT
  n.workspace_id,
  COALESCE(n.updated_by, w.created_by) AS user_id,
  n.body
FROM public.notes n
JOIN public.workspaces w ON w.id = n.workspace_id
WHERE
  COALESCE(NULLIF(trim(n.body), ''), '') <> ''
  AND COALESCE(n.updated_by, w.created_by) IS NOT NULL
ON CONFLICT (workspace_id, user_id) DO UPDATE SET
  body = EXCLUDED.body;

-- Realtime (optionnel)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE
      pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_notes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notes;
  END IF;
END;
$$;

