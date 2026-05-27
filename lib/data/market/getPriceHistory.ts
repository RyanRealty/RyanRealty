/**
 * getPriceHistory — fetch a sequence of price-history points for a
 * (geoType, geoSlug, periodType) tuple.
 *
 * Reads from `public.market_stats_cache` — the same source backing
 * `getMarketStats`. Each row in the cache is one period's stats; this
 * function returns the SEQUENCE of periods, ordered oldest to newest,
 * for chart rendering (price history line, sold-count bars, YoY
 * comparisons).
 *
 * Used by:
 *   - Listing detail price-history chart (city-level context)
 *   - Market reports page (the headline trend chart)
 *   - Future neighborhood/community LP price trend modules
 *
 * Per docs/CLAUDE.md §0: cache data only — do not aggregate raw
 * `listings` here. market_stats_cache is computed by the
 * `compute_and_cache_period_stats()` Postgres function and refreshed
 * by `/api/cron/refresh-market-stats` (daily 07:00 UTC) +
 * `refresh-market-stats-monthly-recompute` (Sundays 04:00 UTC).
 *
 * Cache: 6h `unstable_cache` window matching the underlying refresh
 * cadence. Tag `market` flushes if upstream cron re-runs early.
 */

import { unstable_cache } from 'next/cache'
import { z } from 'zod'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import type { GeoType } from '@/lib/data/types/shared'
import type { PriceHistoryPoint, MarketStats } from '@/lib/data/types/market'

type PeriodType = MarketStats['periodType']

const InputSchema = z.object({
  geoType: z.enum(['region', 'city', 'community', 'neighborhood', 'zip', 'subdivision']),
  geoSlug: z.string().min(1).max(120),
  periodType: z.enum(['rolling_30d', 'rolling_90d', 'rolling_365d', 'monthly', 'ytd']).default('monthly'),
  limit: z.number().int().min(1).max(120).default(24),
})

type Row = {
  period_start: string
  median_sale_price: number | null
  sold_count: number | null
}

async function fetchHistory(
  geoType: GeoType,
  geoSlug: string,
  periodType: PeriodType,
  limit: number,
): Promise<PriceHistoryPoint[]> {
  const sb = supabaseAnon()
  if (!sb) return []
  const { data, error } = await sb
    .from('market_stats_cache')
    .select('period_start, median_sale_price, sold_count')
    .eq('geo_type', geoType)
    .eq('geo_slug', geoSlug)
    .eq('period_type', periodType)
    .order('period_start', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('[getPriceHistory]', { geoType, geoSlug, periodType, error })
    return []
  }
  // Reverse to chronological (oldest → newest) for chart consumers.
  return ((data ?? []) as Row[])
    .map((r) => ({
      periodStart: r.period_start,
      medianSalePrice: r.median_sale_price,
      soldCount: r.sold_count,
    }))
    .reverse()
}

export const getPriceHistory = (
  geoType: GeoType,
  geoSlug: string,
  periodType: PeriodType = 'monthly',
  limit: number = 24,
): Promise<PriceHistoryPoint[]> => {
  InputSchema.parse({ geoType, geoSlug, periodType, limit })
  return unstable_cache(
    () => fetchHistory(geoType, geoSlug, periodType, limit),
    ['price-history', geoType, geoSlug, periodType, String(limit)],
    {
      revalidate: CACHE_WINDOWS.marketStats,
      tags: [cacheTag.market],
    },
  )()
}
