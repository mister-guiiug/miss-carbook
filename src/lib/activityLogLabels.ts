/** Libellés FR pour le journal activity_log (types connus de l’app). */

const ACTION: Record<string, string> = {
  'candidate.create': 'Création d’un modèle',
  'candidate.delete': 'Suppression d’un modèle',
  'candidate.duplicate': 'Duplication d’un modèle',
  'candidate.import_csv': 'Import de modèles (CSV)',
  'candidate.update_identity': 'Mise à jour fiche modèle',
  'candidate.specs.upsert': 'Données constructeur enregistrées',
  'candidate.review.upsert': 'Avis / note enregistrés',
  'candidate.photo.upload': 'Photo ajoutée',
  'requirement.create': 'Exigence créée',
  'requirement.update': 'Exigence modifiée',
  'requirement.delete': 'Exigence supprimée',
  'rce.upsert': 'Évaluation exigence × modèle',
  'user_note.update': 'Bloc-notes mis à jour',
  'reminder.create': 'Rappel créé',
  'reminder.update': 'Rappel modifié',
  'visit.create': 'Visite enregistrée',
  'current_vehicle.upsert': 'Véhicule actuel enregistré',
  'member.role_change': 'Rôle d’un membre modifié',
  'member.removed': 'Membre retiré',
  'workspace.decision': 'Décision (modèle retenu)',
  'workspace.update_meta': 'Nom ou description du dossier',
}

const ENTITY: Record<string, string> = {
  workspace: 'Dossier',
  candidate: 'Modèle',
  requirement: 'Exigence',
  requirement_candidate: 'Évaluation',
  workspace_member: 'Membre',
  current_vehicle: 'Véhicule actuel',
  user_note: 'Bloc-notes',
  reminder: 'Rappel',
  visit: 'Visite',
}

export function activityActionLabel(actionType: string): string {
  return ACTION[actionType] ?? actionType
}

export function activityEntityLabel(entityType: string): string {
  return ENTITY[entityType] ?? entityType
}
