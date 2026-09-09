import { describe, expect, it } from 'vitest'
import { PRICING_MAX_COMPS, PRICING_TARGET_COMPS, pricingTierLadder } from '@/lib/pricing/ladder'

describe('pricingTierLadder — time before distance', () => {
  it('walks 3 then 6 then 9 months inside the subdivision before any mile ring', () => {
    const names = pricingTierLadder().map((t) => t.name)
    expect(names.slice(0, 3)).toEqual(['subdivision-3mo', 'subdivision-6mo', 'subdivision-9mo'])
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
      expect(!!t.ignoreCity).toBe(t.name.startsWith('rural-'))
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
