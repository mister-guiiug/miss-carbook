-- Fiche technique flexible pour le véhicule actuel (remplacement), alignée sur candidate_specs.
ALTER TABLE public.current_vehicle
ADD COLUMN IF NOT EXISTS specs jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.current_vehicle.specs IS 'Données techniques JSON (schéma validé côté app — Zod)';
