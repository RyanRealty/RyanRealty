'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { slugify, subdivisionEntityKey } from '@/lib/slug'
import { canonicalCityCacheSlug } from '@/lib/market/city-cache-slug'
import { marketVerdict } from '@/lib/market/classify'
import type { CityMarketStats } from '@/app/actions/listings'

export type MarketGeoType = 'region' | 'city' | 'subdivision' | 'neighborhood'
export type MarketPeriodType = 'monthly' | 'quarterly' | 'yearly' | 'custom' | 'ytd' | 'weekly' | 'rolling_30d' | 'rolling_90d' | 'rolling_365d'

export type CachedStatRow = {
  id: string
  geo_type: MarketGeoType
  geo_slug: string
  geo_label: string
  period_type: MarketPeriodType
  period_start: string
  period_end: string
  sold_count: number
  median_sale_price: number | null
  avg_sale_price: number | null
  total_volume: number | null
  median_dom: number | null
  speed_p25: number | null
  speed_p50: number | null
  speed_p75: number | null
  median_ppsf: number | null
  avg_sale_to_list_ratio: number | null
  market_health_score: number | null
  market_health_label: string | null
  end_of_period_inventory: number | null
  computed_at: string
}

export type MarketPulseRow = {
  geo_type: MarketGeoType
  geo_slug: string
  geo_label: string
  /** Null when the overlay withheld the count. Unknown is not zero. */
  active_count: number | null
  pending_count: number | null
  new_count_7d: number
  new_count_30d: number | null
  median_list_price: number | null
  avg_list_price: number | null
  market_health_score: number | null
  market_health_label: string | null
  months_of_supply: number | null
  updated_at: string
}

export async function getCachedStats(input: {
  geoType: MarketGeoType
  geoSlug: string
  periodType?: MarketPeriodType
  periodStart?: string
}): Promise<CachedStatRow | null> {
  void createServiceClient
  const { getMarketStatsCacheRowForPeriod } = await import('@/lib/data')
  const data = await getMarketStatsCacheRowForPeriod({
    geoType: input.geoType,
    geoSlug: input.geoSlug,
    periodType: input.periodType ?? 'monthly',
    periodStart: input.periodStart,
  })
  return (data as CachedStatRow | null) ?? null
}

export async function getLiveMarketPulse(input: {
  geoType: MarketGeoType
  geoSlug: string
  /**
   * Kept for call-site compatibility. The overlaid reader is SFR type A
   * (`getMarketPulse`); city/region rows inherit Market Truth detached
   * active / MoS / verdict so OG cards cannot print pulse 488 / seller
   * next to `/sell` 774 / balanced.
   */
  propertyType?: string
}): Promise<MarketPulseRow | null> {
  void input.propertyType
  try {
    const { getMarketPulse } = await import('@/lib/data')
    const pulse = await getMarketPulse({
      geoType: input.geoType,
      geoSlug: input.geoSlug,
    })
    if (!pulse) return null
    const verdict = marketVerdict(pulse.monthsOfSupply)
    return {
      geo_type: pulse.geoType as MarketGeoType,
      geo_slug: pulse.geoSlug,
      geo_label: pulse.geoSlug,
      active_count: pulse.activeCount,
      pending_count: null,
      new_count_7d: pulse.newThisWeek,
      new_count_30d: null,
      median_list_price: pulse.medianListPrice,
      avg_list_price: null,
      market_health_score: null,
      market_health_label: verdict.kind === 'unknown' ? null : verdict.label,
      months_of_supply: pulse.monthsOfSupply,
      updated_at: pulse.refreshedAt,
    }
  } catch (e) {
    console.warn('[market-stats] getLiveMarketPulse failed:', e)
    return null
  }
}

/**
 * Live pulse row -> stats. The pulse is the ASKING side (active inventory), so
 * it fills the list fields; the closed-sale fields come from the cache row and
 * stay null when there is none. (§0 price-kind discipline — see CityMarketStats.)
 */
function pulseToMarketStats(
  pulse: MarketPulseRow,
  cached: CachedStatRow | null
): CityMarketStats {
  return {
    count: pulse.active_count ?? 0,
    avgListPrice: pulse.avg_list_price,
    medianListPrice: pulse.median_list_price,
    avgSalePrice: cached?.avg_sale_price ?? null,
    medianSalePrice: cached?.median_sale_price ?? null,
    avgDom: cached?.median_dom ?? null,
    newListingsLast30Days: pulse.new_count_30d ?? 0,
    pendingCount: pulse.pending_count ?? 0,
    closedLast12Months: cached?.sold_count ?? 0,
  }
}

/**
 * Build CityMarketStats from a cached stat row alone (no pulse).
 *
 * This is the NORMAL path for a geo_type='neighborhood' resort community, not a
 * rare fallback: `market_pulse_live` carries no neighborhood or subdivision rows
 * at all (verified live 2026-07-24 — 17 rows, every one city or region).
 *
 * §0: a cache row is entirely the CLOSED side, so both list fields stay null.
 * They used to be filled from `avg_sale_price` / `median_sale_price`, which is
 * how a closed-sale median reached a "Median list" label on the community page.
 * A caller that needs an asking price for one of these geos computes it from the
 * active tiles it already has (lib/market/tile-medians.ts) — the same set that
 * produces the active count beside it.
 */
function cachedToMarketStats(cached: CachedStatRow): CityMarketStats {
  return {
    count: cached.end_of_period_inventory ?? 0,
    avgListPrice: null,
    medianListPrice: null,
    avgSalePrice: cached.avg_sale_price,
    medianSalePrice: cached.median_sale_price,
    avgDom: cached.median_dom,
    newListingsLast30Days: 0,
    pendingCount: 0,
    closedLast12Months: cached.sold_count ?? 0,
  }
}

/**
 * Market stats for a city via cached pulse + stats tables.
 * Falls back to a lightweight direct count when cache rows are unavailable.
 */
export async function getMarketStatsForCity(
  cityName: string
): Promise<CityMarketStats> {
  const geoSlug = canonicalCityCacheSlug(cityName)
  const [pulse, cached] = await Promise.all([
    getLiveMarketPulse({ geoType: 'city', geoSlug }),
    getCachedStats({ geoType: 'city', geoSlug }),
  ])
  if (pulse && pulse.active_count != null) return pulseToMarketStats(pulse, cached)
  if (cached) return cachedToMarketStats(cached)
  return getQuickCityCount(cityName)
}


/** Lightweight fallback — just count active listings, no complex aggregations */
async function getQuickCityCount(cityName: string): Promise<CityMarketStats> {
  void createServiceClient
  try {
    const { getCityListings: getCityListingsDAL } = await import('@/lib/data')
    const tiles = await getCityListingsDAL(cityName, { status: 'active', limit: 5000 })
    return {
      count: tiles.length,
      // The asking-price median IS derivable from these very tiles; callers that
      // want it use medianListPriceOfTiles on their own active set so the count
      // and the median provably describe the same homes. (§0)
      avgListPrice: null,
      medianListPrice: null,
      avgSalePrice: null,
      medianSalePrice: null,
      avgDom: null,
      newListingsLast30Days: 0,
      pendingCount: 0,
      closedLast12Months: 0,
    }
  } catch {
    return {
      count: 0,
      avgListPrice: null,
      medianListPrice: null,
      avgSalePrice: null,
      medianSalePrice: null,
      avgDom: null,
      newListingsLast30Days: 0,
      pendingCount: 0,
      closedLast12Months: 0,
    }
  }
}

/**
 * Market stats for a subdivision via cached pulse + stats tables.
 *
 * Resort/master-planned communities (Tetherow, Sunriver, Eagle Crest, Pronghorn,
 * Caldera Springs, Awbrey Glen, NorthWest Crossing, Crosswater, Black Butte Ranch,
 * Brasada Ranch, Widgi Creek, Vandevert Ranch, Three Rivers, Broken Top) are
 * registered as geo_type='neighborhood' in public.boundaries with their child
 * SubdivisionName aliases mapped in public.neighborhood_subdivisions. For those,
 * the cache aggregates every alias under one report — much richer than what
 * geo_type='subdivision' text-equality alone would produce.
 *
 * Routing: check public.subdivision_flags for (city:subdivision) first; if flagged
 * as resort/area community, query geo_type='neighborhood' with the bare subdivision
 * slug. Else fall through to existing geo_type='subdivision' path.
 *
 * Source: data/resort-communities.json v2-2026-05-15. Methodology: the v4-2026-05-15
 * definition is REGISTERED in cache_methodology_definitions but no live cache row
 * carries it — every served row is stamped v3-2026-05-07 (CLAUDE.md §7). Cite the
 * stamp on the row, never the newest definition.
 */
export async function getMarketStatsForSubdivision(
  city: string,
  subdivision: string
): Promise<CityMarketStats> {
  const entityKey = subdivisionEntityKey(city, subdivision) // e.g. 'bend:tetherow'
  void createServiceClient
  const { isSubdivisionFlagged } = await import('@/lib/data')
  // Is this a registered resort/area community? (subdivision_flags is populated
  // by the resort-communities migration; only those rows route to 'neighborhood'.)
  const flag = await isSubdivisionFlagged(entityKey)

  if (flag) {
    // 'tetherow' (not 'bend:tetherow') — bare community slug for neighborhood-level cache
    const nbhdSlug = slugify(subdivision)
    // Pull every period in parallel; pick the freshest non-empty one (slow-turnover
    // resort markets show 0 in rolling_30d/90d — fall back to rolling_365d / ytd).
    const [pulse, c90, c365, cYtd, cMo] = await Promise.all([
      getLiveMarketPulse({ geoType: 'neighborhood', geoSlug: nbhdSlug }),
      getCachedStats({ geoType: 'neighborhood', geoSlug: nbhdSlug, periodType: 'rolling_90d' }),
      getCachedStats({ geoType: 'neighborhood', geoSlug: nbhdSlug, periodType: 'rolling_365d' }),
      getCachedStats({ geoType: 'neighborhood', geoSlug: nbhdSlug, periodType: 'ytd' }),
      getCachedStats({ geoType: 'neighborhood', geoSlug: nbhdSlug, periodType: 'monthly' }),
    ])
    // Pick the most recent period with actual sales; preserve rolling_90d's inventory snapshot.
    const cachedWithSales = [c90, c365, cYtd, cMo].find((c) => (c?.sold_count ?? 0) > 0) ?? c90 ?? c365 ?? cYtd ?? cMo ?? null
    if (pulse) return pulseToMarketStats(pulse, cachedWithSales)
    if (cachedWithSales) return cachedToMarketStats(cachedWithSales)
    // Cache miss for a flagged community — fall through to subdivision/city paths
  }

  const [pulse, cached] = await Promise.all([
    getLiveMarketPulse({ geoType: 'subdivision', geoSlug: entityKey }),
    getCachedStats({ geoType: 'subdivision', geoSlug: entityKey }),
  ])
  if (pulse) return pulseToMarketStats(pulse, cached)
  return getQuickCityCount(city)
}
