/**
 * getMarketPulse — current live inventory + activity for a geo.
 *
 * Reads from `public.market_pulse_live` (10–15 minute freshness per
 * docs/DATABASE_FOR_AI_AGENTS.md). Surfaces "what's happening right now"
 * for the homepage activity feed and LP route badges.
 *
 * City/region/neighborhood/community: overlay Market Truth inventory
 * (active + median) when active_count is publishable, even if MOS is below
 * min_n. Community looks up the neighborhood overlay (same membership).
 * MOS/verdict overlay only when the full headline assemble succeeds.
 * Inventory miss or throw withholds active (not pulse 488). Days to
 * pending, new this week, sold 30d stay.
 */

import { z } from 'zod'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached, readOrThrow } from '@/lib/data/cache/resilient'
import {
  overlayDetachedLayers,
  withholdDetachedHeadlines,
  getDetachedOverlays,
  cityDetachedSlug,
} from '@/lib/data/market-truth/getSellBendMarket'
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
  const pulse: MarketPulse = {
    geoType: row.geo_type as GeoType,
    geoSlug: row.geo_slug as string,
    activeCount: row.active_count == null ? null : Number(row.active_count),
    medianListPrice: row.median_list_price as number | null,
    newThisWeek: (row.new_count_7d as number) ?? 0,
    priceDropsThisWeek: Math.round(((row.price_reduction_share as number) ?? 0) * 100),
    closedLast30Days: (row.sold_count_30d as number) ?? 0,
    monthsOfSupply: row.months_of_supply as number | null,
    medianDaysToPending: row.median_days_to_pending as number | null,
    refreshedAt: row.updated_at as IsoTimestamp,
  }
  if (geoType === 'city' || geoType === 'region' || geoType === 'neighborhood' || geoType === 'community') {
    try {
      // Inventory overlays without MOS. Headlines overlay only on full assemble.
      // Throw: withhold active/MOS/verdict/median so pulse 488 is not Market Truth.
      // Community pulse rows overlay the neighborhood membership cells.
      const overlayType = geoType === 'community' ? 'neighborhood' : geoType
      const overlays = await getDetachedOverlays([{ geoType: overlayType, geoSlug }])
      const slug = overlayType === 'region' ? geoSlug.trim().toLowerCase() : cityDetachedSlug(geoSlug)
      const layers = overlays.get(`${overlayType}:${slug}`)
      return overlayDetachedLayers(pulse, layers?.headlines ?? null, layers?.inventory ?? null)
    } catch {
      return withholdDetachedHeadlines(pulse)
    }
  }
  return pulse
}

// v8 2026-08-23 — inventory overlays when active_count is publishable even
// if MOS is below min_n. v7 miss withholds active as null (v6 wrote 0;
// unknown is not zero). v6 withheld overlay fields (v5 overlaid only on
// hit and kept pulse headlines on miss). v4/v5 were poison-null evictions.
export const getMarketPulse = makeResilientCached(
  fetchMarketPulse,
  ['market-pulse-v10-mt-community'],
  {
    revalidate: CACHE_WINDOWS.marketPulse,
    tags: [cacheTag.market],
  },
  null,
)
