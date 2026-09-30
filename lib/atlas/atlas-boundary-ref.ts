/**
 * A boundary reference (lib/atlas/atlas-dots-scope.ts) back to the geometry
 * the page read, through the SAME cached DAL call the page made — so the dots
 * route filters by the very polygon the page's server-rendered counts used.
 *
 * A community reference also carries the on-market population the page
 * listed (lib/place/community-population.ts): the route rebuilds the map from
 * the same outline AND the same homes, so the dots a browser fetches after
 * paint are the population the page's "for sale" count was computed from.
 *
 * Server only: it reads the DAL.
 */
import 'server-only'
import type { AtlasTile } from '@/lib/data'
import { getBoundaryGeoJSON, getCityBoundaryGeoJSON, getCommunityOutlineGeoJSON } from '@/lib/data'
import { asPlaceBoundary } from '@/lib/place/place-type-page'
import { getCommunityPopulation } from '@/lib/place/community-population'
import type { AtlasBoundaryRef } from '@/lib/atlas/atlas-dots-scope'

export type AtlasScopeResolution = {
  boundary: GeoJSON.Geometry | null
  /** The page's own on-market population, for a community reference. */
  onMarket?: AtlasTile[]
}

export async function resolveAtlasScopeRef(ref: AtlasBoundaryRef): Promise<AtlasScopeResolution> {
  switch (ref.kind) {
    case 'geo':
      return { boundary: asPlaceBoundary(await getBoundaryGeoJSON({ geoType: ref.geoType, geoSlug: ref.geoSlug })) }
    case 'community': {
      const population = await getCommunityPopulation(ref.slug)
      const boundary = asPlaceBoundary(population?.outline ?? null)
      return boundary && population ? { boundary, onMarket: population.atlasTiles } : { boundary: null }
    }
    case 'resort':
      return { boundary: asPlaceBoundary(await getCommunityOutlineGeoJSON(ref.slug)) }
    case 'city-row':
      return { boundary: asPlaceBoundary(await getCityBoundaryGeoJSON(ref.cityName)) }
    default: {
      const never: never = ref
      return never
    }
  }
}
