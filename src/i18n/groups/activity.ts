// Onglet Activité et historique du dossier (ActivityTab).
// Note : les libellés d’action/entité proviennent de lib/activityLogLabels.ts
// et ne sont pas traduits ici (hors périmètre).
export const activityFr = {
  title: 'Activité et historique',
  lead: 'Actions récentes sur ce dossier (créations, modifications, partage…). Les nouvelles entrées s’affichent en temps réel.',
  metaSingular: '{count} événement affiché — jusqu’à {limit} au maximum.',
  metaPlural: '{count} événements affichés — jusqu’à {limit} au maximum.',
  emptyTitle: 'Aucune activité pour l’instant',
  emptyText:
    'Dès que vous ou d’autres membres agirez dans le dossier, le détail apparaîtra ici avec la date et l’auteur.',
  today: "Aujourd'hui",
  yesterday: 'Hier',
  systemAuthor: 'Système',
  ctxLoadActivity: 'Chargement du journal d’activité',
} as const;

export const activityEn = {
  title: 'Activity and history',
  lead: 'Recent actions on this workspace (creations, edits, sharing…). New entries appear in real time.',
  metaSingular: '{count} event shown — up to {limit} max.',
  metaPlural: '{count} events shown — up to {limit} max.',
  emptyTitle: 'No activity yet',
  emptyText:
    'As soon as you or other members act in the workspace, the details will appear here with the date and author.',
  today: 'Today',
  yesterday: 'Yesterday',
  systemAuthor: 'System',
  ctxLoadActivity: 'Loading the activity log',
} as const;
