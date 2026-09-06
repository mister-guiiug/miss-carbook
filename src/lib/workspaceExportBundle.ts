import { getSupabase } from './supabase';

/**
 * Première ligne de `meta.txt`, et seul marqueur qui distingue notre ZIP de
 * n'importe quel autre. Elle vit ICI, aux côtés de l'écriture, et non chez le
 * lecteur : les deux bouts de l'aller-retour lisent la même constante, donc
 * personne ne peut renommer l'un sans casser le test de l'autre.
 */
export const CARBOOK_EXPORT_SIGNATURE = 'Export Miss Carbook';

/** Version du format de bundle. À incrémenter quand le contenu change de forme. */
export const CARBOOK_EXPORT_VERSION = 2;

/** Le `meta.txt` du ZIP — écrit par l'export, relu par l'import. */
export function buildExportMetaText(
  workspaceId: string,
  generatedAt: string
): string {
  return [
    CARBOOK_EXPORT_SIGNATURE,
    `export_version=${CARBOOK_EXPORT_VERSION}`,
    `generated_at=${generatedAt}`,
    `workspace_id=${workspaceId}`,
    '',
    'Contenu : workspace, exigences, modèles (+ specs), notes, journal, visites, rappels, invitations,',
    'membres, presets de comparaison, véhicule actuel, évaluations matrice, votes MoSCoW,',
    'commentaires, avis modèles, pièces jointes (métadonnées uniquement, pas de fichiers binaires).',
    '',
    'Réimport : Réglages du dossier → Données → « Importer un dossier (ZIP) ». Sont restaurés les',
    'exigences, les modèles (avec leur hiérarchie et leurs caractéristiques) et le bloc-notes s’il est',
    'vide. Ne le sont pas : les photos (absentes du ZIP) ni ce qui porte l’identité d’un participant.',
  ].join('\n');
}

/** Données brutes alignées sur l’export ZIP (hors fichiers binaires). */
export type WorkspaceExportBundle = {
  workspace: Record<string, unknown> | null;
  requirements: unknown[];
  candidates: unknown[];
  notes: Record<string, unknown> | null;
  userNotes: unknown[];
  activityLog: unknown[];
  visits: unknown[];
  reminders: unknown[];
  invites: unknown[];
  members: unknown[];
  presets: unknown[];
  currentVehicle: Record<string, unknown> | null;
  evaluations: unknown[];
  votes: unknown[];
  comments: unknown[];
  reviews: unknown[];
  attachments: unknown[];
  /** id utilisateur → nom affiché (profil) */
  profileNames: Record<string, string>;
};

const empty = { data: [] as unknown[], error: null as null };

/**
 * Charge tout le périmètre exportable d’un dossier + noms d’affichage des profils
 * pour les utilisateurs référencés dans les données.
 */
export async function fetchWorkspaceExportBundle(
  workspaceId: string
): Promise<WorkspaceExportBundle> {
  const [
    ws,
    req,
    cand,
    notes,
    userNotes,
    act,
    visits,
    reminders,
    invites,
    members,
    presets,
    currVehicle,
  ] = await Promise.all([
    getSupabase().from('workspaces').select('*').eq('id', workspaceId).single(),
    getSupabase()
      .from('requirements')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('sort_order', { ascending: true }),
    getSupabase()
      .from('candidates')
      .select('*, candidate_specs ( specs )')
      .eq('workspace_id', workspaceId)
      .order('parent_candidate_id', { ascending: true, nullsFirst: true })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    getSupabase()
      .from('notes')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle(),
    getSupabase()
      .from('user_notes')
      .select('*')
      .eq('workspace_id', workspaceId),
    getSupabase()
      .from('activity_log')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(500),
    getSupabase()
      .from('visits')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('visit_at', { ascending: false }),
    getSupabase().from('reminders').select('*').eq('workspace_id', workspaceId),
    getSupabase()
      .from('workspace_invites')
      .select('*')
      .eq('workspace_id', workspaceId),
    getSupabase()
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', workspaceId),
    getSupabase()
      .from('comparison_presets')
      .select('*')
      .eq('workspace_id', workspaceId),
    getSupabase()
      .from('current_vehicle')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle(),
  ]);

  const requirementIds = (req.data ?? []).map((r: { id: string }) => r.id);
  const candidateIds = (cand.data ?? []).map((c: { id: string }) => c.id);

  const [evals, votes, comments, reviews, attachments] = await Promise.all([
    requirementIds.length
      ? getSupabase()
          .from('requirement_candidate_evaluations')
          .select('*')
          .in('requirement_id', requirementIds)
      : Promise.resolve(empty),
    requirementIds.length
      ? getSupabase()
          .from('requirement_priority_votes')
          .select('*')
          .in('requirement_id', requirementIds)
      : Promise.resolve(empty),
    candidateIds.length
      ? getSupabase()
          .from('comments')
          .select('*')
          .in('candidate_id', candidateIds)
      : Promise.resolve(empty),
    candidateIds.length
      ? getSupabase()
          .from('candidate_reviews')
          .select('*')
          .in('candidate_id', candidateIds)
      : Promise.resolve(empty),
    getSupabase()
      .from('attachments')
      .select('*')
      .eq('workspace_id', workspaceId),
  ]);

  const userIds = new Set<string>();
  for (const m of members.data ?? []) {
    const u = (m as { user_id?: string }).user_id;
    if (u) userIds.add(u);
  }
  for (const row of comments.data ?? []) {
    const u = (row as { user_id?: string }).user_id;
    if (u) userIds.add(u);
  }
  for (const row of reviews.data ?? []) {
    const u = (row as { user_id?: string }).user_id;
    if (u) userIds.add(u);
  }
  for (const row of votes.data ?? []) {
    const u = (row as { user_id?: string }).user_id;
    if (u) userIds.add(u);
  }
  for (const row of act.data ?? []) {
    const u = (row as { user_id?: string | null }).user_id;
    if (u) userIds.add(u);
  }
  for (const row of evals.data ?? []) {
    const u = (row as { updated_by?: string | null }).updated_by;
    if (u) userIds.add(u);
  }
  const noteRow = notes.data as { updated_by?: string | null } | null;
  if (noteRow?.updated_by) userIds.add(noteRow.updated_by);
  for (const row of reminders.data ?? []) {
    const u = (row as { created_by?: string }).created_by;
    if (u) userIds.add(u);
  }
  for (const row of visits.data ?? []) {
    const u = (row as { created_by?: string }).created_by;
    if (u) userIds.add(u);
  }
  for (const row of userNotes.data ?? []) {
    const u = (row as { user_id?: string }).user_id;
    if (u) userIds.add(u);
  }

  const ids = [...userIds];
  const profileNames: Record<string, string> = {};
  if (ids.length) {
    const { data: profs } = await getSupabase()
      .from('profiles')
      .select('id, display_name')
      .in('id', ids);
    for (const p of profs ?? []) {
      profileNames[(p as { id: string }).id] = (
        p as { display_name: string }
      ).display_name;
    }
  }

  return {
    workspace: (ws.data ?? null) as Record<string, unknown> | null,
    requirements: req.data ?? [],
    candidates: cand.data ?? [],
    notes: (notes.data ?? null) as Record<string, unknown> | null,
    userNotes: userNotes.data ?? [],
    activityLog: act.data ?? [],
    visits: visits.data ?? [],
    reminders: reminders.data ?? [],
    invites: invites.data ?? [],
    members: members.data ?? [],
    presets: presets.data ?? [],
    currentVehicle: (currVehicle.data ?? null) as Record<
      string,
      unknown
    > | null,
    evaluations: evals.data ?? [],
    votes: votes.data ?? [],
    comments: comments.data ?? [],
    reviews: reviews.data ?? [],
    attachments: attachments.data ?? [],
    profileNames,
  };
}
