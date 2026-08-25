import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_PUBLIC_PACE } from '@/lib/data/market-truth/public-pace'
import type { CityRangeRow } from '@/lib/market/range-periods'

const { detailMock, pulseMock, leftoverMock, overlaysMock } = vi.hoisted(() => ({
  detailMock: vi.fn(),
  pulseMock: vi.fn(),
  leftoverMock: vi.fn(),
  overlaysMock: vi.fn(),
}))

vi.mock('@/lib/data/market/getCityMarketDetail', () => ({
  getCityMarketDetail: (args: unknown) => detailMock(args),
}))
vi.mock('@/lib/data/market/getMarketPulse', () => ({
  getMarketPulse: (args: unknown) => pulseMock(args),
}))
vi.mock('@/lib/data/market-truth/public-pace', async () => {
  const actual = await vi.importActual<typeof import('@/lib/data/market-truth/public-pace')>(
    '@/lib/data/market-truth/public-pace',
  )
  return {
    ...actual,
    getPublicDetachedPace: (...args: unknown[]) => leftoverMock(...args),
  }
})
vi.mock('@/lib/data/market-truth/getSellBendMarket', async () => {
  const actual = await vi.importActual<typeof import('@/lib/data/market-truth/getSellBendMarket')>(
    '@/lib/data/market-truth/getSellBendMarket',
  )
  return {
    ...actual,
    getDetachedOverlays: (...args: unknown[]) => overlaysMock(...args),
  }
})

const { overlayRangeLeftover, getCityRangeRow } = await import('./getCityRangeReport')

const SRC = readFileSync(resolve('lib/data/market/getCityRangeReport.ts'), 'utf8')

const CACHE_30D = {
  soldCount: 137,
  medianSalePrice: 730_000,
  medianDom: 33,
  medianPricePerSqft: 385,
  periodStart: '2026-07-25',
  periodEnd: '2026-08-24',
}

const CACHE_365 = {
  soldCount: 1641,
  medianSalePrice: 719_000,
  medianDom: 25,
  medianPricePerSqft: 385,
  periodStart: '2025-08-24',
  periodEnd: '2026-08-24',
}

const LEFTOVER = {
  ...EMPTY_PUBLIC_PACE,
  closedCount: 2095,
  medianClose: 760_000,
  daysToContract: 28,
  medianPpsf: 400,
}

function rangeRow(overrides: Partial<CityRangeRow> = {}): CityRangeRow {
  return {
    city: 'Bend',
    urlSlug: 'bend',
    soldCount: 137,
    medianSalePrice: 730_000,
    medianDom: 33,
    medianPricePerSqft: 385,
    activeCount: 772,
    sales12mo: 1641,
    monthsOfSupply: 4.5,
    periodStart: '2026-07-25',
    periodEnd: '2026-08-24',
    ...overrides,
  }
}

describe('getCityRangeReport leftover source', () => {
  it('reads leftover closedCount/medianClose/medianPpsf for the 12-month column, not cache rolling_365d sold', () => {
    expect(SRC).toMatch(/getPublicDetachedPace/)
    expect(SRC).toMatch(/leftover\.closedCount/)
    expect(SRC).toMatch(/leftover\.medianClose/)
    expect(SRC).toMatch(/leftover\.medianPpsf/)
    expect(SRC).toMatch(/overlayRangeLeftover/)
    expect(SRC).not.toMatch(/daysToContract/)
  })
})

describe('overlayRangeLeftover', () => {
  it('overlays leftover closedCount onto Sales (12 mo) and leaves 30-day Sold/Median on cache', () => {
    const out = overlayRangeLeftover(rangeRow(), LEFTOVER, 'rolling_30d')
    expect(out.sales12mo).toBe(2095)
    expect(out.soldCount).toBe(137)
    expect(out.medianSalePrice).toBe(730_000)
    expect(out.medianDom).toBe(33)
    expect(out.medianPricePerSqft).toBe(385)
  })

  it('keeps rolling_30d $/sq ft on cache even when leftover medianPpsf is present', () => {
    const out = overlayRangeLeftover(rangeRow({ medianPricePerSqft: 385 }), LEFTOVER, 'rolling_30d')
    expect(out.medianPricePerSqft).toBe(385)
    expect(out.medianPricePerSqft).not.toBe(400)
    expect(out.medianDom).toBe(33)
  })

  it('overlays leftover closedCount and medianClose onto rolling_365d Sold/Median and Sales (12 mo)', () => {
    const out = overlayRangeLeftover(
      rangeRow({
        soldCount: 1641,
        medianSalePrice: 719_000,
        sales12mo: 1641,
        medianDom: 25,
        medianPricePerSqft: 385,
      }),
      LEFTOVER,
      'rolling_365d',
    )
    expect(out.soldCount).toBe(2095)
    expect(out.medianSalePrice).toBe(760_000)
    expect(out.sales12mo).toBe(2095)
    expect(out.medianDom).toBe(25)
    expect(out.medianPricePerSqft).toBe(400)
  })

  it('overlays leftover medianPpsf onto rolling_365d $/sq ft, replacing cache', () => {
    const out = overlayRangeLeftover(
      rangeRow({ medianPricePerSqft: 385, medianDom: 25 }),
      LEFTOVER,
      'rolling_365d',
    )
    expect(out.medianPricePerSqft).toBe(400)
    expect(out.medianPricePerSqft).not.toBe(385)
    expect(out.medianDom).toBe(25)
  })

  it('keeps rolling_90d and ytd Sold/Median/$/sq ft on cache', () => {
    const ninety = overlayRangeLeftover(
      rangeRow({ soldCount: 400, medianSalePrice: 725_000, medianPricePerSqft: 385 }),
      LEFTOVER,
      'rolling_90d',
    )
    expect(ninety.soldCount).toBe(400)
    expect(ninety.medianSalePrice).toBe(725_000)
    expect(ninety.medianPricePerSqft).toBe(385)
    expect(ninety.sales12mo).toBe(2095)
    const ytd = overlayRangeLeftover(
      rangeRow({ soldCount: 1007, medianSalePrice: 725_000, medianPricePerSqft: 385 }),
      LEFTOVER,
      'ytd',
    )
    expect(ytd.soldCount).toBe(1007)
    expect(ytd.medianSalePrice).toBe(725_000)
    expect(ytd.medianPricePerSqft).toBe(385)
    expect(ytd.sales12mo).toBe(2095)
  })

  it('omits 12-month figures on leftover miss — does not keep cache 1,641 / $719k', () => {
    const thirty = overlayRangeLeftover(rangeRow(), EMPTY_PUBLIC_PACE, 'rolling_30d')
    expect(thirty.sales12mo).toBeNull()
    expect(thirty.soldCount).toBe(137)
    expect(thirty.medianSalePrice).toBe(730_000)
    expect(thirty.medianPricePerSqft).toBe(385)
    const year = overlayRangeLeftover(
      rangeRow({ soldCount: 1641, medianSalePrice: 719_000, sales12mo: 1641 }),
      EMPTY_PUBLIC_PACE,
      'rolling_365d',
    )
    expect(year.sales12mo).toBeNull()
    expect(year.soldCount).toBeNull()
    expect(year.medianSalePrice).toBeNull()
    expect(year.soldCount).not.toBe(0)
  })

  it('overlays leftover HUD active/MOS and omits on leftover miss', () => {
    const withHud = overlayRangeLeftover(rangeRow(), LEFTOVER, 'rolling_30d', {
      active: 768,
      monthsSupply: 4.4,
    })
    expect(withHud.activeCount).toBe(768)
    expect(withHud.monthsOfSupply).toBe(4.4)
    const miss = overlayRangeLeftover(rangeRow(), LEFTOVER, 'rolling_30d', {
      active: null,
      monthsSupply: null,
    })
    expect(miss.activeCount).toBeNull()
    expect(miss.monthsOfSupply).toBeNull()
    expect(miss.activeCount).not.toBe(772)
  })

  it('omits rolling_365d $/sq ft on leftover ppsf miss even when cache had a value', () => {
    const year = overlayRangeLeftover(
      rangeRow({ medianPricePerSqft: 385, medianDom: 25 }),
      EMPTY_PUBLIC_PACE,
      'rolling_365d',
    )
    expect(year.medianPricePerSqft).toBeNull()
    expect(year.medianPricePerSqft).not.toBe(385)
    expect(year.medianDom).toBe(25)
  })
})

describe('getCityRangeRow leftover overlay', () => {
  beforeEach(() => {
    detailMock.mockReset()
    pulseMock.mockReset()
    leftoverMock.mockReset()
    leftoverMock.mockResolvedValue({ ...LEFTOVER })
    pulseMock.mockResolvedValue({ activeCount: 772, monthsOfSupply: 4.5 })
    overlaysMock.mockReset()
    overlaysMock.mockResolvedValue(new Map())
  })

  it('default 30-day range keeps cache Sold and overlays leftover onto Sales (12 mo)', async () => {
    detailMock.mockResolvedValue(CACHE_30D)
    const row = await getCityRangeRow('Bend', 'rolling_30d')
    expect(leftoverMock).toHaveBeenCalledWith({ geoType: 'city', geoSlug: 'bend' })
    expect(row!.soldCount).toBe(137)
    expect(row!.medianSalePrice).toBe(730_000)
    expect(row!.sales12mo).toBe(2095)
    expect(row!.medianDom).toBe(33)
  })

  it('rolling_365d overlays leftover onto Sold, Median, Sales (12 mo), and $/sq ft', async () => {
    detailMock.mockResolvedValue(CACHE_365)
    const row = await getCityRangeRow('Bend', 'rolling_365d')
    expect(row!.soldCount).toBe(2095)
    expect(row!.medianSalePrice).toBe(760_000)
    expect(row!.sales12mo).toBe(2095)
    expect(row!.medianDom).toBe(25)
    expect(row!.medianPricePerSqft).toBe(400)
    expect(row!.soldCount).not.toBe(1641)
    expect(row!.medianSalePrice).not.toBe(719_000)
    expect(row!.medianPricePerSqft).not.toBe(385)
  })

  it('does not map leftover days-to-contract onto DOM; 30-day $/sq ft stays cache', async () => {
    detailMock.mockResolvedValue(CACHE_30D)
    const row = await getCityRangeRow('Bend', 'rolling_30d')
    expect(row!.medianDom).toBe(33)
    expect(row!.medianPricePerSqft).toBe(385)
  })

  it('rolling_365d leftover ppsf miss nulls $/sq ft even when cache had 385', async () => {
    leftoverMock.mockResolvedValue({ ...EMPTY_PUBLIC_PACE })
    detailMock.mockResolvedValue(CACHE_365)
    const row = await getCityRangeRow('Bend', 'rolling_365d')
    expect(row!.medianPricePerSqft).toBeNull()
    expect(row!.medianDom).toBe(25)
  })
})
