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

  it('builds Closed / Pending / Active / Expired rows from letter homes', () => {
    const closed = [
      entry({ key: '1', family: 'closed', listPrice: 510000, closePrice: 500000, sqft: 1600 }),
      entry({ key: '2', family: 'closed', listPrice: 490000, closePrice: 480000, sqft: 1600 }),
      entry({ key: '3', family: 'closed', listPrice: 530000, closePrice: 520000, sqft: 1600 }),
    ]
    const active = [
      entry({ key: 'A', family: 'active', status: 'active', listPrice: 530000, sqft: 1600 }),
      entry({ key: 'B', family: 'active', status: 'pending', listPrice: 545000, sqft: 1600 }),
    ]
    const unsold = [entry({ key: 'i', family: 'unsold', listPrice: 560000, sqft: 1600 })]
    const rows = statusPriceSummaries({ closed, active, unsold })
    expect(rows.map((r) => r.key)).toEqual(['closed', 'pending', 'active', 'expired'])
    expect(rows[0]).toMatchObject({
      label: 'Closed',
      homes: 3,
      list: { low: 490000, avg: 510000, median: 510000, high: 530000 },
      sold: { low: 480000, avg: 500000, median: 500000, high: 520000 },
      // Sold price over living area once closed: 480000/1600 = 300.
      ppsf: { low: 300, avg: 313, median: 313, high: 325 },
    })
    // Before a sale the rate is the ask over living area, and there is no Sold.
    expect(rows[1]).toMatchObject({ label: 'Pending', homes: 1, sold: null, ppsf: { median: 341 } })
    expect(rows[2]).toMatchObject({ label: 'Active', homes: 1, sold: null, ppsf: { median: 331 } })
    expect(rows[3]).toMatchObject({ label: 'Expired', homes: 1, sold: null, ppsf: { median: 350 } })
  })

  it('prints one FlexMLS-style table: List, Sold, $/sqft across, the four figures down each status', () => {
    const html = statusPriceBoardHtml(
      statusPriceSummaries({
        closed: [
          entry({ key: '1', family: 'closed', listPrice: 510400, closePrice: 505600, sqft: 1600 }),
          entry({ key: '2', family: 'closed', listPrice: 528000, closePrice: 512000, sqft: 1600 }),
        ],
        active: [entry({ key: 'A', family: 'active', status: 'active', listPrice: 544000, sqft: 1600 })],
      }),
    )
    expect(html).toContain('<h3 class="subhead">Closed · Active</h3>')
    expect(html).toMatch(/<th class="n" scope="col">List<\/th><th class="n" scope="col">Sold<\/th><th class="n" scope="col">\$\/sqft<\/th>/)
    expect(html).toContain('col class="sp-fig"')
    expect(html).toContain('<tbody data-status="closed">')
    expect(html).toContain('<tbody data-status="active">')
    expect(html).toContain('Closed<span class="sp-count">2 homes</span>')
    expect(html).toContain('Active<span class="sp-count">1 home</span>')
    // Closed Low row: list 510,400, sold 505,600, 505600/1600 = 316.
    expect(html).toContain(
      '<tr><th scope="row">Low</th><td class="n">$510,400</td><td class="n">$505,600</td><td class="n">$316</td></tr>',
    )
    // Closed High row: 512000/1600 = 320.
    expect(html).toContain(
      '<tr><th scope="row">High</th><td class="n">$528,000</td><td class="n">$512,000</td><td class="n">$320</td></tr>',
    )
    // Active has no sale: the Sold cell is empty, $/sqft is the ask (544000/1600 = 340).
    expect(html).toContain(
      '<tr><th scope="row">Median</th><td class="n">$544,000</td><td class="n"></td><td class="n">$340</td></tr>',
    )
    for (const stat of ['Low', 'Avg', 'Median', 'High']) {
      expect(html.match(new RegExp(`<th scope="row">${stat}</th>`, 'g'))).toHaveLength(2)
    }
    // The separate "Dollars a square foot" board is folded in, not repeated.
    expect(html).not.toContain('Dollars a square foot')
    expect(html).not.toContain('status-price-note')
    expect(html).not.toMatch(/months of supply/i)
    expect(html).not.toMatch(/\bMOS\b/)
    expect(html).not.toMatch(/\bcomp(s)?\b/i)
    expect(html).not.toContain('—')
  })

  it('says under the table when a column covers fewer homes than its status holds', () => {
    const html = statusPriceBoardHtml(
      statusPriceSummaries({
        closed: [
          entry({ key: '1', family: 'closed', listPrice: 510000, closePrice: 500000, sqft: 0 }),
          entry({ key: '2', family: 'closed', listPrice: 490000, closePrice: 480000, sqft: 1600 }),
        ],
      }),
    )
    expect(html).toContain('Closed<span class="sp-count">2 homes</span>')
    expect(html).toContain(
      '<tr><th scope="row">Low</th><td class="n">$490,000</td><td class="n">$480,000</td><td class="n">$300</td></tr>',
    )
    expect(html).toContain('Closed $/sqft covers 1 of 2 homes (1 with no living area on record).')
  })

  it('never counts the subject', () => {
    const rows = statusPriceSummaries({
      closed: [
        entry({ key: 'subject', family: 'subject', listPrice: 999999, closePrice: 999999, sqft: 1000 }),
        entry({ key: '1', family: 'closed', listPrice: 510000, closePrice: 500000, sqft: 1600 }),
      ],
      active: [entry({ key: 'subject', family: 'subject', listPrice: 999999, sqft: 1000 })],
      unsold: [entry({ key: 'subject', family: 'subject', listPrice: 999999, sqft: 1000 })],
    })
    expect(rows.map((r) => r.key)).toEqual(['closed'])
    expect(rows[0]).toMatchObject({ homes: 1, sold: { high: 500000 } })
    expect(statusPriceBoardHtml([])).toBe('')
  })
})
