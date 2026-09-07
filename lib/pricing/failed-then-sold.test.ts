/**
 * The local failed-then-sold pairing, tested through the two functions the
 * builder calls. Tested here: the pairing rules the regional backtest
 * established — the address key, which sale answers which failure, the relist
 * window, earliest-close-wins — and the minimum below which no city figure is
 * published. Not tested: return shapes the compiler already proves.
 */

import { describe, it, expect } from 'vitest'
import {
  MIN_FAILED_THEN_SOLD_N,
  addressKey,
  computeLocalFailedThenSold,
  failureEnd,
  pairFailedThenSold,
  type ClosedSaleRow,
  type FailedCycleRow,
} from './failed-then-sold'

const FETCHED = '2026-09-07T12:00:00.000Z'
const SINCE = '2024-09-07'

function failedCycle(over: Partial<FailedCycleRow> = {}): FailedCycleRow {
  return {
    ListingKey: 'F1',
    StreetNumber: '2465',
    StreetName: 'SW 7th St',
    City: 'Redmond',
    StandardStatus: 'Withdrawn',
    ListPrice: 500_000,
    OriginalListPrice: 525_000,
    off_market_date: '2025-06-01',
    status_change_timestamp: '2025-06-01T20:00:00+00:00',
    ...over,
  }
}

function closedSale(over: Partial<ClosedSaleRow> = {}): ClosedSaleRow {
  return {
    ListingKey: 'C1',
    StreetNumber: '2465',
    StreetName: 'SW 7th St',
    City: 'Redmond',
    ClosePrice: 470_000,
    CloseDate: '2025-10-01',
    ListDate: '2025-07-01',
    ...over,
  }
}

describe('address key', () => {
  it('collapses case and inner whitespace, and needs all three parts', () => {
    expect(addressKey({ StreetNumber: ' 2465 ', StreetName: 'SW  7th  St', City: 'Redmond' })).toBe(
      '2465|sw 7th st|redmond',
    )
    expect(addressKey({ StreetNumber: '2465', StreetName: null, City: 'Redmond' })).toBeNull()
    expect(addressKey({ StreetNumber: '', StreetName: 'SW 7th', City: 'Redmond' })).toBeNull()
  })
})

describe('failure end date', () => {
  it('prefers off_market_date and falls back to the status change', () => {
    expect(failureEnd(failedCycle())).toBe('2025-06-01')
    expect(failureEnd(failedCycle({ off_market_date: null }))).toBe('2025-06-01T20:00:00+00:00')
    expect(failureEnd(failedCycle({ off_market_date: null, status_change_timestamp: null }))).toBeNull()
  })
})

describe('pairing', () => {
  it('pairs a failure with the sale at the same address that started after it', () => {
    const pairs = pairFailedThenSold({ failedRows: [failedCycle()], closedRows: [closedSale()] })
    expect(pairs).toHaveLength(1)
    expect(pairs[0].shareOfFailedAskPct).toBeCloseTo(94, 5)
    expect(pairs[0].soldListingKey).toBe('C1')
  })

  it('refuses a sale that was already on the market when the listing failed', () => {
    const pairs = pairFailedThenSold({
      failedRows: [failedCycle()],
      closedRows: [closedSale({ ListDate: '2025-01-01' })],
    })
    expect(pairs).toHaveLength(0)
  })

  it('falls back to the close date when the sale carries no list date', () => {
    const pairs = pairFailedThenSold({
      failedRows: [failedCycle()],
      closedRows: [closedSale({ ListDate: null })],
    })
    expect(pairs).toHaveLength(1)
  })

  it('refuses a sale that closed outside the relist window', () => {
    const pairs = pairFailedThenSold({
      failedRows: [failedCycle()],
      closedRows: [closedSale({ CloseDate: '2027-06-01', ListDate: '2027-01-01' })],
    })
    expect(pairs).toHaveLength(0)
  })

  it('takes the earliest qualifying close when several sales follow', () => {
    const pairs = pairFailedThenSold({
      failedRows: [failedCycle()],
      closedRows: [
        closedSale({ ListingKey: 'LATE', CloseDate: '2026-05-01', ClosePrice: 520_000 }),
        closedSale({ ListingKey: 'EARLY', CloseDate: '2025-09-01', ClosePrice: 480_000 }),
      ],
    })
    expect(pairs).toHaveLength(1)
    expect(pairs[0].soldListingKey).toBe('EARLY')
  })

  it('does not pair across addresses', () => {
    const pairs = pairFailedThenSold({
      failedRows: [failedCycle()],
      closedRows: [closedSale({ StreetNumber: '2467' })],
    })
    expect(pairs).toHaveLength(0)
  })

  it('skips a failure with no ask to divide by', () => {
    const pairs = pairFailedThenSold({
      failedRows: [failedCycle({ ListPrice: null })],
      closedRows: [closedSale()],
    })
    expect(pairs).toHaveLength(0)
  })
})

describe('the city block', () => {
  function pairSet(n: number, share: (i: number) => number) {
    const failedRows = Array.from({ length: n }, (_, i) =>
      failedCycle({ ListingKey: `F${i}`, StreetNumber: String(1000 + i), ListPrice: 500_000 }),
    )
    const closedRows = Array.from({ length: n }, (_, i) =>
      closedSale({
        ListingKey: `C${i}`,
        StreetNumber: String(1000 + i),
        ClosePrice: Math.round(500_000 * share(i)),
      }),
    )
    return { failedRows, closedRows }
  }

  it('publishes the median share once the minimum is reached', () => {
    const { failedRows, closedRows } = pairSet(MIN_FAILED_THEN_SOLD_N, () => 0.95)
    const out = computeLocalFailedThenSold({
      failedRows,
      closedRows,
      city: 'Redmond',
      sinceIso: SINCE,
      fetchedAt: FETCHED,
    })
    expect(out.n).toBe(MIN_FAILED_THEN_SOLD_N)
    expect(out.medianShareOfFailedAsk).toBe(95)
    expect(out.reason).toBeNull()
    expect(out.windowMonths).toBe(24)
  })

  it('withholds the figure with a reason one pair short', () => {
    const { failedRows, closedRows } = pairSet(MIN_FAILED_THEN_SOLD_N - 1, () => 0.95)
    const out = computeLocalFailedThenSold({
      failedRows,
      closedRows,
      city: 'Redmond',
      sinceIso: SINCE,
      fetchedAt: FETCHED,
    })
    expect(out.n).toBe(MIN_FAILED_THEN_SOLD_N - 1)
    expect(out.medianShareOfFailedAsk).toBeNull()
    expect(out.reason).toContain(String(MIN_FAILED_THEN_SOLD_N))
    expect(out.source.query).toContain('Expired')
  })
})
