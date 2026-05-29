/**
 * getCommunitySubdivisions — the GIS subdivision plats that make up a
 * resort/master-planned community, via the `community_subdivisions` RPC.
 *
 * Each entry carries the subdivision's authoritative county-GIS polygon (so the
 * community map can render the subdivisions "broken out" as separate cells) and
 * its active home count (from listing_boundary_xref_mv). Membership is spatial
 * (centroid within the parent community polygon) — see the RPC migration
 * 20260529050000 for why (plats aren't parented to communities, and MLS names
 * don't match plat names).
 *
 * Cached per-geo on the geoNeighborhood window. Throws on a transient RPC error
 * (never caches an empty result) — same no-poison contract as
 * getGeoBoundaryMapData / getBoundaryGeoJSON.
 *
 * GIS rule (CLAUDE.md): polygons come from the authoritative `boundaries`
 * table. This never approximates.
 */

import { unstable_cache } from 'next/cache'
import { supabaseAnon } from '@/lib/data/client'
import type { BoundaryGeometry } from '@/lib/data/geo/getBoundaryGeoJSON'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'

export type CommunitySubdivisionInput = {
  geoType: 'city' | 'neighborhood'
  geoSlug: string
}

export type CommunitySubdivision = {
  slug: string
  label: string
  geometry: BoundaryGeometry
  activeHomes: number
}

type RpcRow = {
  geo_slug: string
  geo_label: string
  geojson: string | null
  active_homes: number | null
}

function parseGeometry(geojson: string | null): BoundaryGeometry | null {
  if (!geojson) return null
  try {
    const parsed = JSON.parse(geojson)
    if (
      parsed &&
      (parsed.type === 'Polygon' || parsed.type === 'MultiPolygon') &&
      Array.isArray(parsed.coordinates)
    ) {
      return parsed as BoundaryGeometry
    }
    return null
  } catch {
    return null
  }
}

async function fetchCommunitySubdivisions(
  geoType: 'city' | 'neighborhood',
  geoSlug: string,
): Promise<CommunitySubdivision[]> {
  const supabase = supabaseAnon()
  if (!supabase) return []

  const { data, error } = await supabase.rpc('community_subdivisions', {
    p_geo_type: geoType,
    p_geo_slug: geoSlug,
  })

  if (error) {
    // THROW (do not return []) so unstable_cache never caches a transient
    // failure — same no-poison rule as the other geo DALs.
    console.error('[getCommunitySubdivisions] RPC error:', { geoType, geoSlug, error })
    throw new Error(`community_subdivisions RPC failed for ${geoType}/${geoSlug}: ${error.message}`)
  }

  return ((data ?? []) as RpcRow[])
    .map((row) => {
      const geometry = parseGeometry(row.geojson)
      if (!geometry) return null
      return {
        slug: row.geo_slug,
        label: row.geo_label,
        geometry,
        activeHomes: row.active_homes ?? 0,
      }
    })
    .filter((s): s is CommunitySubdivision => s !== null)
}

export function getCommunitySubdivisions(
  input: CommunitySubdivisionInput,
): Promise<CommunitySubdivision[]> {
  const { geoType, geoSlug } = input
  return unstable_cache(
    () => fetchCommunitySubdivisions(geoType, geoSlug),
    ['community-subdivisions-v1', geoType, geoSlug],
    {
      revalidate: CACHE_WINDOWS.geoNeighborhood,
      tags: [cacheTag.neighborhood(geoSlug), 'boundaries'],
    },
  )()
}
