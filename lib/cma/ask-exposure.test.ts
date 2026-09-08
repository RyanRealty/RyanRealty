/**
 * ASK EXPOSURE — round four, class B.
 *
 * The document computed its story from `failedAskForStory`, which deliberately
 * takes the LAST cut. 2465 7th held $475,000 for 152 of its 187 days and
 * $460,000 for the other 35, and the document quoted the final ask's gap and
 * never named $475,000 in prose. Concorde's 290 days covered a $1,799,000
 * opening that was cut once, and none of it reached the page.
 *
 * These tests hold the shape a renderer needs to tell the whole truth: every
 * price the listing actually wore, how long each one ran, and which one ran
 * the clock.
 */
import { describe, expect, it } from 'vitest'
import { buildAskExposure, resolveFinalCycle } from '@/lib/cma/expired-audit'
import type { ExpiredFinalCycle } from '@/lib/cma/expired-audit'
import type { BpoListingCycle } from '@/lib/bpo/types'

/** cma-2465-7th-redmond-97756, exactly as the dry run reads it. */
const CYCLE_2465: ExpiredFinalCycle = {
  listDate: '2026-02-26',
  initialAsk: 475_000,
  cuts: [{ date: '2026-07-28', ask: 460_000 }],
  cutsDated: true,
  finalAsk: 460_000,
  offMarketDate: '2026-09-01',
  status: 'Withdrawn',
  days: 187,
  source: { table: 't', filter: 'f', fetchedAt: '2026-09-08', query: 'q' },
}

/** cma-65365-concorde. One cut, 290 days, an opening the document never printed. */
const CYCLE_CONCORDE: ExpiredFinalCycle = {
  listDate: '2025-09-17',
  initialAsk: 1_799_000,
  cuts: [{ date: '2026-05-02', ask: 1_500_000 }],
  cutsDated: true,
  finalAsk: 1_500_000,
  offMarketDate: '2026-07-04',
  status: 'Expired',
  days: 290,
  source: { table: 't', filter: 'f', fetchedAt: '2026-09-08', query: 'q' },
}

describe('buildAskExposure — every price the listing wore, and for how long', () => {
  it('2465: splits the 187 days into the two asks that ran them', () => {
    const e = buildAskExposure({ cycle: CYCLE_2465, rangeLow: 426_000, rangeHigh: 475_000 })!
    expect(e.segments).toHaveLength(2)
    expect(e.segments[0]).toMatchObject({ ask: 475_000, from: '2026-02-26', to: '2026-07-28', days: 152 })
    expect(e.segments[1]).toMatchObject({ ask: 460_000, from: '2026-07-28', to: '2026-09-01', days: 35 })
    expect(e.segments[0]!.days + e.segments[1]!.days).toBe(CYCLE_2465.days)
  })

  it('2465: the share of the clock each ask held', () => {
    const e = buildAskExposure({ cycle: CYCLE_2465, rangeLow: 426_000, rangeHigh: 475_000 })!
    expect(e.segments[0]!.sharePct).toBeCloseTo(81.3, 1)
    expect(e.segments[1]!.sharePct).toBeCloseTo(18.7, 1)
    expect(e.segments.reduce((s, x) => s + x.sharePct, 0)).toBeCloseTo(100, 6)
  })

  it('2465: the dominant ask is the one that ran the clock, not the last cut', () => {
    const e = buildAskExposure({ cycle: CYCLE_2465, rangeLow: 426_000, rangeHigh: 475_000 })!
    expect(e.dominant.ask).toBe(475_000)
    expect(e.dominant.days).toBe(152)
    expect(e.final.ask).toBe(460_000)
    expect(e.final.ask).not.toBe(e.dominant.ask)
  })

  it('measures each ask against the TOP of the range, signed', () => {
    const e = buildAskExposure({ cycle: CYCLE_2465, rangeLow: 426_000, rangeHigh: 440_000 })!
    // 475,000 against a 440,000 top is +7.95%; 460,000 is +4.55%.
    expect(e.segments[0]!.pctAboveRangeTop).toBeCloseTo(7.95, 2)
    expect(e.segments[1]!.pctAboveRangeTop).toBeCloseTo(4.55, 2)
    // An ask BELOW the top reads negative rather than being hidden.
    const inside = buildAskExposure({ cycle: CYCLE_2465, rangeLow: 426_000, rangeHigh: 500_000 })!
    expect(inside.segments[0]!.pctAboveRangeTop).toBeLessThan(0)
  })

  it('Concorde: the $1,799,000 opening carried 227 of the 290 days', () => {
    const e = buildAskExposure({ cycle: CYCLE_CONCORDE, rangeLow: 1_390_000, rangeHigh: 1_930_000 })!
    expect(e.segments.map((s) => s.ask)).toEqual([1_799_000, 1_500_000])
    expect(e.segments[0]!.days).toBe(227)
    expect(e.segments[1]!.days).toBe(63)
    expect(e.dominant.ask).toBe(1_799_000)
  })

  it('names the dominant ask, its days and its share in the sentence', () => {
    const e = buildAskExposure({ cycle: CYCLE_2465, rangeLow: 426_000, rangeHigh: 440_000 })!
    expect(e.sentence).toContain('$475,000')
    expect(e.sentence).toContain('152')
    expect(e.sentence).toContain('187')
    expect(e.sentence).toContain('$460,000')
    expect(e.sentence).not.toMatch(/[—;]/)
  })

  it('a single-price listing is one segment that is both dominant and final', () => {
    const flat: ExpiredFinalCycle = { ...CYCLE_2465, cuts: [], cutsDated: false, finalAsk: 475_000 }
    const e = buildAskExposure({ cycle: flat, rangeLow: 426_000, rangeHigh: 440_000 })!
    expect(e.segments).toHaveLength(1)
    expect(e.dominant).toEqual(e.final)
    expect(e.dominant.days).toBe(187)
    expect(e.sentence).toContain('$475,000')
  })

  it('refuses to draw segments from an undated cut rather than inventing a date', () => {
    const undated: ExpiredFinalCycle = {
      ...CYCLE_2465,
      cuts: [{ date: null, ask: 460_000 }],
      cutsDated: false,
    }
    const e = buildAskExposure({ cycle: undated, rangeLow: 426_000, rangeHigh: 440_000 })!
    // One segment at the opening ask, spanning the whole period. The cut is
    // real but the day it happened is not recorded, and §0 forbids a date from
    // convention.
    expect(e.segments).toHaveLength(1)
    expect(e.segments[0]!.ask).toBe(475_000)
    expect(e.segments[0]!.days).toBe(187)
  })

  it('is null when there is no cycle, no list date or no off-market date', () => {
    expect(buildAskExposure({ cycle: null, rangeLow: 1, rangeHigh: 2 })).toBeNull()
    expect(
      buildAskExposure({ cycle: { ...CYCLE_2465, listDate: null }, rangeLow: 1, rangeHigh: 2 }),
    ).toBeNull()
    expect(
      buildAskExposure({ cycle: { ...CYCLE_2465, offMarketDate: null }, rangeLow: 1, rangeHigh: 2 }),
    ).toBeNull()
  })

  it('drops a cut dated outside the period rather than producing a negative span', () => {
    const bad: ExpiredFinalCycle = {
      ...CYCLE_2465,
      cuts: [{ date: '2025-01-01', ask: 460_000 }],
    }
    const e = buildAskExposure({ cycle: bad, rangeLow: 426_000, rangeHigh: 440_000 })!
    expect(e.segments).toHaveLength(1)
    expect(e.segments[0]!.days).toBe(187)
  })
})

/**
 * Round four, class B, second half: 19968's "listed" figure is a NOVEMBER 2004
 * ask of $140,000, printed undated beside a $461,000 recommendation. A cycle
 * older than FAILED_ASK_RECENCY_MONTHS is a different market and may not
 * populate the story at all.
 */
const cycleAt = (offMarket: string, status = 'Expired'): BpoListingCycle =>
  ({
    listingKey: 'k',
    listDate: `${offMarket.slice(0, 4)}-01-02`,
    offMarketDate: offMarket,
    originalListPrice: 140_000,
    finalListPrice: 140_000,
    status,
  }) as unknown as BpoListingCycle

describe('resolveFinalCycle — a stale cycle tells no story', () => {
  it('suppresses a cycle that came off the market more than twelve months ago', () => {
    const r = resolveFinalCycle({ cycle: cycleAt('2004-12-14'), asOf: new Date('2026-09-08T00:00:00Z') })
    expect(r.cycle).toBeNull()
    expect(r.suppressedReason).toBeTruthy()
    expect(r.suppressedReason!).toMatch(/2004-12-14/)
    expect(r.suppressedReason!).toMatch(/12 months/)
  })

  it('keeps a cycle inside the recency window', () => {
    const r = resolveFinalCycle({ cycle: cycleAt('2026-07-04'), asOf: new Date('2026-09-08T00:00:00Z') })
    expect(r.cycle).not.toBeNull()
    expect(r.suppressedReason).toBeNull()
  })

  it('keeps a cycle whose off-market date is not recorded — absence is not staleness', () => {
    const c = { ...cycleAt('2026-07-04'), offMarketDate: null } as unknown as BpoListingCycle
    const r = resolveFinalCycle({ cycle: c, asOf: new Date('2026-09-08T00:00:00Z') })
    expect(r.cycle).not.toBeNull()
    expect(r.suppressedReason).toBeNull()
  })

  it('has nothing to suppress when there is no cycle', () => {
    expect(resolveFinalCycle({ cycle: null })).toEqual({ cycle: null, suppressedReason: null })
  })
})
