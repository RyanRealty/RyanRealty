import { describe, expect, it } from 'vitest'
import {
  publishListingHeroCompactPrice,
  publishListingHeroKeyStats,
  publishListingHeroPrice,
} from './publish-listing-hero-stats'

describe('publishListingHeroPrice', () => {
  it('prints Flagstone exact dollars, never a compact K', () => {
    expect(publishListingHeroPrice(568_900)).toBe('$568,900')
    expect(publishListingHeroPrice(568_900)).not.toBe('$569K')
  })

  it('prints Roosevelt and million-dollar asks as exact dollars', () => {
    expect(publishListingHeroPrice(999_900)).toBe('$999,900')
    expect(publishListingHeroPrice(1_495_000)).toBe('$1,495,000')
    expect(publishListingHeroCompactPrice(260_000)).toBe('$260,000')
  })

  it('withholds a missing ask', () => {
    expect(publishListingHeroPrice(null)).toBeNull()
    expect(publishListingHeroPrice(0)).toBeNull()
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
