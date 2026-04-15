-- Kilométrage affiché dans les détails véhicule (fiche candidat).

ALTER TABLE public.candidates
ADD COLUMN IF NOT EXISTS mileage_km integer
  CHECK (
    mileage_km IS NULL
    OR (mileage_km >= 0 AND mileage_km <= 9999999)
  );

COMMENT ON COLUMN public.candidates.mileage_km IS 'Kilométrage du véhicule (km).';
