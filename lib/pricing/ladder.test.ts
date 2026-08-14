import { describe, expect, it } from 'vitest'
import { pricingTierLadder } from '@/lib/pricing/ladder'

describe('pricingTierLadder — time before distance', () => {
  it('walks 3 then 6 then 9 months inside the subdivision before any mile ring', () => {
    const names = pricingTierLadder().map((t) => t.name)
    expect(names.slice(0, 3)).toEqual(['subdivision-3mo', 'subdivision-6mo', 'subdivision-9mo'])
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
})
