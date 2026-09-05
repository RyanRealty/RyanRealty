import { describe, expect, it } from 'vitest'
import {
  cmaQueueMoneyLine,
  filterCmaQueueRows,
  sortCmaQueueRows,
  theirPriceFromBuildSummary,
  type CmaQueueViewRow,
} from '@/lib/cma/queue-view'

function row(over: Partial<CmaQueueViewRow> = {}): CmaQueueViewRow {
  return {
    id: over.id ?? over.address ?? 'row',
    address: '123 Main St',
    city: 'Bend',
    origin: 'expired',
    state: 'ready',
    recommendedList: 605_000,
    valueLow: 585_000,
    valueHigh: 625_000,
    theirPrice: 650_000,
    theirPriceLabel: 'Last list',
    theirPriceDelta: (605_000 - 650_000) / 650_000,
    contactName: 'Jane Owner',
    contactEmail: 'jane@example.com',
    createdAt: '2026-09-01T12:00:00.000Z',
    ...over,
  }
}

describe('cmaQueueMoneyLine', () => {
  it('always shows range and recommended, and last list on an expired', () => {
    const line = cmaQueueMoneyLine(row())
    expect(line).toContain('$585,000')
    expect(line).toContain('$625,000')
    expect(line).toContain('$605,000')
    expect(line).toContain('Last list $650,000')
  })

  it('does not invent a last list on a requested valuation', () => {
    const line = cmaQueueMoneyLine(
      row({ origin: 'seller-valuation', theirPrice: null, theirPriceLabel: null, theirPriceDelta: null }),
    )
    expect(line).toContain('$585,000-$625,000')
    expect(line).toContain('rec $605,000')
    expect(line).not.toContain('Last list')
  })
})

describe('filterCmaQueueRows', () => {
  const now = Date.parse('2026-09-05T12:00:00.000Z')
  const rows = [
    row(),
    row({
      address: '9 Pine',
      city: 'Redmond',
      origin: 'fsbo',
      state: 'sent',
      recommendedList: 420_000,
      valueLow: 400_000,
      valueHigh: 440_000,
      theirPrice: 449_000,
      theirPriceLabel: 'Their ask',
      createdAt: '2026-08-01T12:00:00.000Z',
    }),
    row({
      address: '2100 NW',
      city: 'Bend',
      origin: 'seller-valuation',
      state: 'ready',
      recommendedList: 1_200_000,
      theirPrice: null,
      theirPriceLabel: null,
      contactName: 'Sam Seller',
      createdAt: '2026-09-04T12:00:00.000Z',
    }),
  ]

  it('defaults to work and hides sent rows', () => {
    const visible = filterCmaQueueRows(rows, {}, now)
    expect(visible.map((r) => r.address)).toEqual(['123 Main St', '2100 NW'])
  })

  it('filters by city, origin, address, rec band, and created window', () => {
    expect(filterCmaQueueRows(rows, { city: 'Redmond', state: 'all' }, now).map((r) => r.city)).toEqual(['Redmond'])
    expect(filterCmaQueueRows(rows, { origin: 'expired' }, now)).toHaveLength(1)
    expect(filterCmaQueueRows(rows, { q: 'sam' }, now)[0]?.contactName).toBe('Sam Seller')
    expect(filterCmaQueueRows(rows, { rec: 'gt1m' }, now)[0]?.recommendedList).toBe(1_200_000)
    expect(filterCmaQueueRows(rows, { created: '7d', state: 'all' }, now)).toHaveLength(2)
  })
})

describe('sortCmaQueueRows', () => {
  it('sorts by recommended list when asked', () => {
    const rows = [
      row({ recommendedList: 900_000, address: 'hi' }),
      row({ recommendedList: 400_000, address: 'lo' }),
    ]
    expect(sortCmaQueueRows(rows, 'price-asc').map((r) => r.address)).toEqual(['lo', 'hi'])
    expect(sortCmaQueueRows(rows, 'price-desc').map((r) => r.address)).toEqual(['hi', 'lo'])
  })
})

describe('theirPriceFromBuildSummary', () => {
  it('reads last list from the summary only for expired and FSBO', () => {
    const summary = { subject: { last_list_price: 749_900 } }
    expect(theirPriceFromBuildSummary(summary, 'expired')).toBe(749_900)
    expect(theirPriceFromBuildSummary(summary, 'fsbo')).toBe(749_900)
    expect(theirPriceFromBuildSummary(summary, 'seller-valuation')).toBeNull()
    expect(theirPriceFromBuildSummary({}, 'expired')).toBeNull()
  })
})
