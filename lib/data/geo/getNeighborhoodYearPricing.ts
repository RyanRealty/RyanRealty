/**
 * getNeighborhoodYearPricing — the per-Bend-district, per-year closed
 * single-family aggregate the neighborhood page's chart-room forms run on:
 * median close, median $/sqft, closing count, closed volume.
 *
 * reachability: entry-point — /cities/[slug]/[neighborhoodSlug] chart-room
 * rollout (Unit NEIGHBORHOOD, 2026-08-19).
 *
 * MECHANISM. One read of `neighborhood_year_pricing_mv` (migration
 * supabase/migrations/20260819234500_neighborhood_year_pricing_mv.sql). The MV
 * stores the aggregate because computing it live is a 53K-row scan of a very
 * wide MV — 9.2s warm, measured 2026-08-19 — and the answer is only ~420 rows.
 * It refreshes from /api/cron/refresh-mvs right after listing_tile_mv, the view
 * it derives from. The whole table is pulled once under one cache key; per
 * district reads filter the cached pull, so one entry serves all thirteen
 * pages.
 *
 * §0 POPULATION. Closed single-family inside a recorded Bend district polygon:
 * `listing_tile_mv.boundary_neighborhood` (the `public.boundaries` assignment —
 * the SAME geometry the place page's map and its `listing_boundary_xref_mv`
 * inventory use), `standard_status='Closed'`, `property_type='A'` AND
 * `property_sub_type='Single Family Residence'`, `close_price > 0`,
 * `sqft >= 300`, years with at least MIN_CLOSINGS_PER_YEAR closings.
 * Verified identical to `sale_pricing_facts` detached under the same filters
 * (Awbrey Butte 1997/2000/2005/2010/2015/2020/2024/2025: same n, same median).
 *
 * WHAT THIS IS NOT. It is not the ACTIVE population: that is
 * `getBendNeighborhoodPublicInventory`, and the two must never be mixed under
 * one label. It is also not `market_pulse_live` or `market_stats_cache` at
 * neighborhood grain — both under-count closings at this scale by 6x to 16x
 * (Awbrey Butte trailing year: pulse implies 12 in six months, the cache says
 * 17 in twelve; the polygon says 75 and 138). The migration's header carries
 * the full reconciliation.
 */

import { supabaseAnon } from '@/lib/data/client'
import { fetchPagedRows } from '@/lib/supabase/paginate'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'

/** HAVING floor the MV applies. A median of two sales is an anecdote. */
export const MIN_CLOSINGS_PER_YEAR = 3

/** The synthetic row: all thirteen districts unioned, same method, same source. */
export const ALL_BEND_DISTRICTS_SLUG = '__bend_districts__'

export type NeighborhoodYearPricingRow = {
  /** `bend-<district>` boundary slug, or ALL_BEND_DISTRICTS_SLUG. */
  geoSlug: string
  geoLabel: string
  year: number
  closings: number
  medianClose: number | null
  medianPpsf: number | null
  totalVolume: number | null
}

type NeighborhoodYearPricingDbRow = {
  geo_slug: string
  geo_label: string
  year: number
  closings: number
  median_close: number | string | null
  median_ppsf: number | string | null
  total_volume: number | string | null
}

function toFiniteOrNull(value: number | string | null): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Pure row mapper, exported for unit tests. */
export function mapNeighborhoodYearPricingRow(
  row: NeighborhoodYearPricingDbRow,
): NeighborhoodYearPricingRow | null {
  const geoSlug = typeof row.geo_slug === 'string' ? row.geo_slug.trim() : ''
  const year = Number(row.year)
  const closings = Number(row.closings)
  if (!geoSlug || !Number.isInteger(year) || !(closings > 0)) return null
  return {
    geoSlug,
    geoLabel:
      typeof row.geo_label === 'string' && row.geo_label.trim() ? row.geo_label.trim() : geoSlug,
    year,
    closings,
    medianClose: toFiniteOrNull(row.median_close),
    medianPpsf: toFiniteOrNull(row.median_ppsf),
    totalVolume: toFiniteOrNull(row.total_volume),
  }
}

/** Pure district/window filter, exported for unit tests. */
export function filterNeighborhoodYearPricing(
  rows: readonly NeighborhoodYearPricingRow[],
  opts: { geoSlug?: string; fromYear?: number; toYear?: number } = {},
): NeighborhoodYearPricingRow[] {
  const geoSlug = opts.geoSlug?.trim().toLowerCase()
  return rows.filter((r) => {
    if (geoSlug && r.geoSlug.toLowerCase() !== geoSlug) return false
    if (opts.fromYear != null && r.year < opts.fromYear) return false
    if (opts.toYear != null && r.year > opts.toYear) return false
    return true
  })
}

async function fetchAllNeighborhoodYearPricing(): Promise<NeighborhoodYearPricingRow[]> {
  const sb = supabaseAnon()
  if (!sb) throw new Error('getNeighborhoodYearPricing: Supabase anon client is not configured.')

  // Paged on a stable (geo_slug, year) order: ~420 rows today, but a district
  // added to public.boundaries grows the table, and PostgREST silently drops
  // everything past 1,000 in one shot (G48).
  const { rows: data, error } = await fetchPagedRows<NeighborhoodYearPricingDbRow>(
    (from, to) =>
      sb
        .from('neighborhood_year_pricing_mv')
        .select('geo_slug, geo_label, year, closings, median_close, median_ppsf, total_volume')
        .order('geo_slug', { ascending: true })
        .order('year', { ascending: true })
        .range(from, to),
    5000,
  )

  // Throw, never return []: unstable_cache must not store a blip (or a
  // not-yet-applied migration) as "this district has no sales history."
  if (error) {
    throw new Error(`neighborhood_year_pricing_mv query failed: ${error.message}`)
  }

  const out: NeighborhoodYearPricingRow[] = []
  for (const row of data) {
    const mapped = mapNeighborhoodYearPricingRow(row)
    if (mapped) out.push(mapped)
  }
  return out
}

/**
 * Every district x year cell, ascending by district then year. One cached
 * pull on the market-stats window; the MV itself refreshes every 15 minutes
 * with the rest of the listing MVs.
 */
export const getAllNeighborhoodYearPricing = makeResilientCached(
  fetchAllNeighborhoodYearPricing,
  ['neighborhood-year-pricing-v1'],
  {
    revalidate: CACHE_WINDOWS.marketStats,
    tags: [cacheTag.market, cacheTag.city('bend')],
  },
  [] as NeighborhoodYearPricingRow[],
)

/** One district's years (or a year window across all districts). */
export async function getNeighborhoodYearPricing(
  opts: { geoSlug?: string; fromYear?: number; toYear?: number } = {},
): Promise<NeighborhoodYearPricingRow[]> {
  const all = await getAllNeighborhoodYearPricing()
  return filterNeighborhoodYearPricing(all, opts)
}
