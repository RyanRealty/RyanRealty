/**
 * getMarketPulse — current live inventory + activity for a geo.
 *
 * Reads from `public.market_pulse_live` (10–15 minute freshness per
 * docs/DATABASE_FOR_AI_AGENTS.md). Surfaces "what's happening right now"
 * for the homepage activity feed and LP route badges.
 */

import { unstable_cache } from 'next/cache'
import { z } from 'zod'
import { supabaseServer } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import type { GeoType, IsoTimestamp } from '@/lib/data/types/shared'
import type { MarketPulse } from '@/lib/data/types/market'

const InputSchema = z.object({
  geoType: z.enum(['city', 'neighborhood', 'community', 'subdivision', 'zip', 'region']),
  geoSlug: z.string().min(1).max(200),
})

type GetMarketPulseInput = z.input<typeof InputSchema>

export const getMarketPulse = unstable_cache(
  async (input: GetMarketPulseInput): Promise<MarketPulse | null> => {
    const { geoType, geoSlug } = InputSchema.parse(input)

    const supabase = await supabaseServer()
    const { data, error } = await supabase
      .from('market_pulse_live')
      .select(
        'geo_type, geo_slug, active_count, median_list_price, new_this_week, ' +
          'price_drops_this_week, closed_last_30_days, refreshed_at'
      )
      .eq('geo_type', geoType)
      .eq('geo_slug', geoSlug)
      .maybeSingle()

    if (error) {
      console.error('[getMarketPulse]', { geoType, geoSlug, error })
      return null
    }
    if (!data) return null

    return {
      geoType: data.geo_type as GeoType,
      geoSlug: data.geo_slug as string,
      activeCount: (data.active_count as number) ?? 0,
      medianListPrice: data.median_list_price as number | null,
      newThisWeek: (data.new_this_week as number) ?? 0,
      priceDropsThisWeek: (data.price_drops_this_week as number) ?? 0,
      closedLast30Days: (data.closed_last_30_days as number) ?? 0,
      refreshedAt: data.refreshed_at as IsoTimestamp,
    }
  },
  ['market-pulse'],
  {
    revalidate: CACHE_WINDOWS.marketPulse,
    tags: [cacheTag.market],
  }
)
