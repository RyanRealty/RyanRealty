import { describe, it, expect } from 'vitest'
import { normalizeSavedSearchFilters, getSavedSearchHash } from './search-filters'

// Saved-search alert dedup hinges on normalize + hash: two saves that mean the
// same thing must produce the same hash (else duplicate alerts), and a real
// filter change must produce a different hash (else a missed alert). Audit p3.2.
describe('normalizeSavedSearchFilters', () => {
  it('keeps known keys, drops unknown keys and null/empty values', () => {
    const out = normalizeSavedSearchFilters({
      city: '  Bend  ',
      minPrice: '500000',
      beds: null,
      maxPrice: '',
      randomJunk: 'x',
    })
    expect(out).toEqual({ city: 'Bend', minPrice: 500000 })
  })
  it('coerces string booleans and drops invalid ones', () => {
    const out = normalizeSavedSearchFilters({ hasPool: 'true', includeClosed: 'no', hasView: 'maybe' })
    expect(out).toEqual({ hasPool: true, includeClosed: false })
  })
})

describe('getSavedSearchHash (dedup contract)', () => {
  it('is independent of key insertion order', () => {
    expect(getSavedSearchHash({ city: 'Bend', minPrice: 500000 })).toBe(
      getSavedSearchHash({ minPrice: 500000, city: 'Bend' }),
    )
  })
  it('treats a numeric string and a number as equal', () => {
    expect(getSavedSearchHash({ minPrice: '500000' })).toBe(getSavedSearchHash({ minPrice: 500000 }))
  })
  it('ignores unknown junk keys', () => {
    expect(getSavedSearchHash({ city: 'Bend', randomJunk: 'zzz' })).toBe(
      getSavedSearchHash({ city: 'Bend' }),
    )
  })
  it('changes when a real filter changes', () => {
    expect(getSavedSearchHash({ city: 'Bend' })).not.toBe(getSavedSearchHash({ city: 'Redmond' }))
  })
  it('returns the s_<hex> format', () => {
    expect(getSavedSearchHash({ city: 'Bend' })).toMatch(/^s_[0-9a-f]+$/)
  })
})
