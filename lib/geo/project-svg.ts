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
