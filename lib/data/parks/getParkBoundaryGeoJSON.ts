/**
 * getParkBoundaryGeoJSON — fetch the authoritative polygon for a park from the
 * `boundaries` table (geo_type='park') via the shared `boundary_geojson` RPC.
 *
 * Mirrors getBoundaryGeoJSON (city/neighborhood/subdivision) but for parks. The
 * RPC calls ST_AsGeoJSON server-side and returns a GeoJSON geometry string,
 * which we parse to a typed Polygon | MultiPolygon for NeighborhoodMap.client.
 *
 * GIS rule (CLAUDE.md §0): park polygons come from the Oregon State Parks
 * FeatureServer (state parks) or OpenStreetMap (city parks), inserted by
 * migration 20260603130000_park_boundaries.sql. This function NEVER approximates.
 *
 * Returns null when the park has no boundary row, Supabase is unavailable, or
 * the geometry fails to parse — never throws on a genuine no-boundary so a
 * point-only park still renders. On a transient RPC error it THROWS so the
 * failure is not cached as "no boundary" for the full TTL.
 *
 * Lives behind the DAL boundary (Gate G1). Pages import from @/lib/data.
 */

import { unstable_cache } from 'next/cache'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS } from '@/lib/data/cache/unstable-cache'

/** GeoJSON geometry — Polygon or MultiPolygon only (what PostGIS returns). */
export type ParkBoundaryGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon

async function fetchParkBoundaryGeoJSON(slug: string): Promise<ParkBoundaryGeometry | null> {
  const supabase = supabaseAnon()
  if (!supabase) return null

  const { data, error } = await supabase.rpc('boundary_geojson', {
    p_geo_type: 'park',
    p_geo_slug: slug,
  })

  if (error) {
    // THROW on a transient RPC error so unstable_cache does not persist the
    // failure as a genuine "no boundary" for the full TTL.
    console.error('[getParkBoundaryGeoJSON] RPC error:', { slug, error })
    throw new Error(`boundary_geojson RPC failed for park/${slug}: ${error.message}`)
  }
  if (!data) return null

  try {
    const parsed = JSON.parse(data as string)
    if (
      parsed &&
      (parsed.type === 'Polygon' || parsed.type === 'MultiPolygon') &&
      Array.isArray(parsed.coordinates)
    ) {
      return parsed as ParkBoundaryGeometry
    }
    console.warn('[getParkBoundaryGeoJSON] unexpected geometry type:', parsed?.type)
    return null
  } catch {
    console.error('[getParkBoundaryGeoJSON] JSON.parse failed for', slug)
    return null
  }
}

/**
 * Cached entry point. Key includes the park slug. Returns null when no boundary
 * exists — callers fall back to a point-only map (CLAUDE.md §0: omit, never guess).
 */
export function getParkBoundaryGeoJSON(slug: string): Promise<ParkBoundaryGeometry | null> {
  return unstable_cache(
    () => fetchParkBoundaryGeoJSON(slug),
    ['park-boundary-geojson-v1', slug],
    {
      revalidate: CACHE_WINDOWS.geoCity,
      tags: ['boundaries', 'parks', `park:${slug}`],
    },
  )()
}
