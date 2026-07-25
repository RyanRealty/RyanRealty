/**
 * getBoundaryGeoJSON — fetch the authoritative polygon for a geo from the
 * `boundaries` table via the `boundary_geojson` Supabase RPC.
 *
 * The RPC calls ST_AsGeoJSON(polygon) server-side and returns a GeoJSON
 * geometry string. We parse it here and return a typed GeoJSON.Geometry
 * object (Polygon | MultiPolygon) — matching the shape expected by
 * NeighborhoodMap.client.tsx's `geojsonToPaths()`.
 *
 * GIS rule (CLAUDE.md): polygons MUST come from the `boundaries` table
 * (authoritative: City of Bend GIS, Deschutes County DIAL, Oregon GEO,
 * Census TIGER). This function NEVER approximates or generates coordinates.
 *
 * Cached per-geo with the same TTL as geoCity/geoNeighborhood/geoCommunity
 * so the map stays fresh alongside the rest of the page data.
 *
 * Returns null when:
 *   - the geo has no boundary row (common for many subdivisions)
 *   - Supabase is unavailable
 *   - the returned GeoJSON fails to parse
 */

import { unstable_cache } from 'next/cache'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'

export type BoundaryGeoJSONInput = {
  /**
   * Must stay in sync with the boundaries_geo_type_check CHECK constraint
   * (supabase/migrations/20260724223000_boundaries_geo_type_school_district.sql)
   * and DECLARED_GEO_TYPES in scripts/check-boundary-provenance.mjs.
   *
   * `school` = Deschutes County GIS ATTENDANCE areas (one per school).
   * `school_district` = Oregon Dept of Education DISTRICT polygons (W2.7).
   * There is deliberately no `trail`: trail geometry is authoritative linework
   * in public.trail_lines, and a trail polygon could only be a corridor we
   * buffered ourselves.
   */
  geoType: 'city' | 'neighborhood' | 'subdivision' | 'park' | 'school' | 'school_district'
  geoSlug: string
}

/** GeoJSON geometry — Polygon or MultiPolygon only (what PostGIS returns). */
export type BoundaryGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon

function cacheTTL(geoType: BoundaryGeoJSONInput['geoType']): number {
  if (geoType === 'city') return CACHE_WINDOWS.geoCity
  if (geoType === 'neighborhood') return CACHE_WINDOWS.geoNeighborhood
  return CACHE_WINDOWS.geoCommunity
}

function cacheTags(
  geoType: BoundaryGeoJSONInput['geoType'],
  geoSlug: string,
): string[] {
  if (geoType === 'city') return [cacheTag.city(geoSlug), 'boundaries']
  if (geoType === 'neighborhood') return [cacheTag.neighborhood(geoSlug), 'boundaries']
  // school / school_district slugs overlap city slugs ('redmond', 'sisters',
  // 'culver'), so scope their tag by geoType — a city revalidation must not
  // silently drop a district polygon and vice versa.
  if (geoType === 'school' || geoType === 'school_district') {
    return [`${geoType}:${geoSlug}`, 'boundaries']
  }
  return [cacheTag.community(geoSlug), 'boundaries']
}

async function fetchBoundaryGeoJSON(
  geoType: BoundaryGeoJSONInput['geoType'],
  geoSlug: string,
): Promise<BoundaryGeometry | null> {
  const supabase = supabaseAnon()
  if (!supabase) return null

  const { data, error } = await supabase.rpc('boundary_geojson', {
    p_geo_type: geoType,
    p_geo_slug: geoSlug,
  })

  if (error) {
    // THROW (do not return null) on a transient RPC error / statement timeout.
    // This function is unstable_cache-wrapped: returning null here would CACHE
    // the failure for the full TTL, blanking the boundary map for everyone for
    // minutes after a single hiccup. Throwing means unstable_cache skips
    // caching, the caller degrades gracefully for this one request, and the
    // next request retries fresh. `null` is reserved for a genuine no-boundary.
    console.error('[getBoundaryGeoJSON] RPC error:', { geoType, geoSlug, error })
    throw new Error(`boundary_geojson RPC failed for ${geoType}/${geoSlug}: ${error.message}`)
  }
  if (!data) return null

  try {
    const parsed = JSON.parse(data as string)
    if (
      parsed &&
      (parsed.type === 'Polygon' || parsed.type === 'MultiPolygon') &&
      Array.isArray(parsed.coordinates)
    ) {
      return parsed as BoundaryGeometry
    }
    console.warn('[getBoundaryGeoJSON] unexpected geometry type:', parsed?.type)
    return null
  } catch {
    console.error('[getBoundaryGeoJSON] JSON.parse failed for', { geoType, geoSlug })
    return null
  }
}

/**
 * Cached entry point. Key includes geoType + geoSlug so different geos
 * never collide. Returns null when no boundary exists — callers must handle.
 */
export function getBoundaryGeoJSON(
  input: BoundaryGeoJSONInput,
): Promise<BoundaryGeometry | null> {
  const { geoType, geoSlug } = input
  return unstable_cache(
    () => fetchBoundaryGeoJSON(geoType, geoSlug),
    // v2: busts the disk-persisted entries holding the pre-correction resort
    // hulls (e.g. Tetherow's 5,718-acre "spatial discovery" blob) now that the
    // boundaries rows carry the authoritative county-GIS plat unions.
    ['boundary-geojson-v2', geoType, geoSlug],
    {
      revalidate: cacheTTL(geoType),
      tags: cacheTags(geoType, geoSlug),
    },
  )()
}
