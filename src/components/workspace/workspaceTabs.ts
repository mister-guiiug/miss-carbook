export const WORKSPACE_TABS = [
  { id: 'notepad', label: 'Bloc-notes' },
  { id: 'requirements', label: 'Exigences' },
  { id: 'requirementsMatrix', label: 'Matrice exigences' },
  { id: 'evaluations', label: 'Évaluations' },
  { id: 'weightedVoting', label: 'Votes pondérés' },
  { id: 'candidates', label: 'Modèles' },
  { id: 'compare', label: 'Comparer' },
  { id: 'smartCompare', label: 'Assistant' },
  /** Visites (historique) + rappels à faire / faits — même onglet dans l'UI. */
  { id: 'reminders', label: 'Visites et rappels' },
  { id: 'budget', label: 'Budget et TCO' },
  { id: 'activity', label: 'Activité' },
  { id: 'settings', label: 'Réglages' },
] as const

export type TabId = (typeof WORKSPACE_TABS)[number]['id']

/** Onglets de la bande « Sections » — réglages via la barre du haut ; activité : raccourci à côté du titre. */
export const WORKSPACE_STRIP_TAB_ORDER = [
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
] as const satisfies readonly TabId[]

export const WORKSPACE_TABS_STRIP = WORKSPACE_STRIP_TAB_ORDER.map(
  (id) => WORKSPACE_TABS.find((t) => t.id === id)!
)

export const WORKSPACE_SETTINGS_TAB_TITLE =
  'Nom du dossier, membres, invitations, partage — uniquement ce projet'

export const WORKSPACE_ACTIVITY_TAB_TITLE = 'Activité et historique de ce dossier'

export function parseWorkspaceTabParam(raw: string | null): TabId {
  if (raw && WORKSPACE_TABS.some((t) => t.id === raw)) return raw as TabId
  return 'notepad'
}
