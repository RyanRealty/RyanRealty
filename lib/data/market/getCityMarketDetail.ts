/**
 * getCityMarketDetail — fetch the full market_stats_cache projection for a geo.
 *
 * Unlike getMarketStats (which selects 6 non-existent columns), this function
 * selects ONLY the confirmed-existing columns verified against live production
 * data as of 2026-06-05. It is the correct DAL for the per-city market report
 * detail section.
 *
 * Reads from `public.market_stats_cache` (6-hour freshness). Uses supabaseAnon
 * so it is safe inside unstable_cache. Throws on transient DB error (never
 * caches an error result) via makeResilientCached + readOrThrow.
 *
 * §0 trace — every returned field maps 1:1 to a verified column:
 *   geo_type, geo_slug, geo_label, period_type, period_start, period_end,
 *   median_sale_price, avg_sale_price, total_volume, sold_count, median_dom,
 *   median_price_per_sqft_closed, avg_sale_to_list_ratio,
 *   yoy_median_price_delta_pct, yoy_ppsf_change_pct, yoy_dom_change,
 *   market_health_label, market_health_score, end_of_period_inventory,
 *   cash_purchase_pct, median_concessions_amount, updated_at,
 *   methodology_version
 */

import { z } from 'zod'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached, readOrThrow } from '@/lib/data/cache/resilient'
import type { GeoType, IsoTimestamp } from '@/lib/data/types/shared'
import type { MarketDetail } from '@/lib/data/types/market'

const InputSchema = z.object({
  geoType: z.enum(['city', 'neighborhood', 'community', 'subdivision', 'zip', 'region']),
  geoSlug: z.string().min(1).max(200),
  periodType: z
    .enum(['rolling_30d', 'rolling_90d', 'rolling_365d', 'monthly', 'ytd'])
    .default('monthly'),
})

type GetCityMarketDetailInput = z.input<typeof InputSchema>

/** Confirmed-existing columns in market_stats_cache (verified 2026-06-05). */
const SELECT_COLUMNS =
  'geo_type, geo_slug, geo_label, period_type, period_start, period_end, ' +
  'median_sale_price, avg_sale_price, total_volume, sold_count, median_dom, ' +
  'median_price_per_sqft_closed, avg_sale_to_list_ratio, ' +
  'yoy_median_price_delta_pct, yoy_ppsf_change_pct, yoy_dom_change, ' +
  'market_health_label, market_health_score, end_of_period_inventory, ' +
  'cash_purchase_pct, median_concessions_amount, updated_at, methodology_version'

async function fetchCityMarketDetail(
  input: GetCityMarketDetailInput,
): Promise<MarketDetail | null> {
  const { geoType, geoSlug, periodType } = InputSchema.parse(input)

  const supabase = supabaseAnon()
  if (!supabase) return null

  const data = await readOrThrow(
    `getCityMarketDetail(${geoType}:${geoSlug}:${periodType})`,
    () =>
      supabase
        .from('market_stats_cache')
        .select(SELECT_COLUMNS)
        .eq('geo_type', geoType)
        .eq('geo_slug', geoSlug)
        .eq('period_type', periodType)
        .order('period_end', { ascending: false })
        .limit(1)
        .maybeSingle(),
  )

  if (!data) return null

  const row = data as unknown as Record<string, unknown>

  return {
    geoType: row.geo_type as GeoType,
    geoSlug: row.geo_slug as string,
    geoLabel: (row.geo_label as string | null) ?? null,
    periodType: row.period_type as MarketDetail['periodType'],
    periodStart: (row.period_start as IsoTimestamp | null) ?? null,
    periodEnd: (row.period_end as IsoTimestamp | null) ?? null,
    medianSalePrice: (row.median_sale_price as number | null) ?? null,
    avgSalePrice: (row.avg_sale_price as number | null) ?? null,
    totalVolume: (row.total_volume as number | null) ?? null,
    soldCount: (row.sold_count as number | null) ?? null,
    medianDom: (row.median_dom as number | null) ?? null,
    medianPricePerSqft: (row.median_price_per_sqft_closed as number | null) ?? null,
    avgSaleToListRatio: (row.avg_sale_to_list_ratio as number | null) ?? null,
    yoyMedianPriceDeltaPct: (row.yoy_median_price_delta_pct as number | null) ?? null,
    yoyPpsfChangePct: (row.yoy_ppsf_change_pct as number | null) ?? null,
    yoyDomChange: (row.yoy_dom_change as number | null) ?? null,
    marketHealthLabel: (row.market_health_label as string | null) ?? null,
    marketHealthScore: (row.market_health_score as number | null) ?? null,
    endOfPeriodInventory: (row.end_of_period_inventory as number | null) ?? null,
    cashPurchasePct: (row.cash_purchase_pct as number | null) ?? null,
    medianConcessionsAmount: (row.median_concessions_amount as number | null) ?? null,
    updatedAt: (row.updated_at as IsoTimestamp | null) ?? null,
    methodologyVersion: (row.methodology_version as string | null) ?? null,
  }
}

// Cache-key version bump pattern matches getMarketStats.ts convention.
// 'market-detail-v1' is a fresh key — no prior poison-null entries to evict.
export const getCityMarketDetail = makeResilientCached(
  fetchCityMarketDetail,
  ['market-detail-v1'],
  {
    revalidate: CACHE_WINDOWS.marketStats,
    tags: [cacheTag.market],
  },
  null,
)

/**
 * The three timeframe rows the KbTimeframeStats selector renders (W8.4): YTD
 * (default), trailing month, and rolling 12 months — each the most-recent
 * market_stats_cache row for its period_type. Fans out to the cached
 * getCityMarketDetail so every period keeps its own cache entry + tag; a null
 * period (no cache row) renders as em-dash, never fabricated. Any transient DB
 * error on one period resolves that slot to null — the others still render.
 */
export async function getCityMarketDetailByTimeframe(
  geoType: GetCityMarketDetailInput['geoType'],
  geoSlug: string,
): Promise<{ ytd: MarketDetail | null; monthly: MarketDetail | null; rolling_365d: MarketDetail | null }> {
  const [ytd, monthly, rolling_365d] = await Promise.all([
    getCityMarketDetail({ geoType, geoSlug, periodType: 'ytd' }).catch(() => null),
    getCityMarketDetail({ geoType, geoSlug, periodType: 'monthly' }).catch(() => null),
    getCityMarketDetail({ geoType, geoSlug, periodType: 'rolling_365d' }).catch(() => null),
  ])
  return { ytd, monthly, rolling_365d }
}

const CompleteMonthlyInput = z.object({
  geoType: InputSchema.shape.geoType,
  geoSlug: z.string().min(1).max(200),
  /** Pacific YYYY-MM. Rows with period_start on or after this month are dropped. */
  currentMonthKey: z.string().regex(/^\d{4}-\d{2}$/),
})

async function fetchCompleteMonthlyMarketDetail(input: z.input<typeof CompleteMonthlyInput>): Promise<MarketDetail | null> {
  const { geoType, geoSlug, currentMonthKey } = CompleteMonthlyInput.parse(input)
  const supabase = supabaseAnon()
  if (!supabase) return null

  const before = `${currentMonthKey}-01`
  const data = await readOrThrow(
    `getCompleteMonthlyMarketDetail(${geoType}:${geoSlug}:${currentMonthKey})`,
    () =>
      supabase
        .from('market_stats_cache')
        .select(SELECT_COLUMNS)
        .eq('geo_type', geoType)
        .eq('geo_slug', geoSlug)
        .eq('period_type', 'monthly')
        .lt('period_start', before)
        .order('period_end', { ascending: false })
        .limit(1)
        .maybeSingle(),
  )
  if (!data) return null
  const row = data as unknown as Record<string, unknown>
  return {
    geoType: row.geo_type as GeoType,
    geoSlug: row.geo_slug as string,
    geoLabel: (row.geo_label as string | null) ?? null,
    periodType: row.period_type as MarketDetail['periodType'],
    periodStart: (row.period_start as IsoTimestamp | null) ?? null,
    periodEnd: (row.period_end as IsoTimestamp | null) ?? null,
    medianSalePrice: (row.median_sale_price as number | null) ?? null,
    avgSalePrice: (row.avg_sale_price as number | null) ?? null,
    totalVolume: (row.total_volume as number | null) ?? null,
    soldCount: (row.sold_count as number | null) ?? null,
    medianDom: (row.median_dom as number | null) ?? null,
    medianPricePerSqft: (row.median_price_per_sqft_closed as number | null) ?? null,
    avgSaleToListRatio: (row.avg_sale_to_list_ratio as number | null) ?? null,
    yoyMedianPriceDeltaPct: (row.yoy_median_price_delta_pct as number | null) ?? null,
    yoyPpsfChangePct: (row.yoy_ppsf_change_pct as number | null) ?? null,
    yoyDomChange: (row.yoy_dom_change as number | null) ?? null,
    marketHealthLabel: (row.market_health_label as string | null) ?? null,
    marketHealthScore: (row.market_health_score as number | null) ?? null,
    endOfPeriodInventory: (row.end_of_period_inventory as number | null) ?? null,
    cashPurchasePct: (row.cash_purchase_pct as number | null) ?? null,
    medianConcessionsAmount: (row.median_concessions_amount as number | null) ?? null,
    updatedAt: (row.updated_at as IsoTimestamp | null) ?? null,
    methodologyVersion: (row.methodology_version as string | null) ?? null,
  }
}

/** Last completed monthly cache row. Does not return the in-progress month. */
export const getCompleteMonthlyMarketDetail = makeResilientCached(
  fetchCompleteMonthlyMarketDetail,
  ['market-detail-complete-monthly-v1'],
  {
    revalidate: CACHE_WINDOWS.marketStats,
    tags: [cacheTag.market],
  },
  null,
)
