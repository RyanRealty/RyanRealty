import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SellBendMarket } from '@/lib/data/market-truth/getSellBendMarket'

const { rowMock, detachedMock } = vi.hoisted(() => ({
  rowMock: vi.fn(),
  detachedMock: vi.fn(),
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

  it('neighborhood grain keeps pulse MOS — no invented figure, no detached overlay', async () => {
    rowMock.mockResolvedValue({
      ...PULSE_BEND,
      geo_type: 'neighborhood',
      geo_slug: 'tetherow',
      geo_label: 'Tetherow',
      active_count: 35,
      months_of_supply: 4.6,
      market_health_label: 'Cool',
    })

    const result = found(
      await getMarketPulseJsonFeed({ geoType: 'neighborhood', geoSlug: 'tetherow' }),
    )
    expect(detachedMock).not.toHaveBeenCalled()
    expect(result.figures.activeListings).toBe(35)
    expect(result.figures.monthsOfSupply).toBe(4.6)
    expect(result.figures.marketHealthLabel).toBe('Cool')
    expect(result.methodology.verdictKind).toBe('balanced')
  })

  it('neighborhood with a null pulse MOS keeps that withhold — does not invent MOS', async () => {
    rowMock.mockResolvedValue({
      ...PULSE_BEND,
      geo_type: 'neighborhood',
      geo_slug: 'awbrey-butte',
      geo_label: 'Awbrey Butte',
      active_count: 12,
      months_of_supply: null,
      market_health_label: 'Warm',
    })

    const result = found(
      await getMarketPulseJsonFeed({ geoType: 'neighborhood', geoSlug: 'awbrey-butte' }),
    )
    expect(detachedMock).not.toHaveBeenCalled()
    expect(result.figures.monthsOfSupply).toBeNull()
    expect(result.figures.activeListings).toBe(12)
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
    expect(src).toMatch(/geoType === 'city' \|\| geoType === 'region'/)
    expect(src).not.toMatch(/monthsOfSupply\(/)
  })
})
