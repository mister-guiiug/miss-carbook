import { describe, expect, it } from 'vitest'
import {
  authPasswordLoginSchema,
  authPasswordSignUpSchema,
  candidateSchema,
  changeEmailSchema,
  displayNameSchema,
  requirementSchema,
  shareCodeSchema,
  workspaceMetaUpdateSchema,
} from './schemas'

describe('changeEmailSchema', () => {
  it('accepte un e-mail valide', () => {
    expect(changeEmailSchema.safeParse({ email: '  user@host.com  ' }).success).toBe(true)
  })
  it('refuse invalide', () => {
    expect(changeEmailSchema.safeParse({ email: 'pas-un-mail' }).success).toBe(false)
  })
})

describe('authPasswordSignUpSchema', () => {
  it('refuse si les mots de passe diffèrent', () => {
    const r = authPasswordSignUpSchema.safeParse({
      email: 'a@b.co',
      password: 'abcdefgh',
      confirmPassword: 'abcdefgi',
    })
    expect(r.success).toBe(false)
  })

  it('accepte inscription cohérente', () => {
    const r = authPasswordSignUpSchema.safeParse({
      email: 'a@b.co',
      password: 'abcdefgh',
      confirmPassword: 'abcdefgh',
    })
    expect(r.success).toBe(true)
  })
})

describe('authPasswordLoginSchema', () => {
  it('exige un mot de passe', () => {
    expect(authPasswordLoginSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false)
  })
})

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

describe('workspaceMetaUpdateSchema', () => {
  it('accepte nom + description', () => {
    const r = workspaceMetaUpdateSchema.safeParse({ name: ' Mon projet ', description: 'Détail' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.name).toBe('Mon projet')
  })
  it('refuse nom vide', () => {
    expect(workspaceMetaUpdateSchema.safeParse({ name: '   ', description: '' }).success).toBe(
      false
    )
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
  it('accepte une liste de liens vide', () => {
    const r = candidateSchema.safeParse({ manufacturer_links: [] })
    expect(r.success).toBe(true)
  })
  it('refuse une URL invalide dans les liens', () => {
    const r = candidateSchema.safeParse({ manufacturer_links: [{ url: 'pas-une-url', label: '' }] })
    expect(r.success).toBe(false)
  })
  it('normalise parent_candidate_id vide en null', () => {
    const r = candidateSchema.safeParse({ parent_candidate_id: '' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.parent_candidate_id).toBeNull()
  })
  it('accepte un UUID parent_candidate_id', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    const r = candidateSchema.safeParse({ parent_candidate_id: id })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.parent_candidate_id).toBe(id)
  })
  it('refuse parent_candidate_id non UUID', () => {
    expect(candidateSchema.safeParse({ parent_candidate_id: 'nope' }).success).toBe(false)
  })
  it('parse le prix avec espaces et virgule (fr-FR)', () => {
    const r = candidateSchema.safeParse({ price: '12 345,67' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.price).toBe(12345.67)
  })
  it('parse le kilométrage (entier km)', () => {
    const r = candidateSchema.safeParse({ mileage_km: '45 000' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.mileage_km).toBe(45000)
  })
})
