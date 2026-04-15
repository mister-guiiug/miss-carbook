import { describe, expect, it } from 'vitest'
import { formatMileageKmDisplay, parseMileageKmInput } from './formatMileage'

describe('formatMileage', () => {
  it('formate avec séparateurs fr-FR', () => {
    expect(formatMileageKmDisplay(45000)).toMatch(/45[\s\u202f]000/)
    expect(formatMileageKmDisplay(1200)).toMatch(/1[\s\u202f]200/)
  })

  it('parse espaces et espaces insécables', () => {
    expect(parseMileageKmInput('45 000')).toBe(45000)
    expect(parseMileageKmInput('45\u202f000')).toBe(45000)
    expect(parseMileageKmInput('')).toBeNull()
  })
})
