-- Variations de modèles : lien vers un candidat « racine » (même marque / même modèle, finitions ou motorisations différentes).
-- Un seul niveau : pas de variation d’une variation (parent doit être racine).

ALTER TABLE public.candidates
ADD COLUMN IF NOT EXISTS parent_candidate_id uuid REFERENCES public.candidates (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_candidates_parent ON public.candidates (workspace_id, parent_candidate_id);

COMMENT ON COLUMN public.candidates.parent_candidate_id IS 'Référence optionnelle au modèle racine du même dossier ; NULL = racine.';

CREATE OR REPLACE FUNCTION public.candidates_enforce_parent ()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  p_workspace uuid;
  p_parent uuid;
BEGIN
  IF NEW.parent_candidate_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.parent_candidate_id = NEW.id THEN
    RAISE EXCEPTION 'parent_candidate_id must differ from id';
  END IF;
  SELECT workspace_id, parent_candidate_id INTO p_workspace, p_parent
  FROM
    public.candidates
  WHERE
    id = NEW.parent_candidate_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'parent candidate not found';
  END IF;
  IF p_workspace IS DISTINCT FROM NEW.workspace_id THEN
    RAISE EXCEPTION 'parent must belong to the same workspace';
  END IF;
  IF p_parent IS NOT NULL THEN
    RAISE EXCEPTION 'parent must be a root model (no variation of a variation)';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_candidates_parent ON public.candidates;

CREATE TRIGGER trg_candidates_parent
BEFORE INSERT OR UPDATE OF parent_candidate_id, workspace_id ON public.candidates FOR EACH ROW
EXECUTE FUNCTION public.candidates_enforce_parent ();
