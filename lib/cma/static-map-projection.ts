/**
 * Web Mercator, the small part of it a Google Static Map needs.
 *
 * tasteReview 2026-09-07, item 2: chapter 3's map was a single base64 `<img>`
 * with no pins, no image map and no canvas, so three of the interactions the
 * blueprint promises — tap a sale row and its pin pulses, tap a pin and the
 * row highlights and scrolls into view, and a tappable pin at all — did not
 * exist. A bitmap cannot answer a tap.
 *
 * The fix is to STOP asking Google to draw the markers and draw them
 * ourselves, as DOM over the tile. That needs two pure functions: one that
 * picks the centre and zoom a static map would use to hold a set of points,
 * and one that puts a point back at a pixel inside the image that came back.
 * Both are here, both are tested, and neither touches the network.
 *
 * Google's static map coordinate system: the world is 256 logical pixels
 * square at zoom 0 and doubles per zoom level, y is Mercator-projected, and
 * `scale=2` returns an image twice the requested `size` in real pixels while
 * leaving the logical geometry alone. So every figure below is in LOGICAL
 * pixels, and the caller converts to a percentage of the rendered image, which
 * is scale-independent and survives the image being laid out at any width.
 */

export type LatLng = { lat: number; lng: number }

/** What a static map was asked for. Enough to put a point back on it. */
export type StaticMapView = {
  centerLat: number
  centerLng: number
  zoom: number
  /** Logical pixels — the `size` parameter, not the scaled image. */
  width: number
  height: number
}

const TILE = 256
const MAX_LAT = 85.05112878

function clampLat(lat: number): number {
  return Math.max(-MAX_LAT, Math.min(MAX_LAT, lat))
}

/** Lat/lng to world pixels at zoom 0 (0..256 on both axes). */
export function latLngToWorld(p: LatLng): { x: number; y: number } {
  const lat = clampLat(p.lat)
  const sin = Math.sin((lat * Math.PI) / 180)
  return {
    x: TILE * (0.5 + p.lng / 360),
    y: TILE * (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)),
  }
}

/** World pixels at zoom 0 back to lat/lng. The inverse of the above. */
export function worldToLatLng(w: { x: number; y: number }): LatLng {
  const lng = (w.x / TILE - 0.5) * 360
  const n = Math.PI * (1 - (2 * w.y) / TILE)
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n))
  return { lat, lng }
}

export type FitOptions = {
  width: number
  height: number
  /** Logical pixels of breathing room on every edge. */
  padding?: number
  minZoom?: number
  maxZoom?: number
  /**
   * Keep the zoom fractional. A Google tile needs an integer zoom, which can
   * leave the frame up to twice as wide as the pins need; the document's own
   * SVG ground (lib/cma/map-ground.ts) has no such rule and fits tight.
   */
  fractional?: boolean
}

/**
 * The centre and integer zoom a static map needs to hold every point with
 * `padding` logical pixels to spare.
 *
 * Integer, because Google Static Maps takes an integer `zoom`; asking for one
 * we cannot get back would put every overlay pin in the wrong place, which is
 * worse than a slightly loose frame.
 */
export function fitStaticMapView(points: readonly LatLng[], opts: FitOptions): StaticMapView | null {
  const pts = points.filter(
    (p) => p != null && Number.isFinite(p.lat) && Number.isFinite(p.lng),
  )
  if (pts.length === 0) return null
  const padding = opts.padding ?? 48
  const minZoom = opts.minZoom ?? 1
  const maxZoom = opts.maxZoom ?? 17
  const world = pts.map(latLngToWorld)
  const minX = Math.min(...world.map((w) => w.x))
  const maxX = Math.max(...world.map((w) => w.x))
  const minY = Math.min(...world.map((w) => w.y))
  const maxY = Math.max(...world.map((w) => w.y))
  const usableW = Math.max(opts.width - padding * 2, 1)
  const usableH = Math.max(opts.height - padding * 2, 1)
  // A single point, or a set of clones, has no extent: fall back to maxZoom
  // rather than dividing by zero and asking for zoom Infinity.
  const spanX = Math.max(maxX - minX, 1e-9)
  const spanY = Math.max(maxY - minY, 1e-9)
  const raw = Math.min(Math.log2(usableW / spanX), Math.log2(usableH / spanY))
  const zoom = Math.max(minZoom, Math.min(maxZoom, opts.fractional ? raw : Math.floor(raw)))
  const center = worldToLatLng({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 })
  return {
    centerLat: center.lat,
    centerLng: center.lng,
    zoom,
    width: opts.width,
    height: opts.height,
  }
}

/**
 * Where a point lands inside the returned image, as a percentage of its width
 * and height — scale-independent, so the overlay is right whether the image is
 * laid out at 320px or 1120px.
 *
 * Returns null when the point falls outside the frame: a pin drawn at 118% is
 * a pin pointing at the wrong house.
 */
export function projectToImagePercent(
  p: LatLng,
  view: StaticMapView,
  slackPct = 0,
): { xPct: number; yPct: number } | null {
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return null
  const scale = Math.pow(2, view.zoom)
  const c = latLngToWorld({ lat: view.centerLat, lng: view.centerLng })
  const w = latLngToWorld(p)
  const px = (w.x - c.x) * scale + view.width / 2
  const py = (w.y - c.y) * scale + view.height / 2
  const xPct = (px / view.width) * 100
  const yPct = (py / view.height) * 100
  if (xPct < -slackPct || xPct > 100 + slackPct || yPct < -slackPct || yPct > 100 + slackPct) {
    return null
  }
  return { xPct, yPct }
}
