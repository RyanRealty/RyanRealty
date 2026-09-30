import { describe, expect, it } from 'vitest'
import {
  listPriceForPpsf,
  ppsfBand,
  ppsfOf,
  statusPpsfCaptionHtml,
  statusPpsfSummaries,
} from '@/lib/cma/status-ppsf'
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

describe('status ppsf math', () => {
  it('uses listPrice, then last ask, then first ask', () => {
    expect(listPriceForPpsf({ listPrice: 500000, lastAsk: 490000, firstAsk: 520000 })).toBe(500000)
    expect(listPriceForPpsf({ listPrice: null, lastAsk: 490000, firstAsk: 520000 })).toBe(490000)
    expect(listPriceForPpsf({ listPrice: null, lastAsk: null, firstAsk: 520000 })).toBe(520000)
    expect(listPriceForPpsf({ listPrice: 0, lastAsk: null, firstAsk: null })).toBeNull()
  })

  it('refuses a rate when price or living area is missing', () => {
    expect(ppsfOf(500000, 1600)).toBe(312.5)
    expect(ppsfOf(500000, 0)).toBeNull()
    expect(ppsfOf(null, 1600)).toBeNull()
  })

  it('takes a true median of the rounded rates', () => {
    expect(ppsfBand([300, 310, 350])).toEqual({ n: 3, median: 310, low: 300, high: 350 })
    expect(ppsfBand([300, 320])).toEqual({ n: 2, median: 310, low: 300, high: 320 })
    expect(ppsfBand([])).toBeNull()
  })
})

describe('status ppsf summaries from the selected homes', () => {
  const sold = [
    entry({
      key: '1',
      family: 'closed',
      listPrice: 510000,
      closePrice: 500000,
      sqft: 1580,
    }),
    entry({
      key: '2',
      family: 'closed',
      listPrice: 490000,
      closePrice: 480000,
      sqft: 1600,
    }),
    entry({
      key: '3',
      family: 'closed',
      listPrice: 530000,
      closePrice: 520000,
      sqft: 1700,
    }),
  ]
  const expired = [
    entry({ key: 'i', family: 'unsold', listPrice: 540000, sqft: 1500 }),
    entry({ key: 'ii', family: 'unsold', listPrice: 560000, sqft: 1600 }),
  ]
  const active = [entry({ key: 'A', family: 'active', listPrice: 520000, sqft: 1600 })]

  it('reports list and sold $/sf on sold, list only on active and expired', () => {
    const rows = statusPpsfSummaries({ closed: sold, unsold: expired, active })
    expect(rows.map((r) => r.key)).toEqual(['sold', 'active', 'expired'])
    const listRates = [510000 / 1580, 490000 / 1600, 530000 / 1700].map((n) => Math.round(n))
    const soldRates = [500000 / 1580, 480000 / 1600, 520000 / 1700].map((n) => Math.round(n))
    expect(rows[0]).toMatchObject({ label: 'Sold', homes: 3 })
    expect(rows[0]!.list).toEqual({
      n: 3,
      low: Math.min(...listRates),
      high: Math.max(...listRates),
      median: 312,
    })
    expect(rows[0]!.sold).toEqual({
      n: 3,
      low: Math.min(...soldRates),
      high: Math.max(...soldRates),
      median: 306,
    })
    expect(rows[1]).toMatchObject({
      key: 'active',
      homes: 1,
      list: { n: 1, median: 325, low: 325, high: 325 },
      sold: null,
    })
    const expiredRates = [540000 / 1500, 560000 / 1600].map((n) => Math.round(n))
    expect(rows[2]).toMatchObject({
      key: 'expired',
      homes: 2,
      list: {
        n: 2,
        low: Math.min(...expiredRates),
        high: Math.max(...expiredRates),
        median: Math.round((expiredRates[0]! + expiredRates[1]!) / 2),
      },
      sold: null,
    })
  })

  it('drops a status that is not in the selected set', () => {
    expect(statusPpsfSummaries({ closed: sold }).map((r) => r.key)).toEqual(['sold'])
    expect(statusPpsfSummaries({ active }).map((r) => r.key)).toEqual(['active'])
    expect(statusPpsfSummaries({ unsold: expired }).map((r) => r.key)).toEqual(['expired'])
    expect(statusPpsfSummaries({})).toEqual([])
  })

  it('never folds the subject column into the rate', () => {
    const withSubject = [
      entry({ key: 'subject', family: 'subject', listPrice: 999999, closePrice: 999999, sqft: 1000 }),
      ...sold,
    ]
    const rows = statusPpsfSummaries({ closed: withSubject })
    expect(rows).toHaveLength(1)
    expect(rows[0]!.homes).toBe(3)
    expect(rows[0]!.sold?.high).toBeLessThan(400)
  })

  it('omits a sale with no living area rather than inventing a rate', () => {
    const thin = [
      entry({ key: '1', family: 'closed', listPrice: 510000, closePrice: 500000, sqft: 0 }),
      entry({ key: '2', family: 'closed', listPrice: 490000, closePrice: 480000, sqft: 1600 }),
    ]
    const rows = statusPpsfSummaries({ closed: thin })
    expect(rows[0]!.homes).toBe(2)
    expect(rows[0]!.sold).toEqual({ n: 1, median: 300, low: 300, high: 300 })
  })
})

describe('status ppsf matrix captions', () => {
  it('captions each matrix from that status only', () => {
    const closed = statusPpsfCaptionHtml('closed', [
      entry({ key: '1', family: 'closed', listPrice: 512000, closePrice: 496000, sqft: 1600 }),
      entry({ key: '2', family: 'closed', listPrice: 528000, closePrice: 512000, sqft: 1600 }),
    ])
    expect(closed).toContain('These two sales list at')
    expect(closed).toContain('and sold at')
    expect(closed).toContain('data-ppsf-status="sold"')
    const asking = statusPpsfCaptionHtml('active', [
      entry({ key: 'A', family: 'active', listPrice: 544000, sqft: 1600 }),
    ])
    expect(asking).toContain('This one listing lists at $340 a foot.')
    expect(asking).not.toContain('sold at')
  })
})
