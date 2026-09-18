import { describe, expect, it } from 'vitest'
import {
  priceBand,
  splitActivePending,
  statusPriceBoardHtml,
  statusPriceSummaries,
} from '@/lib/cma/status-price-summary'
import type { MatrixEntry } from '@/lib/cma/matrix-entry'

function entry(over: Partial<MatrixEntry> & Pick<MatrixEntry, 'family' | 'key'>): MatrixEntry {
  return {
    address: over.address ?? '12 Pine',
    href: null,
    photoUrl: null,
    outcome: '',
    yearBuilt: 1999,
    remodelNote: null,
    remarksRead: false,
    sqft: over.sqft ?? 1600,
    lotAcres: 0.2,
    rooms: null,
    beds: 3,
    baths: 2,
    domDays: 20,
    priceChanges: 0,
    priceChangesExact: false,
    path: null,
    firstAsk: over.firstAsk ?? null,
    lastAsk: over.lastAsk ?? null,
    closePrice: over.closePrice ?? null,
    listPrice: over.listPrice ?? null,
    concessionsAmount: null,
    proximity: null,
    garageSpaces: null,
    cdomDays: null,
    statusDate: null,
    adjustedPrice: null,
    endLabel: '',
    latitude: null,
    longitude: null,
    sort: '',
    ...over,
  }
}

describe('status price bands', () => {
  it('computes Low · Avg · Median · High', () => {
    expect(priceBand([500000, 480000, 520000])).toEqual({
      n: 3,
      low: 480000,
      avg: 500000,
      median: 500000,
      high: 520000,
    })
    expect(priceBand([])).toBeNull()
  })

  it('splits pending from active on the competition set', () => {
    const rows = [
      entry({ key: 'A', family: 'active', status: 'active', listPrice: 520000 }),
      entry({ key: 'B', family: 'active', status: 'pending', listPrice: 540000 }),
      entry({ key: 'C', family: 'active', listPrice: 510000 }),
    ]
    const split = splitActivePending(rows)
    expect(split.pending.map((e) => e.key)).toEqual(['B'])
    expect(split.active.map((e) => e.key)).toEqual(['A', 'C'])
  })

  it('builds Closed / Pending / Active summary rows from letter homes', () => {
    const closed = [
      entry({ key: '1', family: 'closed', closePrice: 500000 }),
      entry({ key: '2', family: 'closed', closePrice: 480000 }),
      entry({ key: '3', family: 'closed', closePrice: 520000 }),
    ]
    const active = [
      entry({ key: 'A', family: 'active', status: 'active', listPrice: 530000 }),
      entry({ key: 'B', family: 'active', status: 'pending', listPrice: 545000 }),
    ]
    const rows = statusPriceSummaries({ closed, active })
    expect(rows.map((r) => r.key)).toEqual(['closed', 'pending', 'active'])
    expect(rows[0]).toMatchObject({
      label: 'Closed',
      basis: 'sold',
      band: { low: 480000, avg: 500000, median: 500000, high: 520000 },
    })
    expect(rows[1]).toMatchObject({ label: 'Pending', basis: 'list', homes: 1 })
    expect(rows[2]).toMatchObject({ label: 'Active', basis: 'list', homes: 1 })
    const html = statusPriceBoardHtml(rows)
    expect(html).toContain('Closed · Pending · Active')
    expect(html).toContain('Low')
    expect(html).toContain('Avg')
    expect(html).toContain('Median')
    expect(html).toContain('High')
    expect(html).toContain('data-status="pending"')
  })
})
