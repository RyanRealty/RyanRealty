/**
 * getSubdivisionSalesHistory — yearly closed-sale aggregates for one
 * subdivision plat, powering the sales-history section on
 * /subdivisions/[slug] (W2.5 depth: the 589K-listing historical asset,
 * rendered as market statistics).
 *
 * ODS §5-4 A.4: sold LISTING data is VOW-only — this function deliberately
 * returns ONLY per-year aggregates (year, closed count, median close price),
 * which are market statistics, never individual sold addresses/prices. Do not
 * extend it to return row-level sold listings for public rendering.
 *
 * Query shape (verification trace, §0): ONE server-side aggregate via the
 * get_subdivision_sales_history(p_slug) RPC (migration
 * 20260722043000_subdivision_sales_history_rpc.sql):
 *   SELECT extract(year from "CloseDate")::int,
 *          count(*)::int,
 *          percentile_cont(0.5) within group (order by "ClosePrice")
 *   FROM public.listings
 *   WHERE "PropertyType" = 'A'                       -- SFR-only convention
 *     AND lower(coalesce("StandardStatus",'')) like '%closed%'
 *     AND "CloseDate" is not null and "ClosePrice" > 0
 *     AND slugify_geo("SubdivisionName") = p_slug    -- expression index
 *   GROUP BY 1 ORDER BY 1 DESC
 * No raw listings aggregation happens in app code.
 *
 * FEATURE-DETECT: until the orchestrator applies the migration, PostgREST
 * returns PGRST202 (function not found). The fetch THROWS on every error —
 * makeResilientCached never caches the failure, retries once uncached, and
 * falls back to [] for that render only. The page hides the section on [],
 * so the site fails soft pre-migration and lights up the moment the RPC lands
 * (no poisoned 6h empty cache).
 */

import { supabaseAnon } from '@/lib/data/client'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'

export type SubdivisionSalesYear = {
  /** Calendar year of the closings. */
  year: number
  /** Closed single-family sales in that year. */
  closedCount: number
  /** Median close price across those sales (null if unavailable). */
  medianClosePrice: number | null
}

type RpcRow = {
  sale_year?: number | string | null
  closed_count?: number | string | null
  median_close_price?: number | string | null
}

async function fetchSubdivisionSalesHistory(slug: string): Promise<SubdivisionSalesYear[]> {
  const trimmed = slug.trim().toLowerCase()
  if (!trimmed) return []

  const supabase = supabaseAnon()
  if (!supabase) return []

  const { data, error } = await supabase.rpc('get_subdivision_sales_history', {
    p_slug: trimmed,
  })
  if (error) {
    // Includes PGRST202 (RPC not yet migrated) — throw so the resilient
    // wrapper never caches an empty result for a deployed-tomorrow function.
    throw new Error(
      `get_subdivision_sales_history RPC failed for "${trimmed}": ${error.message}`,
    )
  }

  return ((Array.isArray(data) ? data : []) as RpcRow[])
    .map((row) => {
      const year = Number(row.sale_year)
      const closedCount = Number(row.closed_count)
      if (!Number.isFinite(year) || !Number.isFinite(closedCount) || closedCount <= 0) return null
      const median = row.median_close_price == null ? null : Number(row.median_close_price)
      return {
        year,
        closedCount,
        medianClosePrice: median != null && Number.isFinite(median) ? median : null,
      }
    })
    .filter((r): r is SubdivisionSalesYear => r !== null)
    .sort((a, b) => b.year - a.year)
}

/** Cached 6h — closed history only moves on new closings. */
export const getSubdivisionSalesHistory = makeResilientCached(
  fetchSubdivisionSalesHistory,
  ['subdivision-sales-history-v1'],
  {
    revalidate: CACHE_WINDOWS.marketStats,
    tags: [cacheTag.market],
  },
  [],
)
