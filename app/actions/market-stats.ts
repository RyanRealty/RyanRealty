'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { slugify, subdivisionEntityKey } from '@/lib/slug'
import type { CityMarketStats } from '@/app/actions/listings'

export type MarketGeoType = 'region' | 'city' | 'subdivision'
export type MarketPeriodType = 'monthly' | 'quarterly' | 'yearly' | 'custom'

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
  const supabase = createServiceClient()
  let query = supabase
    .from('market_stats_cache')
    .select('*')
    .eq('geo_type', input.geoType)
    .eq('geo_slug', input.geoSlug)
    .eq('period_type', input.periodType ?? 'monthly')
  if (input.periodStart) {
    query = query.eq('period_start', input.periodStart)
  }
  const { data } = await query.order('period_start', { ascending: false }).limit(1).maybeSingle()
  return (data as CachedStatRow | null) ?? null
}

export async function getLiveMarketPulse(input: {
  geoType: MarketGeoType
  geoSlug: string
}): Promise<MarketPulseRow | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('market_pulse_live')
    .select('*')
    .eq('geo_type', input.geoType)
    .eq('geo_slug', input.geoSlug)
    .maybeSingle()
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
 * Market stats for a city via cached pulse + stats tables.
 * Falls back to the legacy getCityMarketStats, then to a lightweight direct count.
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
  // Fallback: try legacy, but with a timeout
  try {
    const { getCityMarketStats } = await import('@/app/actions/listings')
    return await getCityMarketStats({ city: cityName })
  } catch {
    // Last resort: lightweight active count only
    return getQuickCityCount(cityName)
  }
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

    // Active count + avg/median price — paginate to get ALL rows (Supabase caps at 1,000)
    const { fetchAllRows } = await import('@/lib/supabase/paginate')
    const activeData = await fetchAllRows<{ ListPrice?: number | null }>(
      supabase, 'listings', 'ListPrice',
      (q: any) => q.ilike('City', cityName)
        .or('StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%For Sale%,StandardStatus.ilike.%Coming Soon%')
        .not('ListPrice', 'is', null),
    )
    const prices = activeData.map((r) => Number(r.ListPrice)).filter((p) => Number.isFinite(p) && p > 0).sort((a, b) => a - b)
    const activeCount = prices.length
    const avgListPrice = prices.length > 0 ? Math.round(prices.reduce((s, p) => s + p, 0) / prices.length) : null
    const medianListPrice = prices.length > 0 ? prices[Math.floor(prices.length / 2)]! : null

    // Pending count
    const { count: pendingCount } = await supabase
      .from('listings')
      .select('ListingKey', { count: 'exact', head: true })
      .ilike('City', cityName)
      .or('StandardStatus.ilike.%Pending%,StandardStatus.ilike.%Under Contract%,StandardStatus.ilike.%Contingent%')

    // New in last 7 days
    const { count: new7d } = await supabase
      .from('listings')
      .select('ListingKey', { count: 'exact', head: true })
      .ilike('City', cityName)
      .or('StandardStatus.is.null,StandardStatus.ilike.%Active%')
      .gte('OnMarketDate', sevenDaysAgo.toISOString().slice(0, 10))

    // New in last 30 days
    const { count: new30d } = await supabase
      .from('listings')
      .select('ListingKey', { count: 'exact', head: true })
      .ilike('City', cityName)
      .or('StandardStatus.is.null,StandardStatus.ilike.%Active%')
      .gte('OnMarketDate', thirtyDaysAgo.toISOString().slice(0, 10))

    // Upsert into market_pulse_live
    const { error } = await supabase
      .from('market_pulse_live')
      .upsert({
        geo_type: 'city',
        geo_slug: geoSlug,
        geo_label: cityName,
        active_count: activeCount,
        pending_count: pendingCount ?? 0,
        new_count_7d: new7d ?? 0,
        new_count_30d: new30d ?? 0,
        median_list_price: medianListPrice,
        avg_list_price: avgListPrice,
        market_health_score: null,
        market_health_label: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'geo_type,geo_slug' })

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Populate market_pulse_live for all Central Oregon cities.
 */
export async function populateAllMarketPulse(): Promise<{ results: Array<{ city: string; ok: boolean; error?: string }> }> {
  const cities = ['Bend', 'Redmond', 'Sisters', 'Sunriver', 'La Pine', 'Madras', 'Prineville', 'Terrebonne', 'Tumalo', 'Crooked River Ranch', 'Powell Butte']
  const results = []
  for (const city of cities) {
    const result = await populateMarketPulseForCity(city)
    results.push({ city, ...result })
  }
  return { results }
}

/** Lightweight fallback — just count active listings, no complex aggregations */
async function getQuickCityCount(cityName: string): Promise<CityMarketStats> {
  try {
    const supabase = createServiceClient()
    const { count } = await supabase
      .from('listings')
      .select('ListingKey', { count: 'exact', head: true })
      .ilike('City', cityName)
      .or('StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%For Sale%,StandardStatus.ilike.%Coming Soon%')
    return {
      count: count ?? 0,
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
 * Falls back to the legacy getCityMarketStats, then to a lightweight direct count.
 */
export async function getMarketStatsForSubdivision(
  city: string,
  subdivision: string
): Promise<CityMarketStats> {
  const geoSlug = subdivisionEntityKey(city, subdivision)
  const [pulse, cached] = await Promise.all([
    getLiveMarketPulse({ geoType: 'subdivision', geoSlug }),
    getCachedStats({ geoType: 'subdivision', geoSlug }),
  ])
  if (pulse) return pulseToMarketStats(pulse, cached)
  try {
    const { getCityMarketStats } = await import('@/app/actions/listings')
    return await getCityMarketStats({ city, subdivision })
  } catch {
    return getQuickCityCount(city)
  }
}
