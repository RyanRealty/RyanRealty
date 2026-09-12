import { describe, expect, it } from 'vitest'
import { PRICING_MAX_COMPS, PRICING_TARGET_COMPS, pricingTierLadder } from '@/lib/pricing/ladder'

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

  it('does not stop at three tight sales — target 8, cap 10', () => {
    expect(PRICING_TARGET_COMPS).toBe(8)
    expect(PRICING_MAX_COMPS).toBe(10)
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
    expect(names.indexOf('subdivision-12mo-wide')).toBeLessThan(names.indexOf('adjacent-sub-3mo'))
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
    expect(names.indexOf('subdivision-24mo')).toBeLessThan(names.indexOf('adjacent-sub-3mo'))
    expect(names.indexOf('adjacent-sub-24mo')).toBeLessThan(names.indexOf('community-6mo'))
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

  it('marks the community rungs sameCommunity and nothing else', () => {
    for (const t of pricingTierLadder()) {
      expect(!!t.sameCommunity).toBe(t.name.startsWith('community-'))
      expect(!!t.likeCommunity).toBe(t.name.startsWith('like-community-'))
    }
  })
})
