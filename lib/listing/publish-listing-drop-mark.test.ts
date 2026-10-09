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

  // A CUT THE SELLER HAS SINCE UNDONE IS NOT A CUT (2026-09-11).
  //
  // Live on /homes-for-sale/bend/21357-kilimanjaro-220222798: the home asked
  // $614,995 and this mark printed a struck-through $609,995 labelled
  // "Cut $1,000" beside it, because the loop walked past the newer +$6,000
  // increase to reach an older -$1,000 cut. A reader saw a discount on a home
  // whose price had just gone up, and the struck "from" was LOWER than the ask
  // directly above it. The rise is the current price action, so nothing draws.
  const raisedAfterCut = [
    { event: 'listed', event_date: '2026-06-04', price: 610_000, price_change: null },
    { event: 'pricechange', event_date: '2026-08-19', price: 609_000, price_change: -1_000 },
    { event: 'pricechange', event_date: '2026-09-02', price: 615_000, price_change: 6_000 },
  ]

  it('draws nothing when a price rise is newer than the cut', () => {
    expect(publishListingDropMark(raisedAfterCut)).toBeNull()
  })

  it('still draws the cut when the rise is OLDER than it', () => {
    const rows = [
      { event: 'listed', event_date: '2026-06-04', price: 600_000, price_change: null },
      { event: 'pricechange', event_date: '2026-07-01', price: 620_000, price_change: 20_000 },
      { event: 'pricechange', event_date: '2026-08-19', price: 605_000, price_change: -15_000 },
    ]
    expect(publishListingDropMark(rows)).toEqual({
      from: 620_000,
      to: 605_000,
      drop: 15_000,
      pct: 2.4,
      date: '2026-08-19',
    })
  })

  it('reads past a zero-change row rather than treating it as a rise', () => {
    const rows = [
      { event: 'listed', event_date: '2026-06-04', price: 700_000, price_change: null },
      { event: 'pricechange', event_date: '2026-08-01', price: 650_000, price_change: -50_000 },
      { event: 'pricechange', event_date: '2026-08-20', price: 650_000, price_change: 0 },
    ]
    expect(publishListingDropMark(rows)?.drop).toBe(50_000)
  })

  it('reads past an unclassifiable change rather than calling it a rise', () => {
    const rows = [
      { event: 'listed', event_date: '2026-06-04', price: 700_000, price_change: null },
      { event: 'pricechange', event_date: '2026-08-01', price: 650_000, price_change: -50_000 },
      { event: 'pricechange', event_date: '2026-08-20', price: 650_000, price_change: null },
    ]
    expect(publishListingDropMark(rows)?.drop).toBe(50_000)
  })
})
