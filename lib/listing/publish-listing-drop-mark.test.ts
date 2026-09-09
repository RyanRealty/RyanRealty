import { describe, expect, it } from 'vitest'
import { publishListingDropMark } from './publish-listing-drop-mark'

describe('publishListingDropMark', () => {
  const delaware = [
    { event: 'listed', event_date: '2026-06-04', price: 1_195_000, price_change: null },
    { event: 'pricechange', event_date: '2026-07-10', price: 1_075_000, price_change: -120_000 },
    { event: 'pricechange', event_date: '2026-08-15', price: 999_000, price_change: -76_000 },
  ]

  it('places both points on the newest cut and derives the percent to a tenth', () => {
    expect(publishListingDropMark(delaware)).toEqual({
      from: 1_075_000,
      to: 999_000,
      drop: 76_000,
      pct: 7.1,
      date: '2026-08-15',
    })
  })

  it('ignores a cut from a prior listing cycle', () => {
    const rows = [
      { event: 'pricechange', event_date: '2025-03-01', price: 900_000, price_change: -50_000 },
      { event: 'listed', event_date: '2026-06-04', price: 1_195_000, price_change: null },
    ]
    expect(publishListingDropMark(rows)).toBeNull()
  })

  it('draws nothing for a rise, an undated cut, or a cut with no price to place', () => {
    expect(publishListingDropMark([{ event: 'pricechange', event_date: '2026-08-15', price: 1_000_000, price_change: 25_000 }])).toBeNull()
    expect(publishListingDropMark([{ event: 'pricechange', event_date: null, price: 999_000, price_change: -76_000 }])).toBeNull()
    expect(publishListingDropMark([{ event: 'pricechange', event_date: '2026-08-15', price: null, price_change: -76_000 }])).toBeNull()
    expect(publishListingDropMark([])).toBeNull()
    expect(publishListingDropMark(null)).toBeNull()
  })

  it('names the same cut publishListingLastDrop labels (the newest since listed)', () => {
    const mark = publishListingDropMark(delaware)!
    expect(mark.drop).toBe(76_000)
  })
})
