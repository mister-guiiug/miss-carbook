import { describe, expect, it } from 'vitest'
import { formatGroupedIntegerFrDisplay, parseGroupedIntegerFrInput } from './formatGroupedIntegerFr'

describe('formatGroupedIntegerFr', () => {
  it('formate avec séparateurs fr-FR', () => {
    expect(formatGroupedIntegerFrDisplay(4_620)).toMatch(/4[\s\u202f]620/)
    expect(formatGroupedIntegerFrDisplay(12_345)).toMatch(/12[\s\u202f]345/)
  })

  it('parse espaces et espaces insécables', () => {
    expect(parseGroupedIntegerFrInput('4 620')).toBe(4620)
    expect(parseGroupedIntegerFrInput('12\u202f345')).toBe(12345)
    expect(parseGroupedIntegerFrInput('')).toBeNull()
  })
})
