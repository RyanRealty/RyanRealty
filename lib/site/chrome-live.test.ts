import { describe, expect, it } from 'vitest'
import { composeChromeLive, moneyShort } from './chrome-live'

describe('composeChromeLive', () => {
  it('formats every figure from its input and nothing else', () => {
    const live = composeChromeLive({
      atlas: { counts: { forSale: 3288, pending: 897, sold: 501 }, stamp: 'Sep 2, 2026, 12:07 AM' },
      towns: [
        { href: '/cities/bend', count: 1204 },
        { href: '/cities/redmond', count: 512 },
        { href: '/cities/madras', count: null },
      ],
      region: { medianListPrice: 750_000, monthsOfSupply: 5.1, medianDaysToPending: 27, stamp: 'Sep 2, 2026, 12:01 AM' },
    })
    expect(live.Areas?.values).toEqual({ '/cities/bend': '1,204', '/cities/redmond': '512' })
    expect(live.Areas?.eyebrow).toBe('')
    // The region's figures render on every page beside that page's own place
    // figures; the eyebrow is the only thing that says which population they are.
    expect(live.Market?.eyebrow).toBe('Central Oregon detached homes right now')
    expect(live.Sell?.eyebrow).toBe('Central Oregon sellers right now')
    expect(live.Market?.facts.map((f) => `${f.figure} ${f.label}`)).toEqual([
      '$750K median list price',
      '5.1 months of supply, balanced market',
      '27 median days to pending',
    ])
    expect(live.Sell?.facts[0]).toEqual({ figure: '501', label: 'sold in the last 30 days' })
    expect(live.Market?.note).toBe('Read Sep 2, 2026, 12:01 AM')
  })

  // SITE-12: "Central Oregon right now" left the Homes dropdown for the
  // homepage band. One figure, one place — a count published twice drifts in
  // one of them, and the menu is the copy nobody was maintaining.
  it('publishes no Buy group: the region strip lives on the homepage now', () => {
    const live = composeChromeLive({
      atlas: { counts: { forSale: 3288, pending: 897, sold: 501 }, stamp: 'Sep 2, 2026, 12:07 AM' },
      towns: [],
      region: null,
    })
    expect(live.Buy).toBeUndefined()
    expect(Object.keys(live)).toEqual(['Sell'])
    expect(JSON.stringify(live)).not.toContain('Central Oregon right now')
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

describe('moneyShort', () => {
  it('rounds without changing the narrative', () => {
    expect(moneyShort(749_900)).toBe('$750K')
    expect(moneyShort(474_500)).toBe('$475K')
    expect(moneyShort(1_250_000)).toBe('$1.25M')
    expect(moneyShort(2_000_000)).toBe('$2M')
    expect(moneyShort(12_400_000)).toBe('$12.4M')
  })
})
