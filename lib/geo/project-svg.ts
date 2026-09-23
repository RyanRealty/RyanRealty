/**
 * Flat SVG projection for small regions (a county, a town) — pure functions,
 * no DOM. Equirectangular with the longitude axis scaled by cos(mid-latitude)
 * so shapes keep their aspect at Central Oregon's latitude (~44°N). Good to
 * well under 1% distortion across the Deschutes basin, which is all the
 * atlas asks of it; a real map projection library would be a dependency for
 * no visible gain at this scale.
 */

export type LonLat = readonly [number, number]
/** One closed ring of [lon, lat] points (GeoJSON order). */
export type Ring = readonly LonLat[]

export type Bbox = { minLon: number; minLat: number; maxLon: number; maxLat: number }

export type Projection = {
  /** SVG viewBox width. */
  width: number
  /** SVG viewBox height, derived from the bbox aspect at mid-latitude. */
  height: number
  toXY: (lon: number, lat: number) => readonly [number, number]
}

export function bboxOfRings(rings: readonly Ring[]): Bbox | null {
  let minLon = Infinity
  let minLat = Infinity
  let maxLon = -Infinity
  let maxLat = -Infinity
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue
      if (lon < minLon) minLon = lon
      if (lon > maxLon) maxLon = lon
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
    }
  }
  if (!Number.isFinite(minLon) || !Number.isFinite(minLat)) return null
  return { minLon, minLat, maxLon, maxLat }
}

export function padBbox(b: Bbox, fraction: number): Bbox {
  const dLon = (b.maxLon - b.minLon) * fraction
  const dLat = (b.maxLat - b.minLat) * fraction
  return { minLon: b.minLon - dLon, maxLon: b.maxLon + dLon, minLat: b.minLat - dLat, maxLat: b.maxLat + dLat }
}

export function makeProjection(b: Bbox, width = 1000): Projection {
  const midLat = ((b.minLat + b.maxLat) / 2) * (Math.PI / 180)
  const kx = Math.cos(midLat)
  const spanX = (b.maxLon - b.minLon) * kx
  const spanY = b.maxLat - b.minLat
  const scale = width / spanX
  const height = Math.round(spanY * scale)
  return {
    width,
    height,
    toXY: (lon, lat) => [(lon - b.minLon) * kx * scale, (b.maxLat - lat) * scale] as const,
  }
}

/** SVG path data for a set of rings, projected. */
export function ringsToPath(rings: readonly Ring[], proj: Projection, decimals = 1): string {
  const f = (n: number) => n.toFixed(decimals)
  let d = ''
  for (const ring of rings) {
    if (ring.length < 3) continue
    ring.forEach(([lon, lat], i) => {
      const [x, y] = proj.toXY(lon, lat)
      d += `${i === 0 ? 'M' : 'L'}${f(x)} ${f(y)}`
    })
    d += 'Z'
  }
  return d
}

/** Open line parts of a recorded LineString / MultiLineString. Never invents points. */
export function lineStringParts(
  geometry: GeoJSON.LineString | GeoJSON.MultiLineString,
): LonLat[][] {
  const asLine = (coords: readonly GeoJSON.Position[]): LonLat[] => {
    const out: LonLat[] = []
    for (const pos of coords) {
      const lon = pos[0]
      const lat = pos[1]
      if (typeof lon === 'number' && typeof lat === 'number') out.push([lon, lat])
    }
    return out
  }
  if (geometry.type === 'LineString') return [asLine(geometry.coordinates)]
  return geometry.coordinates.map((line) => asLine(line))
}

/**
 * SVG path data for an OPEN line — a road, a river. Unlike `ringsToPath` it
 * never closes the path and it keeps a two-point segment, which is most of what
 * a road network is made of.
 */
export function pointsToPath(points: readonly LonLat[], proj: Projection, decimals = 1): string {
  if (points.length < 2) return ''
  const f = (n: number) => n.toFixed(decimals)
  let d = ''
  points.forEach(([lon, lat], i) => {
    const [x, y] = proj.toXY(lon, lat)
    d += `${i === 0 ? 'M' : 'L'}${f(x)} ${f(y)}`
  })
  return d
}

/**
 * Outer rings of a GeoJSON Polygon or MultiPolygon. Holes are dropped: the
 * atlas draws places as silhouettes and tests membership against the outer
 * boundary, which is what a visitor means by "in Tetherow".
 */
function toRing(positions: readonly GeoJSON.Position[] | undefined): Ring | null {
  if (!positions || positions.length < 3) return null
  const ring: LonLat[] = []
  for (const pos of positions) {
    const lon = pos[0]
    const lat = pos[1]
    if (typeof lon === 'number' && typeof lat === 'number') ring.push([lon, lat])
  }
  return ring.length >= 3 ? ring : null
}

export function outerRings(geometry: GeoJSON.Geometry | null | undefined): Ring[] {
  if (!geometry) return []
  if (geometry.type === 'Polygon') {
    const outer = toRing(geometry.coordinates[0])
    return outer ? [outer] : []
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.flatMap((poly) => {
      const outer = toRing(poly[0])
      return outer ? [outer] : []
    })
  }
  return []
}

/** Ray-casting point-in-polygon against a set of outer rings (any hit wins). */
export function pointInRings(lon: number, lat: number, rings: readonly Ring[]): boolean {
  for (const ring of rings) {
    let inside = false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]!
      const [xj, yj] = ring[j]!
      const intersects = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
      if (intersects) inside = !inside
    }
    if (inside) return true
  }
  return false
}

/** Shortest distance from a point to one segment, in projected units. */
function distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  const t = lenSq > 0 ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq)) : 0
  const cx = x1 + t * dx
  const cy = y1 + t * dy
  return Math.hypot(px - cx, py - cy)
}

/**
 * Shortest distance from (lon, lat) to the nearest edge of a set of rings.
 * Longitude is scaled by `kx` (cos of the shape's mid-latitude) first, so the
 * distance approximates screen pixels rather than raw degrees — the same
 * anisotropy `makeProjection` corrects for the drawn map.
 */
function distanceToRingsEdge(lon: number, lat: number, rings: readonly Ring[], kx: number): number {
  let best = Infinity
  const px = lon * kx
  const py = lat
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x1, y1] = ring[j]!
      const [x2, y2] = ring[i]!
      const d = distanceToSegment(px, py, x1 * kx, y1, x2 * kx, y2)
      if (d < best) best = d
    }
  }
  return best
}

/**
 * An approximate pole of inaccessibility: the point INSIDE the polygon
 * farthest from every edge, for a label that must not sit on the boundary or
 * spill outside a concave shape. Coarse-to-fine grid search (a simplified,
 * dependency-free cousin of Mapbox's polylabel) — good enough for a
 * subdivision-sized silhouette; not a survey and not exact for a fractal
 * coastline, which this atlas never draws.
 *
 * Returns null when no sampled point falls inside the rings at all (a shape
 * thinner than the coarsest grid cell) — a caller adjusts a centroid or
 * omits the label rather than trusting a point that might sit outside.
 */
export function polygonInteriorPoint(rings: readonly Ring[]): LonLat | null {
  const bbox = bboxOfRings(rings)
  if (!bbox) return null
  const kx = Math.cos((((bbox.minLat + bbox.maxLat) / 2) * Math.PI) / 180) || 1
  const GRID = 9
  const ROUNDS = 5
  let frame = bbox
  let best: LonLat | null = null
  let bestD = -Infinity
  for (let round = 0; round < ROUNDS; round += 1) {
    const spanLon = frame.maxLon - frame.minLon
    const spanLat = frame.maxLat - frame.minLat
    if (spanLon <= 0 || spanLat <= 0) break
    let roundBest: LonLat | null = null
    let roundBestD = -Infinity
    for (let ix = 0; ix < GRID; ix += 1) {
      for (let iy = 0; iy < GRID; iy += 1) {
        const lon = frame.minLon + ((ix + 0.5) / GRID) * spanLon
        const lat = frame.minLat + ((iy + 0.5) / GRID) * spanLat
        if (!pointInRings(lon, lat, rings)) continue
        const d = distanceToRingsEdge(lon, lat, rings, kx)
        if (d > roundBestD) {
          roundBestD = d
          roundBest = [lon, lat]
        }
      }
    }
    if (!roundBest) break
    if (roundBestD > bestD) {
      bestD = roundBestD
      best = roundBest
    }
    // Zoom the frame into the best cell plus a one-cell margin, so the next
    // round refines around it instead of resampling the whole shape.
    const cellLon = (spanLon / GRID) * 1.5
    const cellLat = (spanLat / GRID) * 1.5
    frame = {
      minLon: roundBest[0] - cellLon,
      maxLon: roundBest[0] + cellLon,
      minLat: roundBest[1] - cellLat,
      maxLat: roundBest[1] + cellLat,
    }
  }
  return best
}

/** Centroid of the largest ring's bbox — a label anchor, not a true centroid. */
export function labelAnchor(rings: readonly Ring[]): LonLat | null {
  let best: Ring | null = null
  let bestArea = -1
  for (const ring of rings) {
    const b = bboxOfRings([ring])
    if (!b) continue
    const area = (b.maxLon - b.minLon) * (b.maxLat - b.minLat)
    if (area > bestArea) {
      bestArea = area
      best = ring
    }
  }
  if (!best) return null
  const b = bboxOfRings([best])!
  return [(b.minLon + b.maxLon) / 2, (b.minLat + b.maxLat) / 2]
}
