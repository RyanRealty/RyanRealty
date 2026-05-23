'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { slugify, subdivisionEntityKey } from '@/lib/slug'
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
  active_count: number
  pending_count: number
  new_count_7d: number
  new_count_30d: number
  median_list_price: number | null
  avg_list_price: number | null
  market_health_score: number | null
  market_health_label: string | null
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
   * MLS property type code. `market_pulse_live` is keyed by
   * (geo_type, geo_slug, property_type) — `refresh_market_pulse()` upserts
   * 6 rows per geo (A=Residential, B=Manufactured, C=Multi-Family, D=Land,
   * E=Commercial, F=Farm/Ranch). For "homes for sale" surfaces (city/community
   * pages, hero stats) the residential aggregate `'A'` is canonical.
   * Default `'A'` keeps existing call sites working.
   */
  propertyType?: string
}): Promise<MarketPulseRow | null> {
  void createServiceClient
  const { getMarketPulseRowForGeo } = await import('@/lib/data')
  const data = await getMarketPulseRowForGeo({
    geoType: input.geoType,
    geoSlug: input.geoSlug,
    propertyType: input.propertyType ?? 'A',
  })
  return (data as MarketPulseRow | null) ?? null
}

function pulseToMarketStats(
  pulse: MarketPulseRow,
  cached: CachedStatRow | null
): CityMarketStats {
  return {
    count: pulse.active_count,
    avgPrice: pulse.avg_list_price,
    medianPrice: pulse.median_list_price,
    avgDom: cached?.median_dom ?? null,
    newListingsLast30Days: pulse.new_count_30d,
    pendingCount: pulse.pending_count,
    closedLast12Months: cached?.sold_count ?? 0,
  }
}

/**
 * Build CityMarketStats from a cached stat row alone (no pulse).
 * Used for geo_type='neighborhood' resort communities where market_pulse_live
 * doesn't carry rows yet — but market_stats_cache does (populated by the cron).
 * Inventory comes from end_of_period_inventory; price metrics from CLOSED sales
 * in the cached period (median_sale_price reads the period's closed median).
 */
function cachedToMarketStats(cached: CachedStatRow): CityMarketStats {
  return {
    count: cached.end_of_period_inventory ?? 0,
    avgPrice: cached.avg_sale_price,
    medianPrice: cached.median_sale_price,
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
  const geoSlug = slugify(cityName)
  const [pulse, cached] = await Promise.all([
    getLiveMarketPulse({ geoType: 'city', geoSlug }),
    getCachedStats({ geoType: 'city', geoSlug }),
  ])
  if (pulse) return pulseToMarketStats(pulse, cached)
  return getQuickCityCount(cityName)
}

/**
 * Populate market_pulse_live for a single city. Called from admin or cron.
 * Uses simple, fast queries instead of the heavy RPC that times out.
 */
export async function populateMarketPulseForCity(cityName: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createServiceClient()
    const geoSlug = slugify(cityName)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const cutoff30 = thirtyDaysAgo.toISOString().slice(0, 10)
    const cutoff7 = sevenDaysAgo.toISOString().slice(0, 10)

    // DAL: city aggregations via listing_tile_mv.
    const { getCityListings: getCityListingsDAL } = await import('@/lib/data')
    const [activeTiles, pendingTiles] = await Promise.all([
      getCityListingsDAL(cityName, { status: 'active', limit: 5000 }),
      getCityListingsDAL(cityName, { status: 'pending-only', limit: 5000 }),
    ])
    const prices = activeTiles
      .map((t) => Number(t.listPrice))
      .filter((p) => Number.isFinite(p) && p > 0)
      .sort((a, b) => a - b)
    const activeCount = prices.length
    const avgListPrice =
      prices.length > 0 ? Math.round(prices.reduce((s, p) => s + p, 0) / prices.length) : null
    const medianListPrice = prices.length > 0 ? prices[Math.floor(prices.length / 2)]! : null
    const pendingCount = pendingTiles.length
    const new7d = activeTiles.filter(
      (t) => t.onMarketDate != null && t.onMarketDate.slice(0, 10) >= cutoff7
    ).length
    const new30d = activeTiles.filter(
      (t) => t.onMarketDate != null && t.onMarketDate.slice(0, 10) >= cutoff30
    ).length

    // Upsert into market_pulse_live via DAL.
    void supabase
    const { upsertMarketPulseLiveRow } = await import('@/lib/data')
    const res = await upsertMarketPulseLiveRow({
      geo_type: 'city',
      geo_slug: geoSlug,
      geo_label: cityName,
      active_count: activeCount,
      pending_count: pendingCount,
      new_count_7d: new7d,
      new_count_30d: new30d,
      median_list_price: medianListPrice,
      avg_list_price: avgListPrice,
      market_health_score: null,
      market_health_label: null,
      updated_at: new Date().toISOString(),
    })

    if (!res.ok) return { ok: false, error: res.error }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Populate market_pulse_live for all Central Oregon cities.
 */
export async function populateAllMarketPulse(): Promise<{ results: Array<{ city: string; ok: boolean; error?: string }> }> {
  const cities = [
    'Bend',
    'Redmond',
    'Sisters',
    'Sunriver',
    'La Pine',
    'Madras',
    'Prineville',
    'Terrebonne',
    'Tumalo',
    'Powell Butte',
    'Crooked River Ranch',
  ]
  const results = []
  for (const city of cities) {
    const result = await populateMarketPulseForCity(city)
    results.push({ city, ...result })
  }
  return { results }
}

/** Lightweight fallback — just count active listings, no complex aggregations */
async function getQuickCityCount(cityName: string): Promise<CityMarketStats> {
  void createServiceClient
  try {
    const { getCityListings: getCityListingsDAL } = await import('@/lib/data')
    const tiles = await getCityListingsDAL(cityName, { status: 'active', limit: 5000 })
    return {
      count: tiles.length,
      avgPrice: null,
      medianPrice: null,
      avgDom: null,
      newListingsLast30Days: 0,
      pendingCount: 0,
      closedLast12Months: 0,
    }
  } catch {
    return { count: 0, avgPrice: null, medianPrice: null, avgDom: null, newListingsLast30Days: 0, pendingCount: 0, closedLast12Months: 0 }
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
 * Source: data/resort-communities.json v2-2026-05-15; methodology v4-2026-05-15.
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
