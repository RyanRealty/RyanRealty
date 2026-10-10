import { describe, expect, it } from 'vitest'
import { poolPlaceFromTier, rankBestPool, type BestPoolHome } from './best-pool'

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
