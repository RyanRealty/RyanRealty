import { describe, expect, it } from 'vitest'
import {
  latestCompleteQuarter,
  mapCityQuarterSaleToAskRow,
  pairCityQuarterRows,
  type CityQuarterSaleToAskRow,
} from './getCityQuarterSaleToAsk'

describe('mapCityQuarterSaleToAskRow', () => {
  it('maps a numeric-string median and keeps the ratio grain', () => {
    const row = mapCityQuarterSaleToAskRow({
      city_slug: 'bend',
      city: 'Bend',
      year: 2026,
      closings: 514,
      median_sale_to_original: '0.9845',
    })
    expect(row).toEqual({
      citySlug: 'bend',
      city: 'Bend',
      year: 2026,
      closings: 514,
      medianSaleToOriginal: 0.9845,
    })
  })

  it('refuses rows without a usable median, slug, year, or closings', () => {
    const base = {
      city_slug: 'bend',
      city: 'Bend',
      year: 2026,
      closings: 10,
      median_sale_to_original: 0.98 as number | string | null,
    }
    expect(mapCityQuarterSaleToAskRow({ ...base, median_sale_to_original: null })).toBeNull()
    expect(mapCityQuarterSaleToAskRow({ ...base, median_sale_to_original: 0 })).toBeNull()
    expect(mapCityQuarterSaleToAskRow({ ...base, city_slug: '  ' })).toBeNull()
    expect(mapCityQuarterSaleToAskRow({ ...base, year: 2026.5 })).toBeNull()
    expect(mapCityQuarterSaleToAskRow({ ...base, closings: 0 })).toBeNull()
  })
})

describe('latestCompleteQuarter', () => {
  it('names the prior quarter mid-year and rolls to Q4 of last year in Q1', () => {
    expect(latestCompleteQuarter(new Date('2026-08-19T12:00:00Z'))).toEqual({ quarter: 2, year: 2026 })
    expect(latestCompleteQuarter(new Date('2026-11-02T12:00:00Z'))).toEqual({ quarter: 3, year: 2026 })
    expect(latestCompleteQuarter(new Date('2026-02-10T12:00:00Z'))).toEqual({ quarter: 4, year: 2025 })
    expect(latestCompleteQuarter(new Date('2026-04-01T00:00:00Z'))).toEqual({ quarter: 1, year: 2026 })
  })
})

describe('pairCityQuarterRows', () => {
  const rows: CityQuarterSaleToAskRow[] = [
    { citySlug: 'bend', city: 'Bend', year: 2026, closings: 514, medianSaleToOriginal: 0.9845 },
    { citySlug: 'bend', city: 'Bend', year: 2025, closings: 574, medianSaleToOriginal: 0.9779 },
    { citySlug: 'redmond', city: 'Redmond', year: 2026, closings: 180, medianSaleToOriginal: 0.9875 },
    { citySlug: 'redmond', city: 'Redmond', year: 2025, closings: 211, medianSaleToOriginal: 0.9991 },
    // Only one side present — a dumbbell needs both ends.
    { citySlug: 'culver', city: 'Culver', year: 2026, closings: 6, medianSaleToOriginal: 0.9801 },
    // Stale year outside the pair — ignored.
    { citySlug: 'bend', city: 'Bend', year: 2024, closings: 600, medianSaleToOriginal: 0.97 },
  ]

  it('pairs current with prior for the same quarter and drops one-sided cities', () => {
    const pairs = pairCityQuarterRows(rows, { quarter: 2, currentYear: 2026 })
    expect(pairs.map((p) => p.citySlug)).toEqual(['redmond', 'bend'])
    const bend = pairs.find((p) => p.citySlug === 'bend')!
    expect(bend.currentYear).toBe(2026)
    expect(bend.priorYear).toBe(2025)
    expect(bend.currentMedian).toBe(0.9845)
    expect(bend.priorMedian).toBe(0.9779)
    expect(bend.currentClosings).toBe(514)
    expect(bend.priorClosings).toBe(574)
  })

  it('sorts by current median descending — the chart-room sort', () => {
    const pairs = pairCityQuarterRows(rows, { quarter: 2, currentYear: 2026 })
    expect(pairs[0]!.currentMedian).toBeGreaterThan(pairs[1]!.currentMedian)
  })
})
