/**
 * getTrailLineGeoJSON — fetch the authoritative route linework for a trail from
 * the `trail_lines` table via the `trail_line_geojson` Supabase RPC (which calls
 * ST_AsGeoJSON server-side). Returns a typed LineString | MultiLineString, or
 * null when the trail has no verified line yet (it then renders as a point).
 *
 * GIS rule (CLAUDE.md / feedback_gis_authoritative_only): linework MUST come from
 * an authoritative source (USFS, Bend Park & Rec, Oregon State Parks, BLM) with
 * provenance. This function NEVER approximates or generates coordinates.
 *
 * unstable_cache-wrapped: THROW on a transient RPC error (so the failure isn't
 * cached for the whole TTL), null only for a genuine no-line trail.
 */

import { unstable_cache } from 'next/cache'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'

export type TrailLineGeometry = GeoJSON.LineString | GeoJSON.MultiLineString

async function fetchTrailLineGeoJSON(slug: string): Promise<TrailLineGeometry | null> {
  const supabase = supabaseAnon()
  if (!supabase) return null

  const { data, error } = await supabase.rpc('trail_line_geojson', { p_slug: slug })
  if (error) {
    console.error('[getTrailLineGeoJSON] RPC error:', { slug, error })
    throw new Error(`trail_line_geojson RPC failed for ${slug}: ${error.message}`)
  }
  if (!data) return null

  try {
    const parsed = JSON.parse(data as string)
    if (
      parsed &&
      (parsed.type === 'LineString' || parsed.type === 'MultiLineString') &&
      Array.isArray(parsed.coordinates)
    ) {
      return parsed as TrailLineGeometry
    }
    return null
  } catch {
    console.error('[getTrailLineGeoJSON] JSON.parse failed for', slug)
    return null
  }
}

export function getTrailLineGeoJSON(slug: string): Promise<TrailLineGeometry | null> {
  return unstable_cache(() => fetchTrailLineGeoJSON(slug), ['trail-line-geojson-v1', slug], {
    revalidate: CACHE_WINDOWS.geoCity,
    tags: [cacheTag.listings, 'trails', 'trail-lines'],
  })()
}
