/**
 * GeoJSON polygon → Google Maps path rings. PURE.
 * Coordinates in GeoJSON are [lng, lat].
 */
export function geojsonToPaths(
  geo: { type: string; coordinates: unknown } | null | undefined,
): Array<Array<{ lat: number; lng: number }>> {
  if (!geo) return []
  if (geo.type === 'Polygon' && Array.isArray(geo.coordinates)) {
    return (geo.coordinates as number[][][]).map((ring) =>
      ring.map(([lng, lat]) => ({ lat, lng })),
    )
  }
  if (geo.type === 'MultiPolygon' && Array.isArray(geo.coordinates)) {
    return (geo.coordinates as number[][][][]).flatMap((poly) =>
      poly.map((ring) => ring.map(([lng, lat]) => ({ lat, lng }))),
    )
  }
  return []
}
