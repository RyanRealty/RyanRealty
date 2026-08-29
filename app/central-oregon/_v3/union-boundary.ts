import type { BoundaryGeometry } from '@/lib/data/geo/getBoundaryGeoJSON'

/**
 * Union city (or other) polygons into one GeoJSON the Field map can fit.
 * Does not invent coordinates — it only concatenates rings the DAL already
 * returned. One polygon stays a Polygon; two or more become a MultiPolygon.
 */
export function unionBoundaryGeometry(
  geoms: readonly (BoundaryGeometry | null | undefined)[],
): BoundaryGeometry | null {
  const rings: GeoJSON.Position[][][] = []
  for (const geom of geoms) {
    if (!geom) continue
    if (geom.type === 'Polygon') rings.push(geom.coordinates)
    else if (geom.type === 'MultiPolygon') rings.push(...geom.coordinates)
  }
  if (rings.length === 0) return null
  if (rings.length === 1) return { type: 'Polygon', coordinates: rings[0] }
  return { type: 'MultiPolygon', coordinates: rings }
}
