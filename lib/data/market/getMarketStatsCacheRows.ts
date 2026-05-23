/**
 * Wide market_stats_cache row reads for LP routes that need more fields than
 * the canonical MarketStats projection (sale-to-list ratio, PPSF, methodology
 * version, end-of-period inventory).
 *
 * Lives behind the DAL boundary. The bend LP + peer-city LP consume these.
 */

import { supabaseAnon } from '@/lib/data/client'

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

/** Latest market_stats_cache row for one geo+period. */
export async function getMarketStatsCacheRowForGeo(options: {
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
    .eq('geo_slug', options.geoSlug)
    .eq('period_type', options.periodType ?? 'rolling_365d')
    .order('period_end', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data ?? null) as MarketStatsCacheRow | null
}

/** Many geos at once: returns one row (latest period_end) per geo_slug. */
export async function getMarketStatsCacheRowsForGeos(options: {
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
    .in('geo_slug', options.geoSlugs)
    .eq('period_type', options.periodType ?? 'rolling_365d')
  q = options.orderBy
    ? q.order(options.orderBy.column, { ascending: options.orderBy.ascending })
    : q.order('period_end', { ascending: false })
  const { data } = await q
  return (data ?? []) as MarketStatsCacheRow[]
}
