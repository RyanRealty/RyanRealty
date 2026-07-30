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

// ── Multi-shape include/exclude sets (Phase 2 map search) ───────────────────
// Mirrors the SQL contract of public.search_listing_keys_in_shapes
// (supabase/migrations/20260730011000_search_shapes_rpc.sql): coords are
// GeoJSON-ordered [lng, lat]; a point matches when it is inside the union of
// `include` and NOT inside the union of `exclude`. These helpers are the
// in-memory FALLBACK the DAL uses when the RPC is unavailable — the primary
// path is PostGIS.

/** One drawn shape, [lng, lat] axis order (GeoJSON / the RPC contract). */
export type MapShape =
  | { type: 'polygon'; coords: [number, number][] }
  | { type: 'circle'; center: [number, number]; radius_m: number }

export type MapShapeSet = { include: MapShape[]; exclude?: MapShape[] }

const EARTH_RADIUS_M = 6371008.8

/** Great-circle distance in meters (mean-Earth-radius haversine, ±0.5%). */
export function haversineMeters(a: MapPolygonPoint, b: MapPolygonPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h =
    sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function isPointInShape(point: MapPolygonPoint, shape: MapShape): boolean {
  if (shape.type === 'circle') {
    const [lng, lat] = shape.center
    return haversineMeters(point, { lat, lng }) <= shape.radius_m
  }
  return isPointInPolygon(
    point,
    shape.coords.map(([lng, lat]) => ({ lat, lng }))
  )
}

/** Union(include) minus union(exclude) — the RPC's set algebra, in memory. */
export function isPointInShapeSet(point: MapPolygonPoint, set: MapShapeSet): boolean {
  if (!set.include.some((shape) => isPointInShape(point, shape))) return false
  return !(set.exclude ?? []).some((shape) => isPointInShape(point, shape))
}

// ── Drawn-shape UI model + ?shapes= URL codec (Phase 2 draw tools) ──────────
// The UI speaks {lat,lng} (Google Maps order); the server contract (MapShape /
// search_listing_keys_in_shapes) speaks GeoJSON [lng, lat]. DrawnShape is the
// UI-side shape; buildShapeSetForSearch converts to the RPC contract.

/** One user-drawn shape as the map UI holds it. `name` is the rename-later
 *  hook for Phase 2.4 named areas — never URL-encoded, defaults to "Area N". */
export type DrawnShape =
  | { type: 'polygon'; points: MapPolygonPoint[]; exclude: boolean; name?: string }
  | { type: 'circle'; center: MapPolygonPoint; radiusM: number; exclude: boolean; name?: string }

/** UI-level cap — the server allows 50 total, but 12 drawn areas is already
 *  past any real search; keeps the URL bounded. */
export const MAX_SHAPES = 12
/** Matches the RPC's 200 km ST_DWithin cap. */
export const MAX_SHAPE_RADIUS_M = 200_000

function encodeLatLng(p: MapPolygonPoint): string {
  return `${Number(p.lat.toFixed(6))},${Number(p.lng.toFixed(6))}`
}

function decodeLatLng(pair: string): MapPolygonPoint | null {
  const [latRaw, lngRaw] = pair.split(',').map((part) => part.trim())
  const lat = toFinite(latRaw ?? '')
  const lng = toFinite(lngRaw ?? '')
  if (lat == null || lng == null) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

/**
 * Encode a drawn shape set for the `?shapes=` URL param.
 *
 * Spec (decoded form; URLSearchParams percent-escaping rides on top):
 *   shapes  := shape ('*' shape)*
 *   shape   := polygon | circle
 *   polygon := ('p'|'xp') (';' lat ',' lng){3,80}     — 'xp' = exclude
 *   circle  := ('c'|'xc') ';' lat ',' lng ';' radiusM — integer meters, 1..200000
 * Coords are rounded to 6 decimals (≈11 cm), matching encodeMapPolygon.
 * Example: `p;44.1,-121.3;44.2,-121.3;44.2,-121.2*xc;44.15,-121.25;1609`
 *
 * Shapes that cannot encode (degenerate polygon, non-finite radius) are
 * skipped; returns undefined when nothing encodable remains.
 */
export function encodeMapShapes(shapes: DrawnShape[]): string | undefined {
  if (!Array.isArray(shapes) || shapes.length === 0) return undefined
  const parts: string[] = []
  for (const shape of shapes.slice(0, MAX_SHAPES)) {
    if (shape.type === 'polygon') {
      if (!Array.isArray(shape.points) || shape.points.length < 3) continue
      const points = shape.points.slice(0, MAX_POINTS).map(encodeLatLng)
      parts.push([shape.exclude ? 'xp' : 'p', ...points].join(';'))
    } else {
      const radius = Math.round(shape.radiusM)
      if (!Number.isFinite(radius) || radius < 1 || radius > MAX_SHAPE_RADIUS_M) continue
      parts.push([shape.exclude ? 'xc' : 'c', encodeLatLng(shape.center), String(radius)].join(';'))
    }
  }
  return parts.length > 0 ? parts.join('*') : undefined
}

/**
 * Decode `?shapes=`. STRICT: any malformed shape rejects the whole set (null),
 * mirroring the DAL's no-silent-widening policy — a dropped exclude shape
 * would return homes the user explicitly carved out.
 * Legacy `?poly=` keeps its own decoder (decodeMapPolygon) forever.
 */
export function decodeMapShapes(serialized: string | null | undefined): DrawnShape[] | null {
  const raw = (serialized ?? '').trim()
  if (!raw) return null
  const tokens = raw.split('*').map((t) => t.trim()).filter(Boolean)
  if (tokens.length === 0 || tokens.length > MAX_SHAPES) return null
  const shapes: DrawnShape[] = []
  for (const token of tokens) {
    const fields = token.split(';').map((f) => f.trim())
    const tag = fields[0]
    if (tag === 'p' || tag === 'xp') {
      const pairs = fields.slice(1)
      if (pairs.length < 3 || pairs.length > MAX_POINTS) return null
      const points: MapPolygonPoint[] = []
      for (const pair of pairs) {
        const point = decodeLatLng(pair)
        if (!point) return null
        points.push(point)
      }
      shapes.push({ type: 'polygon', points, exclude: tag === 'xp' })
    } else if (tag === 'c' || tag === 'xc') {
      if (fields.length !== 3) return null
      const center = decodeLatLng(fields[1] ?? '')
      const radius = Number(fields[2])
      if (
        !center ||
        !Number.isFinite(radius) ||
        !Number.isInteger(radius) ||
        radius < 1 ||
        radius > MAX_SHAPE_RADIUS_M
      ) {
        return null
      }
      shapes.push({ type: 'circle', center, radiusM: radius, exclude: tag === 'xc' })
    } else {
      return null
    }
  }
  return shapes.length > 0 ? shapes : null
}

/**
 * Convert drawn shapes to the server contract (MapShapeSet, [lng,lat] order).
 * Set algebra: union(include) minus union(exclude). When the user drew ONLY
 * exclude shapes, the natural meaning is "this viewport minus those areas" —
 * the RPC requires ≥1 include, so the viewport bbox is synthesized as the
 * include ring. Returns null when nothing spatial applies.
 */
export function buildShapeSetForSearch(
  shapes: DrawnShape[] | null | undefined,
  viewportBounds?: { west: number; south: number; east: number; north: number } | null
): MapShapeSet | null {
  if (!shapes || shapes.length === 0) return null
  const toServerShape = (s: DrawnShape): MapShape =>
    s.type === 'circle'
      ? {
          type: 'circle',
          center: [s.center.lng, s.center.lat],
          radius_m: Math.min(MAX_SHAPE_RADIUS_M, Math.max(1, Math.round(s.radiusM))),
        }
      : { type: 'polygon', coords: s.points.map((p) => [p.lng, p.lat] as [number, number]) }
  const valid = (s: DrawnShape) => (s.type === 'circle' ? s.radiusM > 0 : s.points.length >= 3)
  const include = shapes.filter((s) => !s.exclude && valid(s)).map(toServerShape)
  const exclude = shapes.filter((s) => s.exclude && valid(s)).map(toServerShape)
  if (include.length === 0 && exclude.length > 0 && viewportBounds) {
    const { west, south, east, north } = viewportBounds
    include.push({
      type: 'polygon',
      coords: [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ],
    })
  }
  if (include.length === 0) return null
  return exclude.length > 0 ? { include, exclude } : { include }
}

/**
 * Envelope (bbox) of the INCLUDE shapes — excludes never widen the search
 * area. Circle envelopes are analytic (radius → degrees at the center's
 * latitude, +1% margin), matching the SQL function's pre-filter.
 */
export function getShapeSetBounds(set: MapShapeSet): {
  west: number
  south: number
  east: number
  north: number
} | null {
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  for (const shape of set.include) {
    if (shape.type === 'polygon') {
      for (const [lng, lat] of shape.coords) {
        west = Math.min(west, lng)
        east = Math.max(east, lng)
        south = Math.min(south, lat)
        north = Math.max(north, lat)
      }
    } else {
      const [lng, lat] = shape.center
      const dLat = (shape.radius_m / 111320) * 1.01
      const dLng = (shape.radius_m / (111320 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01))) * 1.01
      west = Math.min(west, lng - dLng)
      east = Math.max(east, lng + dLng)
      south = Math.min(south, lat - dLat)
      north = Math.max(north, lat + dLat)
    }
  }
  if (!Number.isFinite(west) || !Number.isFinite(east) || !Number.isFinite(south) || !Number.isFinite(north)) {
    return null
  }
  return {
    west: Math.max(west, -180),
    south: Math.max(south, -90),
    east: Math.min(east, 180),
    north: Math.min(north, 90),
  }
}
