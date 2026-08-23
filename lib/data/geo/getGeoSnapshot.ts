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

import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { z } from 'zod'
import { supabaseAnon } from '@/lib/data/client'
import { fetchPagedRows } from '@/lib/supabase/paginate'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { pulseOnlyCitySnapshot, type PulseCityRow } from '@/lib/data/geo/pulse-only-city-snapshot'
import {
  cityDetachedSlug,
  getCityDetachedInventory,
  getDetachedInventories,
  type DetachedInventory,
} from '@/lib/data/market-truth/getSellBendMarket'

const GeoSnapshotSchema = z.object({
  geoType: z.enum(['city', 'community', 'neighborhood']),
  geoKey: z.string().min(1).max(160),
})

export type GeoSnapshotInput = z.input<typeof GeoSnapshotSchema>

export type GeoSnapshot = {
  geoType: 'city' | 'community' | 'neighborhood'
  geoKey: string
  geoLabel: string
  /** City: Market Truth detached when publishable; null on miss (unknown, not zero). Community/neighborhood: MV count. */
  activeSfrCount: number | null
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

// ── Canonical city override (§0 one-number rule) ────────────────────────────
// The MV counts by MLS City and includes Active Under Contract. Pulse is
// polygon-clipped mixed type A (Bend 488 / seller). Market Truth is MLS-city
// detached exact-Active (Bend ~774 / balanced) — the same three figures /sell
// publishes. City snapshots overlay MT when the detached cell is publishable.
// A miss or throw does NOT return null: city pages 404 on a null snapshot
// (`if (!snapshot) notFound()`), and generateMetadata uses the same read.
// MV then pulse stay for existence (pendingCount, the door). Published city
// inventory (activeSfrCount, medianListPrice as a market figure) is MT on
// hit and null on miss — unknown is not zero; pulse 488 / polygon MV is not
// printed as detached on /cities, mega-menu, or homepage town rows.
// Community/neighborhood stay on the MV (REGISTRY §4: polygons unrepaired).

async function fetchPulseCityMap(): Promise<Map<string, PulseCityRow>> {
  const map = new Map<string, PulseCityRow>()
  const supabase = supabaseAnon()
  if (!supabase) return map
  try {
    const { data, error } = await supabase
      .from('market_pulse_live')
      .select('geo_slug, geo_label, active_count, pending_count, median_list_price, updated_at')
      .eq('geo_type', 'city')
    if (error || !data) return map
    for (const r of data as PulseCityRow[]) {
      map.set(r.geo_slug.toLowerCase().trim(), r)
      map.set(r.geo_label.toLowerCase().trim(), r)
    }
    return map
  } catch {
    return map // pulse unavailable: MV values stand rather than failing the page
  }
}

function withPulseOverride(snap: GeoSnapshot, pulse: PulseCityRow | undefined): GeoSnapshot {
  if (!pulse) return snap
  return {
    ...snap,
    // Existence / freshness only. Do not copy pulse.active_count — polygon
    // 488 is not detached. City published inventory is MT or null.
    pendingCount: pulse.pending_count,
    medianListPrice:
      pulse.median_list_price != null ? Math.round(Number(pulse.median_list_price)) : snap.medianListPrice,
    refreshedAt: pulse.updated_at,
  }
}

function withDetachedInventory(snap: GeoSnapshot, mt: DetachedInventory): GeoSnapshot {
  return {
    ...snap,
    activeSfrCount: mt.activeCount,
    medianListPrice: mt.medianListPrice ?? snap.medianListPrice,
    refreshedAt: mt.computedAt,
  }
}

/** City MT miss/throw: keep the snapshot object (do not 404) and null published inventory. */
function withholdCityPublishedInventory(snap: GeoSnapshot): GeoSnapshot {
  if (snap.geoType !== 'city') return snap
  return {
    ...snap,
    activeSfrCount: null,
    medianListPrice: null,
  }
}

async function overlayOneCityDetached(snap: GeoSnapshot): Promise<GeoSnapshot> {
  if (snap.geoType !== 'city') return snap
  try {
    const mt = await getCityDetachedInventory(snap.geoKey)
    // Miss: keep the door. Do not 404. Do not keep pulse/MV as published inventory.
    // Inventory overlay needs publishable active_count only — MOS may be below min_n.
    return mt ? withDetachedInventory(snap, mt) : withholdCityPublishedInventory(snap)
  } catch {
    return withholdCityPublishedInventory(snap)
  }
}

async function overlayCitySnapshotsDetached(snaps: GeoSnapshot[]): Promise<GeoSnapshot[]> {
  if (!snaps.length) return snaps
  try {
    const map = await getDetachedInventories(
      snaps.map((s) => ({ geoType: 'city' as const, geoSlug: s.geoKey })),
    )
    return snaps.map((s) => {
      const mt = map.get(`city:${cityDetachedSlug(s.geoKey)}`)
      return mt ? withDetachedInventory(s, mt) : withholdCityPublishedInventory(s)
    })
  } catch {
    return snaps.map(withholdCityPublishedInventory)
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
    if (!error) { // poison-null-ok — genuine miss only; the error branch below still throws
      // Success — a present row, or a genuine miss (null). Both are cacheable.
      if (!data) {
        if (parsed.geoType !== 'city') return null
        const pulse = await fetchPulseCityMap()
        const pulseRow = pulse.get(key)
        if (!pulseRow) return null
        return overlayOneCityDetached(pulseOnlyCitySnapshot(key, pulseRow))
      }
      const snap = rowToSnapshot(data as GeoSnapshotMvRow)
      if (parsed.geoType !== 'city') return snap
      const pulse = await fetchPulseCityMap()
      return overlayOneCityDetached(withPulseOverride(snap, pulse.get(key)))
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
const getGeoSnapshotUncoalesced = async (input: GeoSnapshotInput): Promise<GeoSnapshot | null> => {
  const parsed = GeoSnapshotSchema.parse(input)
  const cached = unstable_cache(
    () => fetchOneOrThrow(parsed),
    // v7 2026-08-23 — city inventory overlay (active_count) even when MOS
    // is below min_n. v6 miss nulls published inventory (not pulse 488).
    // Snapshot object still returned (do not 404). v5 overlay on hit.
    ['geo-snapshot-v7-mt-inventory', parsed.geoType, parsed.geoKey],
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
 * Request-scoped dedup (React cache) OVER unstable_cache. The city/community/
 * neighborhood pages call getGeoSnapshot in both generateMetadata and the page
 * body. cache() memoizes by per-arg Object.is, so wrapping the OBJECT-arg fn
 * directly would dedupe nothing (each call site passes a fresh literal). Key on
 * the two primitives instead, so both awaits collapse to one fetch per render.
 */
const getGeoSnapshotByKeys = cache(
  (geoType: GeoSnapshotInput['geoType'], geoKey: string): Promise<GeoSnapshot | null> =>
    getGeoSnapshotUncoalesced({ geoType, geoKey })
)

export const getGeoSnapshot = (input: GeoSnapshotInput): Promise<GeoSnapshot | null> => {
  const parsed = GeoSnapshotSchema.parse(input)
  return getGeoSnapshotByKeys(parsed.geoType, parsed.geoKey)
}

// The three list-helpers below mirror getGeoSnapshot's resilience: each fetch fn
// THROWS on a transient DB error so makeResilientCached never caches an empty list
// (poison-null: one pooler/timeout blip would otherwise pin the homepage city grid,
// the admin community list, or a city's communities bar to [] for the whole window).
// A genuine empty success still returns []. Cache keys bumped to -v2 to evict any
// poison-null entries cached under the prior inline-unstable_cache keys.

async function _fetchAllCitySnapshots(): Promise<GeoSnapshot[]> {
  const supabase = supabaseAnon()
  if (!supabase) return []
  // P12: was .limit(50) while 130+ cities carry active SFR inventory — the public
  // city grid and admin market list under-counted Central Oregon by ~85 cities.
  // Page through the MV (same pattern as communities) so the count matches reality.
  const [{ rows, error }, pulse] = await Promise.all([
    fetchPagedRows<GeoSnapshotMvRow>((from, to) =>
      supabase
        .from('geo_snapshot_mv')
        .select('*')
        .eq('geo_type', 'city')
        .gt('active_sfr_count', 0)
        .order('active_sfr_count', { ascending: false })
        .range(from, to),
    ),
    fetchPulseCityMap(),
  ])
  if (error) throw new Error(`[getAllCitySnapshots] ${error.message ?? JSON.stringify(error)}`)
  if (!rows.length) return []
  const overlaid = await overlayCitySnapshotsDetached(
    rows.map((row) => withPulseOverride(rowToSnapshot(row), pulse.get(row.geo_key.toLowerCase().trim()))),
  )
  return overlaid.sort((a, b) => {
    const av = a.activeSfrCount
    const bv = b.activeSfrCount
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    return bv - av
  })
}

/**
 * Fetch every city snapshot, sorted by active SFR count descending.
 * Powers the homepage city grid + the cities index.
 */
export const getAllCitySnapshots = makeResilientCached(
  _fetchAllCitySnapshots,
  ['geo-snapshot-all-cities-v7-mt-inventory'],
  { revalidate: CACHE_WINDOWS.geoCity, tags: ['cities-index'] },
  [],
)

async function _fetchAllCommunitySnapshots(): Promise<GeoSnapshot[]> {
  const supabase = supabaseAnon()
  if (!supabase) return []
  // Paged read — PostgREST caps single responses at 1,000 rows, so the old
  // .limit(5000) silently dropped every community past the first 1,000.
  // geo_key is unique within geo_type='community', so the order is stable.
  const { rows, error } = await fetchPagedRows<GeoSnapshotMvRow>(
    (from, to) =>
      supabase
        .from('geo_snapshot_mv')
        .select('*')
        .eq('geo_type', 'community')
        .gt('active_sfr_count', 0)
        .order('geo_key', { ascending: true })
        .range(from, to),
    5000,
  )
  if (error) throw new Error(`[getAllCommunitySnapshots] ${error.message ?? JSON.stringify(error)}`)
  return rows.map(rowToSnapshot)
}

/**
 * Fetch every community snapshot across all cities. Used by admin tooling
 * that needs the full list of (city, subdivision) pairs.
 */
export const getAllCommunitySnapshots = makeResilientCached(
  _fetchAllCommunitySnapshots,
  ['geo-snapshot-all-communities-v2'],
  { revalidate: CACHE_WINDOWS.geoCommunity, tags: ['communities-index'] },
  [],
)

async function _fetchCityCommunitySnapshots(cityLower: string): Promise<GeoSnapshot[]> {
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
  if (error) throw new Error(`[getCityCommunitySnapshots] ${cityLower} ${error.message ?? JSON.stringify(error)}`)
  if (!data) return []
  return (data as GeoSnapshotMvRow[]).map(rowToSnapshot)
}

// The cityLower arg is part of the cache key automatically; the per-city tag is
// applied via opts.tags so a city revalidation still flushes its communities bar.
const cachedCityCommunitySnapshots = makeResilientCached(
  _fetchCityCommunitySnapshots,
  ['geo-snapshot-communities-v2'],
  { revalidate: CACHE_WINDOWS.geoCity, tags: ['communities-index'] },
  [],
)

/**
 * Fetch every community snapshot in a city. Powers the city LP communities bar.
 */
export const getCityCommunitySnapshots = (citySlug: string): Promise<GeoSnapshot[]> => {
  // community keys are space-separated lowercase ("la pine:south meadow"), so the
  // hyphenated city slug ("la-pine") must be normalized or the communities bar is
  // empty on every multi-word city.
  const cityLower = citySlug.toLowerCase().trim().replace(/-/g, ' ')
  return cachedCityCommunitySnapshots(cityLower)
}
