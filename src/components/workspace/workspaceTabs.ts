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
