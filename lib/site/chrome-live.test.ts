import { describe, expect, it } from 'vitest'
import { composeChromeLive, fieldFromDots, moneyShort, FIELD_DOT_CAP } from './chrome-live'

const dots = Array.from({ length: 1500 }, (_, i) => ({
  lat: 44.0 + (i % 50) * 0.01,
  lng: -121.3 - Math.floor(i / 50) * 0.01,
  s: i % 7 === 0 ? 'sold' : 'active',
}))

describe('composeChromeLive', () => {
  it('formats every figure from its input and nothing else', () => {
    const live = composeChromeLive({
      atlas: { counts: { forSale: 3288, pending: 897, sold: 501 }, dots, stamp: 'Sep 2, 2026, 12:07 AM' },
      towns: [
        { href: '/cities/bend', count: 1204 },
        { href: '/cities/redmond', count: 512 },
        { href: '/cities/madras', count: null },
      ],
      region: { medianListPrice: 750_000, monthsOfSupply: 5.1, medianDaysToPending: 27, stamp: 'Sep 2, 2026, 12:01 AM' },
    })
    expect(live.Buy?.facts.map((f) => `${f.figure} ${f.label}`)).toEqual([
      '3,288 listings for sale',
      '897 pending',
      '501 sold in 30 days',
    ])
    expect(live.Areas?.values).toEqual({ '/cities/bend': '1,204', '/cities/redmond': '512' })
    expect(live.Market?.facts.map((f) => `${f.figure} ${f.label}`)).toEqual([
      '$750K median list price',
      '5.1 months of supply, balanced market',
      '27 median days to pending',
    ])
    expect(live.Sell?.facts[0]).toEqual({ figure: '501', label: 'sold in the last 30 days' })
    expect(live.Buy?.note).toBe('Read Sep 2, 2026, 12:07 AM')
    expect(live.Market?.note).toBe('Read Sep 2, 2026, 12:01 AM')
  })

  it('carries no group it has no input for', () => {
    const live = composeChromeLive({ atlas: null, towns: [], region: null })
    expect(Object.keys(live)).toEqual([])
    const partial = composeChromeLive({ atlas: null, towns: [{ href: '/cities/bend', count: 3 }], region: null })
    expect(Object.keys(partial)).toEqual(['Areas'])
  })

  it('keeps the verdict word on the number it belongs to', () => {
    const seller = composeChromeLive({ atlas: null, towns: [], region: { medianListPrice: null, monthsOfSupply: 3.2, medianDaysToPending: null, stamp: null } })
    expect(seller.Market?.facts[0]?.label).toBe("months of supply, seller's market")
    const buyer = composeChromeLive({ atlas: null, towns: [], region: { medianListPrice: null, monthsOfSupply: 6.4, medianDaysToPending: null, stamp: null } })
    expect(buyer.Market?.facts[0]?.label).toBe("months of supply, buyer's market")
  })
})

describe('fieldFromDots', () => {
  it('strides to the cap, drops sold dots, and stays inside its box', () => {
    const field = fieldFromDots(dots)
    expect(field).toBeDefined()
    const moves = field!.d.match(/M/g)?.length ?? 0
    // 1,286 on-market dots stride by 3 to 429: at most the cap, never under
    // half of it (a stride is a whole number, so the count lands between).
    expect(moves).toBeLessThanOrEqual(FIELD_DOT_CAP)
    expect(moves).toBeGreaterThanOrEqual(FIELD_DOT_CAP / 2)
    expect(field!.w).toBe(240)
    expect(field!.h).toBeGreaterThan(0)
    for (const m of field!.d.matchAll(/M(\d+) (\d+)h0/g)) {
      expect(Number(m[1])).toBeLessThanOrEqual(field!.w)
      expect(Number(m[2])).toBeLessThanOrEqual(field!.h)
    }
  })

  it('returns nothing for a population too small to project', () => {
    expect(fieldFromDots([{ lat: 44, lng: -121, s: 'active' }])).toBeUndefined()
  })
})

describe('moneyShort', () => {
  it('rounds without changing the narrative', () => {
    expect(moneyShort(749_900)).toBe('$750K')
    expect(moneyShort(474_500)).toBe('$475K')
    expect(moneyShort(1_250_000)).toBe('$1.25M')
    expect(moneyShort(2_000_000)).toBe('$2M')
    expect(moneyShort(12_400_000)).toBe('$12.4M')
  })
})
