import { describe, expect, it } from 'vitest'
import {
  candidateSchema,
  displayNameSchema,
  requirementSchema,
  shareCodeSchema,
} from './schemas'

describe('displayNameSchema', () => {
  it('accepte un pseudo valide', () => {
    expect(displayNameSchema.safeParse('  Ada_Lovelace9  ').success).toBe(true)
  })
  it('refuse vide', () => {
    expect(displayNameSchema.safeParse('').success).toBe(false)
  })
  it('refuse trop court', () => {
    expect(displayNameSchema.safeParse('ab').success).toBe(false)
  })
  it('refuse espace ou accents', () => {
    expect(displayNameSchema.safeParse('a b').success).toBe(false)
    expect(displayNameSchema.safeParse('été').success).toBe(false)
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
