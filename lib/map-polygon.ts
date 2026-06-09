export type MapPolygonPoint = { lat: number; lng: number }

const MAX_POINTS = 80

function toFinite(value: string): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function encodeMapPolygon(points: MapPolygonPoint[]): string | undefined {
  if (!Array.isArray(points) || points.length < 3) return undefined
  const normalized = points
    .slice(0, MAX_POINTS)
    .map((point) => ({
      lat: Number(point.lat.toFixed(6)),
      lng: Number(point.lng.toFixed(6)),
    }))
  return normalized.map((point) => `${point.lat},${point.lng}`).join(';')
}

export function decodeMapPolygon(serialized: string | null | undefined): MapPolygonPoint[] | null {
  const raw = (serialized ?? '').trim()
  if (!raw) return null
  const points = raw
    .split(';')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .slice(0, MAX_POINTS)
    .map((pair) => {
      const [latRaw, lngRaw] = pair.split(',').map((part) => part.trim())
      const lat = toFinite(latRaw ?? '')
      const lng = toFinite(lngRaw ?? '')
      if (lat == null || lng == null) return null
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
      return { lat, lng }
    })
    .filter((point): point is MapPolygonPoint => point != null)
  return points.length >= 3 ? points : null
}

export function getPolygonBounds(points: MapPolygonPoint[]): {
  west: number
  south: number
  east: number
  north: number
} | null {
  if (!Array.isArray(points) || points.length < 3) return null
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  for (const point of points) {
    west = Math.min(west, point.lng)
    east = Math.max(east, point.lng)
    south = Math.min(south, point.lat)
    north = Math.max(north, point.lat)
  }
  if (!Number.isFinite(west) || !Number.isFinite(east) || !Number.isFinite(south) || !Number.isFinite(north)) {
    return null
  }
  return { west, south, east, north }
}

export function isPointInPolygon(point: MapPolygonPoint, polygon: MapPolygonPoint[]): boolean {
  if (polygon.length < 3) return false
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i]!.lng
    const yi = polygon[i]!.lat
    const xj = polygon[j]!.lng
    const yj = polygon[j]!.lat
    const intersects = ((yi > point.lat) !== (yj > point.lat)) &&
      (point.lng < ((xj - xi) * (point.lat - yi)) / ((yj - yi) || Number.EPSILON) + xi)
    if (intersects) inside = !inside
  }
  return inside
}

/**
 * True if the point falls inside ANY of the given rings (outer ring, or any ring
 * of a MultiPolygon). Used to CLIP listing pins to a rendered boundary so homes
 * never display outside the polygon on the city / community / neighborhood maps.
 * When `rings` is empty (no boundary), returns true — i.e. "show all".
 */
export function isInsideAnyRing(point: MapPolygonPoint, rings: MapPolygonPoint[][]): boolean {
  if (!rings || rings.length === 0) return true
  return rings.some((ring) => isPointInPolygon(point, ring))
}
