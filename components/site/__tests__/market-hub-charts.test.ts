import { describe, it, expect } from 'vitest'
import { formatPriceCompact } from '@/lib/format/money'
import {
  buildClosedCountChart,
  buildMonthlyMedianChart,
  buildRegionMedianChart,
  dropInProgressMonth,
  lastCompleteMonths,
  withChartId,
} from '@/app/housing-market/_v3/market-charts'

describe('dropInProgressMonth', () => {
  it('drops the Pacific in-progress month and keeps completed ones', () => {
    const rows = [
      { periodStart: '2025-06-01', medianSalePrice: 500000 },
      { periodStart: '2025-07-01', medianSalePrice: 510000 },
    ]
    expect(dropInProgressMonth(rows, '2025-07').map((r) => r.periodStart)).toEqual(['2025-06-01'])
  })

  it('returns a copy when the key is blank', () => {
    const rows = [{ periodStart: '2025-06-01', medianSalePrice: 1 }]
    expect(dropInProgressMonth(rows, '')).toEqual(rows)
    expect(dropInProgressMonth(rows, '')).not.toBe(rows)
  })
})

describe('buildMonthlyMedianChart', () => {
  it('formats every reading through formatPriceCompact and needs two points', () => {
    const chart = buildMonthlyMedianChart(
      [
        { periodStart: '2025-01-01', medianSalePrice: 500000 },
        { periodStart: '2025-02-01', medianSalePrice: 520000 },
      ],
      'Median sale price, completed months',
    )
    expect(chart).toBeDefined()
    expect(chart?.caption).toBe('Median sale price, completed months')
    const points = chart?.series?.[0]?.points ?? []
    expect(points).toHaveLength(2)
    expect(points[0]?.label).toBe(formatPriceCompact(500000))
    expect(points[1]?.label).toBe(formatPriceCompact(520000))
    expect(points[0]?.tick).toBe('Jan 2025')
    expect(String(points[0]?.label)).not.toMatch(/^[0-9]+$/)
  })

  it('returns undefined for one finite month', () => {
    expect(
      buildMonthlyMedianChart([{ periodStart: '2025-01-01', medianSalePrice: 500000 }], 'Median sale'),
    ).toBeUndefined()
  })

  it('skips null, zero, and non-finite prices', () => {
    const chart = buildMonthlyMedianChart(
      [
        { periodStart: '2025-01-01', medianSalePrice: null },
        { periodStart: '2025-02-01', medianSalePrice: 0 },
        { periodStart: '2025-03-01', medianSalePrice: 480000 },
        { periodStart: '2025-04-01', medianSalePrice: 490000 },
      ],
      'Median sale price, completed months',
    )
    expect(chart?.series?.[0]?.points).toHaveLength(2)
  })
})

describe('buildRegionMedianChart', () => {
  it('overlays recent years when each year can plot, with caller-formatted labels', () => {
    const monthly = [
      { periodStart: '2024-01-01', medianSalePrice: 450000, soldCount: 20 },
      { periodStart: '2024-06-01', medianSalePrice: 460000, soldCount: 22 },
      { periodStart: '2025-01-01', medianSalePrice: 500000, soldCount: 18 },
      { periodStart: '2025-06-01', medianSalePrice: 510000, soldCount: 19 },
    ]
    const chart = buildRegionMedianChart(monthly)
    expect(chart?.caption).toBe('Median sale price by month, recent years')
    expect(chart?.series?.map((s) => s.name)).toEqual(['2024', '2025'])
    expect(chart?.series?.[0]?.points[0]?.label).toBe(formatPriceCompact(450000))
    expect(chart?.series?.[0]?.points[0]?.tick).toBe('Jan')
  })

  it('falls back to one chronological line when overlay years cannot plot', () => {
    const chart = buildRegionMedianChart([
      { periodStart: '2024-12-01', medianSalePrice: 500000, soldCount: 10 },
      { periodStart: '2025-01-01', medianSalePrice: 505000, soldCount: 11 },
    ])
    expect(chart?.caption).toBe('Median sale price, completed months')
    expect(chart?.series).toHaveLength(1)
    expect(chart?.series?.[0]?.name).toBe('Median sale')
    expect(chart?.series?.[0]?.points[0]?.label).toBe(formatPriceCompact(500000))
  })
})

describe('lastCompleteMonths and withChartId', () => {
  it('keeps the last n months oldest first', () => {
    const rows = [
      { periodStart: '2025-01-01' },
      { periodStart: '2025-02-01' },
      { periodStart: '2025-03-01' },
    ]
    expect(lastCompleteMonths(rows, 2).map((r) => r.periodStart)).toEqual([
      '2025-02-01',
      '2025-03-01',
    ])
    expect(lastCompleteMonths(rows, 0)).toEqual([])
  })

  it('puts a figure id on a plottable chart and stays undefined when there is no line', () => {
    const chart = buildMonthlyMedianChart(
      [
        { periodStart: '2025-01-01', medianSalePrice: 500000 },
        { periodStart: '2025-02-01', medianSalePrice: 520000 },
      ],
      'Median sale price, last 12 completed months',
    )
    expect(withChartId(chart, 'trailing-median')?.id).toBe('trailing-median')
    expect(withChartId(chart, 'trailing-median')?.series?.[0]?.points[0]?.label).toBe(
      formatPriceCompact(500000),
    )
    expect(withChartId(undefined, 'trailing-median')).toBeUndefined()
  })
})

describe('buildClosedCountChart', () => {
  it('plots sold counts oldest first with locale labels, not raw numbers as ticks', () => {
    const chart = buildClosedCountChart(
      [
        { year: 2024, soldCount: 2100 },
        { year: 2023, soldCount: 1900 },
        { year: 2022, soldCount: 0 },
      ],
      'Closed single-family sales by year, Central Oregon',
    )
    expect(chart?.series?.[0]?.points.map((p) => p.tick)).toEqual(['2023', '2024'])
    expect(chart?.series?.[0]?.points.map((p) => p.label)).toEqual(['1,900', '2,100'])
    expect(chart?.series?.[0]?.name).toBe('Homes sold')
  })

  it('returns undefined below two finite years', () => {
    expect(buildClosedCountChart([{ year: 2024, soldCount: 10 }], 'Closed sales')).toBeUndefined()
  })
})
