-- Plusieurs liens constructeur / ressources par candidat (variations).
ALTER TABLE public.candidates
ADD COLUMN IF NOT EXISTS manufacturer_links jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.candidates.manufacturer_links IS 'Liste JSON [{ "url": "https://...", "label": "..." }] ; manufacturer_url reste le premier URL pour compatibilité.';

UPDATE public.candidates
SET
  manufacturer_links = jsonb_build_array(
    jsonb_build_object('url', trim(manufacturer_url), 'label', '')
  )
WHERE
  trim(manufacturer_url) <> ''
  AND manufacturer_links = '[]'::jsonb;
