-- Correctif : création de dossier en 403 si la première ligne workspace_members était bloquée
-- par wm_insert_admin (admin requis avant d’exister comme membre).
-- À exécuter sur les projets ayant déjà appliqué la migration initiale sans cette policy.

DROP POLICY IF EXISTS wm_insert_creator_first ON public.workspace_members;

CREATE POLICY wm_insert_creator_first ON public.workspace_members FOR INSERT
WITH CHECK (
  user_id = auth.uid ()
  AND role = 'admin'
  AND EXISTS (
    SELECT 1
    FROM public.workspaces w
    WHERE
      w.id = workspace_id
      AND w.created_by = auth.uid ()
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = workspace_id
  )
);
