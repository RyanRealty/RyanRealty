/**
 * Place-page Split seed. GeoJSON ring → camera bbox + search ring.
 * Do not seed a drawable Area. Do not write ?shapes= onto the place URL.
 */
import type { DrawnShape, MapPolygonPoint } from '@/lib/map-polygon'
import type { MapBounds } from '@/app/actions/listings'

export type PlaceSplitSeed = {
  shapes: DrawnShape[]
  bounds: MapBounds
  /** Evenly sampled outer ring for the viewport fetch. Not a drawable Area. */
  searchRing: MapPolygonPoint[]
}

function visitLngLat(node: unknown, visit: (lng: number, lat: number) => void): void {
  if (Array.isArray(node) && typeof node[0] === 'number' && typeof node[1] === 'number') {
    visit(node[0] as number, node[1] as number)
    return
  }
  if (Array.isArray(node)) {
    for (const child of node) visitLngLat(child, visit)
  }
}

function downsampleRing(points: MapPolygonPoint[], max: number): MapPolygonPoint[] {
  if (points.length <= max) return points
  const out: MapPolygonPoint[] = []
  const last = points.length - 1
  for (let i = 0; i < max; i++) {
    out.push(points[Math.round((i / (max - 1)) * last)])
  }
  return out
}

function ringToPoints(ring: unknown, maxPoints: number): MapPolygonPoint[] {
  if (!Array.isArray(ring)) return []
  const points: MapPolygonPoint[] = []
  for (const pair of ring) {
    if (!Array.isArray(pair) || typeof pair[0] !== 'number' || typeof pair[1] !== 'number') continue
    const lng = pair[0] as number
    const lat = pair[1] as number
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue
    points.push({ lat, lng })
  }
  if (points.length >= 2) {
    const first = points[0]
    const last = points[points.length - 1]
    if (first.lat === last.lat && first.lng === last.lng) points.pop()
  }
  return downsampleRing(points, maxPoints)
}

/**
 * Every outer ring of a Polygon or MultiPolygon as include shapes. Miss
 * returns null. A MultiPolygon keeps EVERY part: a resort footprint built as
 * a county plat-union is dozens of disjoint parts, and taking only the first
 * scoped Black Butte Ranch's search to one plat cell — the map said "3 homes"
 * over a face counting 33 (2026-09-01). Parts capped so a pathological union
 * cannot flood the shapes RPC.
 */
export function geoJsonToDrawnShapes(geom: { type?: string; coordinates?: unknown } | null | undefined): DrawnShape[] | null {
  if (!geom || !Array.isArray(geom.coordinates)) return null
  const type = geom.type
  let rings: unknown[] = []
  if (type === 'Polygon') rings = [geom.coordinates[0]]
  else if (type === 'MultiPolygon') {
    rings = (geom.coordinates as unknown[])
      .slice(0, 120)
      .map((part) => (Array.isArray(part) ? part[0] : null))
      .filter((r) => r != null)
  } else return null
  const shapes: DrawnShape[] = []
  for (const ring of rings) {
    const points = ringToPoints(ring, 80)
    if (points.length >= 3) shapes.push({ type: 'polygon', points, exclude: false })
  }
  return shapes.length > 0 ? shapes : null
}

function outerRing(geom: { type?: string; coordinates?: unknown } | null | undefined): unknown {
  if (!geom || !Array.isArray(geom.coordinates)) return null
  if (geom.type === 'Polygon') return geom.coordinates[0]
  if (geom.type === 'MultiPolygon') {
    const first = geom.coordinates[0]
    return Array.isArray(first) ? first[0] : null
  }
  return null
}

export function bboxFromGeometry(
  geom: { type?: string; coordinates?: unknown } | null | undefined,
): MapBounds | null {
  if (!geom || !Array.isArray(geom.coordinates)) return null
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  visitLngLat(geom.coordinates, (lng, lat) => {
    if (lng < west) west = lng
    if (lng > east) east = lng
    if (lat < south) south = lat
    if (lat > north) north = lat
  })
  if (!Number.isFinite(west) || west >= east || south >= north) return null
  return { west, south, east, north }
}

export function publishPlaceSplitSeed(
  geom: { type?: string; coordinates?: unknown } | null | undefined,
): PlaceSplitSeed | null {
  const shapes = geoJsonToDrawnShapes(geom)
  const bounds = bboxFromGeometry(geom)
  const searchRing = ringToPoints(outerRing(geom), 200)
  if (!shapes || !bounds || searchRing.length < 3) return null
  return { shapes, bounds, searchRing }
}
