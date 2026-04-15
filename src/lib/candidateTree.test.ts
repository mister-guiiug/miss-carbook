import { describe, expect, it } from 'vitest'
import {
  countVariationsForRoot,
  eligibleRootParentsForSelect,
  isOrphanVariation,
  isRootCandidate,
  listChildrenOf,
  listOrphanVariations,
  listRootCandidates,
  postOrderDeleteIds,
  resolveIdentityForCandidateUpdate,
  validateParentAssignment,
  validateParentChange,
} from './candidateTree'

function row(
  id: string,
  parent: string | null,
  so = 0,
  trim = ''
): import('./candidateTree').CandidateTreeRow {
  return {
    id,
    parent_candidate_id: parent,
    sort_order: so,
    trim,
    brand: 'B',
    model: 'M',
    event_date: null,
  }
}

describe('candidateTree', () => {
  it('détecte racine et orphelin', () => {
    const a = row('a', null)
    const b = row('b', 'a')
    expect(isRootCandidate(a)).toBe(true)
    expect(isRootCandidate(b)).toBe(false)
    expect(isOrphanVariation(b, [b])).toBe(true)
    expect(isOrphanVariation(b, [a, b])).toBe(false)
  })

  it('liste racines, enfants et orphelins', () => {
    const a = row('a', null, 1, 'v1')
    const b = row('b', null, 0, 'v2')
    const c = row('c', 'a')
    const o = row('o', 'missing')
    const all = [c, a, b, o]
    expect(listRootCandidates(all).map((x) => x.id)).toEqual(['b', 'a'])
    expect(listChildrenOf('a', all).map((x) => x.id)).toEqual(['c'])
    expect(listOrphanVariations(all).map((x) => x.id)).toEqual(['o'])
  })

  it('validateParentAssignment refuse racine avec compléments rattachée à un parent', () => {
    const a = row('a', null)
    const b = row('b', 'a')
    const r = validateParentAssignment('a', 'x', [a, b, row('x', null)])
    expect(r.ok).toBe(false)
  })

  it('validateParentAssignment accepte racine sans enfant', () => {
    const a = row('a', null)
    const x = row('x', null)
    expect(validateParentAssignment('a', 'x', [a, x]).ok).toBe(true)
  })

  it('validateParentChange reflète racine avec compléments', () => {
    expect(
      validateParentChange('a', 'x', { isRoot: true, directVariationCount: 1 }).ok
    ).toBe(false)
    expect(validateParentChange('a', 'x', { isRoot: true, directVariationCount: 0 }).ok).toBe(
      true
    )
  })

  it('resolveIdentityForCandidateUpdate prend marque du parent choisi', () => {
    const roots = [
      { ...row('p', null), brand: 'Peugeot', model: '308', event_date: '2024' },
    ]
    const r = resolveIdentityForCandidateUpdate({
      nextParentId: 'p',
      meta: { brand: 'X', model: 'Y', event_date: '1999' },
      rootCandidates: roots,
    })
    expect(r.brand).toBe('Peugeot')
    expect(r.model).toBe('308')
    expect(r.event_date).toBe('2024')
  })

  it('resolveIdentityForCandidateUpdate sans parent garde le meta', () => {
    const r = resolveIdentityForCandidateUpdate({
      nextParentId: null,
      meta: { brand: 'Renault', model: 'Clio', event_date: ' 2020 ' },
      rootCandidates: [],
    })
    expect(r.brand).toBe('Renault')
    expect(r.event_date).toBe('2020')
  })

  it('postOrderDeleteIds enfant puis racine', () => {
    const a = row('a', null)
    const b = row('b', 'a')
    const c = row('c', 'a')
    const all = [a, b, c]
    expect(postOrderDeleteIds(a, all)).toEqual(['b', 'c', 'a'])
  })

  it('eligibleRootParentsForSelect exclut soi-même', () => {
    const roots = [row('a', null), row('b', null)]
    expect(eligibleRootParentsForSelect('a', roots).map((x) => x.id)).toEqual(['b'])
  })

  it('countVariationsForRoot', () => {
    const all = [row('a', null), row('b', 'a'), row('c', 'a'), row('d', null)]
    expect(countVariationsForRoot('a', all)).toBe(2)
  })
})
