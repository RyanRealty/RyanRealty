import { describe, expect, it } from 'vitest'
import {
  publishListingHeroCompactPrice,
  publishListingHeroKeyStats,
} from './publish-listing-hero-stats'

describe('publishListingHeroCompactPrice', () => {
  it('prints Roosevelt $999,900 as $1.0M, never $1000K', () => {
    expect(publishListingHeroCompactPrice(999_900)).toBe('$1.0M')
    expect(publishListingHeroCompactPrice(999_900)).not.toBe('$1000K')
  })

  it('keeps sub-million K labels and exact millions', () => {
    expect(publishListingHeroCompactPrice(260_000)).toBe('$260K')
    expect(publishListingHeroCompactPrice(1_495_000)).toBe('$1.5M')
  })

  it('withholds a missing ask', () => {
    expect(publishListingHeroCompactPrice(null)).toBeNull()
    expect(publishListingHeroCompactPrice(0)).toBeNull()
  })
})

describe('publishListingHeroKeyStats', () => {
  it('prints Columbus and Kouns acres when living-area stats are absent', () => {
    expect(publishListingHeroKeyStats({ acres: 19.77 })).toEqual(['19.77 acres'])
    expect(publishListingHeroKeyStats({ acres: 1.35 })).toEqual(['1.35 acres'])
  })

  it('prints living-area stats and withholds acres when they exist', () => {
    expect(
      publishListingHeroKeyStats({
        beds: 2,
        baths: 3,
        sqft: 1868,
        acres: 0.28,
      }),
    ).toEqual(['2 bd', '3 ba', '1,868 sqft'])
  })

  it('does not invent beds for the Agness farm row that only has sqft', () => {
    expect(
      publishListingHeroKeyStats({
        beds: null,
        baths: null,
        sqft: 4021,
        acres: 2.5,
      }),
    ).toEqual(['4,021 sqft'])
  })
})
