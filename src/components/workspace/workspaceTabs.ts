// Libellés d'onglets déplacés vers l'i18n (groupe `workspace`, clés `tab_<id>`) ;
// seuls les identifiants stables restent ici, rendus via t('workspace.tab_<id>').
export const WORKSPACE_TABS = [
  { id: 'notepad' },
  { id: 'requirements' },
  { id: 'requirementsMatrix' },
  { id: 'evaluations' },
  { id: 'weightedVoting' },
  { id: 'candidates' },
  { id: 'compare' },
  { id: 'smartCompare' },
  /** Visites (historique) + rappels à faire / faits — même onglet dans l'UI. */
  { id: 'reminders' },
  { id: 'budget' },
  { id: 'activity' },
  { id: 'settings' },
] as const;

export type TabId = (typeof WORKSPACE_TABS)[number]['id'];

/** Onglets de la bande « Sections » — réglages via la barre du haut ; activité : raccourci à côté du titre. */
const WORKSPACE_STRIP_TAB_ORDER = [
  'notepad',
  'requirements',
  'requirementsMatrix',
  'evaluations',
  'weightedVoting',
  'candidates',
  'compare',
  'smartCompare',
  'reminders',
  'budget',
] as const satisfies readonly TabId[];

export const WORKSPACE_TABS_STRIP = WORKSPACE_STRIP_TAB_ORDER.map(
  id => WORKSPACE_TABS.find(t => t.id === id)!
);

export function parseWorkspaceTabParam(raw: string | null): TabId {
  if (raw && WORKSPACE_TABS.some(t => t.id === raw)) return raw as TabId;
  return 'notepad';
}
