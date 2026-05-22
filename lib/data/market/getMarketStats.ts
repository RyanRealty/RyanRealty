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
import { supabaseServer } from '@/lib/data/client'
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

    const supabase = await supabaseServer()
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

    const monthsOfSupply = data.months_of_supply as number | null
    return {
      geoType: data.geo_type as GeoType,
      geoSlug: data.geo_slug as string,
      periodType: data.period_type as MarketStats['periodType'],
      periodStart: data.period_start as IsoTimestamp,
      periodEnd: data.period_end as IsoTimestamp,
      medianSalePrice: data.median_sale_price as number | null,
      medianListPrice: data.median_list_price as number | null,
      medianDaysOnMarket: data.median_dom as number | null,
      monthsOfSupply,
      mosVerdict: classifyMoS(monthsOfSupply),
      saleToListRatio: data.sale_to_list_ratio as number | null,
      soldCount: data.sold_count as number | null,
      activeCount: data.active_count as number | null,
      yoyChangePct: data.yoy_change_pct as number | null,
      refreshedAt: data.refreshed_at as IsoTimestamp,
      methodologyVersion: (data.methodology_version as string) ?? 'unknown',
    }
  },
  ['market-stats'],
  {
    revalidate: CACHE_WINDOWS.marketStats,
    tags: [cacheTag.market],
  }
)
