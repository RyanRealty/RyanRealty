/**
 * Real-estate KPIs per golf community — pulled from market_stats_cache
 * (canonical pre-aggregated table per CLAUDE.md §0).
 *
 * The 12 golf-adjacent resort communities each have a row keyed by
 * geo_slug in market_stats_cache. We pull the 12-month rolling stat row
 * and surface median sale price + active inventory + sold-12mo count on
 * the LP's Where-to-Live cards.
 *
 * Per CLAUDE.md §0: every figure traces to market_stats_cache rows
 * with a documented period_type, computed_at timestamp, and the
 * methodology_version that produced them. The page renders the
 * computed_at date as a freshness signal.
 *
 * Fail-safe: if the cache row is missing for a community, we render
 * the card without KPIs rather than showing a wrong number.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

export interface GolfCommunityKpi {
  geoSlug: string
  medianSalePrice: number | null
  soldCount12mo: number | null
  activeInventory: number | null
  medianDom: number | null
  computedAt: string | null
  methodologyVersion: string | null
}

const GOLF_COMMUNITY_SLUGS = [
  'tetherow',
  'broken-top',
  'pronghorn',
  'sunriver',
  'caldera-springs',
  'crosswater',
  'black-butte-ranch',
  'brasada-ranch',
  'eagle-crest',
  'awbrey-glen',
  'widgi-creek',
  'three-rivers',
] as const

export type GolfCommunitySlug = (typeof GOLF_COMMUNITY_SLUGS)[number]

export async function loadGolfCommunityKpis(): Promise<Record<GolfCommunitySlug, GolfCommunityKpi | null>> {
  const supabase = createServiceClient()
  // Pull the most recent rolling_365d row per geo_slug.
  const { data, error } = await supabase
    .from('market_stats_cache')
    .select(
      'geo_slug, median_sale_price, sold_count, end_of_period_inventory, median_dom, computed_at, methodology_version, period_end',
    )
    .in('geo_slug', GOLF_COMMUNITY_SLUGS as unknown as string[])
    .eq('period_type', 'rolling_365d')
    .order('period_end', { ascending: false })

  const out: Record<string, GolfCommunityKpi | null> = {}
  for (const s of GOLF_COMMUNITY_SLUGS) out[s] = null

  if (error) {
    console.warn('[golf-lp] kpi query failed:', error.message)
    return out as Record<GolfCommunitySlug, GolfCommunityKpi | null>
  }
  if (!data) return out as Record<GolfCommunitySlug, GolfCommunityKpi | null>

  // Take the FIRST row per geo_slug — that's the freshest period_end.
  for (const row of data as Array<{
    geo_slug: string
    median_sale_price: number | null
    sold_count: number | null
    end_of_period_inventory: number | null
    median_dom: number | null
    computed_at: string | null
    methodology_version: string | null
  }>) {
    if (out[row.geo_slug] != null) continue // already have the freshest
    out[row.geo_slug] = {
      geoSlug: row.geo_slug,
      medianSalePrice: row.median_sale_price,
      soldCount12mo: row.sold_count,
      activeInventory: row.end_of_period_inventory,
      medianDom: row.median_dom,
      computedAt: row.computed_at,
      methodologyVersion: row.methodology_version,
    }
  }
  return out as Record<GolfCommunitySlug, GolfCommunityKpi | null>
}

/** Round currency to thousands per voice rules. $895,000 not $894,750. */
export function formatCurrencyToThousands(value: number | null): string | null {
  if (value == null || !Number.isFinite(value)) return null
  const rounded = Math.round(value / 1000) * 1000
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(rounded)
}
