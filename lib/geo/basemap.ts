/**
 * The basemap under the living map: the highway skeleton, the named rivers and
 * canals, and the lakes of Central Oregon, drawn in our own projection.
 *
 * The file on disk (`data/basemap/central-oregon-{region,near}.json`, built by
 * scripts/gis/build-basemap-skeleton.mjs from public-domain US Census
 * TIGER/Line 2024) stores every path as quantized deltas — `[x0, y0, dx, dy, …]`
 * in units of 1/q degrees — because a region frame carries seven thousand
 * points and absolute coordinates cost twenty-two bytes each.
 *
 * A page picks the tier, clips to its own frame by the integer bounding box
 * each feature carries (no decoding), and hands the still-encoded subset to the
 * map, which decodes once and projects with the same functions it uses for the
 * recorded boundaries.
 */
import type { Bbox, LonLat } from './project-svg'

/** A path as quantized deltas: [x0, y0, dx1, dy1, …]. */
export type BasemapPath = readonly number[]

export type BasemapFeature = {
  /** primary | secondary for a road; river | canal for a waterway; lake | reservoir | river for a body. */
  c: string
  /** The published name, or '' where the recorder left it blank. */
  n: string
  /** The feature's bounding box in quantized units: [minX, minY, maxX, maxY]. */
  b: readonly number[]
  p: readonly BasemapPath[]
}

export type Basemap = {
  source: string
  sourceUrl: string
  counties: readonly string[]
  tier: string
  /** Quantization: a stored unit is 1/q degrees. */
  q: number
  method: string
  roads: readonly BasemapFeature[]
  waterways: readonly BasemapFeature[]
  bodies: readonly BasemapFeature[]
}

export const EMPTY_BASEMAP: Basemap = {
  source: '',
  sourceUrl: '',
  counties: [],
  tier: 'none',
  q: 10000,
  method: '',
  roads: [],
  waterways: [],
  bodies: [],
}

/** One encoded path back to lon/lat pairs. */
export function decodeBasemapPath(path: BasemapPath, q: number): LonLat[] {
  if (path.length < 4 || q === 0) return []
  const out: LonLat[] = []
  let x = path[0]!
  let y = path[1]!
  out.push([x / q, y / q])
  for (let i = 2; i + 1 < path.length; i += 2) {
    x += path[i]!
    y += path[i + 1]!
    out.push([x / q, y / q])
  }
  return out
}

export function decodeBasemapFeature(feature: BasemapFeature, q: number): LonLat[][] {
  return feature.p.map((path) => decodeBasemapPath(path, q)).filter((points) => points.length >= 2)
}

/** Does a feature's stored box overlap the frame? Integer compare, no decode. */
function overlaps(box: readonly number[], frame: readonly number[]): boolean {
  return box[0]! <= frame[2]! && box[2]! >= frame[0]! && box[1]! <= frame[3]! && box[3]! >= frame[1]!
}

/**
 * The subset of a basemap a frame holds, still encoded — this is what crosses
 * to the client. `pad` widens the frame by a fraction of its own span so a
 * highway that leaves the top of the map still enters it.
 */
export function clipBasemap(basemap: Basemap | null | undefined, bbox: Bbox | null | undefined, pad = 0.15): Basemap {
  if (!basemap) return EMPTY_BASEMAP
  if (!bbox) return basemap
  const q = basemap.q
  const dLon = (bbox.maxLon - bbox.minLon) * pad
  const dLat = (bbox.maxLat - bbox.minLat) * pad
  const frame = [
    Math.round((bbox.minLon - dLon) * q),
    Math.round((bbox.minLat - dLat) * q),
    Math.round((bbox.maxLon + dLon) * q),
    Math.round((bbox.maxLat + dLat) * q),
  ]
  const keep = (features: readonly BasemapFeature[]): BasemapFeature[] =>
    features.filter((f) => f.p.length > 0 && overlaps(f.b, frame))
  return {
    ...basemap,
    roads: keep(basemap.roads),
    waterways: keep(basemap.waterways),
    bodies: keep(basemap.bodies),
  }
}

/** How many coordinates a basemap carries — the payload check in one number. */
export function basemapPoints(basemap: Basemap | null | undefined): number {
  if (!basemap) return 0
  const count = (features: readonly BasemapFeature[]): number =>
    features.reduce((n, f) => n + f.p.reduce((m, path) => m + path.length / 2, 0), 0)
  return count(basemap.roads) + count(basemap.waterways) + count(basemap.bodies)
}

/**
 * Drop what a frame is too coarse to show. A region frame drawing every named
 * creek is noise; the rule is the same one the eye applies — a feature whose
 * whole extent is under a pixel or two does not earn ink.
 */
export function thinBasemap(basemap: Basemap, bbox: Bbox, minSpanFraction = 0.04): Basemap {
  const q = basemap.q
  const lonSpan = (bbox.maxLon - bbox.minLon) * q
  const latSpan = (bbox.maxLat - bbox.minLat) * q
  const min = Math.max(lonSpan, latSpan) * minSpanFraction
  const wide = (f: BasemapFeature): boolean => Math.max(f.b[2]! - f.b[0]!, f.b[3]! - f.b[1]!) >= min
  return {
    ...basemap,
    // Roads are the orientation layer: a short highway stub still says where
    // the junction is, so only water thins.
    waterways: basemap.waterways.filter(wide),
    bodies: basemap.bodies.filter(wide),
  }
}
