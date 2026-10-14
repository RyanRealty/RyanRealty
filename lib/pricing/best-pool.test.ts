import { describe, expect, it } from 'vitest'
import { amenityViewsFromListing, poolPlaceFromTier, rankBestPool, type BestPoolHome } from './best-pool'

function home(over: Partial<BestPoolHome> & Pick<BestPoolHome, 'id' | 'place'>): BestPoolHome {
  return {
    sqft: 1700,
    bedsOff: 0,
    bathsOff: 0,
    yearBuilt: 1920,
    when: '2026-01-01',
    ask: 1_000_000,
    miles: 0.2,
    ...over,
  }
}

const subject = { sqft: 1738, yearBuilt: 1920, recommended: 1_000_000 }

describe('rankBestPool', () => {
  it('seats the subject subdivision ahead of a closer adjacent match', () => {
    const kept = rankBestPool(
      [
        home({ id: 'adj', place: 'adjacent', sqft: 1738, miles: 0.05 }),
        home({ id: 'own', place: 'own', sqft: 1200, yearBuilt: 2024, miles: 0.4 }),
      ],
      subject,
      'sold',
    )
    expect(kept.map((h) => h.id)).toEqual(['own', 'adj'])
  })

  it('keeps a new house in the subject subdivision and ranks it after an older match there', () => {
    const kept = rankBestPool(
      [
        home({ id: 'new', place: 'own', yearBuilt: 2024, sqft: 1738 }),
        home({ id: 'old', place: 'own', yearBuilt: 1922, sqft: 1738 }),
      ],
      subject,
      'sold',
    )
    expect(kept.map((h) => h.id)).toEqual(['old', 'new'])
  })

  it('among adjacent homes, prefers closer size, then fewer rooms off, then closer year, then the newer sale', () => {
    const kept = rankBestPool(
      [
        home({ id: 'far-size', place: 'adjacent', sqft: 1200, when: '2026-06-01' }),
        home({ id: 'rooms', place: 'adjacent', sqft: 1738, bedsOff: 2, when: '2026-06-01' }),
        home({ id: 'older', place: 'adjacent', sqft: 1738, yearBuilt: 1960, when: '2026-06-01' }),
        home({ id: 'stale', place: 'adjacent', sqft: 1738, yearBuilt: 1920, when: '2024-06-01' }),
        home({ id: 'best', place: 'adjacent', sqft: 1738, yearBuilt: 1920, when: '2026-03-01' }),
      ],
      subject,
      'sold',
    )
    expect(kept.map((h) => h.id)).toEqual(['best', 'stale', 'older', 'rooms', 'far-size'])
  })

  it('ranks an active home by how close its ask is to the recommendation, not by date', () => {
    const kept = rankBestPool(
      [
        home({ id: 'high', place: 'adjacent', ask: 1_400_000, when: '2026-09-01' }),
        home({ id: 'near', place: 'adjacent', ask: 1_070_000, when: '2024-01-01' }),
      ],
      subject,
      'active',
    )
    expect(kept.map((h) => h.id)).toEqual(['near', 'high'])
  })

  it('returns at most five', () => {
    const homes = Array.from({ length: 8 }, (_, i) =>
      home({ id: `h${i}`, place: 'adjacent', sqft: 1738 - i, when: `2026-0${i + 1}-01` }),
    )
    expect(rankBestPool(homes, subject, 'sold')).toHaveLength(5)
  })

  it('inside one plat, a lot within half again outranks a closer-size lot past that', () => {
    const kept = rankBestPool(
      [
        home({ id: 'half-acre', place: 'own', sqft: 1738, lotAcres: 0.52 }),
        home({ id: 'same-lot', place: 'own', sqft: 1400, lotAcres: 0.15 }),
      ],
      { ...subject, lotAcres: 0.14, amenityViews: [] },
      'sold',
    )
    expect(kept.map((h) => h.id)).toEqual(['same-lot', 'half-acre'])
  })

  it('keeps a lot past half again when fewer than five closer lots are in the pool', () => {
    const kept = rankBestPool(
      [
        home({ id: 'a', place: 'own', sqft: 1600, lotAcres: 0.14 }),
        home({ id: 'b', place: 'own', sqft: 1500, lotAcres: 0.15 }),
        home({ id: 'c', place: 'own', sqft: 1400, lotAcres: 0.16 }),
        home({ id: 'big', place: 'own', sqft: 1738, lotAcres: 0.29 }),
      ],
      { ...subject, lotAcres: 0.14, amenityViews: [] },
      'sold',
    )
    expect(kept.map((h) => h.id)).toEqual(['a', 'b', 'c', 'big'])
  })

  it('does not demote an unknown lot behind a known closer lot', () => {
    const kept = rankBestPool(
      [
        home({ id: 'unknown', place: 'own', sqft: 1738, lotAcres: null }),
        home({ id: 'known', place: 'own', sqft: 1400, lotAcres: 0.15 }),
      ],
      { ...subject, lotAcres: 0.14, amenityViews: [] },
      'sold',
    )
    expect(kept.map((h) => h.id)).toEqual(['unknown', 'known'])
  })

  it('keeps an own-plat lot past half again ahead of an adjacent closer lot', () => {
    const kept = rankBestPool(
      [
        home({ id: 'adjacent', place: 'adjacent', sqft: 1738, lotAcres: 0.15 }),
        home({ id: 'own-big', place: 'own', sqft: 1400, lotAcres: 0.52 }),
      ],
      { ...subject, lotAcres: 0.14, amenityViews: [] },
      'sold',
    )
    expect(kept.map((h) => h.id)).toEqual(['own-big', 'adjacent'])
  })

  it('ranks a golf or lake view the subject does not list behind a sale without it', () => {
    const kept = rankBestPool(
      [
        home({ id: 'fairway', place: 'own', sqft: 1738, lotAcres: 0.2, amenityViews: ['golf'] }),
        home({ id: 'interior', place: 'own', sqft: 1500, lotAcres: 0.2, amenityViews: [] }),
      ],
      { ...subject, lotAcres: 0.2, amenityViews: [] },
      'sold',
    )
    expect(kept.map((h) => h.id)).toEqual(['interior', 'fairway'])
  })

  it('does not demote a view the subject also lists, or an unread view', () => {
    const sameWater = rankBestPool(
      [
        home({ id: 'closer', place: 'own', sqft: 1738, amenityViews: ['lake'] }),
        home({ id: 'farther', place: 'own', sqft: 1400, amenityViews: ['lake'] }),
      ],
      { ...subject, amenityViews: ['lake'] },
      'sold',
    )
    expect(sameWater.map((h) => h.id)).toEqual(['closer', 'farther'])
    const unread = rankBestPool(
      [
        home({ id: 'golf', place: 'own', sqft: 1738, amenityViews: ['golf'] }),
        home({ id: 'plain', place: 'own', sqft: 1400, amenityViews: [] }),
      ],
      { ...subject, amenityViews: null },
      'sold',
    )
    expect(unread.map((h) => h.id)).toEqual(['golf', 'plain'])
  })

  it('lets living area decide when both lots sit past half again', () => {
    const kept = rankBestPool(
      [
        home({ id: 'larger', place: 'own', sqft: 1400, lotAcres: 0.6 }),
        home({ id: 'closer', place: 'own', sqft: 1738, lotAcres: 0.5 }),
      ],
      { ...subject, lotAcres: 0.14, amenityViews: [] },
      'sold',
    )
    expect(kept.map((h) => h.id)).toEqual(['closer', 'larger'])
  })

  it('puts the next row behind every adjacent home', () => {
    const kept = rankBestPool(
      [
        home({ id: 'next', place: 'next', sqft: 1738 }),
        home({ id: 'adj', place: 'adjacent', sqft: 1100 }),
      ],
      subject,
      'expired',
    )
    expect(kept.map((h) => h.id)).toEqual(['adj', 'next'])
  })
})

describe('amenityViewsFromListing', () => {
  it('reads a golf-course or lake view and ignores a mountain or neighborhood view', () => {
    expect(amenityViewsFromListing('{"Golf Course": true, "Neighborhood": true}')).toEqual(['golf'])
    expect(amenityViewsFromListing('{"Lake": true, "Panoramic": true}')).toEqual(['lake'])
    expect(amenityViewsFromListing('{"Mountain(s)": true, "Territorial": true}')).toEqual([])
    expect(amenityViewsFromListing('Neighborhood')).toEqual([])
    expect(amenityViewsFromListing('City, Neighborhood')).toEqual([])
    expect(amenityViewsFromListing(null)).toBeNull()
    expect(amenityViewsFromListing('')).toBeNull()
    expect(amenityViewsFromListing('N/A')).toBeNull()
  })
})

describe('poolPlaceFromTier', () => {
  it('maps the ladder names onto own, adjacent, and next', () => {
    expect(poolPlaceFromTier('subdivision-18mo-wide')).toBe('own')
    expect(poolPlaceFromTier('older-subdivision-30mo-wide')).toBe('own')
    expect(poolPlaceFromTier('own-street-24mo')).toBe('own')
    expect(poolPlaceFromTier('adjacent-sub-18mo')).toBe('adjacent')
    expect(poolPlaceFromTier('older-adjacent-30mo')).toBe('adjacent')
    expect(poolPlaceFromTier('closer-sub-6mo')).toBe('next')
    expect(poolPlaceFromTier('older-closer-36mo')).toBe('next')
    expect(poolPlaceFromTier('nearby-0.25mi-3mo')).toBeNull()
  })
})
