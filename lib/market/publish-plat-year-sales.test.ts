import { describe, expect, it } from 'vitest'
import {
  currentYearSalesRow,
  publishPlatYtdStats,
} from './publish-plat-year-sales'

const ridgeYtd = {
  soldCount: 9,
  medianSalePrice: 850_000,
  medianDaysOnMarket: 26,
  yoyChangePct: -3.9,
}

const ridge2026 = {
  year: 2026,
  closedCount: 17,
  medianClosePrice: 575_000,
}

describe('publishPlatYtdStats', () => {
  it('withholds when YTD sold count contradicts the current-year table (Ridge founding)', () => {
    expect(
      publishPlatYtdStats({
        stats: ridgeYtd,
        currentYear: ridge2026,
      }),
    ).toBeNull()
  })

  it('withholds when nearest-thousand medians disagree even if counts match', () => {
    expect(
      publishPlatYtdStats({
        stats: { ...ridgeYtd, soldCount: 17 },
        currentYear: ridge2026,
      }),
    ).toBeNull()
  })

  it('publishes YTD when it matches the current-year table', () => {
    expect(
      publishPlatYtdStats({
        stats: { ...ridgeYtd, soldCount: 17, medianSalePrice: 575_400 },
        currentYear: ridge2026,
      }),
    ).toEqual({ ...ridgeYtd, soldCount: 17, medianSalePrice: 575_400 })
  })

  it('publishes YTD when there is no current-year table row to contradict it', () => {
    expect(publishPlatYtdStats({ stats: ridgeYtd, currentYear: null })).toEqual(ridgeYtd)
  })

  it('returns null when the cache row has no sold count or median', () => {
    expect(
      publishPlatYtdStats({
        stats: { soldCount: null, medianSalePrice: null, medianDaysOnMarket: 26, yoyChangePct: -3.9 },
        currentYear: ridge2026,
      }),
    ).toBeNull()
  })
})

describe('currentYearSalesRow', () => {
  it('picks the matching calendar year', () => {
    expect(currentYearSalesRow([ridge2026, { year: 2025, closedCount: 26, medianClosePrice: 787_000 }], 2026)).toEqual(
      ridge2026,
    )
    expect(currentYearSalesRow([ridge2026], 2025)).toBeNull()
  })
})
