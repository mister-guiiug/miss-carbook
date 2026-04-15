-- Ordre d'affichage des notes des *autres* membres dans le bloc-notes.
-- Stocké sur la ligne user_notes de l'utilisateur courant (compatible RLS : on ne modifie que sa propre ligne).

ALTER TABLE public.user_notes
ADD COLUMN IF NOT EXISTS peer_order uuid[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.user_notes.peer_order IS
  'Ordre préféré des user_id des autres membres du dossier pour l’affichage du bloc-notes (la note « moi » reste en tête côté UI).';
