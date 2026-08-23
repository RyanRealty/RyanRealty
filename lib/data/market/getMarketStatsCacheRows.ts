/**
 * Wide market_stats_cache row reads for LP routes that need more fields than
 * the canonical MarketStats projection (sale-to-list ratio, PPSF, methodology
 * version, end-of-period inventory).
 *
 * Lives behind the DAL boundary. The bend LP + peer-city LP consume these.
 */

import { supabaseAnon } from '@/lib/data/client'
import {
  overlayDetachedMarket,
  withholdDetachedHeadlines,
  cityDetachedSlug,
  getDetachedMarkets,
} from '@/lib/data/market-truth/getSellBendMarket'

export type MarketStatsCacheRow = {
  geo_slug?: string
  geo_label?: string | null
  sold_count?: number | null
  median_sale_price?: number | null
  median_dom?: number | null
  avg_sale_to_list_ratio?: number | null
  median_ppsf?: number | null
  end_of_period_inventory?: number | null
  computed_at?: string | null
  methodology_version?: string | null
}

/**
 * Latest market_stats_cache row for one geo+period.
 *
 * §0 `geoType` IS REQUIRED, and that is not defensive typing. A cache slug is
 * NOT unique on its own: 13 slugs exist under more than one geo_type, and
 * `sunriver` exists under THREE (city, neighborhood, subdivision). Filtering on
 * slug + period alone and taking `order(period_end desc).limit(1)` therefore
 * returned whichever geography happened to have the fresher row.
 *
 * It was picking the wrong one live: `/communities/sunriver` asks for the
 * COMMUNITY and was served the CITY row — 124 twelve-month sales and a 93.2%
 * sale-to-list ratio for all of Sunriver, rendered as the community's own
 * figures beside neighborhood-scoped numbers on the same page. The other 12
 * collisions resolved to `neighborhood` only by accident of which row was
 * written last, so every one of them was one cron run away from the same
 * misattribution.
 *
 * A caller that asks for a geo_type with no row now gets null, and shows
 * nothing — the §0 outcome. It never gets a different geography's numbers.
 */
export async function getMarketStatsCacheRowForGeo(options: {
  geoType: 'city' | 'neighborhood' | 'subdivision' | 'region' | 'zip'
  geoSlug: string
  periodType?: string
  columns?: string
}): Promise<MarketStatsCacheRow | null> {
  const sb = supabaseAnon()
  if (!sb) return null
  const columns =
    options.columns ??
    'sold_count, median_sale_price, median_dom, avg_sale_to_list_ratio, median_ppsf, end_of_period_inventory, computed_at, methodology_version'
  const { data } = await sb
    .from('market_stats_cache')
    .select(columns)
    .eq('geo_type', options.geoType)
    .eq('geo_slug', options.geoSlug)
    .eq('period_type', options.periodType ?? 'rolling_365d')
    .order('period_end', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data ?? null) as MarketStatsCacheRow | null
}

/** Read monthly reporting_cache rows for a geo (community price history fallback). */
export async function getReportingCacheMonthlyRows(options: {
  geoType: string
  geoNameIlike: string
  limit?: number
}): Promise<Array<{ period_start?: string; metrics?: { median_price?: number; sold_count?: number } }>> {
  const sb = supabaseAnon()
  if (!sb) return []
  const { data } = await sb
    .from('reporting_cache')
    .select('period_start, metrics')
    .eq('geo_type', options.geoType)
    .ilike('geo_name', options.geoNameIlike)
    .eq('period_type', 'monthly')
    .order('period_start', { ascending: true })
    .limit(Math.min(Math.max(options.limit ?? 12, 1), 100))
  return (data ?? []) as Array<{ period_start?: string; metrics?: { median_price?: number; sold_count?: number } }>
}

/** Multi-row market_stats_cache read by geo_type + period_type, ordered by period_end DESC. */
export async function getMarketStatsCacheRowsByGeoType(options: {
  geoType: string
  periodType?: string
  limit: number
  columns?: string
}): Promise<Array<Record<string, unknown>>> {
  const sb = supabaseAnon()
  if (!sb) return []
  const columns =
    options.columns ?? 'geo_slug, median_sale_price, median_dom, sold_count, period_end'
  const { data } = await sb
    .from('market_stats_cache')
    .select(columns)
    .eq('geo_type', options.geoType)
    .eq('period_type', options.periodType ?? 'monthly')
    .order('period_end', { ascending: false })
    .limit(options.limit)
  return (data ?? []) as unknown as Array<Record<string, unknown>>
}

/** Period-pinned cache row by (geo_type, geo_slug, period_type, period_start?). */
export async function getMarketStatsCacheRowForPeriod(options: {
  geoType: string
  geoSlug: string
  periodType?: string
  periodStart?: string
  columns?: string
}): Promise<MarketStatsCacheRow | null> {
  const sb = supabaseAnon()
  if (!sb) return null
  const columns =
    options.columns ??
    'id, geo_type, geo_slug, geo_label, period_type, period_start, period_end, sold_count, median_sale_price, avg_sale_price, total_volume, median_dom, speed_p25, speed_p50, speed_p75, median_ppsf, avg_sale_to_list_ratio, market_health_score, market_health_label, end_of_period_inventory, computed_at'
  let q = sb
    .from('market_stats_cache')
    .select(columns)
    .eq('geo_type', options.geoType)
    .eq('geo_slug', options.geoSlug)
    .eq('period_type', options.periodType ?? 'monthly')
  if (options.periodStart) q = q.eq('period_start', options.periodStart)
  const { data } = await q.order('period_start', { ascending: false }).limit(1).maybeSingle()
  return (data ?? null) as MarketStatsCacheRow | null
}

/** All non-empty market_pulse_live rows for a geo_type, ordered by active count desc. */
export async function getMarketPulseRowsByGeoType(options: {
  geoType: string
  minActiveCount?: number
  columns?: string
}): Promise<Array<Record<string, unknown>>> {
  const sb = supabaseAnon()
  if (!sb) return []
  const columns = options.columns ?? 'geo_slug, geo_label, active_count'
  let q = sb
    .from('market_pulse_live')
    .select(columns)
    .eq('geo_type', options.geoType)
    .gt('active_count', options.minActiveCount ?? 0)
    .order('active_count', { ascending: false })
  if (options.geoType === 'city' || options.geoType === 'region') {
    q = q.eq('property_type', 'A')
  }
  const { data } = await q
  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>
  if (options.geoType !== 'city' && options.geoType !== 'region') return rows
  try {
    const map = await getDetachedMarkets(
      rows.map((r) => ({
        geoType: options.geoType as 'city' | 'region',
        geoSlug: String(r.geo_slug ?? r.geo_label ?? ''),
      })),
    )
    return rows
      .map((r) => {
        const slug = String(r.geo_slug ?? r.geo_label ?? '')
        const mt = map.get(`${options.geoType}:${cityDetachedSlug(slug)}`)
        return overlayDetachedMarket(
          r as { active_count?: number | null; months_of_supply?: number | null; median_list_price?: number | null },
          mt,
        ) as Record<string, unknown>
      })
      .sort((a, b) => Number(b.active_count ?? 0) - Number(a.active_count ?? 0))
  } catch {
    return rows.map((r) =>
      withholdDetachedHeadlines(
        r as { active_count?: number | null; months_of_supply?: number | null; median_list_price?: number | null },
      ),
    ) as Array<Record<string, unknown>>
  }
}

/** Upsert one market_pulse_live row (admin populate path). */
export async function upsertMarketPulseLiveRow(
  row: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const sb = supabaseAnon()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const { error } = await sb
    .from('market_pulse_live')
    .upsert(row, { onConflict: 'geo_type,geo_slug' })
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** market_pulse_live row by (geo_type, geo_slug, property_type) — typed wide projection. */
export async function getMarketPulseRowForGeo(options: {
  geoType: string
  geoSlug: string
  propertyType?: string
  columns?: string
}): Promise<Record<string, unknown> | null> {
  const sb = supabaseAnon()
  if (!sb) return null
  const columns =
    options.columns ??
    'geo_type, geo_slug, geo_label, active_count, pending_count, new_count_7d, new_count_30d, median_list_price, avg_list_price, market_health_score, market_health_label, updated_at'
  const { data, error } = await sb
    .from('market_pulse_live')
    .select(columns)
    .eq('geo_type', options.geoType)
    .eq('geo_slug', options.geoSlug)
    .eq('property_type', options.propertyType ?? 'A')
    .maybeSingle()
  // THROW on a transient DB error instead of dropping it: returning null on both
  // a real miss AND an error lets a caching caller (getRegionPulse) poison-cache
  // the null and blank the page for the TTL. Callers that must not surface the
  // throw wrap this in try/catch (dashboard, seller LP) or makeResilientCached.
  if (error) throw new Error(`getMarketPulseRowForGeo(${options.geoType}/${options.geoSlug}): ${error.message}`)
  return (data ?? null) as Record<string, unknown> | null
}

/** Many geos at once: returns one row (latest period_end) per geo_slug. */
export async function getMarketStatsCacheRowsForGeos(options: {
  /**
   * §0 REQUIRED — a slug does not identify a geography on its own. 13 slugs
   * exist under more than one geo_type. `/lp/tetherow`'s peer comparison asks
   * for ['tetherow','pronghorn','broken-top','caldera-springs','sunriver'] and,
   * unfiltered, could pull the CITY Sunriver row (124 twelve-month sales, all
   * of Sunriver) into a table of resort COMMUNITIES on a lead-capture page.
   * Every caller passes one homogeneous set, so this costs nothing to state.
   */
  geoType: 'city' | 'neighborhood' | 'subdivision' | 'region' | 'zip'
  geoSlugs: string[]
  periodType?: string
  columns?: string
  orderBy?: { column: string; ascending: boolean }
}): Promise<MarketStatsCacheRow[]> {
  const sb = supabaseAnon()
  if (!sb || options.geoSlugs.length === 0) return []
  const columns =
    options.columns ??
    'geo_slug, sold_count, median_sale_price, end_of_period_inventory'
  let q = sb
    .from('market_stats_cache')
    .select(columns)
    .eq('geo_type', options.geoType)
    .in('geo_slug', options.geoSlugs)
    .eq('period_type', options.periodType ?? 'rolling_365d')
  q = options.orderBy
    ? q.order(options.orderBy.column, { ascending: options.orderBy.ascending })
    : q.order('period_end', { ascending: false })
  const { data } = await q
  return (data ?? []) as MarketStatsCacheRow[]
}
