import { describe, expect, it } from 'vitest'
import {
  candidateSchema,
  displayNameSchema,
  requirementSchema,
  shareCodeSchema,
} from './schemas'

describe('displayNameSchema', () => {
  it('accepte un pseudo valide', () => {
    expect(displayNameSchema.safeParse('  Ada  ').success).toBe(true)
  })
  it('refuse vide', () => {
    expect(displayNameSchema.safeParse('').success).toBe(false)
  })
})

describe('shareCodeSchema', () => {
  it('accepte un code', () => {
    expect(shareCodeSchema.safeParse('ABCD12').success).toBe(true)
  })
})

describe('requirementSchema', () => {
  it('parse tags depuis une chaîne', () => {
    const r = requirementSchema.safeParse({
      label: 'Coffre',
      level: 'mandatory',
      tags: 'famille, ski',
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.tags).toEqual(['famille', 'ski'])
  })
})

describe('candidateSchema', () => {
  it('accepte URL vide', () => {
    const r = candidateSchema.safeParse({ manufacturer_url: '' })
    expect(r.success).toBe(true)
  })
  it('refuse URL invalide', () => {
    const r = candidateSchema.safeParse({ manufacturer_url: 'pas-une-url' })
    expect(r.success).toBe(false)
  })
})
