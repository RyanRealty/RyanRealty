import { describe, expect, it } from 'vitest'
import {
  formatListingMoney,
  publishListingMoney,
  publishNewConstructionYn,
  publishYearBuilt,
} from './publish-listing-facts'

describe('publishListingMoney', () => {
  it('keeps an exact list price (no thousand-round)', () => {
    expect(publishListingMoney(614995)).toBe(614995)
    expect(formatListingMoney(614995)).toBe('$614,995')
  })

  it('rounds HOA cents to whole dollars so True cost and Financial agree', () => {
    expect(publishListingMoney(21.92)).toBe(22)
    expect(publishListingMoney(172.94)).toBe(173)
    expect(formatListingMoney(93)).toBe('$93')
  })

  it('withholds zero and non-finite', () => {
    expect(publishListingMoney(0)).toBeNull()
    expect(publishListingMoney(null)).toBeNull()
    expect(publishListingMoney(Number.NaN)).toBeNull()
    expect(formatListingMoney(null)).toBeNull()
  })
})

describe('publishYearBuilt', () => {
  it('keeps a plausible year', () => {
    expect(publishYearBuilt(2025, 2026)).toBe(2025)
    expect(publishYearBuilt(1991, 2026)).toBe(1991)
  })

  it('withholds sqft leaking into year_built', () => {
    expect(publishYearBuilt(3672, 2026)).toBeNull()
  })

  it('withholds years before 1800 and more than two years ahead', () => {
    expect(publishYearBuilt(1799, 2026)).toBeNull()
    expect(publishYearBuilt(2029, 2026)).toBeNull()
    expect(publishYearBuilt(2028, 2026)).toBe(2028)
  })
})

describe('publishNewConstructionYn', () => {
  it('keeps MLS new-construction when the year is plausible', () => {
    expect(publishNewConstructionYn(true, 2025, 2026)).toBe(true)
  })

  it('withholds new-construction when year_built is implausible', () => {
    expect(publishNewConstructionYn(true, 3672, 2026)).toBe(false)
  })

  it('keeps the flag when year is missing', () => {
    expect(publishNewConstructionYn(true, null, 2026)).toBe(true)
  })

  it('stays false when MLS did not mark new construction', () => {
    expect(publishNewConstructionYn(false, 2025, 2026)).toBe(false)
    expect(publishNewConstructionYn(null, 3672, 2026)).toBe(false)
  })
})
