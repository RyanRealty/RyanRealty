import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  assembleCmaMarketContext,
  resolveCmaMarketTargets,
  type CmaMarketAssembleInput,
} from '@/lib/cma/market'
import type { CmaMarketPulseRow, CmaMarketStatsRow } from '@/lib/data/cma/builderReads'
import type { SellBendMarket } from '@/lib/data/market-truth/getSellBendMarket'
import { EMPTY_PUBLIC_PACE, type PublicPaceRow } from '@/lib/data/market-truth/public-pace'

const CACHE_STATS: CmaMarketStatsRow = {
  geo_type: 'city',
  geo_slug: 'bend',
  geo_label: 'Bend',
  period_start: '2025-08-22',
  period_end: '2026-08-21',
  sold_count: 1800,
  median_sale_price: 800000,
  median_dom: 72,
  median_ppsf: 350,
  median_price_per_sqft_closed: 351,
  avg_sale_to_list_ratio: 0.98,
  yoy_median_price_delta_pct: 5,
  end_of_period_inventory: 500,
  methodology_version: 'cache-v1',
  computed_at: '2026-08-21T00:00:00.000Z',
}

const PULSE: CmaMarketPulseRow = {
  geo_slug: 'bend',
  active_count: 488,
  pending_count: 80,
  median_list_price: 775000,
  months_of_supply: 3.54,
  updated_at: '2026-08-23T12:00:00.000Z',
}

const CITY_DETACHED: SellBendMarket = {
  activeCount: 774,
  monthsOfSupply: 4.47,
  mosLabel: '4.5 months',
  verdictKind: 'balanced',
  verdictLabel: 'Balanced market',
  medianListPrice: 749000,
  computedAt: '2026-08-23T00:00:00.000Z',
  completeThrough: '2026-08-21',
}

const SUNRIVER_DETACHED: SellBendMarket = {
  activeCount: 56,
  monthsOfSupply: 7.47,
  mosLabel: '7.5 months',
  verdictKind: 'buyers',
  verdictLabel: "Buyer's market",
  medianListPrice: 989000,
  computedAt: '2026-08-23T00:00:00.000Z',
  completeThrough: '2026-08-21',
}

const CITY_LEFTOVER: PublicPaceRow = {
  ...EMPTY_PUBLIC_PACE,
  saleToOriginal: 0.969,
  yoyMedian: -0.019,
  pendingCount: 311,
  medianClose: 760000,
  medianPpsf: 399,
  closedCount: 2095,
  daysToContract: 28,
}

function assemble(over: Partial<CmaMarketAssembleInput> = {}) {
  return assembleCmaMarketContext({
    city: 'Bend',
    geoType: 'city',
    geoSlug: 'bend',
    stats: CACHE_STATS,
    pulse: PULSE,
    detached: CITY_DETACHED,
    leftover: CITY_LEFTOVER,
    trendRows: [],
    yearMart: null,
    ...over,
  })
}

describe('resolveCmaMarketTargets', () => {
  it('uses the resort community cache, not the city, for Caldera Springs', () => {
    const { targets } = resolveCmaMarketTargets({
      city: 'Bend',
      subdivision: 'Caldera Springs',
    })
    expect(targets[0]).toEqual({ geoType: 'neighborhood', slugs: ['caldera-springs'] })
    expect(targets[1]?.geoType).toBe('city')
    expect(targets[1]?.slugs).toContain('bend')
  })

  it('still uses the city when the subdivision is not a resort', () => {
    const { targets } = resolveCmaMarketTargets({
      city: 'Redmond',
      subdivision: 'Obsidian',
    })
    expect(targets).toEqual([{ geoType: 'city', slugs: ['redmond'] }])
  })
})

describe('assembleCmaMarketContext leftover', () => {
  it('city leftover fields do not fall back to cache or pulse numbers', () => {
    const missed = assemble({ leftover: { ...EMPTY_PUBLIC_PACE } })
    expect(missed.medianSalePrice).toBeNull()
    expect(missed.medianPpsf).toBeNull()
    expect(missed.saleToListRatio).toBeNull()
    expect(missed.yoyMedianPriceDeltaPct).toBeNull()
    expect(missed.pendingCount).toBeNull()
    expect(missed.medianSalePrice).not.toBe(CACHE_STATS.median_sale_price)
    expect(missed.pendingCount).not.toBe(PULSE.pending_count)
    expect(missed.medianDom).toBe(72)
  })

  it('city leftover overlays sale-to-original, YoY, pending, median close, and ppsf', () => {
    const hit = assemble()
    expect(hit.medianSalePrice).toBe(760000)
    expect(hit.medianPpsf).toBe(399)
    expect(hit.saleToListRatio).toBe(0.969)
    expect(hit.yoyMedianPriceDeltaPct).toBeCloseTo(-1.9, 5)
    expect(hit.pendingCount).toBe(311)
    expect(hit.medianSalePrice).not.toBe(CACHE_STATS.median_sale_price)
    expect(hit.pendingCount).not.toBe(PULSE.pending_count)
  })

  it('does not map leftover 12-month days to contract onto medianDom', () => {
    const row = assemble({ leftover: { ...CITY_LEFTOVER, daysToContract: 28 } })
    expect(row.medianDom).toBe(72)
    expect(row.medianDom).not.toBe(28)
  })

  it('still assembles when cache rolling_365d is missing and leftover exists', () => {
    const row = assemble({ stats: null, detached: null })
    expect(row.medianSalePrice).toBe(760000)
    expect(row.pendingCount).toBe(311)
    expect(row.monthsOfSupply).toBeNull()
    expect(row.activeCount).toBeNull()
    expect(row.medianDom).toBeNull()
  })
})

describe('assembleCmaMarketContext neighborhood MOS', () => {
  const tetherowPulse: CmaMarketPulseRow = {
    geo_slug: 'tetherow',
    active_count: 35,
    pending_count: 8,
    median_list_price: 1_850_000,
    months_of_supply: 4.6,
    updated_at: '2026-08-23T12:00:00.000Z',
  }
  const tetherowStats: CmaMarketStatsRow = {
    ...CACHE_STATS,
    geo_type: 'neighborhood',
    geo_slug: 'tetherow',
    geo_label: 'Tetherow',
    sold_count: 16,
    median_sale_price: 1_900_000,
  }

  it('withholds neighborhood MOS when Market Truth is not publishable', () => {
    const row = assemble({
      geoType: 'neighborhood',
      geoSlug: 'tetherow',
      stats: tetherowStats,
      pulse: tetherowPulse,
      detached: null,
      leftover: { ...EMPTY_PUBLIC_PACE, pendingCount: 6, daysToContract: 37 },
    })
    expect(row.monthsOfSupply).toBeNull()
    expect(row.marketVerdict).toBeNull()
    expect(row.activeCount).toBeNull()
    expect(row.mosFormula).toMatch(/withheld/)
    expect(row.mosFormula).toMatch(/no pulse fallback/)
    expect(row.monthsOfSupply).not.toBe(4.6)
    expect(row.pendingCount).toBe(6)
    expect(row.medianDom).toBe(72)
    expect(row.soldCount365).not.toBe(16)
  })

  it('publishes neighborhood MOS only from Market Truth', () => {
    const row = assemble({
      geoType: 'neighborhood',
      geoSlug: 'sunriver',
      stats: { ...tetherowStats, geo_slug: 'sunriver', geo_label: 'Sunriver', sold_count: 45 },
      pulse: { ...tetherowPulse, geo_slug: 'sunriver', months_of_supply: 14.2, active_count: 19 },
      detached: SUNRIVER_DETACHED,
      leftover: { ...EMPTY_PUBLIC_PACE, pendingCount: 16, medianClose: 875000 },
    })
    expect(row.monthsOfSupply).toBe(7.5)
    expect(row.marketVerdict).toBe('buyer')
    expect(row.activeCount).toBe(56)
    expect(row.mosFormula).toMatch(/market-truth/)
    expect(row.mosFormula).not.toMatch(/pulse/)
    expect(row.monthsOfSupply).not.toBe(14.2)
    expect(row.pendingCount).toBe(16)
    expect(row.medianSalePrice).toBe(875000)
  })
})

describe('CMA market readers', () => {
  it('comp pool SQL still PropertyType A then keepSameProductType', () => {
    const comps = readFileSync(resolve('lib/cma/comps.ts'), 'utf8')
    const pool = readFileSync(resolve('lib/data/cma/builderReads.ts'), 'utf8')
    expect(pool).toMatch(/\.eq\('PropertyType', 'A'\)/)
    expect(comps).toMatch(/PropertyType='A'/)
    expect(comps).toMatch(/keepSameProductType/)
    expect(comps).toMatch(/selectCmaCompsPool/)
  })

  it('getCmaMarketContext overlays leftover and inventory without requiring cache', () => {
    const src = readFileSync(resolve('lib/cma/market.ts'), 'utf8')
    expect(src).toMatch(/assembleCmaMarketContext/)
    expect(src).toMatch(/getPublicDetachedPace/)
    expect(src).toMatch(/getDetachedMarket\('neighborhood'/)
    expect(src).toMatch(/getCityDetachedMarket/)
    expect(src).toMatch(/publicPaceHasRow/)
    expect(src).toMatch(/source: 'market-truth'/)
    expect(src).not.toMatch(/if \(!stats\) return null/)
    expect(src).not.toMatch(/cityPace\?\.medianClose \?\? num\(stats/)
    expect(src).not.toMatch(/cityPace\?\.saleToOriginal \?\? num\(stats/)
    expect(src).not.toMatch(/cityPace\?\.pendingCount \?\? num\(pulse/)
    expect(src).not.toMatch(/getCmaSubdivision/)
  })
})
