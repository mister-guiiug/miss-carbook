-- Ordre d'affichage des modèles (racines entre elles ; compléments entre frères)
-- Idempotent : ré-exécution / base partiellement à jour → pas d’échec.

ALTER TABLE public.candidates
ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_candidates_workspace_parent_sort ON public.candidates (
  workspace_id,
  parent_candidate_id,
  sort_order
);

-- Racines : numérotation par workspace selon created_at
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY workspace_id
      ORDER BY
        created_at ASC,
        id ASC
    ) - 1 AS rn
  FROM public.candidates
  WHERE
    parent_candidate_id IS NULL
)
UPDATE public.candidates c
SET
  sort_order = ranked.rn
FROM ranked
WHERE
  c.id = ranked.id;

-- Compléments : numérotation par parent selon created_at
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY parent_candidate_id
      ORDER BY
        created_at ASC,
        id ASC
    ) - 1 AS rn
  FROM public.candidates
  WHERE
    parent_candidate_id IS NOT NULL
)
UPDATE public.candidates c
SET
  sort_order = ranked.rn
FROM ranked
WHERE
  c.id = ranked.id;
