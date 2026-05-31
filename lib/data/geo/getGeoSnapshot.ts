/**
 * getGeoSnapshot — fetch a pre-aggregated geo row from geo_snapshot_mv.
 *
 * Replaces the previous pattern where city/community/neighborhood pages
 * aggregated raw `listings` (589K rows) on every cold cache hit. The MV
 * carries: active_sfr_count, active_all_count, pending_count,
 * median_list_price, community_count, refreshed_at — one indexed row
 * per geo. Lookup latency: ~2ms.
 *
 * Migration: 20260522144510_geo_snapshot_mv.sql (applied 2026-05-22).
 */

import { unstable_cache } from 'next/cache'
import { z } from 'zod'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'

const GeoSnapshotSchema = z.object({
  geoType: z.enum(['city', 'community', 'neighborhood']),
  geoKey: z.string().min(1).max(160),
})

export type GeoSnapshotInput = z.input<typeof GeoSnapshotSchema>

export type GeoSnapshot = {
  geoType: 'city' | 'community' | 'neighborhood'
  geoKey: string
  geoLabel: string
  activeSfrCount: number
  activeAllCount: number
  pendingCount: number
  medianListPrice: number | null
  communityCount: number
  refreshedAt: string
}

type GeoSnapshotMvRow = {
  geo_type: 'city' | 'community' | 'neighborhood'
  geo_key: string
  geo_label: string
  active_sfr_count: number
  active_all_count: number
  pending_count: number
  median_list_price: number | null
  community_count: number
  refreshed_at: string
}

function rowToSnapshot(row: GeoSnapshotMvRow): GeoSnapshot {
  return {
    geoType: row.geo_type,
    geoKey: row.geo_key,
    geoLabel: row.geo_label,
    activeSfrCount: row.active_sfr_count,
    activeAllCount: row.active_all_count,
    pendingCount: row.pending_count,
    medianListPrice: row.median_list_price,
    communityCount: row.community_count,
    refreshedAt: row.refreshed_at,
  }
}

/**
 * Raw lookup. Returns the row, or null for a GENUINE miss (no matching row).
 * THROWS on a transient DB error — this distinction is load-bearing: see
 * getGeoSnapshot below for why a null-on-error would poison the cache.
 * Retries a transient error in-process (3 attempts) before throwing.
 */
async function fetchOneOrThrow(input: GeoSnapshotInput): Promise<GeoSnapshot | null> {
  const parsed = GeoSnapshotSchema.parse(input)
  const supabase = supabaseAnon()
  if (!supabase) return null
  // geo_snapshot_mv stores CITY keys space-separated lowercase ("la pine"),
  // but city-page slugs are hyphenated ("la-pine"). Normalize hyphens to spaces
  // for cities so multi-word cities (La Pine, Powell Butte, Black Butte Ranch)
  // resolve instead of 404'ing. Community/neighborhood keys keep their hyphens
  // (their slugs intentionally use hyphenated subdivision names).
  const key = parsed.geoType === 'city'
    ? parsed.geoKey.toLowerCase().trim().replace(/-/g, ' ')
    : parsed.geoKey.toLowerCase().trim()
  let lastError: unknown = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase
      .from('geo_snapshot_mv')
      .select('*')
      .eq('geo_type', parsed.geoType)
      .eq('geo_key', key)
      .maybeSingle()
    if (!error) {
      // Success — a present row, or a genuine miss (null). Both are cacheable.
      return data ? rowToSnapshot(data as GeoSnapshotMvRow) : null
    }
    lastError = error
  }
  throw new Error(
    `geo_snapshot_mv lookup failed for ${parsed.geoType}:${key}: ` +
      (lastError instanceof Error ? lastError.message : JSON.stringify(lastError)),
  )
}

/**
 * Single-geo snapshot lookup. Sub-2ms via unique index on (geo_type, geo_key).
 *
 * RESILIENCE (fixes the intermittent "City Not Found" bug, 2026-05-31): the old
 * code returned null on BOTH a genuine miss AND a transient DB error, and
 * unstable_cache happily cached that null. A single timeout then pinned the page
 * to notFound() for the entire revalidate window — that is why Bend / Sunriver /
 * La Pine flickered to "City Not Found" while their MV rows were perfectly
 * healthy. Now:
 *   1. fetchOneOrThrow THROWS on a DB error — unstable_cache never caches a
 *      rejected promise, so no poison-null is stored.
 *   2. If the cached path throws, we make ONE direct uncached attempt so a blip
 *      doesn't 404 a geo that has data.
 *   3. Only a genuine miss (or a fully-failed retry) returns null. The public
 *      function never throws, so consumers keep their simple `if (!snap) notFound()`.
 */
export const getGeoSnapshot = async (input: GeoSnapshotInput): Promise<GeoSnapshot | null> => {
  const parsed = GeoSnapshotSchema.parse(input)
  const cached = unstable_cache(
    () => fetchOneOrThrow(parsed),
    // v2 cache-key bump 2026-05-31 — evicts poison-null entries cached before the
    // throw-on-error fix (Vercel's Data Cache persists across deploys, so the old
    // nulls would otherwise linger until TTL and keep flashing "City Not Found").
    ['geo-snapshot-v2', parsed.geoType, parsed.geoKey],
    {
      revalidate:
        parsed.geoType === 'city'
          ? CACHE_WINDOWS.geoCity
          : parsed.geoType === 'community'
            ? CACHE_WINDOWS.geoCommunity
            : CACHE_WINDOWS.geoNeighborhood,
      tags: [parsed.geoType === 'city' ? cacheTag.city(parsed.geoKey) : parsed.geoType === 'community' ? cacheTag.community(parsed.geoKey) : cacheTag.neighborhood(parsed.geoKey)],
    }
  )
  try {
    return await cached()
  } catch {
    // Transient DB error bubbled up (NOT cached). Try once uncached before the
    // caller 404s — recovers in-render instead of showing a stale not-found.
    try {
      return await fetchOneOrThrow(parsed)
    } catch {
      return null
    }
  }
}

/**
 * Fetch every city snapshot, sorted by active SFR count descending.
 * Powers the homepage city grid + the cities index.
 */
export const getAllCitySnapshots = (): Promise<GeoSnapshot[]> =>
  unstable_cache(
    async () => {
      const supabase = supabaseAnon()
      if (!supabase) return []
      const { data, error } = await supabase
        .from('geo_snapshot_mv')
        .select('*')
        .eq('geo_type', 'city')
        .gt('active_sfr_count', 0)
        .order('active_sfr_count', { ascending: false })
        .limit(50)
      if (error || !data) return []
      return (data as GeoSnapshotMvRow[]).map(rowToSnapshot)
    },
    ['geo-snapshot', 'all-cities'],
    {
      revalidate: CACHE_WINDOWS.geoCity,
      tags: ['cities-index'],
    }
  )()

/**
 * Fetch every community snapshot across all cities. Used by admin tooling
 * that needs the full list of (city, subdivision) pairs.
 */
export const getAllCommunitySnapshots = (): Promise<GeoSnapshot[]> =>
  unstable_cache(
    async () => {
      const supabase = supabaseAnon()
      if (!supabase) return []
      const { data, error } = await supabase
        .from('geo_snapshot_mv')
        .select('*')
        .eq('geo_type', 'community')
        .gt('active_sfr_count', 0)
        .order('geo_key', { ascending: true })
        .limit(5000)
      if (error || !data) return []
      return (data as GeoSnapshotMvRow[]).map(rowToSnapshot)
    },
    ['geo-snapshot', 'all-communities'],
    {
      revalidate: CACHE_WINDOWS.geoCommunity,
      tags: ['communities-index'],
    }
  )()

/**
 * Fetch every community snapshot in a city. Powers the city LP communities bar.
 */
export const getCityCommunitySnapshots = (citySlug: string): Promise<GeoSnapshot[]> => {
  // community keys are space-separated lowercase ("la pine:south meadow"), so the
  // hyphenated city slug ("la-pine") must be normalized or the communities bar is
  // empty on every multi-word city.
  const cityLower = citySlug.toLowerCase().trim().replace(/-/g, ' ')
  return unstable_cache(
    async () => {
      const supabase = supabaseAnon()
      if (!supabase) return []
      const { data, error } = await supabase
        .from('geo_snapshot_mv')
        .select('*')
        .eq('geo_type', 'community')
        .like('geo_key', `${cityLower}:%`)
        .gt('active_sfr_count', 0)
        .order('active_sfr_count', { ascending: false })
        .limit(40)
      if (error || !data) return []
      return (data as GeoSnapshotMvRow[]).map(rowToSnapshot)
    },
    ['geo-snapshot', 'communities', cityLower],
    {
      revalidate: CACHE_WINDOWS.geoCity,
      tags: [cacheTag.city(cityLower)],
    }
  )()
}
