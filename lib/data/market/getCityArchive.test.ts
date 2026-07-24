/**
 * Unit test for aggregateCityArchive (W8.5) — the pure per-year aggregation the
 * city archive page renders. Proves the §0 properties without a DB:
 *   - homes sold is the EXACT sum of monthly sold_count (additive, never a median)
 *   - the price column is the RANGE of the year's monthly medians, never a
 *     fabricated single "annual median"
 *   - a month below MONTHLY_VOLUME_FLOOR does NOT contribute its median to the
 *     range (ODS: a 1-2 sale "median" is a near-individual price)
 *   - a partial year (fewer than 12 months present) is flagged complete=false
 */
import { describe, expect, it } from 'vitest'
import { aggregateCityArchive, MONTHLY_VOLUME_FLOOR } from './getCityArchive'
import type { PriceHistoryPoint } from '@/lib/data/types/market'

const p = (periodStart: string, medianSalePrice: number | null, soldCount: number | null): PriceHistoryPoint => ({
  periodStart,
  medianSalePrice,
  soldCount,
})

describe('aggregateCityArchive (W8.5)', () => {
  it('sums homesSold exactly and ranges the volume-qualifying monthly medians', () => {
    const points: PriceHistoryPoint[] = [
      // 2023 — all 12 monthly rows present, one below-floor month, one
      // genuine zero-sale month (a row exists, no median). A finished past year
      // with a dead month must still read complete (not "in progress").
      p('2023-01-01', 500_000, 10),
      p('2023-02-01', 900_000, 2), // sold < floor (3) → excluded from the range
      p('2023-03-01', 550_000, 4),
      p('2023-04-01', 520_000, 3),
      p('2023-05-01', 520_000, 3),
      p('2023-06-01', 520_000, 3),
      p('2023-07-01', 520_000, 3),
      p('2023-08-01', 520_000, 3),
      p('2023-09-01', 520_000, 3),
      p('2023-10-01', 520_000, 3),
      p('2023-11-01', 520_000, 3),
      p('2023-12-01', null, 0), // zero-sale month: row present, no median
    ]
    const [y2023] = aggregateCityArchive(points)
    expect(y2023.year).toBe(2023)
    // 10 + 2 + 4 + (8 months * 3) + 0 = 40
    expect(y2023.homesSold).toBe(40)
    expect(y2023.monthsPresent).toBe(12) // all 12 rows present, incl. the dead month
    expect(y2023.complete).toBe(true) // completeness is of the DATA, not of sales
    // Range excludes Feb (below floor) and Dec (no median): min 500k, max 550k.
    expect(y2023.medianLow).toBe(500_000)
    expect(y2023.medianHigh).toBe(550_000)
    // §0: the high is NOT the below-floor 900k month.
    expect(y2023.medianHigh).not.toBe(900_000)
  })

  it('flags a full year complete and sorts newest first', () => {
    const points: PriceHistoryPoint[] = []
    for (let m = 1; m <= 12; m++) points.push(p(`2022-${String(m).padStart(2, '0')}-01`, 400_000, 5))
    points.push(p('2024-06-01', 700_000, 8)) // a later, partial year
    const years = aggregateCityArchive(points)
    expect(years.map((y) => y.year)).toEqual([2024, 2022]) // newest first
    const y2022 = years.find((y) => y.year === 2022)!
    expect(y2022.complete).toBe(true)
    expect(y2022.monthsPresent).toBe(12)
    expect(y2022.homesSold).toBe(60)
    expect(y2022.medianLow).toBe(400_000)
    expect(y2022.medianHigh).toBe(400_000)
    // 2024 has a single month → genuinely partial, flagged as such.
    const y2024 = years.find((y) => y.year === 2024)!
    expect(y2024.complete).toBe(false)
    expect(y2024.monthsPresent).toBe(1)
  })

  it('leaves the range null when no month clears the volume floor, but still counts sales', () => {
    const points: PriceHistoryPoint[] = [
      p('2021-01-01', 300_000, MONTHLY_VOLUME_FLOOR - 1),
      p('2021-02-01', 310_000, 1),
    ]
    const [y] = aggregateCityArchive(points)
    expect(y.homesSold).toBe(MONTHLY_VOLUME_FLOOR - 1 + 1)
    expect(y.medianLow).toBeNull()
    expect(y.medianHigh).toBeNull()
  })

  it('is empty for no points', () => {
    expect(aggregateCityArchive([])).toEqual([])
  })
})
