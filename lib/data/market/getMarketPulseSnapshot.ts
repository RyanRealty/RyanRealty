/**
 * getMarketPulseSnapshot — full market_pulse_live row(s) for the homepage
 * pulse feed interstitial. Wider projection than getMarketPulse (carries
 * months_of_supply, market_health_label, median_active_dom, etc.) needed
 * by the interstitial card.
 *
 * Lives behind the DAL boundary; pulse-feed.ts delegates to this.
 */

import { supabaseAnon } from '@/lib/data/client'

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
  updated_at: string | null
}

const COLUMNS =
  'geo_slug, geo_label, active_count, median_list_price, months_of_supply, market_health_label, sold_count_30d, new_count_7d, median_active_dom, updated_at'

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

/** City snapshots by geo_label (display name, not slug). */
export async function getMarketPulseCitySnapshots(
  cityLabels: string[]
): Promise<MarketPulseSnapshot[]> {
  const sb = supabaseAnon()
  if (!sb || cityLabels.length === 0) return []
  const { data } = await sb
    .from('market_pulse_live')
    .select(COLUMNS)
    .eq('geo_type', 'city')
    .eq('property_type', 'A')
    .in('geo_label', cityLabels)
  return ((data ?? []) as Array<Record<string, unknown>>).map(toSnapshot)
}
