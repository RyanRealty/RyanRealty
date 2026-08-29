import { describe, expect, it } from 'vitest'
import { publishListingPriceChangeLine } from './publish-listing-price-change-line'
import type { PublishedListingHistoryEvent } from './publish-listing-history'

describe('publishListingPriceChangeLine', () => {
  it('prints a reduction from a history price_change, never an invented delta', () => {
    const history: PublishedListingHistoryEvent[] = [
      { event: 'listed', event_date: '2026-06-20', price: 500000, price_change: null },
      { event: 'pricechange', event_date: '2026-07-08', price: 485000, price_change: -15000 },
    ]
    expect(publishListingPriceChangeLine(history)).toEqual({
      kind: 'reduced',
      text: 'Reduced $15,000 on Jul 8',
    })
  })

  it('prints Listed {date} at $X when history has no reduction', () => {
    const history: PublishedListingHistoryEvent[] = [
      { event: 'listed', event_date: '2026-08-22', price: 298000, price_change: null },
    ]
    expect(publishListingPriceChangeLine(history)).toEqual({
      kind: 'listed',
      text: 'Listed Aug 22 at $298,000',
    })
  })

  it('returns null when history cannot support a line', () => {
    expect(publishListingPriceChangeLine([])).toBeNull()
    expect(
      publishListingPriceChangeLine([{ event: 'pending', event_date: '2026-08-01', price: null }]),
    ).toBeNull()
  })
})
