/**
 * getGeoBoundaryMapData — shared DAL for the boundary map block.
 *
 * Returns the authoritative polygon + active listing pins for ANY geo type:
 *   - City:      geoType='city',         geoSlug = city slug (e.g. 'bend')
 *   - Neighborhood: geoType='neighborhood', geoSlug = 'bend-awbrey-butte'
 *   - Resort/master-planned community:
 *                geoType='neighborhood', geoSlug = bare registry slug (e.g. 'tetherow')
 *
 * Both data fetches go through the PostGIS `boundary_geojson` and
 * `listings_in_boundary` RPCs (SECURITY DEFINER → anon readable). This is
 * THE function all three page types (city / neighborhood / community) use for
 * their map section — no per-page City/SubdivisionName string divergence.
 *
 * GIS rule (CLAUDE.md): polygons MUST come from the `boundaries` table
 * (City of Bend GIS / Deschutes County DIAL / Oregon GEO / Census TIGER).
 *
 * Gate G31 enforces that every page rendering <NeighborhoodMap> imports
 * this function (not a bespoke one-off query).
 */

import { unstable_cache } from 'next/cache'
import { supabaseAnon } from '@/lib/data/client'
import { getBoundaryGeoJSON } from '@/lib/data/geo/getBoundaryGeoJSON'
import type { BoundaryGeometry } from '@/lib/data/geo/getBoundaryGeoJSON'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'

export type GeoType = 'city' | 'neighborhood'

export type GeoBoundaryMapInput = {
  geoType: GeoType
  geoSlug: string
}

export type BoundaryMapPin = {
  listingKey: string
  lat: number
  lng: number
  price: number | null
}

export type GeoBoundaryMapData = {
  polygon: BoundaryGeometry | null
  pins: BoundaryMapPin[]
}

async function fetchPins(
  geoType: GeoType,
  geoSlug: string,
  limit = 200,
): Promise<BoundaryMapPin[]> {
  const supabase = supabaseAnon()
  if (!supabase) return []

  const { data, error } = await supabase.rpc('listings_in_boundary', {
    p_geo_type: geoType,
    p_geo_slug: geoSlug,
    p_limit: limit,
  })

  if (error) {
    console.error('[getGeoBoundaryMapData] listings_in_boundary error:', {
      geoType,
      geoSlug,
      error,
    })
    return []
  }

  return ((data ?? []) as Array<{
    listing_key: string
    lat: number
    lng: number
    list_price: number | null
  }>).map((row) => ({
    listingKey: row.listing_key,
    lat: row.lat,
    lng: row.lng,
    price: row.list_price ?? null,
  }))
}

function cacheTTL(geoType: GeoType): number {
  return geoType === 'city' ? CACHE_WINDOWS.geoCity : CACHE_WINDOWS.geoNeighborhood
}

function cacheTags(geoType: GeoType, geoSlug: string): string[] {
  if (geoType === 'city') return [cacheTag.city(geoSlug), 'boundaries', 'listing-tiles']
  return [cacheTag.neighborhood(geoSlug), 'boundaries', 'listing-tiles']
}

async function fetchGeoBoundaryMapData(
  geoType: GeoType,
  geoSlug: string,
): Promise<GeoBoundaryMapData> {
  const [polygon, pins] = await Promise.all([
    getBoundaryGeoJSON({ geoType, geoSlug }).catch(() => null),
    // Only fetch pins when a polygon exists — without a boundary there is
    // nothing to display. The spatial RPC would return 0 rows anyway (JOIN
    // returns nothing without a matching boundary row).
    getBoundaryGeoJSON({ geoType, geoSlug })
      .then((poly) => (poly ? fetchPins(geoType, geoSlug) : Promise.resolve([])))
      .catch(() => []),
  ])

  return { polygon, pins }
}

/**
 * Cached entry point. Key includes geoType + geoSlug so every unique geo
 * gets its own cache slot. Revalidates on the same TTL as geoCity /
 * geoNeighborhood so the map stays fresh alongside the rest of the page.
 */
export function getGeoBoundaryMapData(
  input: GeoBoundaryMapInput,
): Promise<GeoBoundaryMapData> {
  const { geoType, geoSlug } = input
  return unstable_cache(
    () => fetchGeoBoundaryMapData(geoType, geoSlug),
    ['geo-boundary-map-v1', geoType, geoSlug],
    {
      revalidate: cacheTTL(geoType),
      tags: cacheTags(geoType, geoSlug),
    },
  )()
}
