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

async function fetchOne(input: GeoSnapshotInput): Promise<GeoSnapshot | null> {
  const parsed = GeoSnapshotSchema.parse(input)
  const supabase = supabaseAnon()
  if (!supabase) return null
  const { data, error } = await supabase
    .from('geo_snapshot_mv')
    .select('*')
    .eq('geo_type', parsed.geoType)
    .eq('geo_key', parsed.geoKey.toLowerCase().trim())
    .maybeSingle()
  if (error || !data) return null
  return rowToSnapshot(data as GeoSnapshotMvRow)
}

/**
 * Single-geo snapshot lookup. Sub-2ms via unique index on (geo_type, geo_key).
 */
export const getGeoSnapshot = (input: GeoSnapshotInput): Promise<GeoSnapshot | null> => {
  const parsed = GeoSnapshotSchema.parse(input)
  return unstable_cache(
    () => fetchOne(parsed),
    ['geo-snapshot', parsed.geoType, parsed.geoKey],
    {
      revalidate:
        parsed.geoType === 'city'
          ? CACHE_WINDOWS.geoCity
          : parsed.geoType === 'community'
            ? CACHE_WINDOWS.geoCommunity
            : CACHE_WINDOWS.geoNeighborhood,
      tags: [parsed.geoType === 'city' ? cacheTag.city(parsed.geoKey) : parsed.geoType === 'community' ? cacheTag.community(parsed.geoKey) : cacheTag.neighborhood(parsed.geoKey)],
    }
  )()
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
 * Fetch every community snapshot in a city. Powers the city LP communities bar.
 */
export const getCityCommunitySnapshots = (citySlug: string): Promise<GeoSnapshot[]> => {
  const cityLower = citySlug.toLowerCase().trim()
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
