import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_PUBLIC_PACE } from '@/lib/data/market-truth/public-pace'

const { detailMock, leftoverMock, pulseMock, overlaysMock } = vi.hoisted(() => ({
  detailMock: vi.fn(),
  leftoverMock: vi.fn(),
  pulseMock: vi.fn(),
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

import {
  buildCityReportSnapshot,
  citySlugCandidates,
  cityUrlSlug,
  getCityReportSnapshot,
  hasReportSignal,
  overlayCityReportLeftover,
} from './getCityReportSnapshot'

const SRC = readFileSync(resolve('lib/data/market/getCityReportSnapshot.ts'), 'utf8')

const pulse = {
  activeCount: 500,
  medianListPrice: 815_000,
  monthsOfSupply: 4.1,
  closedLast30Days: 92,
  medianDaysToPending: 38,
  refreshedAt: '2026-07-22T10:00:00Z',
}

const detail = {
  medianSalePrice: 780_000,
  soldCount: 1_240,
  medianDom: 41,
  yoyMedianPriceDeltaPct: 2.1,
  periodStart: '2025-07-22',
  periodEnd: '2026-07-21',
  updatedAt: '2026-07-22T06:00:00Z',
}

describe('citySlugCandidates', () => {
  it('returns space-separated first (the live city-page spelling), hyphenated second', () => {
    expect(citySlugCandidates('La Pine')).toEqual(['la pine', 'la-pine'])
  })

  it('single-word cities collapse to one candidate', () => {
    expect(citySlugCandidates('Bend')).toEqual(['bend'])
  })
})

describe('cityUrlSlug', () => {
  it('hyphenates for /cities/<slug> links', () => {
    expect(cityUrlSlug('La Pine')).toBe('la-pine')
    expect(cityUrlSlug('Bend')).toBe('bend')
  })
})

describe('buildCityReportSnapshot', () => {
  it('keeps live and trailing-12-month figures in separate labeled blocks', () => {
    const snap = buildCityReportSnapshot({ cityLabel: 'Bend', geoSlug: 'bend', pulse, detail })
    expect(snap).not.toBeNull()
    expect(snap!.live).toEqual({
      activeCount: 500,
      medianListPrice: 815_000,
      monthsOfSupply: 4.1,
      closedLast30Days: 92,
      medianDaysToPending: 38,
      refreshedAt: '2026-07-22T10:00:00Z',
    })
    expect(snap!.trailing12mo).toEqual({
      medianSalePrice: 780_000,
      soldCount: 1_240,
      medianDom: 41,
      yoyMedianPriceDeltaPct: 2.1,
      periodStart: '2025-07-22',
      periodEnd: '2026-07-21',
      updatedAt: '2026-07-22T06:00:00Z',
    })
    expect(snap!.urlSlug).toBe('bend')
  })

  it('carries the cache row period bounds as date-only strings (the §0 window label)', () => {
    const snap = buildCityReportSnapshot({
      cityLabel: 'Bend',
      geoSlug: 'bend',
      pulse: null,
      detail: { ...detail, periodStart: '2025-07-22T00:00:00Z', periodEnd: '2026-07-21T00:00:00Z' },
    })
    expect(snap!.trailing12mo!.periodStart).toBe('2025-07-22')
    expect(snap!.trailing12mo!.periodEnd).toBe('2026-07-21')
  })

  it('omits the city entirely when both paths are empty (honest empty, never dashes)', () => {
    expect(
      buildCityReportSnapshot({ cityLabel: 'Bend', geoSlug: 'bend', pulse: null, detail: null }),
    ).toBeNull()
  })

  it('a missing pulse row yields a null live block, not fabricated zeros', () => {
    const snap = buildCityReportSnapshot({ cityLabel: 'Tumalo', geoSlug: 'tumalo', pulse: null, detail })
    expect(snap!.live).toBeNull()
    expect(snap!.trailing12mo!.medianSalePrice).toBe(780_000)
  })

  it('a missing cache row yields a null trailing block, not fabricated zeros', () => {
    const snap = buildCityReportSnapshot({ cityLabel: 'Tumalo', geoSlug: 'tumalo', pulse, detail: null })
    expect(snap!.trailing12mo).toBeNull()
    expect(snap!.live!.activeCount).toBe(500)
  })

  it('hasReportSignal drops all-zero cities (no price, no inventory, no sales)', () => {
    const dead = buildCityReportSnapshot({
      cityLabel: 'Tumalo',
      geoSlug: 'tumalo',
      pulse: { ...pulse, activeCount: 0, medianListPrice: null, monthsOfSupply: null, closedLast30Days: 0, medianDaysToPending: null },
      detail: { ...detail, medianSalePrice: null, soldCount: 0, medianDom: null, yoyMedianPriceDeltaPct: null },
    })
    expect(dead).not.toBeNull()
    expect(hasReportSignal(dead!)).toBe(false)
  })

  it('hasReportSignal keeps a city with any one real signal', () => {
    const base = {
      cityLabel: 'Terrebonne',
      geoSlug: 'terrebonne',
      pulse: { ...pulse, activeCount: 0, medianListPrice: null, monthsOfSupply: null, closedLast30Days: 0, medianDaysToPending: null },
      detail: { ...detail, medianSalePrice: null, soldCount: 0, medianDom: null, yoyMedianPriceDeltaPct: null },
    }
    const inventoryOnly = buildCityReportSnapshot({
      ...base,
      pulse: { ...base.pulse, activeCount: 7 },
    })
    expect(hasReportSignal(inventoryOnly!)).toBe(true)
    const priceOnly = buildCityReportSnapshot({
      ...base,
      detail: { ...base.detail, medianSalePrice: 563_000 },
    })
    expect(hasReportSignal(priceOnly!)).toBe(true)
    const salesOnly = buildCityReportSnapshot({
      ...base,
      detail: { ...base.detail, soldCount: 6 },
    })
    expect(hasReportSignal(salesOnly!)).toBe(true)
  })

  it('non-finite numbers are nulled, never rendered', () => {
    const snap = buildCityReportSnapshot({
      cityLabel: 'Bend',
      geoSlug: 'bend',
      pulse: { ...pulse, medianListPrice: Number.NaN as unknown as number },
      detail,
    })
    expect(snap!.live!.medianListPrice).toBeNull()
  })
})

describe('overlayCityReportLeftover', () => {
  const leftover = {
    ...EMPTY_PUBLIC_PACE,
    medianClose: 760_000,
    closedCount: 2095,
    yoyMedian: -0.019,
    daysToContract: 28,
  }

  it('overlays leftover medianClose/closedCount onto trailing 12-month sold/median', () => {
    const snap = overlayCityReportLeftover(
      buildCityReportSnapshot({ cityLabel: 'Bend', geoSlug: 'bend', pulse, detail }),
      leftover,
    )
    expect(snap!.trailing12mo!.medianSalePrice).toBe(760_000)
    expect(snap!.trailing12mo!.soldCount).toBe(2095)
    expect(snap!.trailing12mo!.medianDom).toBe(41)
    expect(snap!.live!.closedLast30Days).toBe(92)
    expect(snap!.trailing12mo!.medianSalePrice).not.toBe(780_000)
    expect(snap!.trailing12mo!.soldCount).not.toBe(1_240)
  })

  it('overlays leftover yoyMedian share as yoyMedianPriceDeltaPct percent', () => {
    const snap = overlayCityReportLeftover(
      buildCityReportSnapshot({ cityLabel: 'Bend', geoSlug: 'bend', pulse, detail }),
      leftover,
    )
    expect(snap!.trailing12mo!.yoyMedianPriceDeltaPct).toBeCloseTo(-1.9, 5)
    expect(snap!.trailing12mo!.yoyMedianPriceDeltaPct).not.toBe(2.1)
  })

  it('omits cache trailing sold/median/yoy on leftover miss — unknown is not zero', () => {
    const snap = overlayCityReportLeftover(
      buildCityReportSnapshot({ cityLabel: 'Bend', geoSlug: 'bend', pulse, detail }),
      EMPTY_PUBLIC_PACE,
    )
    expect(snap!.trailing12mo!.medianSalePrice).toBeNull()
    expect(snap!.trailing12mo!.soldCount).toBeNull()
    expect(snap!.trailing12mo!.yoyMedianPriceDeltaPct).toBeNull()
    expect(snap!.trailing12mo!.soldCount).not.toBe(0)
    expect(snap!.trailing12mo!.medianSalePrice).not.toBe(780_000)
    expect(snap!.trailing12mo!.yoyMedianPriceDeltaPct).not.toBe(2.1)
    expect(snap!.trailing12mo!.medianDom).toBe(41)
    expect(snap!.live!.activeCount).toBe(500)
  })

  it('does not map leftover days-to-contract onto medianDom', () => {
    const snap = overlayCityReportLeftover(
      buildCityReportSnapshot({ cityLabel: 'Bend', geoSlug: 'bend', pulse, detail }),
      leftover,
    )
    expect(snap!.trailing12mo!.medianDom).toBe(41)
    expect(snap!.trailing12mo!.medianDom).not.toBe(28)
  })
})

describe('getCityReportSnapshot leftover overlay', () => {
  const leftover = {
    ...EMPTY_PUBLIC_PACE,
    medianClose: 760_000,
    closedCount: 2095,
    yoyMedian: -0.019,
    daysToContract: 28,
  }

  beforeEach(() => {
    pulseMock.mockReset()
    detailMock.mockReset()
    leftoverMock.mockReset()
    overlaysMock.mockReset()
    pulseMock.mockResolvedValue(pulse)
    detailMock.mockResolvedValue(detail)
    leftoverMock.mockResolvedValue(leftover)
    overlaysMock.mockResolvedValue(new Map())
  })

  it('singular path source-contracts leftover overlay so cache 12-month close cannot print', () => {
    const start = SRC.indexOf('export async function getCityReportSnapshot(')
    const end = SRC.indexOf('export async function getCityReportSnapshots(')
    const singular = SRC.slice(start, end)
    expect(singular).toMatch(/overlayCityReportLeftover\(/)
    expect(singular).toMatch(/readCityLeftover/)
  })

  it('singular getCityReportSnapshot overlays leftover 12-month close and YoY', async () => {
    const snap = await getCityReportSnapshot('Bend')
    expect(leftoverMock).toHaveBeenCalled()
    expect(snap!.trailing12mo!.medianSalePrice).toBe(760_000)
    expect(snap!.trailing12mo!.soldCount).toBe(2095)
    expect(snap!.trailing12mo!.yoyMedianPriceDeltaPct).toBeCloseTo(-1.9, 5)
    expect(snap!.trailing12mo!.medianDom).toBe(41)
    expect(snap!.live).toBeNull()
    expect(snap!.trailing12mo!.medianSalePrice).not.toBe(780_000)
    expect(snap!.trailing12mo!.soldCount).not.toBe(1_240)
    expect(snap!.trailing12mo!.yoyMedianPriceDeltaPct).not.toBe(2.1)
  })

  it('singular leftover miss nulls trailing median/sold/yoy and omits live HUD-family', async () => {
    leftoverMock.mockResolvedValue(EMPTY_PUBLIC_PACE)
    const snap = await getCityReportSnapshot('Bend')
    expect(snap!.trailing12mo!.medianSalePrice).toBeNull()
    expect(snap!.trailing12mo!.soldCount).toBeNull()
    expect(snap!.trailing12mo!.yoyMedianPriceDeltaPct).toBeNull()
    expect(snap!.trailing12mo!.medianDom).toBe(41)
    expect(snap!.live).toBeNull()
  })

  it('overlays leftover HUD onto live closed30 / DTP / inventory', async () => {
    leftoverMock.mockResolvedValue({
      ...leftover,
      closedCount30d: 180,
      daysToPending90d: 19,
      pendingCount: 316,
    })
    overlaysMock.mockResolvedValue(
      new Map([
        [
          'city:bend',
          {
            headlines: {
              activeCount: 768,
              monthsOfSupply: 4.4,
              medianListPrice: 925_000,
              computedAt: '2026-08-24T00:00:00Z',
            },
            inventory: { activeCount: 768, medianListPrice: 925_000, computedAt: '2026-08-24T00:00:00Z' },
          },
        ],
      ]),
    )
    const snap = await getCityReportSnapshot('Bend')
    expect(snap!.live!.activeCount).toBe(768)
    expect(snap!.live!.closedLast30Days).toBe(180)
    expect(snap!.live!.medianDaysToPending).toBe(19)
    expect(snap!.live!.medianListPrice).toBe(925_000)
    expect(snap!.live!.closedLast30Days).not.toBe(92)
  })
})

