import { describe, expect, it } from 'vitest'
import { latestSaleMedian, sameMonthYearBefore } from './latest-sale-median'

describe('latestSaleMedian', () => {
  const series = [
    { periodStart: '2025-07-01', medianSalePrice: 780_000 },
    { periodStart: '2025-08-01', medianSalePrice: 795_000 },
    { periodStart: '2026-06-01', medianSalePrice: null },
    { periodStart: '2026-07-01', medianSalePrice: 765_000 },
    { periodStart: '2026-08-01', medianSalePrice: 750_000 },
    { periodStart: '2026-09-01', medianSalePrice: 910_000 },
  ]

  it('takes the latest complete month', () => {
    const r = latestSaleMedian(series, '2026-09')
    expect(r).toEqual({ value: 750_000, monthLabel: 'August 2026', monthKey: '2026-08' })
  })

  it('never answers with the month in progress', () => {
    expect(latestSaleMedian(series, '2026-09')?.monthKey).toBe('2026-08')
    expect(latestSaleMedian(series)?.monthKey).toBe('2026-09')
  })

  it('skips null and non-positive months rather than inventing one', () => {
    const r = latestSaleMedian(
      [
        { periodStart: '2026-07-01', medianSalePrice: 0 },
        { periodStart: '2026-08-01', medianSalePrice: null },
      ],
      '2026-09',
    )
    expect(r).toBeNull()
  })
})

describe('sameMonthYearBefore', () => {
  const months = [
    { periodStart: '2025-09-01', medianSalePrice: 766_750 },
    { periodStart: '2026-08-01', medianSalePrice: 749_500 },
    { periodStart: '2026-09-01', medianSalePrice: 759_000 },
  ]
  it('reads the same month a year earlier off the same series', () => {
    expect(sameMonthYearBefore(months, '2026-09')).toEqual({ value: 766_750, monthLabel: 'September 2025', monthKey: '2025-09' })
  })
  it('returns null when that month is missing or empty', () => {
    expect(sameMonthYearBefore(months, '2026-08')).toBeNull()
    expect(sameMonthYearBefore([{ periodStart: '2025-09-01', medianSalePrice: null }], '2026-09')).toBeNull()
    expect(sameMonthYearBefore(months, 'bad')).toBeNull()
  })
})
