-- Création de dossier via RPC (SECURITY DEFINER) : évite les 42501 sur workspaces
-- lorsque l’INSERT direct est refusé par RLS (ex. session JWT non alignée avec created_by côté WITH CHECK).

CREATE OR REPLACE FUNCTION public.create_workspace (
  p_name text,
  p_description text,
  p_replacement_enabled boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wid uuid;
BEGIN
  IF auth.uid () IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  INSERT INTO public.workspaces (name, description, replacement_enabled, created_by)
  VALUES (
    trim(p_name),
    coalesce(p_description, ''),
    coalesce(p_replacement_enabled, false),
    auth.uid ()
  )
  RETURNING id INTO wid;

  RETURN wid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_workspace (text, text, boolean) TO authenticated;
