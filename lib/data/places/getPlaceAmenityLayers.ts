/**
 * getPlaceAmenityLayers — recorded park polygons + trail lines for a place
 * homes Atlas. Per-slug RPCs already in the DAL; this only joins them to the
 * registry membership in lib/atlas/place-amenity-layers.ts.
 *
 * Never invents geometry. A slug without a boundaries / trail_lines row is
 * omitted. Official GIS only (CLAUDE.md / feedback_gis_authoritative_only).
 */

import { unstable_cache } from '@/lib/data/cache/next-cache'
import {
  assembleAmenityLayers,
  parksNeedingGeom,
  trailsNeedingGeom,
  type PlaceAmenityGrain,
  type PlaceAmenityLayers,
} from '@/lib/atlas/place-amenity-layers'
import { getParkBoundaryGeoJSON } from '@/lib/data/parks/getParkBoundaryGeoJSON'
import { getTrailLineGeoJSON } from '@/lib/data/trails/getTrailLineGeoJSON'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'

export type { PlaceAmenityGrain, PlaceAmenityLayers }

export type PlaceAmenityLayersInput = {
  grain: PlaceAmenityGrain
  /** Cache partition: city / neighborhood / community / plat slug. */
  placeSlug: string
  cityName: string
  citySlug?: string
  communitySlug?: string
  placeGeometry?: GeoJSON.Geometry | null
}

async function loadAmenityGeometry(input: PlaceAmenityLayersInput): Promise<PlaceAmenityLayers> {
  const parks = parksNeedingGeom(input)
  const trails = trailsNeedingGeom(input)

  const [parkRows, trailRows] = await Promise.all([
    Promise.all(
      parks.map(async (park) => {
        const geometry = await getParkBoundaryGeoJSON(park.slug).catch(() => null)
        return [park.slug, geometry] as const
      }),
    ),
    Promise.all(
      trails.map(async (trail) => {
        const geometry = await getTrailLineGeoJSON(trail.slug).catch(() => null)
        return [trail.slug, geometry] as const
      }),
    ),
  ])

  return assembleAmenityLayers({
    ...input,
    parkGeom: new Map(parkRows),
    trailGeom: new Map(trailRows),
  })
}

function cacheKey(input: PlaceAmenityLayersInput): string[] {
  return [
    'place-amenity-layers-v1',
    input.grain,
    input.placeSlug.trim().toLowerCase(),
    input.cityName.trim().toLowerCase(),
    input.citySlug?.trim() ?? '',
    input.communitySlug?.trim() ?? '',
    input.placeGeometry ? 'ring' : 'none',
  ]
}

/**
 * Cached entry. Membership can depend on a place ring; the ring itself is not
 * part of the cache key (it is the recorded city / neighborhood / community /
 * plat already keyed by slug). Geom lives in the per-slug RPCs.
 */
export function getPlaceAmenityLayers(input: PlaceAmenityLayersInput): Promise<PlaceAmenityLayers> {
  return unstable_cache(() => loadAmenityGeometry(input), cacheKey(input), {
    revalidate: CACHE_WINDOWS.geoCity,
    tags: [cacheTag.listings, 'boundaries', 'trails', 'trail-lines', 'parks'],
  })()
}
