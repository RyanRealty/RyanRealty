import { describe, it, expect } from 'vitest'
import { slugify, cityEntityKey, subdivisionEntityKey, parseEntityKey } from './slug'

describe('slug', () => {
  it('slugify normalizes names', () => {
    expect(slugify('Bend')).toBe('bend')
    expect(slugify('Sunriver')).toBe('sunriver')
    expect(slugify('  La Pine  ')).toBe('la-pine')
    expect(slugify('Broken Top')).toBe('broken-top')
  })

  it('cityEntityKey returns slug', () => {
    expect(cityEntityKey('Bend')).toBe('bend')
  })

  it('subdivisionEntityKey joins city and subdivision', () => {
    expect(subdivisionEntityKey('Bend', 'Sunriver')).toBe('bend:sunriver')
  })

  it('parseEntityKey parses entity key', () => {
    expect(parseEntityKey('bend:sunriver')).toEqual({ city: 'Bend', subdivision: 'Sunriver' })
  })
})
