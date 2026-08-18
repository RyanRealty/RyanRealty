import { describe, expect, it } from 'vitest'
import {
  completeMonthMedianLabel,
  monthKeyFromPeriodStart,
  publishCompleteMonthMedian,
} from './publish-complete-month-median'

describe('monthKeyFromPeriodStart', () => {
  it('reads YYYY-MM from a cache period_start', () => {
    expect(monthKeyFromPeriodStart('2026-07-01')).toBe('2026-07')
    expect(monthKeyFromPeriodStart('2026-08-01T00:00:00+00:00')).toBe('2026-08')
  })

  it('returns null for empty or short values', () => {
    expect(monthKeyFromPeriodStart(null)).toBeNull()
    expect(monthKeyFromPeriodStart('2026')).toBeNull()
  })
})

describe('completeMonthMedianLabel', () => {
  it('names the calendar month', () => {
    expect(completeMonthMedianLabel('2026-07-01')).toBe('July median sale')
    expect(completeMonthMedianLabel('2026-08-01')).toBe('August median sale')
  })
})

describe('publishCompleteMonthMedian', () => {
  it('publishes this month only when that row has a verified median', () => {
    expect(
      publishCompleteMonthMedian({
        monthly: { medianSalePrice: 755_000, periodStart: '2026-08-01' },
        lastComplete: { medianSalePrice: 740_000, periodStart: '2026-07-01' },
        currentMonthKey: '2026-08',
      }),
    ).toEqual({
      value: 755_000,
      label: 'this month median sale',
      periodStart: '2026-08-01',
      grain: 'current',
    })
  })

  it('falls back to July when August has a sale but a null median (Powell Butte founding case)', () => {
    expect(
      publishCompleteMonthMedian({
        monthly: { medianSalePrice: null, periodStart: '2026-08-01' },
        lastComplete: { medianSalePrice: 1_262_500, periodStart: '2026-07-01' },
        currentMonthKey: '2026-08',
      }),
    ).toEqual({
      value: 1_262_500,
      label: 'July median sale',
      periodStart: '2026-07-01',
      grain: 'complete',
    })
  })

  it('does not label a complete month as this month', () => {
    const published = publishCompleteMonthMedian({
      monthly: { medianSalePrice: 1_262_500, periodStart: '2026-07-01' },
      currentMonthKey: '2026-08',
    })
    expect(published).toEqual({
      value: 1_262_500,
      label: 'July median sale',
      periodStart: '2026-07-01',
      grain: 'complete',
    })
  })

  it('returns null when neither row has a verified median', () => {
    expect(
      publishCompleteMonthMedian({
        monthly: { medianSalePrice: null, periodStart: '2026-08-01' },
        lastComplete: { medianSalePrice: null, periodStart: '2026-07-01' },
        currentMonthKey: '2026-08',
      }),
    ).toBeNull()
  })

  it('returns null for a bad currentMonthKey', () => {
    expect(
      publishCompleteMonthMedian({
        monthly: { medianSalePrice: 1, periodStart: '2026-08-01' },
        currentMonthKey: 'August',
      }),
    ).toBeNull()
  })
})
