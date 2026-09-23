/**
 * Atlas geometry at the precision the Atlas can draw (UXLIVE-3 / COMP-4,
 * visibility audit 2026-09-22).
 *
 * THE DEFECT. The boundary DAL returns ST_AsGeoJSON verbatim: 13 to 15
 * decimal places (sub-millimetre) and every vertex the county digitised. The
 * Atlas projects that into a 1000-unit viewBox, prints paths at one decimal
 * of a unit, and zooms at most ATLAS_K_MAX times. Measured on production
 * 2026-09-23, those raw coordinates were 1.09 MB of /about's RSC payload
 * (the region's towns, communities and neighborhoods), 583 KB of Awbrey
 * Butte's (its 400 child plats) and 326 KB of /cities/bend's (parks and
 * trails), serialized once as client props and drawn again as SVG paths.
 *
 * THE RULE. A vertex that moves the drawn line by less than half a viewBox
 * unit at the deepest zoom is not information the reader can see, so it is
 * not shipped:
 *
 *   tolerance = frame span / 1000 units / ATLAS_K_MAX / 2   (degrees)
 *
 * Douglas-Peucker to that tolerance, coordinates rounded to the decimal that
 * keeps the rounding error under it, holes dropped (outerRings never reads
 * them: the Atlas draws and tests silhouettes). A listing's own coordinate is
 * already rounded to 1e-4 degrees (about 11 m) in atlasDotsFromTiles, so a
 * boundary moved by a fraction of a metre changes no count.
 *
 * The page compacts BEFORE it summarises, so the server's counts and the
 * browser's counts walk the same rings.
 *
 * Isomorphic, pure.
 */
import type { Bbox } from '@/lib/geo/project-svg'
import { ATLAS_K_MAX } from '@/lib/geo/atlas-camera'

/** The Atlas's deepest zoom: read from the camera, so a deeper zoom tightens the tolerance with it. */
const ATLAS_DEEPEST_ZOOM = ATLAS_K_MAX
/** Never simplify finer than this (about 0.1 m): below it the savings are nil. */
const MIN_TOLERANCE_DEG = 1e-6
/** Never coarser than this (about 10 m), whatever the frame. */
const MAX_TOLERANCE_DEG = 1e-4

type Position = readonly number[]

/** Half a viewBox unit at the deepest zoom, in degrees, for a frame box. */
export function atlasGeometryTolerance(box: Bbox | null | undefined): number {
  if (!box) return MIN_TOLERANCE_DEG
  const span = Math.max(box.maxLon - box.minLon, box.maxLat - box.minLat)
  if (!Number.isFinite(span) || span <= 0) return MIN_TOLERANCE_DEG
  const tol = span / 1000 / ATLAS_DEEPEST_ZOOM / 2
  return Math.min(MAX_TOLERANCE_DEG, Math.max(MIN_TOLERANCE_DEG, tol))
}

/** The decimals that keep rounding error (half a step) under the tolerance. */
export function atlasCoordDecimals(tolerance: number): number {
  const d = Math.ceil(-Math.log10(Math.max(tolerance, 1e-9)))
  return Math.min(7, Math.max(4, d))
}

function roundTo(n: number, decimals: number): number {
  const f = 10 ** decimals
  return Math.round(n * f) / f
}

function perpDistance(p: Position, a: Position, b: Position): number {
  const ax = a[0]!
  const ay = a[1]!
  const dx = b[0]! - ax
  const dy = b[1]! - ay
  if (dx === 0 && dy === 0) return Math.hypot(p[0]! - ax, p[1]! - ay)
  const t = Math.max(0, Math.min(1, ((p[0]! - ax) * dx + (p[1]! - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(p[0]! - (ax + t * dx), p[1]! - (ay + t * dy))
}

/** Douglas-Peucker, iterative. Keeps the first and last point. */
export function simplifyLine(points: readonly Position[], tolerance: number): Position[] {
  if (points.length <= 2 || !(tolerance > 0)) return [...points]
  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1
  const stack: [number, number][] = [[0, points.length - 1]]
  while (stack.length > 0) {
    const [s, e] = stack.pop()!
    let maxD = -1
    let maxI = -1
    for (let i = s + 1; i < e; i += 1) {
      const d = perpDistance(points[i]!, points[s]!, points[e]!)
      if (d > maxD) {
        maxD = d
        maxI = i
      }
    }
    if (maxI >= 0 && maxD > tolerance) {
      keep[maxI] = 1
      stack.push([s, maxI], [maxI, e])
    }
  }
  return points.filter((_, i) => keep[i] === 1)
}

function roundPositions(positions: readonly Position[], decimals: number): number[][] {
  const rounded: number[][] = []
  for (const pos of positions) {
    const lon = pos[0]
    const lat = pos[1]
    if (typeof lon !== 'number' || typeof lat !== 'number') continue
    const next = [roundTo(lon, decimals), roundTo(lat, decimals)]
    const prev = rounded[rounded.length - 1]
    if (prev && prev[0] === next[0] && prev[1] === next[1]) continue
    rounded.push(next)
  }
  return rounded
}

/**
 * Round, drop repeats, simplify. A shape smaller than the tolerance is never
 * erased by it: a ring that would fall under four points (a line under two)
 * keeps its vertices at the finest precision instead, so every place the page
 * outlined is still drawn and still a door.
 */
function compactPositions(
  positions: readonly Position[],
  tolerance: number,
  decimals: number,
  closed: boolean,
): number[][] {
  const floor = closed ? 4 : 2
  const rounded = roundPositions(positions, decimals)
  if (rounded.length < floor) {
    const fine = roundPositions(positions, 7)
    return fine.length >= floor
      ? fine
      : positions.flatMap((p) => (typeof p[0] === 'number' && typeof p[1] === 'number' ? [[p[0], p[1]]] : []))
  }
  const simple = simplifyLine(rounded, tolerance) as number[][]
  return simple.length < floor ? rounded : simple
}

/**
 * One geometry at Atlas precision. Polygon and MultiPolygon keep their outer
 * rings only; LineString and MultiLineString keep every part. Anything else
 * passes through untouched.
 */
export function compactAtlasGeometry<G extends GeoJSON.Geometry>(geometry: G, tolerance: number): G {
  const decimals = atlasCoordDecimals(tolerance)
  switch (geometry.type) {
    case 'Polygon': {
      const outer = geometry.coordinates[0]
      if (!outer) return geometry
      return { type: 'Polygon', coordinates: [compactPositions(outer, tolerance, decimals, true)] } as G
    }
    case 'MultiPolygon':
      return {
        type: 'MultiPolygon',
        coordinates: geometry.coordinates.flatMap((poly) =>
          poly[0] ? [[compactPositions(poly[0], tolerance, decimals, true)]] : [],
        ),
      } as G
    case 'LineString':
      return { type: 'LineString', coordinates: compactPositions(geometry.coordinates, tolerance, decimals, false) } as G
    case 'MultiLineString':
      return {
        type: 'MultiLineString',
        coordinates: geometry.coordinates.map((line) => compactPositions(line, tolerance, decimals, false)),
      } as G
    default:
      return geometry
  }
}

/** Every item's `geometry`, compacted; every other field kept as is. */
export function compactAtlasGeometries<T extends { geometry: GeoJSON.Geometry }>(
  items: readonly T[] | null | undefined,
  tolerance: number,
): T[] {
  return (items ?? []).map((item) => ({ ...item, geometry: compactAtlasGeometry(item.geometry, tolerance) }))
}
