/**
 * getMarketPulseSnapshot — full market_pulse_live row(s) for the homepage
 * pulse feed interstitial. Wider projection than getMarketPulse (carries
 * months_of_supply, market_health_label, median_active_dom, etc.) needed
 * by the interstitial card.
 *
 * Lives behind the DAL boundary; pulse-feed.ts delegates to this.
 */

import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'

export type MarketPulseSnapshot = {
  geo_slug: string
  geo_label: string
  active_count: number
  median_list_price: number | null
  months_of_supply: number | null
  market_health_label: string | null
  sold_count_30d: number
  new_count_7d: number
  median_active_dom: number | null
  /** Median days LIST->PENDING for homes that went under contract. A different
   *  population from median_active_dom (unsold inventory age), and much smaller:
   *  Sisters 16 vs 85, Bend 15 vs 57 (live 2026-07-24). (§0) */
  median_days_to_pending: number | null
  updated_at: string | null
}

const COLUMNS =
  'geo_slug, geo_label, active_count, median_list_price, months_of_supply, market_health_label, sold_count_30d, new_count_7d, median_active_dom, median_days_to_pending, updated_at'

function toSnapshot(d: Record<string, unknown>): MarketPulseSnapshot {
  return {
    geo_slug: String(d.geo_slug ?? ''),
    geo_label: String(d.geo_label ?? ''),
    active_count: Number(d.active_count ?? 0),
    median_list_price: d.median_list_price != null ? Number(d.median_list_price) : null,
    months_of_supply: d.months_of_supply != null ? Number(d.months_of_supply) : null,
    market_health_label: (d.market_health_label as string | null) ?? null,
    sold_count_30d: Number(d.sold_count_30d ?? 0),
    new_count_7d: Number(d.new_count_7d ?? 0),
    median_active_dom: d.median_active_dom != null ? Number(d.median_active_dom) : null,
    median_days_to_pending: d.median_days_to_pending != null ? Number(d.median_days_to_pending) : null,
    updated_at: (d.updated_at as string | null) ?? null,
  }
}

/** Region snapshot by slug. Returns null if not found. */
export async function getMarketPulseRegionSnapshot(
  regionSlug: string
): Promise<MarketPulseSnapshot | null> {
  const sb = supabaseAnon()
  if (!sb) return null
  const { data, error } = await sb
    .from('market_pulse_live')
    .select(COLUMNS)
    .eq('geo_type', 'region')
    .eq('property_type', 'A')
    .eq('geo_slug', regionSlug)
    .maybeSingle()
  if (error || !data) return null
  return toSnapshot(data as Record<string, unknown>)
}

/** Inner fetch for city snapshots. THROWS on a query error so the resilient
 * cache never stores a transient failure as an empty list (the hub, region,
 * and every city page render their comparison tiles from this — an [] here
 * silently blanks those sections for a full cache window). */
async function fetchMarketPulseCitySnapshots(
  cityLabels: string[]
): Promise<MarketPulseSnapshot[]> {
  const sb = supabaseAnon()
  if (!sb || cityLabels.length === 0) return []
  const { data, error } = await sb
    .from('market_pulse_live')
    .select(COLUMNS)
    .eq('geo_type', 'city')
    .eq('property_type', 'A')
    .in('geo_label', cityLabels)
  if (error) throw new Error(`market_pulse_live city snapshots: ${error.message}`)
  return ((data ?? []) as Array<Record<string, unknown>>).map(toSnapshot)
}

/** City snapshots by geo_label (display name, not slug). Resilient-cached —
 * previously the ONLY uncached DAL fn on the housing-market routes (every ISR
 * render hit the DB and a blip rendered empty tiles). */
export const getMarketPulseCitySnapshots = makeResilientCached(
  fetchMarketPulseCitySnapshots,
  ['market-pulse-city-snapshots-v1'],
  {
    revalidate: CACHE_WINDOWS.marketPulse,
    tags: [cacheTag.market],
  },
  [],
)
