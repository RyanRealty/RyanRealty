/**
 * getMarketPulse — current live inventory + activity for a geo.
 *
 * Reads from `public.market_pulse_live` (10–15 minute freshness per
 * docs/DATABASE_FOR_AI_AGENTS.md). Surfaces "what's happening right now"
 * for the homepage activity feed and LP route badges.
 */

import { unstable_cache } from 'next/cache'
import { z } from 'zod'
import { supabaseAnon } from '@/lib/data/client'
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

    // market_pulse_live is a public view (no RLS, no cookies). Use
    // supabaseAnon so this function is safe inside unstable_cache.
    // supabaseServer() reads cookies() which Next.js forbids in a
    // cache scope — same bug fixed in lib/data/brokers/getBrokers.ts
    // earlier this session.
    const supabase = supabaseAnon()
    if (!supabase) return null
    // property_type='A' is the SFR-only convention every Ryan Realty surface
    // follows (CLAUDE.md §0, docs/DATABASE_FOR_AI_AGENTS.md §0). market_pulse_live
    // holds one row per (geo_type, geo_slug, property_type); without this filter
    // .maybeSingle() breaks the day a non-'A' row lands. getRegionPulse already
    // pins 'A' — this keeps the city path consistent with it.
    const { data, error } = await supabase
      .from('market_pulse_live')
      .select(
        'geo_type, geo_slug, active_count, median_list_price, new_count_7d, ' +
          'price_reduction_share, sold_count_30d, months_of_supply, ' +
          'median_days_to_pending, updated_at',
      )
      .eq('geo_type', geoType)
      .eq('geo_slug', geoSlug)
      .eq('property_type', 'A')
      .maybeSingle()

    if (error) {
      console.error('[getMarketPulse]', { geoType, geoSlug, error })
      return null
    }
    if (!data) return null

    const row = data as unknown as Record<string, unknown>
    return {
      geoType: row.geo_type as GeoType,
      geoSlug: row.geo_slug as string,
      activeCount: (row.active_count as number) ?? 0,
      medianListPrice: row.median_list_price as number | null,
      newThisWeek: (row.new_count_7d as number) ?? 0,
      priceDropsThisWeek: Math.round(((row.price_reduction_share as number) ?? 0) * 100),
      closedLast30Days: (row.sold_count_30d as number) ?? 0,
      monthsOfSupply: row.months_of_supply as number | null,
      medianDaysToPending: row.median_days_to_pending as number | null,
      refreshedAt: row.updated_at as IsoTimestamp,
    }
  },
  // v2 cache-key bump 2026-05-28 — old key entries hold null from when
  // the function queried non-existent columns (refreshed_at / new_this_week /
  // price_drops_this_week / closed_last_30_days) and from when it was
  // shipping cookies-in-cache errors. Fresh slot for the corrected
  // schema (updated_at / new_count_7d / price_reduction_share /
  // sold_count_30d / months_of_supply / median_days_to_pending).
  // v3 bump 2026-05-28 — v2 holds null from before the anon-read RLS
  // policy landed on market_pulse_live + market_stats_cache (migration
  // 20260528010000_anon_read_market_tables.sql).
  ['market-pulse-v3'],
  {
    revalidate: CACHE_WINDOWS.marketPulse,
    tags: [cacheTag.market],
  }
)
