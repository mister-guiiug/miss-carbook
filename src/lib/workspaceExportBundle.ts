import { supabase } from './supabase'

/** Données brutes alignées sur l’export ZIP (hors fichiers binaires). */
export type WorkspaceExportBundle = {
  workspace: Record<string, unknown> | null
  requirements: unknown[]
  candidates: unknown[]
  notes: Record<string, unknown> | null
  activityLog: unknown[]
  visits: unknown[]
  reminders: unknown[]
  invites: unknown[]
  members: unknown[]
  presets: unknown[]
  currentVehicle: Record<string, unknown> | null
  evaluations: unknown[]
  votes: unknown[]
  comments: unknown[]
  reviews: unknown[]
  attachments: unknown[]
  /** id utilisateur → nom affiché (profil) */
  profileNames: Record<string, string>
}

const empty = { data: [] as unknown[], error: null as null }

/**
 * Charge tout le périmètre exportable d’un dossier + noms d’affichage des profils
 * pour les utilisateurs référencés dans les données.
 */
export async function fetchWorkspaceExportBundle(
  workspaceId: string
): Promise<WorkspaceExportBundle> {
  const [ws, req, cand, notes, act, visits, reminders, invites, members, presets, currVehicle] =
    await Promise.all([
      supabase.from('workspaces').select('*').eq('id', workspaceId).single(),
      supabase
        .from('requirements')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('candidates')
        .select('*, candidate_specs ( specs )')
        .eq('workspace_id', workspaceId),
      supabase.from('notes').select('*').eq('workspace_id', workspaceId).maybeSingle(),
      supabase
        .from('activity_log')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('visits')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('visit_at', { ascending: false }),
      supabase.from('reminders').select('*').eq('workspace_id', workspaceId),
      supabase.from('workspace_invites').select('*').eq('workspace_id', workspaceId),
      supabase.from('workspace_members').select('*').eq('workspace_id', workspaceId),
      supabase.from('comparison_presets').select('*').eq('workspace_id', workspaceId),
      supabase.from('current_vehicle').select('*').eq('workspace_id', workspaceId).maybeSingle(),
    ])

  const requirementIds = (req.data ?? []).map((r: { id: string }) => r.id)
  const candidateIds = (cand.data ?? []).map((c: { id: string }) => c.id)

  const [evals, votes, comments, reviews, attachments] = await Promise.all([
    requirementIds.length
      ? supabase
          .from('requirement_candidate_evaluations')
          .select('*')
          .in('requirement_id', requirementIds)
      : Promise.resolve(empty),
    requirementIds.length
      ? supabase.from('requirement_priority_votes').select('*').in('requirement_id', requirementIds)
      : Promise.resolve(empty),
    candidateIds.length
      ? supabase.from('comments').select('*').in('candidate_id', candidateIds)
      : Promise.resolve(empty),
    candidateIds.length
      ? supabase.from('candidate_reviews').select('*').in('candidate_id', candidateIds)
      : Promise.resolve(empty),
    supabase.from('attachments').select('*').eq('workspace_id', workspaceId),
  ])

  const userIds = new Set<string>()
  for (const m of members.data ?? []) {
    const u = (m as { user_id?: string }).user_id
    if (u) userIds.add(u)
  }
  for (const row of comments.data ?? []) {
    const u = (row as { user_id?: string }).user_id
    if (u) userIds.add(u)
  }
  for (const row of reviews.data ?? []) {
    const u = (row as { user_id?: string }).user_id
    if (u) userIds.add(u)
  }
  for (const row of votes.data ?? []) {
    const u = (row as { user_id?: string }).user_id
    if (u) userIds.add(u)
  }
  for (const row of act.data ?? []) {
    const u = (row as { user_id?: string | null }).user_id
    if (u) userIds.add(u)
  }
  for (const row of evals.data ?? []) {
    const u = (row as { updated_by?: string | null }).updated_by
    if (u) userIds.add(u)
  }
  const noteRow = notes.data as { updated_by?: string | null } | null
  if (noteRow?.updated_by) userIds.add(noteRow.updated_by)
  for (const row of reminders.data ?? []) {
    const u = (row as { created_by?: string }).created_by
    if (u) userIds.add(u)
  }
  for (const row of visits.data ?? []) {
    const u = (row as { created_by?: string }).created_by
    if (u) userIds.add(u)
  }

  const ids = [...userIds]
  const profileNames: Record<string, string> = {}
  if (ids.length) {
    const { data: profs } = await supabase.from('profiles').select('id, display_name').in('id', ids)
    for (const p of profs ?? []) {
      profileNames[(p as { id: string }).id] = (p as { display_name: string }).display_name
    }
  }

  return {
    workspace: (ws.data ?? null) as Record<string, unknown> | null,
    requirements: req.data ?? [],
    candidates: cand.data ?? [],
    notes: (notes.data ?? null) as Record<string, unknown> | null,
    activityLog: act.data ?? [],
    visits: visits.data ?? [],
    reminders: reminders.data ?? [],
    invites: invites.data ?? [],
    members: members.data ?? [],
    presets: presets.data ?? [],
    currentVehicle: (currVehicle.data ?? null) as Record<string, unknown> | null,
    evaluations: evals.data ?? [],
    votes: votes.data ?? [],
    comments: comments.data ?? [],
    reviews: reviews.data ?? [],
    attachments: attachments.data ?? [],
    profileNames,
  }
}
