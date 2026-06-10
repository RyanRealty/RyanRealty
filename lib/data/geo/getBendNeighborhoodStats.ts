/**
 * getBendNeighborhoodStats — market pulse for the 7 westside Bend
 * neighborhoods shown on the homepage neighborhood explorer map.
 *
 * Data source: `market_pulse_live` (geo_type='neighborhood', 10–15 min freshness).
 * Returns one row per named neighborhood with active_count + median_list_price.
 * Rows are returned in the order specified by WESTSIDE_SLUGS so the caller
 * can render chips in a consistent order.
 *
 * Per CLAUDE.md §0 data accuracy: every figure comes from the live cache row;
 * null is returned for any metric the row doesn't carry (honest empty).
 */

import { makeResilientCached } from '@/lib/data/cache/resilient'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'

/** The 7 westside Bend neighborhoods shown on the homepage map. */
export const WESTSIDE_NEIGHBORHOOD_SLUGS = [
  'bend-awbrey-butte',
  'bend-northwest-crossing',
  'bend-river-west',
  'bend-old-bend',
  'bend-century-west',
  'bend-summit-west',
  'bend-tetherow',
] as const

export type NeighborhoodStatRow = {
  /** The geo_slug from market_pulse_live (e.g. 'bend-awbrey-butte'). */
  geoSlug: string
  /** Display label (e.g. 'Awbrey Butte'). Derived from geo_slug if no row found. */
  label: string
  /** Active SFR listing count. Null when no pulse row exists yet. */
  activeCount: number | null
  /** Median list price in dollars. Null when no pulse row exists yet. */
  medianListPrice: number | null
  /** Href for the neighborhood page. */
  href: string
}

function slugToLabel(s: string): string {
  // 'bend-awbrey-butte' -> 'Awbrey Butte'
  return s
    .replace(/^bend-/, '')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

async function _fetchBendNeighborhoodStats(): Promise<NeighborhoodStatRow[]> {
  const sb = supabaseAnon()
  if (!sb) return buildFallback()

  const { data, error } = await sb
    .from('market_pulse_live')
    .select('geo_slug, active_count, median_list_price')
    .eq('geo_type', 'neighborhood')
    .eq('property_type', 'A')
    .in('geo_slug', WESTSIDE_NEIGHBORHOOD_SLUGS as unknown as string[])

  if (error) {
    throw new Error(
      `[getBendNeighborhoodStats] market_pulse_live query failed: ${error.message ?? JSON.stringify(error)}`,
    )
  }

  // Build a map keyed by geo_slug for O(1) lookup
  const bySlug = new Map<string, { active_count: number | null; median_list_price: number | null }>()
  for (const row of (data ?? []) as Array<{
    geo_slug: string
    active_count?: number | null
    median_list_price?: number | null
  }>) {
    bySlug.set(row.geo_slug, {
      active_count: row.active_count ?? null,
      median_list_price: row.median_list_price ?? null,
    })
  }

  // Return in WESTSIDE_NEIGHBORHOOD_SLUGS order so the UI is deterministic
  return WESTSIDE_NEIGHBORHOOD_SLUGS.map((slug) => {
    const row = bySlug.get(slug)
    return {
      geoSlug: slug,
      label: slugToLabel(slug),
      activeCount: row?.active_count ?? null,
      medianListPrice: row?.median_list_price ?? null,
      href: `/cities/bend/${slug.replace(/^bend-/, '')}`,
    }
  })
}

function buildFallback(): NeighborhoodStatRow[] {
  return WESTSIDE_NEIGHBORHOOD_SLUGS.map((slug) => ({
    geoSlug: slug,
    label: slugToLabel(slug),
    activeCount: null,
    medianListPrice: null,
    href: `/cities/bend/${slug.replace(/^bend-/, '')}`,
  }))
}

/**
 * Cached fetch of the 7 westside Bend neighborhood stats.
 * Falls back to a null-stats list on transient errors (honest empty — no invented numbers).
 */
export const getBendNeighborhoodStats = makeResilientCached(
  _fetchBendNeighborhoodStats,
  ['bend-neighborhood-stats-v1'],
  {
    revalidate: CACHE_WINDOWS.marketPulse,
    tags: [cacheTag.city('bend'), cacheTag.market],
  },
  buildFallback(),
)
