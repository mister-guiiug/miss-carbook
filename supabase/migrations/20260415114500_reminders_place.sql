-- Rappels : ajouter un lieu (pour suggestions Garage / lieu)
ALTER TABLE public.reminders
ADD COLUMN IF NOT EXISTS place text NOT NULL DEFAULT '' CHECK (char_length(place) <= 200);

CREATE INDEX IF NOT EXISTS idx_reminders_workspace_place ON public.reminders (workspace_id, place);

