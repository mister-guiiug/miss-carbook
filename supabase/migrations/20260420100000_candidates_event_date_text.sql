-- Période / année saisie libre (texte) au lieu du type date SQL
ALTER TABLE public.candidates
  ALTER COLUMN event_date TYPE text USING (
    CASE
      WHEN event_date IS NULL THEN NULL
      ELSE event_date::text
    END
  );
