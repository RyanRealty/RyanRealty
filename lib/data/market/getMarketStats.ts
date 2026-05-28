/**
 * getMarketStats — fetch period-anchored market stats for a geo.
 *
 * Reads from `public.market_stats_cache` (6-hour freshness per the canonical
 * DB doc). This is the table the marketing brain refreshes every 6 hours
 * with median sale, DOM, MoS, YoY, etc.
 *
 * No MV dependency — implementation is real and usable today.
 */

import { unstable_cache } from 'next/cache'
import { z } from 'zod'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
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
  if (mos == null || !Number.isFinite(mos)) return null
  if (mos <= 4) return 'sellers'
  if (mos < 6) return 'balanced'
  return 'buyers'
}

export const getMarketStats = unstable_cache(
  async (input: GetMarketStatsInput): Promise<MarketStats | null> => {
    const { geoType, geoSlug, periodType } = InputSchema.parse(input)

    // market_stats_cache is a public table (no RLS, no cookies). Use
    // supabaseAnon so this function is safe inside unstable_cache.
    // See lib/data/brokers/getBrokers.ts for the original of this bug
    // fixed earlier today.
    const supabase = supabaseAnon()
    if (!supabase) return null
    const { data, error } = await supabase
      .from('market_stats_cache')
      .select(
        'geo_type, geo_slug, period_type, period_start, period_end, ' +
          'median_sale_price, median_list_price, median_dom, months_of_supply, ' +
          'sale_to_list_ratio, sold_count, active_count, yoy_change_pct, ' +
          'refreshed_at, methodology_version'
      )
      .eq('geo_type', geoType)
      .eq('geo_slug', geoSlug)
      .eq('period_type', periodType)
      .order('period_end', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[getMarketStats]', { geoType, geoSlug, periodType, error })
      return null
    }
    if (!data) return null

    const row = data as unknown as Record<string, unknown>
    const monthsOfSupply = row.months_of_supply as number | null
    return {
      geoType: row.geo_type as GeoType,
      geoSlug: row.geo_slug as string,
      periodType: row.period_type as MarketStats['periodType'],
      periodStart: row.period_start as IsoTimestamp,
      periodEnd: row.period_end as IsoTimestamp,
      medianSalePrice: row.median_sale_price as number | null,
      medianListPrice: row.median_list_price as number | null,
      medianDaysOnMarket: row.median_dom as number | null,
      monthsOfSupply,
      mosVerdict: classifyMoS(monthsOfSupply),
      saleToListRatio: row.sale_to_list_ratio as number | null,
      soldCount: row.sold_count as number | null,
      activeCount: row.active_count as number | null,
      yoyChangePct: row.yoy_change_pct as number | null,
      refreshedAt: row.refreshed_at as IsoTimestamp,
      methodologyVersion: (row.methodology_version as string) ?? 'unknown',
    }
  },
  ['market-stats'],
  {
    revalidate: CACHE_WINDOWS.marketStats,
    tags: [cacheTag.market],
  }
)
