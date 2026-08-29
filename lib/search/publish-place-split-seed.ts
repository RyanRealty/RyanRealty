/**
 * Place-page Split seed. GeoJSON ring → DrawnShape[] + bbox.
 * Pass as MapSearchView initialShapes. Do not write ?shapes= onto the place URL.
 */
import type { DrawnShape, MapPolygonPoint } from '@/lib/map-polygon'
import type { MapBounds } from '@/app/actions/listings'

export type PlaceSplitSeed = {
  shapes: DrawnShape[]
  bounds: MapBounds
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

function ringToPoints(ring: unknown): MapPolygonPoint[] {
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
  return points.slice(0, 80)
}

/** First outer ring of a Polygon or MultiPolygon. Miss returns null. */
export function geoJsonToDrawnShapes(geom: { type?: string; coordinates?: unknown } | null | undefined): DrawnShape[] | null {
  if (!geom || !Array.isArray(geom.coordinates)) return null
  const type = geom.type
  let ring: unknown = null
  if (type === 'Polygon') ring = geom.coordinates[0]
  else if (type === 'MultiPolygon') {
    const first = geom.coordinates[0]
    ring = Array.isArray(first) ? first[0] : null
  } else return null
  const points = ringToPoints(ring)
  if (points.length < 3) return null
  return [{ type: 'polygon', points, exclude: false }]
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
  if (!shapes || !bounds) return null
  return { shapes, bounds }
}
