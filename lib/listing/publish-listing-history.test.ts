import { describe, expect, it } from 'vitest'
import {
  publishListingHistory,
  publishListingHistoryDeltaLabel,
  publishListingHistoryDescription,
} from './publish-listing-history'

describe('publishListingHistory', () => {
  it('Borden: listed from OnMarketDate when listing_history is empty', () => {
    const rows = publishListingHistory({
      listingHistory: [],
      statusHistory: [],
      priceHistory: [],
      onMarketDate: '2026-07-22T15:46:02+00:00',
      listPrice: 487000,
    })
    expect(rows).toEqual([
      { event: 'listed', event_date: '2026-07-22', price: 487000, price_change: null, description: null },
    ])
  })

  it('Rockway: listed + pending from status_history, skip same-day Coming Soon → Active', () => {
    const rows = publishListingHistory({
      listingHistory: [],
      statusHistory: [
        { old_status: 'Coming Soon', new_status: 'Active', changed_at: '2026-07-31T07:18:49.235+00:00' },
        { old_status: 'Active', new_status: 'Pending', changed_at: '2026-08-17T20:48:16.238+00:00' },
      ],
      onMarketDate: '2026-07-31T07:15:03+00:00',
      listPrice: 649000,
    })
    expect(rows.map((r) => r.event)).toEqual(['listed', 'pending'])
    expect(rows[0]).toMatchObject({ event_date: '2026-07-31', price: 649000 })
    expect(rows[1]).toMatchObject({ event_date: '2026-08-17', event: 'pending', price: 649000 })
  })

  it('Mountain Breezes: listed only when the only status row is same-day Active', () => {
    const rows = publishListingHistory({
      statusHistory: [
        { old_status: 'Coming Soon', new_status: 'Active', changed_at: '2026-08-08T07:18:48.184+00:00' },
      ],
      onMarketDate: '2026-08-08T07:15:02+00:00',
      listPrice: 1250000,
    })
    expect(rows).toEqual([
      { event: 'listed', event_date: '2026-08-08', price: 1250000, price_change: null, description: null },
    ])
  })

  it('keeps listing_history rows and adds a later price change', () => {
    const rows = publishListingHistory({
      listingHistory: [
        { event: 'listed', event_date: '2026-06-01', price: 500000 },
      ],
      priceHistory: [
        { old_price: 500000, new_price: 485000, changed_at: '2026-06-20T12:00:00Z' },
      ],
    })
    expect(rows.map((r) => r.event)).toEqual(['listed', 'pricechange'])
    expect(rows[1]).toMatchObject({ price: 485000, price_change: -15000, event_date: '2026-06-20' })
  })

  it('does not invent a listed row without OnMarketDate', () => {
    expect(publishListingHistory({ listPrice: 100000 })).toEqual([])
  })

  it('Foley: does not publish pending from a prior cycle before the current listed date', () => {
    const rows = publishListingHistory({
      listingHistory: [],
      statusHistory: [
        { old_status: 'Active', new_status: 'Pending', changed_at: '2026-08-02T19:03:24.29+00:00' },
        { old_status: 'Pending', new_status: 'Active', changed_at: '2026-08-16T20:48:03.197+00:00' },
      ],
      priceHistory: [
        { old_price: 1575000, new_price: 1475000, changed_at: '2026-06-19T03:03:09.368+00:00' },
        { old_price: 1475000, new_price: 1395000, changed_at: '2026-07-28T00:33:41.222+00:00' },
      ],
      onMarketDate: '2026-08-16T20:45:52+00:00',
      listPrice: 1395000,
    })
    expect(rows.map((r) => r.event)).toEqual(['pricechange', 'pricechange', 'listed'])
    expect(rows.find((r) => r.event === 'pending')).toBeUndefined()
    expect(rows.at(-1)).toMatchObject({ event: 'listed', event_date: '2026-08-16', price: 1395000 })
  })

  it('Swalley: withholds raw ListPrice dump on the published row', () => {
    const rows = publishListingHistory({
      listingHistory: [
        {
          event: 'pricechange',
          event_date: '2026-04-01',
          price: 11_900_000,
          description: 'ListPrice: 14900000.00 → 11900000.00',
        },
      ],
    })
    expect(rows[0]?.description).toBeNull()
    expect(publishListingHistoryDescription('ListPrice: 14900000.00 → 11900000.00')).toBeNull()
    expect(publishListingHistoryDescription('ListPrice: 1795000.00 → 1595000.00')).toBeNull()
    expect(publishListingHistoryDescription('Reduced after inspection')).toBe('Reduced after inspection')
    expect(publishListingHistoryDeltaLabel(3_000_000, 'down')).toBe('$3.0M down')
    expect(publishListingHistoryDeltaLabel(200_000, 'up')).toBe('$200K up')
  })

  it('does not emit PRICE CHANGE when the amount is unchanged', () => {
    const rows = publishListingHistory({
      listingHistory: [
        { event: 'listed', event_date: '2026-07-31', price: 889000 },
        { event: 'pricechange', event_date: '2026-08-24', price: 889000, price_change: 0 },
      ],
      priceHistory: [
        { old_price: 889000, new_price: 889000, changed_at: '2026-08-24T17:00:00.000Z' },
      ],
    })
    expect(rows.map((r) => r.event)).toEqual(['listed'])
    expect(rows[0]).toMatchObject({ event: 'listed', event_date: '2026-07-31', price: 889000 })
    expect(rows.some((row) => /price/i.test(row.event))).toBe(false)
  })

  it('1225 Elgin: publishes PRICE CHANGE only when the ask actually moved', () => {
    const rows = publishListingHistory({
      listingHistory: [],
      priceHistory: [
        { old_price: 1650000, new_price: 1624000, changed_at: '2026-08-07T16:48:47.242+00:00' },
        { old_price: 1624000, new_price: 1585000, changed_at: '2026-08-26T20:03:29.192+00:00' },
      ],
      onMarketDate: '2026-07-10T07:15:03+00:00',
      listPrice: 1585000,
    })
    expect(rows.map((r) => r.event)).toEqual(['listed', 'pricechange', 'pricechange'])
    expect(rows[1]).toMatchObject({ event: 'pricechange', price: 1624000, price_change: -26000 })
    expect(rows[2]).toMatchObject({ event: 'pricechange', price: 1585000, price_change: -39000 })
  })

  it('1461 Elgin: listed only when original and ask are the same dollar', () => {
    const rows = publishListingHistory({
      listingHistory: [],
      priceHistory: [],
      onMarketDate: '2026-07-03',
      listPrice: 1899900,
    })
    expect(rows).toEqual([
      { event: 'listed', event_date: '2026-07-03', price: 1899900, price_change: null, description: null },
    ])
  })

  it('Zenith: same $889,000 on Aug 24 is listed history only, even if price_change is missing', () => {
    const rows = publishListingHistory({
      listingHistory: [
        { event: 'listed', event_date: '2026-07-31', price: 889000 },
        { event: 'pricechange', event_date: '2026-08-24', price: 889000, price_change: null },
      ],
      onMarketDate: '2026-07-31T20:30:58+00:00',
      listPrice: 889000,
    })
    expect(rows).toEqual([
      { event: 'listed', event_date: '2026-07-31', price: 889000, price_change: null, description: null },
    ])
  })
})
