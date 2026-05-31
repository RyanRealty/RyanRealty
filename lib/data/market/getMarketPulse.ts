/**
 * getMarketPulse — current live inventory + activity for a geo.
 *
 * Reads from `public.market_pulse_live` (10–15 minute freshness per
 * docs/DATABASE_FOR_AI_AGENTS.md). Surfaces "what's happening right now"
 * for the homepage activity feed and LP route badges.
 */

import { z } from 'zod'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached, readOrThrow } from '@/lib/data/cache/resilient'
import type { GeoType, IsoTimestamp } from '@/lib/data/types/shared'
import type { MarketPulse } from '@/lib/data/types/market'

const InputSchema = z.object({
  geoType: z.enum(['city', 'neighborhood', 'community', 'subdivision', 'zip', 'region']),
  geoSlug: z.string().min(1).max(200),
})

type GetMarketPulseInput = z.input<typeof InputSchema>

async function fetchMarketPulse(input: GetMarketPulseInput): Promise<MarketPulse | null> {
  const { geoType, geoSlug } = InputSchema.parse(input)

  // market_pulse_live is a public view (no RLS, no cookies). Use
  // supabaseAnon so this function is safe inside unstable_cache.
  const supabase = supabaseAnon()
  if (!supabase) return null
  // property_type='A' is the SFR-only convention every Ryan Realty surface
  // follows (CLAUDE.md §0). market_pulse_live holds one row per
  // (geo_type, geo_slug, property_type).
  //
  // readOrThrow THROWS on a transient DB error (after retries) instead of
  // returning null — so a pooler 25P02 / timeout never gets cached as an
  // em-dash KPI on the homepage. A genuine miss (no row) still returns null.
  const data = await readOrThrow(`getMarketPulse(${geoType}:${geoSlug})`, () =>
    supabase
      .from('market_pulse_live')
      .select(
        'geo_type, geo_slug, active_count, median_list_price, new_count_7d, ' +
          'price_reduction_share, sold_count_30d, months_of_supply, ' +
          'median_days_to_pending, updated_at',
      )
      .eq('geo_type', geoType)
      .eq('geo_slug', geoSlug)
      .eq('property_type', 'A')
      .maybeSingle(),
  )
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
}

// v4 cache-key bump 2026-05-31 — evicts poison-null entries cached before the
// throw-on-error fix (prior v2/v3 bumps were the same class of bug via different
// triggers). makeResilientCached: error throws (never cached) + one uncached
// retry before falling back to null.
export const getMarketPulse = makeResilientCached(
  fetchMarketPulse,
  ['market-pulse-v4'],
  {
    revalidate: CACHE_WINDOWS.marketPulse,
    tags: [cacheTag.market],
  },
  null,
)
