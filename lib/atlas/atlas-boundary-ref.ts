/**
 * A boundary reference (lib/atlas/atlas-dots-scope.ts) back to the geometry
 * the page read, through the SAME cached DAL call the page made — so the dots
 * route filters by the very polygon the page's server-rendered counts used.
 *
 * Server only: it reads the DAL.
 */
import 'server-only'
import { getBoundaryGeoJSON, getCityBoundaryGeoJSON, getResortBoundaryGeoJSON } from '@/lib/data'
import { asPlaceBoundary } from '@/lib/place/place-type-page'
import type { AtlasBoundaryRef } from '@/lib/atlas/atlas-dots-scope'

export async function resolveAtlasBoundaryRef(ref: AtlasBoundaryRef): Promise<GeoJSON.Geometry | null> {
  switch (ref.kind) {
    case 'geo':
      return asPlaceBoundary(await getBoundaryGeoJSON({ geoType: ref.geoType, geoSlug: ref.geoSlug }))
    case 'resort':
      return asPlaceBoundary(await getResortBoundaryGeoJSON(ref.slug))
    case 'city-row':
      return asPlaceBoundary(await getCityBoundaryGeoJSON(ref.cityName))
    default: {
      const never: never = ref
      return never
    }
  }
}
