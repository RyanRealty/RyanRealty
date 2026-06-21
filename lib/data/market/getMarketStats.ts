/**
 * getMarketStats — period-anchored CLOSED-SALES stats for a geo.
 *
 * Reads from `public.market_stats_cache` (6-hour freshness). This cache holds
 * closed-sales aggregates: median sale price, median DOM, sold count, avg
 * sale-to-list, YoY median-price change, end-of-period inventory.
 *
 * It does NOT hold current-inventory metrics (median LIST price, months of
 * supply) — those live in market_pulse_live (getMarketPulse), so those fields
 * are null in the returned MarketStats. (For the fuller stats-cache projection
 * — price/sqft, market health, cash share, concessions — use getCityMarketDetail.)
 *
 * BUGFIX 2026-06-05: the prior select listed median_list_price, months_of_supply,
 * sale_to_list_ratio, active_count, yoy_change_pct, and refreshed_at — none of
 * which exist in market_stats_cache — so every call errored and the function
 * always returned null. Now selects only confirmed-existing columns.
 */

import { z } from 'zod'
import { marketVerdict } from '@/lib/market/classify'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached, readOrThrow } from '@/lib/data/cache/resilient'
import type { GeoType, IsoTimestamp } from '@/lib/data/types/shared'
import type { MarketStats, MoSVerdict } from '@/lib/data/types/market'

const InputSchema = z.object({
  geoType: z.enum(['city', 'neighborhood', 'community', 'subdivision', 'zip', 'region']),
  geoSlug: z.string().min(1).max(200),
  periodType: z
    .enum(['rolling_30d', 'rolling_90d', 'rolling_365d', 'monthly', 'ytd'])
    .default('rolling_90d'),
})

type GetMarketStatsInput = z.input<typeof InputSchema>

function classifyMoS(mos: number | null): MoSVerdict | null {
  // Thresholds live in lib/market/classify.ts (audit p0.4b — single source).
  const kind = marketVerdict(mos).kind
  return kind === 'unknown' ? null : kind
}

async function fetchMarketStats(input: GetMarketStatsInput): Promise<MarketStats | null> {
    const { geoType, geoSlug, periodType } = InputSchema.parse(input)

    // market_stats_cache is a public table (no RLS, no cookies). Use
    // supabaseAnon so this function is safe inside unstable_cache.
    const supabase = supabaseAnon()
    if (!supabase) return null
    // readOrThrow THROWS on a transient DB error so a blip is never cached as
    // "Not available" across the market pages for the whole TTL. Genuine miss
    // (no cached row for this geo/period) still returns null.
    const data = await readOrThrow(`getMarketStats(${geoType}:${geoSlug}:${periodType})`, () =>
      supabase
        .from('market_stats_cache')
        .select(
          // Confirmed-existing market_stats_cache columns only (verified 2026-06-05).
          'geo_type, geo_slug, period_type, period_start, period_end, ' +
            'median_sale_price, median_dom, avg_sale_to_list_ratio, sold_count, ' +
            'end_of_period_inventory, yoy_median_price_delta_pct, ' +
            'updated_at, methodology_version'
        )
        .eq('geo_type', geoType)
        .eq('geo_slug', geoSlug)
        .eq('period_type', periodType)
        .order('period_end', { ascending: false })
        .limit(1)
        .maybeSingle(),
    )
    if (!data) return null

    const row = data as unknown as Record<string, unknown>
    // Current-inventory fields (median list price, months of supply) are not in
    // the sales cache, so they are null here. Callers needing them read the
    // pulse (getMarketPulse). mosVerdict therefore resolves to null.
    const monthsOfSupply: number | null = null
    return {
      geoType: row.geo_type as GeoType,
      geoSlug: row.geo_slug as string,
      periodType: row.period_type as MarketStats['periodType'],
      periodStart: row.period_start as IsoTimestamp,
      periodEnd: row.period_end as IsoTimestamp,
      medianSalePrice: row.median_sale_price as number | null,
      medianListPrice: null,
      medianDaysOnMarket: row.median_dom as number | null,
      monthsOfSupply,
      mosVerdict: classifyMoS(monthsOfSupply),
      saleToListRatio: row.avg_sale_to_list_ratio as number | null,
      soldCount: row.sold_count as number | null,
      // "active" for the period = end-of-period inventory (the cache's count).
      activeCount: row.end_of_period_inventory as number | null,
      yoyChangePct: row.yoy_median_price_delta_pct as number | null,
      refreshedAt: row.updated_at as IsoTimestamp,
      methodologyVersion: (row.methodology_version as string) ?? 'unknown',
    }
}

// v2 cache-key bump 2026-05-31 — evict poison-null entries cached before the
// throw-on-error fix. makeResilientCached: error throws (never cached) + one
// uncached retry before falling back to null.
export const getMarketStats = makeResilientCached(
  fetchMarketStats,
  ['market-stats-v2'],
  {
    revalidate: CACHE_WINDOWS.marketStats,
    tags: [cacheTag.market],
  },
  null,
)
