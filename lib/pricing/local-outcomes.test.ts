/**
 * Chapter 2's arithmetic, tested through the interface the builder calls.
 *
 * Not tested here: return shapes the compiler already proves. Tested here: the
 * things it cannot — the minimum-n withholding, the cumulative curve's own
 * definition, which side of `OriginalListPrice > ListPrice` a row falls on,
 * that the "did not sell" days are the SAME span the subject's own DOM uses,
 * and that the two independent median implementations agree.
 */

import { describe, it, expect } from 'vitest'
import {
  MIN_LOCAL_OUTCOME_N,
  OFFER_TIMING_DAYS,
  computeAskOutcome,
  computeOfferTiming,
  failedRowDays,
  localOutcomeWindowStart,
  medianCounted,
  medianSorted,
  medianVerified,
  soldAfterCut,
  soldToOriginalAskPct,
  soldWithoutCut,
  usableDaysToPending,
  type LocalClosedRow,
  type LocalFailedRow,
} from './local-outcomes'
import { finalCycleDaysOnMarket } from '@/lib/cma/expired-audit'

const FETCHED = '2026-09-07T12:00:00.000Z'
const SINCE = '2025-09-07'

function closed(over: Partial<LocalClosedRow> = {}): LocalClosedRow {
  return {
    CloseDate: '2026-05-01',
    days_to_pending: 20,
    OriginalListPrice: 500_000,
    ListPrice: 500_000,
    ...over,
  }
}

function failed(over: Partial<LocalFailedRow> = {}): LocalFailedRow {
  return {
    StandardStatus: 'Withdrawn',
    ListDate: '2026-02-26T23:27:57+00:00',
    OnMarketDate: '2026-02-26T23:27:57+00:00',
    off_market_date: '2026-09-01',
    status_change_timestamp: '2026-09-01T20:01:17+00:00',
    DaysOnMarket: 999,
    ...over,
  }
}

/** n rows whose days-to-pending are 1..n, so the median is known by hand. */
function closedRun(n: number, over: (i: number) => Partial<LocalClosedRow> = () => ({})): LocalClosedRow[] {
  return Array.from({ length: n }, (_, i) => closed({ days_to_pending: i + 1, ...over(i) }))
}

describe('medians', () => {
  it('sorted and counted agree on odd, even, ties and unsorted input', () => {
    const cases: number[][] = [
      [5],
      [3, 1, 2],
      [4, 1, 3, 2],
      [7, 7, 7, 7],
      [10, 1, 1, 1, 99],
      [0, 0, 1, 1, 2, 2],
      [-0, 5, 5, 12],
    ]
    for (const values of cases) {
      expect(medianCounted(values), JSON.stringify(values)).toBe(medianSorted(values))
      expect(medianVerified(values)).toBe(medianSorted(values))
    }
  })

  it('agrees with sorted over a large pseudo-random set', () => {
    let seed = 12345
    const values = Array.from({ length: 401 }, () => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed % 400
    })
    expect(medianCounted(values)).toBe(medianSorted(values))
  })

  it('is null on an empty set rather than zero', () => {
    expect(medianSorted([])).toBeNull()
    expect(medianCounted([])).toBeNull()
    expect(medianVerified([])).toBeNull()
  })

  it('does not sort its input in place', () => {
    const values = [9, 2, 7]
    medianSorted(values)
    expect(values).toEqual([9, 2, 7])
  })
})

describe('usableDaysToPending', () => {
  it('drops null and negative values instead of reading them as zero', () => {
    const rows = [closed({ days_to_pending: 0 }), closed({ days_to_pending: null }), closed({ days_to_pending: -3 })]
    expect(usableDaysToPending(rows)).toEqual([0])
  })
})

describe('computeOfferTiming', () => {
  it('withholds every figure and says why under the minimum', () => {
    const t = computeOfferTiming({ rows: closedRun(MIN_LOCAL_OUTCOME_N - 1), city: 'Redmond', sinceIso: SINCE, fetchedAt: FETCHED })
    expect(t.n).toBe(MIN_LOCAL_OUTCOME_N - 1)
    expect(t.points).toBeNull()
    expect(t.medianDays).toBeNull()
    expect(t.reason).toContain(String(MIN_LOCAL_OUTCOME_N))
    expect(t.source.table).toBe('listings')
  })

  it('publishes at exactly the minimum', () => {
    const t = computeOfferTiming({ rows: closedRun(MIN_LOCAL_OUTCOME_N), city: 'Redmond', sinceIso: SINCE, fetchedAt: FETCHED })
    expect(t.n).toBe(MIN_LOCAL_OUTCOME_N)
    expect(t.reason).toBeNull()
    expect(t.points).toHaveLength(OFFER_TIMING_DAYS.length)
  })

  it('is cumulative: each point is the share with an offer by that day, never decreasing', () => {
    // 100 sales, days 1..100. By day 7 → 7%; by day 30 → 30%; by day 180 → 100%.
    const t = computeOfferTiming({ rows: closedRun(100), city: 'Redmond', sinceIso: SINCE, fetchedAt: FETCHED })
    expect(t.points!.map((p) => p.pct)).toEqual([7, 14, 30, 60, 90, 100])
    const pcts = t.points!.map((p) => p.pct)
    expect([...pcts].sort((a, b) => a - b)).toEqual(pcts)
  })

  it('counts a sale ON the mark, not only before it', () => {
    const rows = [...closedRun(29), closed({ days_to_pending: 7 })]
    const t = computeOfferTiming({ rows, city: 'Redmond', sinceIso: SINCE, fetchedAt: FETCHED })
    // days 1..29 plus a second 7 → eight sales at 7 days or less out of 30.
    expect(t.points![0]).toEqual({ days: 7, pct: 26.7 })
  })

  it('does not force the last point to 100 when sales ran past 180 days', () => {
    const rows = [...closedRun(30), ...Array.from({ length: 10 }, () => closed({ days_to_pending: 300 }))]
    const t = computeOfferTiming({ rows, city: 'Redmond', sinceIso: SINCE, fetchedAt: FETCHED })
    expect(t.points!.at(-1)!.pct).toBe(75)
  })

  it('names the city, the window and the days definition in the source', () => {
    const t = computeOfferTiming({ rows: closedRun(40), city: 'Bend', sinceIso: SINCE, fetchedAt: FETCHED })
    expect(t.source.filter).toContain("City='Bend'")
    expect(t.source.filter).toContain('days_to_pending')
    expect(t.source.filter).toContain(SINCE)
    expect(t.source.fetchedAt).toBe(FETCHED)
    expect(t.source.query).toContain('from listings')
  })
})

describe('the cut split', () => {
  it('reads a lower final ask as a cut and an unchanged one as no cut', () => {
    expect(soldAfterCut(closed({ OriginalListPrice: 500_000, ListPrice: 460_000 }))).toBe(true)
    expect(soldWithoutCut(closed({ OriginalListPrice: 500_000, ListPrice: 460_000 }))).toBe(false)
    expect(soldWithoutCut(closed({ OriginalListPrice: 500_000, ListPrice: 500_000 }))).toBe(true)
  })

  it('counts a RAISED ask as no cut, never as a cut', () => {
    const raised = closed({ OriginalListPrice: 500_000, ListPrice: 520_000 })
    expect(soldAfterCut(raised)).toBe(false)
    expect(soldWithoutCut(raised)).toBe(true)
  })

  it('puts a row missing either ask in neither group', () => {
    for (const row of [closed({ OriginalListPrice: null }), closed({ ListPrice: 0 })]) {
      expect(soldAfterCut(row)).toBe(false)
      expect(soldWithoutCut(row)).toBe(false)
    }
  })
})

describe('failedRowDays', () => {
  it('is the same span finalCycleDaysOnMarket measures for the subject', () => {
    const row = failed()
    expect(failedRowDays(row)).toBe(187)
    expect(failedRowDays(row)).toBe(
      finalCycleDaysOnMarket({
        listDate: row.ListDate!,
        offMarketDate: row.off_market_date!,
        daysOnMarket: row.DaysOnMarket!,
      }),
    )
  })

  it('falls back to status_change_timestamp when off_market_date is missing', () => {
    expect(failedRowDays(failed({ off_market_date: null }))).toBe(187)
  })

  it('falls back to the reported DaysOnMarket only when a date is missing', () => {
    expect(failedRowDays(failed({ ListDate: null, OnMarketDate: null, DaysOnMarket: 42 }))).toBe(42)
    expect(failedRowDays(failed({ ListDate: null, OnMarketDate: null, DaysOnMarket: null }))).toBeNull()
  })
})

describe('computeAskOutcome', () => {
  const cityArgs = { city: 'Redmond', sinceIso: SINCE, fetchedAt: FETCHED }

  it('returns the three groups in the order the chapter reads them', () => {
    const o = computeAskOutcome({ closedRows: [], failedRows: [], ...cityArgs })
    expect(o.groups.map((g) => g.key)).toEqual(['sold-no-cut', 'sold-after-cut', 'did-not-sell'])
  })

  it('withholds one group and publishes the others', () => {
    const noCut = closedRun(40, () => ({ OriginalListPrice: 400_000, ListPrice: 400_000 }))
    const cut = closedRun(40, () => ({ OriginalListPrice: 400_000, ListPrice: 380_000 }))
    const o = computeAskOutcome({ closedRows: [...noCut, ...cut], failedRows: [failed()], ...cityArgs })
    const [a, b, c] = o.groups
    expect(a.n).toBe(40)
    expect(a.medianDays).toBe(20.5)
    expect(a.reason).toBeNull()
    expect(b.n).toBe(40)
    expect(b.medianCutPct).toBe(5)
    expect(c.n).toBe(1)
    expect(c.medianDays).toBeNull()
    expect(c.reason).toContain('came off the market unsold')
  })

  it('medians the cut PERCENT, not the dollars', () => {
    // Half the sales cut 10% off $500K, half cut 10% off $250K. The median cut
    // is 10 percent either way; a dollar median would be $37,500.
    const rows = [
      ...closedRun(20, () => ({ OriginalListPrice: 500_000, ListPrice: 450_000 })),
      ...closedRun(20, () => ({ OriginalListPrice: 250_000, ListPrice: 225_000 })),
    ]
    const o = computeAskOutcome({ closedRows: rows, failedRows: [], ...cityArgs })
    expect(o.groups[1].medianCutPct).toBe(10)
  })

  it('only the cut group carries a cut percent', () => {
    const o = computeAskOutcome({ closedRows: closedRun(40), failedRows: [], ...cityArgs })
    expect(o.groups[0].medianCutPct).toBeUndefined()
    expect(o.groups[2].medianCutPct).toBeUndefined()
    expect('medianCutPct' in o.groups[1]).toBe(true)
  })

  it('records the ask population rate in the source rather than assuming it', () => {
    const rows = [...closedRun(3), closed({ OriginalListPrice: null })]
    const o = computeAskOutcome({ closedRows: rows, failedRows: [], ...cityArgs })
    expect(o.source.filter).toContain('3 of 4 closed rows (75%)')
  })

  it('measures the did-not-sell group with list-to-off-market days', () => {
    const failedRows = Array.from({ length: 30 }, (_, i) =>
      failed({ ListDate: '2026-01-01', off_market_date: `2026-02-${String((i % 28) + 1).padStart(2, '0')}` }),
    )
    const o = computeAskOutcome({ closedRows: [], failedRows, ...cityArgs })
    expect(o.groups[2].n).toBe(30)
    // Jan 1 to Feb 1..28 is 31..58 days, with Feb 1 and Feb 2 appearing twice.
    expect(o.groups[2].medianDays).toBe(43.5)
    expect(o.source.filter).toContain('finalCycleDaysOnMarket')
  })
})

describe('localOutcomeWindowStart', () => {
  it('walks back twelve calendar months, not 365 fixed days', () => {
    expect(localOutcomeWindowStart(new Date('2026-09-07T00:00:00Z'))).toBe('2025-09-07')
    expect(localOutcomeWindowStart(new Date('2026-03-31T00:00:00Z'), 1)).toBe('2026-03-03')
  })
})

describe('share of the original ask', () => {
  it('is a percent of the ORIGINAL ask, not the final one', () => {
    expect(
      soldToOriginalAskPct({ OriginalListPrice: 500_000, ListPrice: 460_000, ClosePrice: 450_000 }),
    ).toBe(90)
  })

  it('refuses a close more than 50 percent from the ask (Redfin exclusion)', () => {
    expect(soldToOriginalAskPct({ OriginalListPrice: 100_000, ClosePrice: 160_000 })).toBeNull()
    expect(soldToOriginalAskPct({ OriginalListPrice: 100_000, ClosePrice: 40_000 })).toBeNull()
    expect(soldToOriginalAskPct({ OriginalListPrice: 100_000, ClosePrice: 150_000 })).toBe(150)
    expect(soldToOriginalAskPct({ OriginalListPrice: 100_000, ClosePrice: 50_000 })).toBe(50)
  })

  it('is null when either price is missing', () => {
    expect(soldToOriginalAskPct({ OriginalListPrice: 500_000 })).toBeNull()
    expect(soldToOriginalAskPct({ ClosePrice: 500_000 })).toBeNull()
  })

  it('rides the sold groups and is never published for did-not-sell', () => {
    const noCut = closedRun(MIN_LOCAL_OUTCOME_N, () => ({ ClosePrice: 495_000 }))
    const cut = closedRun(MIN_LOCAL_OUTCOME_N, () => ({ ListPrice: 480_000, ClosePrice: 470_000 }))
    const out = computeAskOutcome({
      closedRows: [...noCut, ...cut],
      failedRows: Array.from({ length: MIN_LOCAL_OUTCOME_N }, () => failed()),
      city: 'Redmond',
      sinceIso: SINCE,
      fetchedAt: FETCHED,
    })
    const byKey = Object.fromEntries(out.groups.map((g) => [g.key, g]))
    expect(byKey['sold-no-cut'].medianSoldToOriginalAskPct).toBe(99)
    expect(byKey['sold-no-cut'].soldToOriginalAskN).toBe(MIN_LOCAL_OUTCOME_N)
    expect(byKey['sold-after-cut'].medianSoldToOriginalAskPct).toBe(94)
    expect(byKey['did-not-sell'].medianSoldToOriginalAskPct).toBeNull()
    expect(byKey['did-not-sell'].soldToOriginalAskN).toBe(0)
  })

  it('withholds the share when the price pairs are thinner than the days', () => {
    const rows = closedRun(MIN_LOCAL_OUTCOME_N).map((r, i) =>
      i < 5 ? { ...r, ClosePrice: 495_000 } : r,
    )
    const out = computeAskOutcome({
      closedRows: rows,
      failedRows: [],
      city: 'Redmond',
      sinceIso: SINCE,
      fetchedAt: FETCHED,
    })
    const noCut = out.groups.find((g) => g.key === 'sold-no-cut')!
    expect(noCut.n).toBe(MIN_LOCAL_OUTCOME_N)
    expect(noCut.medianDays).not.toBeNull()
    expect(noCut.soldToOriginalAskN).toBe(5)
    expect(noCut.medianSoldToOriginalAskPct).toBeNull()
  })
})

