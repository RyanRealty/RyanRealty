import { describe, it, expect } from 'vitest'
import { normalizeSavedSearchFilters, getSavedSearchHash, savedFiltersToAdvanced, hasNarrowingFilter } from './search-filters'

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
  it('hash is stable across the registry-key expansion (pinned pre-expansion values)', () => {
    // Captured from the pre-registry implementation (2026-07-11). A change here
    // means every saved-search row would re-alert — do not accept silently.
    expect(getSavedSearchHash({ city: 'Bend', minPrice: 500000 })).toBe('s_a4b5b7a7')
    expect(getSavedSearchHash({ city: 'Redmond', beds: 3, hasPool: 'true', statusFilter: 'active' })).toBe('s_f7245858')
  })
  it('CSV string and string[] hash identically for a registry multi', () => {
    expect(getSavedSearchHash({ flooring: 'Hardwood,Tile' })).toBe(
      getSavedSearchHash({ flooring: ['Hardwood', 'Tile'] }),
    )
    expect(getSavedSearchHash({ flooring: ['Hardwood'] })).not.toBe(
      getSavedSearchHash({ flooring: ['Hardwood', 'Tile'] }),
    )
  })
})

describe('registry-driven filter keys', () => {
  it('normalizes registry booleans, ranges, and multis', () => {
    const out = normalizeSavedSearchFilters({
      shop: '1',
      hoaMonthlyMax: '150',
      flooring: 'Hardwood,Tile',
      county: ['Deschutes'],
      elementarySchool: ' Pine Ridge ',
    })
    expect(out).toEqual({
      shop: true,
      hoaMonthlyMax: 150,
      flooring: ['Hardwood', 'Tile'],
      county: ['Deschutes'],
      elementarySchool: 'Pine Ridge',
    })
  })
  it('savedFiltersToAdvanced passes registry keys through to the advanced object', () => {
    const adv = savedFiltersToAdvanced({
      city: 'Bend',
      shop: '1',
      onWell: 'true',
      flooring: 'Hardwood',
      viewTypes: ['Cascade Mountains', 'River'],
      hoaMonthlyMax: '150',
      daysOnMarket: '7',
      monthlyPaymentMax: 3000,
    })
    expect(adv.city).toBe('Bend')
    expect(adv.shop).toBe(true)
    expect(adv.onWell).toBe(true)
    expect(adv.flooring).toEqual(['Hardwood'])
    expect(adv.viewTypes).toEqual(['Cascade Mountains', 'River'])
    expect(adv.hoaMonthlyMax).toBe(150)
    expect(adv.daysOnMarket).toBe(7)
    expect(adv.monthlyPaymentMax).toBe(3000)
  })
})

describe('propertySubTypes saved-search wiring (plan §4.7, 2026-07-30)', () => {
  it('normalizes the CSV URL grammar and string[] identically', () => {
    expect(normalizeSavedSearchFilters({ propertySubTypes: 'Duplex,Triplex' })).toEqual({
      propertySubTypes: ['Duplex', 'Triplex'],
    })
    expect(getSavedSearchHash({ propertySubTypes: 'Duplex,Triplex' })).toBe(
      getSavedSearchHash({ propertySubTypes: ['Duplex', 'Triplex'] }),
    )
  })
  it('savedFiltersToAdvanced carries the array (alerts see the sub-type filter)', () => {
    const adv = savedFiltersToAdvanced({ city: 'Bend', propertySubTypes: 'Duplex,Triplex' })
    expect(adv.propertySubTypes).toEqual(['Duplex', 'Triplex'])
    // Legacy scalar still round-trips for pre-remap saved rows.
    const legacy = savedFiltersToAdvanced({ propertySubType: 'Condo' })
    expect(legacy.propertySubType).toBe('Condo')
  })
  it('is a NARROWING key — a sub-type-only search can become an alert', () => {
    expect(hasNarrowingFilter({ propertySubTypes: ['Duplex'] })).toBe(true)
    expect(hasNarrowingFilter({ propertySubTypes: 'Duplex,Triplex' })).toBe(true)
  })
})

describe('hasNarrowingFilter (attack 2026-07-11)', () => {
  it('view/sort/poly/status-only searches are NOT narrowing (blocks whole-feed alerts)', () => {
    expect(hasNarrowingFilter({ view: 'list' })).toBe(false)
    expect(hasNarrowingFilter({ sort: 'price_asc' })).toBe(false)
    expect(hasNarrowingFilter({ poly: '44.05,-121.3;44.06,-121.31;44.05,-121.32' })).toBe(false)
    expect(hasNarrowingFilter({ statusFilter: 'active', includeClosed: '1' as unknown as boolean })).toBe(false)
  })
  it('a real filter is narrowing', () => {
    expect(hasNarrowingFilter({ city: 'Bend' })).toBe(true)
    expect(hasNarrowingFilter({ maxPrice: 500000 })).toBe(true)
    expect(hasNarrowingFilter({ viewTypes: ['Panoramic'] })).toBe(true)
    expect(hasNarrowingFilter({ poly: 'x', city: 'Bend' })).toBe(true)
  })
})

describe('normalizeSavedSearchFilters — an inverted range cannot persist', () => {
  it("drops both bounds on the real defect that silenced a subscriber", () => {
    // Saved 2026-08-15: "Sunriver homes, min 650, max 1". He meant $650K to
    // $1M; the field wanted whole dollars. The engine checked it daily and
    // correctly found nothing, so he heard silence for eleven days.
    const out = normalizeSavedSearchFilters({
      neighborhoodSlug: 'sunriver',
      minPrice: 650,
      maxPrice: 1,
    })
    expect(out.minPrice).toBeUndefined()
    expect(out.maxPrice).toBeUndefined()
    // The rest of the search survives, so the row still means what its name says.
    expect(out.neighborhoodSlug).toBe('sunriver')
  })

  it('drops a transposed pair too, rather than guessing a swap', () => {
    const out = normalizeSavedSearchFilters({ city: 'Bend', minPrice: 900000, maxPrice: 500000 })
    expect(out.minPrice).toBeUndefined()
    expect(out.maxPrice).toBeUndefined()
    expect(out.city).toBe('Bend')
  })

  it('leaves a valid range alone, including equal bounds', () => {
    const ok = normalizeSavedSearchFilters({ minPrice: 400000, maxPrice: 600000 })
    expect(ok.minPrice).toBe(400000)
    expect(ok.maxPrice).toBe(600000)
    const equal = normalizeSavedSearchFilters({ minPrice: 500000, maxPrice: 500000 })
    expect(equal.minPrice).toBe(500000)
    expect(equal.maxPrice).toBe(500000)
  })

  it('leaves a one-sided bound alone', () => {
    expect(normalizeSavedSearchFilters({ minPrice: 650000 }).minPrice).toBe(650000)
    expect(normalizeSavedSearchFilters({ maxPrice: 800000 }).maxPrice).toBe(800000)
  })

  it('applies the same rule to square footage', () => {
    const out = normalizeSavedSearchFilters({ minSqFt: 2000, maxSqFt: 1200 })
    expect(out.minSqFt).toBeUndefined()
    expect(out.maxSqFt).toBeUndefined()
  })
})
