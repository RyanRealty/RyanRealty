import { describe, expect, it } from 'vitest'
import {
  BOUNDARY_EXIT_BELOW,
  isClusterPocket,
  isGeographyWidenTier,
  isPocketExclusiveTier,
  keepTightestByClosePrice,
  pocketHoldsGeographyExclusive,
  pocketStarvedForYearQuality,
  POCKET_STARVE_BELOW,
  POCKET_TIGHT_SET_MIN,
  PRICING_MAX_COMPS,
  PRICING_TARGET_COMPS,
  pricingTierLadder,
} from '@/lib/pricing/ladder'

describe('pricingTierLadder — time before distance', () => {
  it('walks 3 then 6 then 9 months inside the subdivision before any mile ring', () => {
    const names = pricingTierLadder().map((t) => t.name)
    // The subject's own street comes before its own plat (Matt 2026-09-10:
    // "we want to look specifically at that address or in that subdivision").
    expect(names[0]).toBe('own-street-24mo')
    expect(names.slice(1, 4)).toEqual(['subdivision-3mo', 'subdivision-6mo', 'subdivision-9mo'])
    expect(names.indexOf('subdivision-9mo')).toBeLessThan(names.indexOf('subdivision-3mo-wide'))
    expect(names.indexOf('subdivision-9mo-wide')).toBeLessThan(names.indexOf('nearby-1mi-3mo'))
    expect(names.indexOf('subdivision-9mo')).toBeLessThan(names.indexOf('nearby-1mi-3mo'))
    expect(names.indexOf('nearby-1mi-9mo')).toBeLessThan(names.indexOf('nearby-2mi-3mo'))
    expect(names.indexOf('nearby-2mi-9mo')).toBeLessThan(names.indexOf('similar-sub-3mo'))
  })

  it('resets the clock when distance opens', () => {
    const near = pricingTierLadder().filter((t) => t.name.startsWith('nearby-1mi-'))
    expect(near.map((t) => t.monthsBack)).toEqual([3, 6, 9])
  })

  it('keeps rural rungs rural-only so an in-town subject cannot reach them', () => {
    for (const t of pricingTierLadder()) {
      expect(!!t.ruralOnly).toBe(t.name.startsWith('rural-'))
      // A peer golf or resort community is genuinely in another mailing city
      // (Sunriver, Powell Butte, Redmond), so that rung drops the city bound.
      expect(!!t.ignoreCity).toBe(t.name.startsWith('rural-') || t.name.startsWith('like-community-'))
    }
  })

  it('stops at five sales, and never prices more than five', () => {
    expect(PRICING_TARGET_COMPS).toBe(5)
    expect(PRICING_MAX_COMPS).toBe(5)
  })

  it('inserts wider custom time-first rungs before similar-sub for custom/new', () => {
    const names = pricingTierLadder({ customOrNew: true }).map((t) => t.name)
    expect(names).toContain('nearby-2mi-24mo')
    expect(names).toContain('nearby-6mi-24mo')
    expect(names.indexOf('nearby-2mi-12mo')).toBeLessThan(names.indexOf('similar-sub-3mo'))
    expect(names.indexOf('nearby-6mi-24mo')).toBeLessThan(names.indexOf('similar-sub-3mo'))
  })
})

describe('pricingTierLadder — containment (Matt 2026-09-08)', () => {
  it('exhausts the subdivision to 12 months, then the plats next to it, before any mile ring', () => {
    const names = pricingTierLadder().map((t) => t.name)
    expect(names.indexOf('subdivision-9mo-wide')).toBeLessThan(names.indexOf('subdivision-12mo'))
    expect(names.indexOf('subdivision-12mo-wide')).toBeLessThan(names.indexOf('pocket-3mo'))
    expect(names.indexOf('pocket-12mo')).toBeLessThan(names.indexOf('adjacent-sub-3mo'))
    expect(names.filter((n) => n.startsWith('adjacent-sub-'))).toEqual([
      'adjacent-sub-3mo',
      'adjacent-sub-6mo',
      'adjacent-sub-9mo',
      'adjacent-sub-12mo',
      'adjacent-sub-18mo',
      'adjacent-sub-24mo',
    ])
    expect(names.indexOf('adjacent-sub-12mo')).toBeLessThan(names.indexOf('nearby-1mi-3mo'))
  })

  it('crosses the boundary only at the end, after the city rung, and says so', () => {
    const tiers = pricingTierLadder()
    const names = tiers.map((t) => t.name)
    expect(names.indexOf('city-5mi-9mo')).toBeLessThan(names.indexOf('beyond-2mi-12mo'))
    expect(names.indexOf('beyond-2mi-12mo')).toBeLessThan(names.indexOf('beyond-5mi-12mo'))
    expect(names.indexOf('beyond-5mi-12mo')).toBeLessThan(names.indexOf('rural-10mi-9mo'))
    for (const t of tiers) {
      expect(!!t.crossBoundary).toBe(t.name.startsWith('beyond-'))
      expect(!!t.adjacentSubdivision).toBe(t.name.startsWith('adjacent-sub-'))
      if (t.crossBoundary) expect(t.disclosure).toMatch(/crossed its boundary/)
    }
  })
})

describe('pricingTierLadder — the parent level (Matt 2026-09-09)', () => {
  const names = pricingTierLadder().map((t) => t.name)

  it('holds a plat to its community before any ring, and reaches two years inside first', () => {
    expect(names.indexOf('subdivision-24mo')).toBeLessThan(names.indexOf('pocket-3mo'))
    expect(names.indexOf('pocket-12mo')).toBeLessThan(names.indexOf('adjacent-sub-3mo'))
    expect(names.filter((n) => n.startsWith('pocket-'))).toEqual([
      'pocket-3mo',
      'pocket-6mo',
      'pocket-9mo',
      'pocket-12mo',
    ])
    expect(names.indexOf('adjacent-sub-24mo')).toBeLessThan(names.indexOf('community-6mo'))
    expect(names.indexOf('pocket-12mo')).toBeLessThan(names.indexOf('community-6mo'))
    expect(names.filter((n) => n.startsWith('community-'))).toEqual(['community-6mo', 'community-12mo', 'community-24mo'])
    expect(names.indexOf('community-24mo')).toBeLessThan(names.indexOf('nearby-1mi-3mo'))
  })

  it('exhausts the boundary to two years before any rung may leave it', () => {
    const lastInside = Math.max(names.indexOf('city-5mi-24mo'), names.indexOf('like-community-24mo'))
    for (const t of pricingTierLadder()) {
      if (t.crossBoundary) expect(names.indexOf(t.name)).toBeGreaterThan(lastInside)
    }
    expect(names.indexOf('city-5mi-9mo')).toBeLessThan(names.indexOf('city-5mi-18mo'))
    expect(names.indexOf('city-5mi-18mo')).toBeLessThan(names.indexOf('city-5mi-24mo'))
  })

  it('reaches a peer community only after the subject\'s own is spent, and says why', () => {
    const peer = pricingTierLadder().find((t) => t.name === 'like-community-24mo')!
    expect(peer.likeCommunity).toBe(true)
    expect(names.indexOf('community-24mo')).toBeLessThan(names.indexOf('like-community-24mo'))
    expect(names.indexOf('like-community-24mo')).toBeLessThan(names.indexOf('similar-sub-3mo'))
    expect(peer.disclosure).toMatch(/golf or resort community/)
  })

  it('marks exclusive pocket rungs vs geography-widening rungs', () => {
    for (const t of pricingTierLadder()) {
      if (t.name.startsWith('subdivision-') || t.name.startsWith('own-street-') || t.name.startsWith('pocket-')) {
        expect(isPocketExclusiveTier(t)).toBe(true)
        expect(isGeographyWidenTier(t)).toBe(false)
      }
      if (t.name.startsWith('nearby-') || t.name.startsWith('similar-sub') || t.name.startsWith('city-') || t.name.startsWith('beyond-')) {
        expect(isGeographyWidenTier(t)).toBe(true)
        expect(isPocketExclusiveTier(t)).toBe(false)
      }
      if (t.name.startsWith('community-') || t.name.startsWith('adjacent-') || t.name.startsWith('like-community')) {
        expect(isGeographyWidenTier(t)).toBe(false)
      }
    }
    expect(BOUNDARY_EXIT_BELOW).toBe(5)
    expect(POCKET_STARVE_BELOW).toBe(5)
    expect(POCKET_TIGHT_SET_MIN).toBe(2)
    expect(pocketStarvedForYearQuality(4)).toBe(true)
    expect(pocketStarvedForYearQuality(5)).toBe(false)
    expect(isClusterPocket({ pocketSubdivisionNorms: [] })).toBe(false)
    expect(isClusterPocket({ pocketSubdivisionNorms: ['horse back', 'ranch'] })).toBe(false)
    expect(isClusterPocket({ inferredPocket: { source: 'mls', neighborNorms: ['horse back', 'ranch'] } })).toBe(
      false,
    )
    expect(isClusterPocket({ inferredPocket: { source: 'street-cluster', neighborNorms: [] } })).toBe(true)
    expect(pocketHoldsGeographyExclusive(1, 0)).toBe(false)
    expect(pocketHoldsGeographyExclusive(2, 0)).toBe(false)
    expect(pocketHoldsGeographyExclusive(4, 0)).toBe(false)
    expect(pocketHoldsGeographyExclusive(5, 0)).toBe(true)
    expect(pocketHoldsGeographyExclusive(1, 1, true)).toBe(true)
    expect(pocketHoldsGeographyExclusive(2, 0, true)).toBe(true)
    expect(pocketHoldsGeographyExclusive(1, 0, true)).toBe(false)
  })

  it('marks the community rungs sameCommunity and nothing else', () => {
    for (const t of pricingTierLadder()) {
      expect(!!t.sameCommunity).toBe(t.name.startsWith('community-'))
      expect(!!t.likeCommunity).toBe(t.name.startsWith('like-community-'))
      expect(!!t.samePocket).toBe(t.name.startsWith('pocket-'))
    }
  })
})

describe('keepTightestByClosePrice — as-of date (WP5 item d, back-dated CMA)', () => {
  // Six candidates, five kept. E is the price outlier (10%+ off the $503,500
  // median) but closed the same day as everyone else. F sits closest of all
  // to the median but closed 24 months earlier. Same set, only the as-of
  // date changes which one is "worst."
  const comps = [
    { key: 'A', closePrice: 500_000, closeDate: '2026-06-01' },
    { key: 'B', closePrice: 505_000, closeDate: '2026-06-01' },
    { key: 'C', closePrice: 495_000, closeDate: '2026-06-01' },
    { key: 'D', closePrice: 510_000, closeDate: '2026-06-01' },
    { key: 'E', closePrice: 560_000, closeDate: '2026-06-01' },
    { key: 'F', closePrice: 502_000, closeDate: '2024-06-01' },
  ]

  it('drops the price outlier when no as-of date is given (no staleness penalty)', () => {
    const kept = keepTightestByClosePrice(comps, 5)
    expect(kept.map((c) => c.key).sort()).toEqual(['A', 'B', 'C', 'D', 'F'])
  })

  it('drops the stale close instead once an as-of date makes it 24 months old', () => {
    // Same six comps, a CMA as-of date close to the fresh five. F is now
    // measured against THAT date, not real-world today, so it reads as
    // ~24 months stale and loses its slot to E instead.
    const kept = keepTightestByClosePrice(comps, 5, '2026-06-15')
    expect(kept.map((c) => c.key).sort()).toEqual(['A', 'B', 'C', 'D', 'E'])
  })
})
