import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  assembleCmaMarketContext,
  cmaMarketSources,
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

  it('city leftover closedCount fills soldCount365', () => {
    const row = assemble({ leftover: { ...CITY_LEFTOVER, closedCount: 2096 } })
    expect(row.soldCount365).toBe(2096)
  })

  it('city leftover miss fills from trusted cache sold_count', () => {
    const row = assemble({
      leftover: { ...EMPTY_PUBLIC_PACE },
      stats: { ...CACHE_STATS, sold_count: 1641 },
    })
    expect(row.soldCount365).toBe(1641)
  })

  it('city leftover miss and no cache omits soldCount365', () => {
    const row = assemble({ leftover: { ...EMPTY_PUBLIC_PACE }, stats: null })
    expect(row.soldCount365).toBeNull()
    expect(row.soldCount365).not.toBe(0)
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
    expect(row.soldCount365).toBeNull()
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
  it('comp pool SQL still defaults to PropertyType A then keepSameProductType', () => {
    const comps = readFileSync(resolve('lib/cma/comps.ts'), 'utf8')
    const pool = readFileSync(resolve('lib/data/cma/builderReads.ts'), 'utf8')
    // 'A' is now the DEFAULT rather than a literal, so a land subject can pull
    // segment 'D' (REGISTRY §1) instead of silently matching nothing. Every
    // improved caller omits the field and still gets 'A'.
    expect(pool).toMatch(/\.eq\('PropertyType', opts\.propertyType\?\.trim\(\) \|\| 'A'\)/)
    expect(comps).toMatch(/const segment = land \? 'D' : 'A'/)
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

describe('D27 — a resort CMA omits the verdict it has not earned', () => {
  // Verified on the live layer 2026-08-25: at neighborhood grain, detached, 24 places
  // publish a 12-month median and only 15 publish a 6-month verdict. The nine that
  // publish a median but no verdict are awbrey-glen, bend-old-bend,
  // bend-southern-crossing, black-butte-ranch, brasada-ranch, broken-top,
  // caldera-springs, northwest-crossing and tetherow — precisely the places our
  // highest-value CMAs are written for. lib/cma/market.ts reads neighborhood grain
  // FIRST for resort subdivisions, so this is the shape a Tetherow CMA actually hits.
  //
  // The failure this pins is not a blank pill. It is a Tetherow document rendering
  // Bend's verdict under Tetherow's name — one population labelled as another, on a
  // page a broker signs. §0.
  const RESORT_MEDIAN_NO_VERDICT: SellBendMarket = {
    activeCount: 21,
    monthsOfSupply: 0,
    mosLabel: '',
    verdictKind: null as unknown as SellBendMarket['verdictKind'],
    verdictLabel: '',
    medianListPrice: 2450000,
    computedAt: '2026-08-25T00:00:00.000Z',
    completeThrough: '2026-08-24',
  }

  const resortBoard = () =>
    assemble({
      city: 'Bend',
      geoType: 'neighborhood',
      geoSlug: 'tetherow',
      // No rolling_365d cache row at this grain — that is exactly why the real
      // resolver keeps the resort slug rather than inheriting the city's.
      stats: null,
      pulse: null,
      detached: RESORT_MEDIAN_NO_VERDICT,
      leftover: { ...CITY_LEFTOVER, medianClose: 1875000 },
    })

  it('publishes the resort median and leaves the verdict null', () => {
    const out = resortBoard()
    expect(out.medianSalePrice).toBe(1875000)
    expect(out.marketVerdict).toBeNull()
  })

  it('never carries the city verdict onto a neighborhood board', () => {
    const out = resortBoard()
    // CITY_DETACHED is 'balanced'. If a fallback ever leaks the city board onto a
    // resort slug, this is the assertion that catches it.
    expect(out.marketVerdict).not.toBe('balanced')
    expect(out.geoSlug).toBe('tetherow')
  })
})

describe('D27 — the CMA citation names the store that produced each figure', () => {
  // The defect: market_context carried one fixed string, "market_stats_cache
  // (rolling_365d) + market_pulse_live", long after the board moved onto leftover.
  // A CMA is broker-signed and its citation is what a reviewer audits against, so
  // a wrong store name makes the figure unverifiable. §0.
  it('attributes the leftover figures to market-truth, not the cache', () => {
    const src = cmaMarketSources(assemble())
    for (const key of [
      'median_sale_price',
      'median_ppsf',
      'sale_to_list_ratio',
      'yoy_median_price_delta_pct',
      'pending_count',
      'active_count',
      'months_of_supply',
      'market_verdict',
    ]) {
      expect(src[key]).toContain('market-truth leftover detached membership')
      expect(src[key]).not.toContain('market_stats_cache')
    }
  })

  it("keeps days on market on the cache, per D17's carve-out", () => {
    const src = cmaMarketSources(assemble())
    expect(src.median_dom).toContain('market_stats_cache')
    expect(src.median_dom).not.toContain('leftover')
  })

  it('says none rather than naming a store for a figure it does not have', () => {
    const src = cmaMarketSources(assemble({ leftover: { ...EMPTY_PUBLIC_PACE }, stats: null }))
    expect(src.median_dom).toBe('none')
    expect(src.sold_count_365).toBe('none')
  })
})

