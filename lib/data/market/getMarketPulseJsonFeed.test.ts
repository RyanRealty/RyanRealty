import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SellBendMarket } from '@/lib/data/market-truth/getSellBendMarket'

const { rowMock, detachedMock, paceMock, segmentsMock } = vi.hoisted(() => ({
  rowMock: vi.fn(),
  detachedMock: vi.fn(),
  paceMock: vi.fn(),
  segmentsMock: vi.fn(),
}))

vi.mock('@/lib/data/market/getMarketStatsCacheRows', () => ({
  getMarketPulseRowForGeo: (...args: unknown[]) => rowMock(...args),
}))

vi.mock('@/lib/data/market-truth/getSellBendMarket', () => ({
  getDetachedOverlays: (...args: unknown[]) => detachedMock(...args),
  cityDetachedSlug: (geoSlug: string) =>
    geoSlug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, ''),
}))

vi.mock('@/lib/data/market-truth/public-pace', async () => {
  const actual = await vi.importActual<typeof import('@/lib/data/market-truth/public-pace')>(
    '@/lib/data/market-truth/public-pace',
  )
  return {
    ...actual,
    getPublicDetachedPace: (...args: unknown[]) => paceMock(...args),
  }
})

vi.mock('@/lib/data/market-truth/public-segments', async () => {
  const actual = await vi.importActual<typeof import('@/lib/data/market-truth/public-segments')>(
    '@/lib/data/market-truth/public-segments',
  )
  return {
    ...actual,
    getPublicPlaceSegments: (...args: unknown[]) => segmentsMock(...args),
  }
})

import { getMarketPulseJsonFeed } from './getMarketPulseJsonFeed'

const PULSE_BEND = {
  geo_type: 'city',
  geo_slug: 'bend',
  geo_label: 'Bend',
  active_count: 488,
  pending_count: 112,
  new_count_7d: 14,
  new_count_30d: 51,
  median_list_price: 799_000,
  avg_list_price: 910_000,
  market_health_score: 55,
  market_health_label: 'Warm',
  updated_at: '2026-08-23T10:00:00Z',
  months_of_supply: 3.54,
  absorption_rate_pct: 12,
  pending_to_active_ratio: 0.23,
  median_sale_to_list: 0.99,
  pct_sold_over_asking: 18,
  pct_sold_under_asking: 40,
  pct_sold_at_asking: 42,
  median_days_to_pending: 18,
  avg_price_drops_active: 0.4,
  price_reduction_share: 0.22,
  expired_rate_90d: 0.05,
  sell_through_rate_90d: 0.7,
  net_inventory_change_30d: -8,
  median_active_dom: 58,
  new_construction_share: 0.1,
  sold_count_30d: 90,
  sold_count_90d: 270,
  median_close_price_90d: 750_000,
  property_type: 'A',
  methodology_version: 'v3-2026-05-07',
}

const MT_BEND: SellBendMarket = {
  activeCount: 775,
  monthsOfSupply: 4.45,
  mosLabel: '4.5',
  verdictKind: 'balanced',
  verdictLabel: 'balanced market',
  medianListPrice: 825_000,
  computedAt: '2026-08-23T12:00:00Z',
  completeThrough: '2026-08-22',
}

function found(result: Awaited<ReturnType<typeof getMarketPulseJsonFeed>>) {
  if (result.status !== 'found') throw new Error(`expected found, got ${result.status}`)
  return result
}

beforeEach(() => {
  rowMock.mockReset()
  detachedMock.mockReset()
  paceMock.mockReset()
  segmentsMock.mockReset()
  segmentsMock.mockResolvedValue([])
  paceMock.mockResolvedValue({
    daysToContract: null,
    daysToClose: null,
    closedCount: null,
    newListings: null,
    priceCutShare: null,
    medianPriceCut: null,
    saleToOriginal: null,
    saleToFinal: null,
    yoyMedian: null,
    yoySold: null,
    cashShare: null,
    medianClose: null,
    medianPpsf: null,
    pendingCount: null,
    medianAgeActive: null,
  })
})

describe('getMarketPulseJsonFeed', () => {
  it('overlays city Market Truth when the detached cell is present', async () => {
    rowMock.mockResolvedValue(PULSE_BEND)
    detachedMock.mockResolvedValue(
      new Map([
        [
          'city:bend',
          {
            headlines: MT_BEND,
            inventory: {
              activeCount: MT_BEND.activeCount,
              medianListPrice: MT_BEND.medianListPrice,
              computedAt: MT_BEND.computedAt,
            },
          },
        ],
      ]),
    )

    const result = found(await getMarketPulseJsonFeed({ geoType: 'city', geoSlug: 'bend' }))
    expect(detachedMock).toHaveBeenCalled()
    expect(result.figures.activeListings).toBe(775)
    expect(result.figures.monthsOfSupply).toBe(4.45)
    expect(result.figures.marketHealthLabel).toBe('balanced market')
    expect(result.methodology.verdict).toBe('balanced market')
    expect(result.methodology.verdictKind).toBe('balanced')
    expect(result.figures.medianListPrice).toBe(825_000)
    expect(result.collectedAt).toBe(MT_BEND.computedAt)
    expect(result.leftover).toBeNull()
  })

  it('attaches leftover 12-month pace on city when publishable', async () => {
    rowMock.mockResolvedValue(PULSE_BEND)
    detachedMock.mockResolvedValue(
      new Map([
        [
          'city:bend',
          {
            headlines: MT_BEND,
            inventory: {
              activeCount: MT_BEND.activeCount,
              medianListPrice: MT_BEND.medianListPrice,
              computedAt: MT_BEND.computedAt,
            },
          },
        ],
      ]),
    )
    paceMock.mockResolvedValue({
      daysToContract: 28,
      daysToClose: null,
      closedCount: 2095,
      newListings: null,
      priceCutShare: null,
      medianPriceCut: null,
      saleToOriginal: 0.969,
      saleToFinal: null,
      yoyMedian: -0.019,
      yoySold: null,
      cashShare: null,
      medianClose: 760000,
      medianPpsf: null,
      pendingCount: 311,
      medianAgeActive: null,
    })

    const result = found(await getMarketPulseJsonFeed({ geoType: 'city', geoSlug: 'bend' }))
    expect(paceMock).toHaveBeenCalledWith({ geoType: 'city', geoSlug: 'bend' })
    expect(result.leftover?.daysToContract).toBe(28)
    expect(result.leftover?.pendingCount).toBe(311)
    expect(result.leftover?.closedCount).toBe(2095)
    expect(result.note).toMatch(/Leftover detached pace/)
    expect(result.figures.soldLast30Days).toBe(90)
  })

  it('attaches extra product types on city when publishable', async () => {
    rowMock.mockResolvedValue(PULSE_BEND)
    detachedMock.mockResolvedValue(
      new Map([
        [
          'city:bend',
          {
            headlines: MT_BEND,
            inventory: {
              activeCount: MT_BEND.activeCount,
              medianListPrice: MT_BEND.medianListPrice,
              computedAt: MT_BEND.computedAt,
            },
          },
        ],
      ]),
    )
    segmentsMock.mockResolvedValue([
      {
        segment: 'condo',
        activeCount: 66,
        medianList: 326000,
        monthsOfSupply: 12.8,
        verdict: 'buyer',
        pendingCount: 5,
        closedCount: 32,
        sampleN: 40,
      },
    ])

    const result = found(await getMarketPulseJsonFeed({ geoType: 'city', geoSlug: 'bend' }))
    expect(segmentsMock).toHaveBeenCalledWith({ geoType: 'city', geoSlug: 'bend' })
    expect(result.extraSegments).toEqual([
      {
        segment: 'condo',
        activeCount: 66,
        medianList: 326000,
        monthsOfSupply: 12.8,
        verdict: 'buyer',
        pendingCount: 5,
        closedCount: 32,
      },
    ])
    expect(result.note).toMatch(/Extra product types/)
  })

  it('inventory overlays when MOS is below min_n', async () => {
    rowMock.mockResolvedValue({ ...PULSE_BEND, geo_slug: 'terrebonne', geo_label: 'Terrebonne' })
    detachedMock.mockResolvedValue(
      new Map([
        [
          'city:terrebonne',
          {
            headlines: null,
            inventory: {
              activeCount: 51,
              medianListPrice: 799_000,
              computedAt: '2026-08-23T12:00:00Z',
            },
          },
        ],
      ]),
    )

    const result = found(await getMarketPulseJsonFeed({ geoType: 'city', geoSlug: 'terrebonne' }))
    expect(result.figures.activeListings).toBe(51)
    expect(result.figures.medianListPrice).toBe(799_000)
    expect(result.figures.monthsOfSupply).toBeNull()
    expect(result.figures.marketHealthLabel).toBeNull()
    expect(result.methodology.verdictKind).toBe('unknown')
    expect(result.figures.pendingListings).toBe(112)
  })

  it('city miss withholds the three headlines rather than pulse 488 / 3.54 / seller', async () => {
    rowMock.mockResolvedValue(PULSE_BEND)
    detachedMock.mockResolvedValue(new Map())

    const result = found(await getMarketPulseJsonFeed({ geoType: 'city', geoSlug: 'bend' }))
    expect(result.figures.activeListings).toBeNull()
    expect(result.figures.monthsOfSupply).toBeNull()
    expect(result.figures.marketHealthLabel).toBeNull()
    expect(result.methodology.verdict).toBe('unknown')
    expect(result.methodology.verdictKind).toBe('unknown')
    expect(result.figures.activeListings).not.toBe(488)
    expect(result.figures.monthsOfSupply).not.toBe(3.54)
    expect(result.methodology.verdict).not.toMatch(/seller/)
    expect(result.figures.pendingListings).toBe(112)
    expect(result.figures.medianListPrice).toBeNull()
    expect(result.figures.marketHealthScore).toBe(55)
    expect(result.note).toMatch(/withheld/)
  })

  it('region miss withholds the same three headlines', async () => {
    rowMock.mockResolvedValue({
      ...PULSE_BEND,
      geo_type: 'region',
      geo_slug: 'central-oregon',
      geo_label: 'Central Oregon',
    })
    detachedMock.mockResolvedValue(new Map())

    const result = found(
      await getMarketPulseJsonFeed({ geoType: 'region', geoSlug: 'central-oregon' }),
    )
    expect(detachedMock).toHaveBeenCalled()
    expect(result.figures.activeListings).toBeNull()
    expect(result.figures.monthsOfSupply).toBeNull()
    expect(result.figures.marketHealthLabel).toBeNull()
    expect(result.methodology.verdictKind).toBe('unknown')
  })

  it('treats a detached-read throw as a miss (withhold, never throw, never pulse headlines)', async () => {
    rowMock.mockResolvedValue(PULSE_BEND)
    detachedMock.mockRejectedValue(new Error('market_metric timeout'))

    const result = found(await getMarketPulseJsonFeed({ geoType: 'city', geoSlug: 'bend' }))
    expect(result.figures.activeListings).toBeNull()
    expect(result.figures.monthsOfSupply).toBeNull()
    expect(result.methodology.verdictKind).toBe('unknown')
  })

  it('neighborhood overlays leftover and withholds pulse MOS unless headlines assemble', async () => {
    rowMock.mockResolvedValue({
      ...PULSE_BEND,
      geo_type: 'neighborhood',
      geo_slug: 'tetherow',
      geo_label: 'Tetherow',
      active_count: 35,
      months_of_supply: 4.6,
      market_health_label: 'Cool',
    })
    detachedMock.mockResolvedValue(
      new Map([
        [
          'neighborhood:tetherow',
          {
            headlines: null,
            inventory: {
              activeCount: 19,
              medianListPrice: 1_895_000,
              computedAt: '2026-08-23T12:00:00Z',
            },
          },
        ],
      ]),
    )
    paceMock.mockResolvedValue({
      daysToContract: 44,
      daysToClose: null,
      closedCount: 48,
      newListings: null,
      priceCutShare: null,
      medianPriceCut: null,
      saleToOriginal: null,
      saleToFinal: null,
      yoyMedian: null,
      yoySold: null,
      cashShare: null,
      medianClose: null,
      medianPpsf: null,
      pendingCount: 7,
      medianAgeActive: null,
    })

    const result = found(
      await getMarketPulseJsonFeed({ geoType: 'neighborhood', geoSlug: 'tetherow' }),
    )
    expect(detachedMock).toHaveBeenCalled()
    expect(paceMock).toHaveBeenCalled()
    expect(result.leftover?.pendingCount).toBe(7)
    expect(result.leftover?.daysToContract).toBe(44)
    expect(result.figures.activeListings).toBe(19)
    expect(result.figures.monthsOfSupply).toBeNull()
    expect(result.methodology.verdictKind).toBe('unknown')
  })

  it('neighborhood with a null pulse MOS does not invent MOS from pulse', async () => {
    rowMock.mockResolvedValue({
      ...PULSE_BEND,
      geo_type: 'neighborhood',
      geo_slug: 'awbrey-butte',
      geo_label: 'Awbrey Butte',
      active_count: 12,
      months_of_supply: null,
      market_health_label: 'Warm',
    })
    detachedMock.mockResolvedValue(new Map())

    const result = found(
      await getMarketPulseJsonFeed({ geoType: 'neighborhood', geoSlug: 'awbrey-butte' }),
    )
    expect(result.figures.monthsOfSupply).toBeNull()
    expect(result.figures.activeListings).toBeNull()
    expect(result.methodology.verdictKind).toBe('unknown')
  })

  it('pulse row miss is not_found (unchanged)', async () => {
    rowMock.mockResolvedValue(null)
    const result = await getMarketPulseJsonFeed({ geoType: 'city', geoSlug: 'bend' })
    expect(result.status).toBe('not_found')
    expect(result.figures).toBeNull()
    expect(detachedMock).not.toHaveBeenCalled()
  })

  it('pulse read throw is degraded with all figures null', async () => {
    rowMock.mockRejectedValue(new Error('pooler 25P02'))
    const result = await getMarketPulseJsonFeed({ geoType: 'city', geoSlug: 'bend' })
    expect(result.status).toBe('degraded')
    expect(result.figures).toBeNull()
    expect(detachedMock).not.toHaveBeenCalled()
  })
})

describe('getMarketPulseJsonFeed source', () => {
  it('city/region miss withholds headlines; neighborhood does not invent MOS', () => {
    const src = readFileSync(resolve('lib/data/market/getMarketPulseJsonFeed.ts'), 'utf8')
    expect(src).toMatch(/getDetachedOverlays/)
    expect(src).toMatch(/applyJsonFeedDetachedOrWithhold/)
    expect(src).toMatch(/activeListings = null/)
    expect(src).toMatch(/monthsOfSupply = null/)
    expect(src).toMatch(/marketHealthLabel = null/)
    expect(src).toMatch(/geoType === 'city' \|\| geoType === 'region' \|\| geoType === 'neighborhood'/)
    expect(src).toMatch(/getPublicDetachedPace/)
    expect(src).toMatch(/readJsonFeedLeftover/)
    expect(src).toMatch(/getPublicPlaceSegments/)
    expect(src).toMatch(/readJsonFeedExtraSegments/)
    expect(src).not.toMatch(/monthsOfSupply\(/)
  })
})
