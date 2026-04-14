-- Miss Carbook — remise à zéro manuelle (NE PAS placer dans migrations/)
-- À exécuter dans Supabase → SQL Editor (ou psql) quand vous voulez tout effacer.
-- Efface : données public, fichiers du bucket workspace-media, comptes Auth.
-- Irréversible.

BEGIN;

TRUNCATE TABLE
  public.activity_log,
  public.comments,
  public.attachments,
  public.candidate_reviews,
  public.candidate_specs,
  public.candidates,
  public.requirement_candidate_evaluations,
  public.requirement_priority_votes,
  public.reminders,
  public.comparison_presets,
  public.requirements,
  public.notes,
  public.current_vehicle,
  public.workspace_invites,
  public.workspace_members,
  public.workspaces,
  public.profiles
RESTART IDENTITY CASCADE;

DELETE FROM storage.objects
WHERE bucket_id = 'workspace-media';

DELETE FROM auth.refresh_tokens;
DELETE FROM auth.sessions;
DELETE FROM auth.identities;
DELETE FROM auth.users;

COMMIT;
