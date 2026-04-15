import { describe, expect, it } from 'vitest'
import { activityActionLabel, activityEntityLabel } from './activityLogLabels'

describe('activityLogLabels', () => {
  it('traduit les actions connues', () => {
    expect(activityActionLabel('workspace.decision')).toBe('Décision (modèle retenu)')
    expect(activityActionLabel('candidate.create')).toBe('Création d’un modèle')
  })

  it('renvoie le type brut si inconnu', () => {
    expect(activityActionLabel('custom.unknown')).toBe('custom.unknown')
  })

  it('traduit les entités connues', () => {
    expect(activityEntityLabel('candidate')).toBe('Modèle')
    expect(activityEntityLabel('workspace')).toBe('Dossier')
  })
})
