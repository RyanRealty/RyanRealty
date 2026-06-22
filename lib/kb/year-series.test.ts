import { describe, it, expect } from 'vitest'
import { buildYearSeries } from './year-series'

// buildYearSeries powers the YoY median-price overlay chart (homepage region +
// every city page). Mis-grouping or a stray null draws a misleading line on a
// data surface. Audit p3.2 (data accuracy).
describe('buildYearSeries', () => {
  it('groups by calendar year, sorts months ascending, skips null prices', () => {
    const series = buildYearSeries([
      { periodStart: '2025-03-01', medianSalePrice: 520000, soldCount: 10 },
      { periodStart: '2025-01-01', medianSalePrice: 500000, soldCount: 8 },
      { periodStart: '2025-02-01', medianSalePrice: null, soldCount: 0 },
      { periodStart: '2024-12-01', medianSalePrice: 480000, soldCount: 5 },
    ])
    expect(series.map((s) => s.year)).toEqual([2024, 2025]) // oldest first
    const y2025 = series.find((s) => s.year === 2025)
    expect(y2025?.points.map((p) => p.m)).toEqual([1, 3]) // sorted; Feb dropped (null price)
    expect(y2025?.points[0]).toEqual({ m: 1, value: 500000, soldCount: 8 })
  })

  it('keeps only the last maxYears (newest), oldest first', () => {
    const pts = [2019, 2020, 2021, 2022, 2023, 2024].map((y) => ({
      periodStart: `${y}-06-01`,
      medianSalePrice: 100000 + y,
      soldCount: 1,
    }))
    expect(buildYearSeries(pts, 3).map((s) => s.year)).toEqual([2022, 2023, 2024])
  })

  it('defaults soldCount to null when missing, drops years with no valid point', () => {
    const series = buildYearSeries([
      { periodStart: '2025-05-01', medianSalePrice: 600000 },
      { periodStart: '2024-05-01', medianSalePrice: null },
    ])
    expect(series).toHaveLength(1)
    expect(series[0].year).toBe(2025)
    expect(series[0].points[0].soldCount).toBeNull()
  })
})
