-- Mise en circulation, boîte de vitesses, énergie (fiche candidat — détails véhicule).

ALTER TABLE public.candidates
ADD COLUMN IF NOT EXISTS first_registration text NOT NULL DEFAULT '' CHECK (char_length(first_registration) <= 120);

ALTER TABLE public.candidates
ADD COLUMN IF NOT EXISTS gearbox text NOT NULL DEFAULT '' CHECK (char_length(gearbox) <= 120);

ALTER TABLE public.candidates
ADD COLUMN IF NOT EXISTS energy text NOT NULL DEFAULT '' CHECK (char_length(energy) <= 120);

COMMENT ON COLUMN public.candidates.first_registration IS 'Date ou période de 1re mise en circulation (saisie libre).';
COMMENT ON COLUMN public.candidates.gearbox IS 'Type de boîte de vitesses.';
COMMENT ON COLUMN public.candidates.energy IS 'Énergie / carburant.';
