// Assign each Bend neighborhood a representative hover photo by locating the
// highest-priced ACTIVE listing whose coordinates fall inside the neighborhood
// boundary polygon. The photo is a real home in that neighborhood (truthful, no
// asset sourcing), used as the hover-reveal background on the KB neighborhoods
// ledger — the same treatment the communities rail gets. Runs server-side at
// ISR build time over the city's active map tiles. (§D83 hover imagery.)

type Ring = number[][] // [[lng, lat], ...]

interface Geometry {
  type: string
  coordinates: unknown
}

interface PhotoTile {
  lat: number | null | undefined
  lng: number | null | undefined
  listPrice: number | null | undefined
  photoUrl: string | null | undefined
}

interface PolygonFeature {
  slug?: string
  name?: string
  geometry: Geometry
}

/** Ray-casting point-in-ring test (outer ring only; holes are rare for a
 *  neighborhood boundary and ignored on purpose). */
function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!
    const yi = ring[i]![1]!
    const xj = ring[j]![0]!
    const yj = ring[j]![1]!
    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

/** Handles GeoJSON Polygon ([rings]) and MultiPolygon ([[rings], ...]); tests the
 *  outer ring of each part. */
function pointInGeometry(lng: number, lat: number, geom: Geometry): boolean {
  if (geom.type === 'Polygon') {
    const rings = geom.coordinates as Ring[]
    return rings.length > 0 && pointInRing(lng, lat, rings[0]!)
  }
  if (geom.type === 'MultiPolygon') {
    const polys = geom.coordinates as Ring[][]
    return polys.some((rings) => rings.length > 0 && pointInRing(lng, lat, rings[0]!))
  }
  return false
}

/**
 * Returns a Map keyed by polygon `slug` (falling back to `name`) → the photoUrl of
 * the highest-priced active listing inside that polygon. Polygons with no active
 * listing (or no photo) are simply absent from the map, so the caller falls back to
 * its own default (no wrong-place image is ever shown).
 */
export function assignNeighborhoodPhotos(
  polygons: PolygonFeature[],
  tiles: PhotoTile[],
): Map<string, string> {
  const best = new Map<string, { url: string; price: number }>()
  const located = tiles.filter(
    (t) => t.lat != null && t.lng != null && typeof t.photoUrl === 'string' && t.photoUrl.length > 0,
  )
  for (const poly of polygons) {
    const key = poly.slug ?? poly.name
    if (!key || !poly.geometry) continue
    for (const t of located) {
      const lng = Number(t.lng)
      const lat = Number(t.lat)
      if (!pointInGeometry(lng, lat, poly.geometry)) continue
      const price = t.listPrice ?? 0
      const cur = best.get(key)
      if (!cur || price > cur.price) best.set(key, { url: t.photoUrl as string, price })
    }
  }
  const out = new Map<string, string>()
  for (const [k, v] of best) out.set(k, v.url)
  return out
}
