export const WORKSPACE_TABS = [
  { id: 'notepad', label: 'Bloc-notes' },
  { id: 'requirements', label: 'Exigences' },
  { id: 'evaluations', label: 'Évaluations' },
  { id: 'candidates', label: 'Modèles' },
  { id: 'compare', label: 'Comparer' },
  { id: 'reminders', label: 'Rappels' },
  { id: 'activity', label: 'Activité' },
  { id: 'settings', label: 'Réglages' },
] as const

export type TabId = (typeof WORKSPACE_TABS)[number]['id']

export function parseWorkspaceTabParam(raw: string | null): TabId {
  if (raw && WORKSPACE_TABS.some((t) => t.id === raw)) return raw as TabId
  return 'notepad'
}
