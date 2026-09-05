/**
 * Pan/zoom camera for V3Atlas. World space is the untransformed stage
 * (the SVG already fills the box). Screen = world * k + (x, y).
 */
export type AtlasCam = { k: number; x: number; y: number }

/** Home fit is k=1. Below 1 the place shrinks in the frame so the visitor can zoom out. */
export const ATLAS_K_MIN = 0.5
/** CSS scale past this rasterizes the map into unreadable blocks. */
export const ATLAS_K_MAX = 5

export const ATLAS_CAM_HOME: AtlasCam = { k: 1, x: 0, y: 0 }

export function clampCam(cam: AtlasCam, w: number, h: number): AtlasCam {
  const k = Math.min(ATLAS_K_MAX, Math.max(ATLAS_K_MIN, cam.k))
  const worldW = w * k
  const worldH = h * k
  const clampAxis = (span: number, world: number, v: number) =>
    world >= span ? Math.min(0, Math.max(span - world, v)) : Math.min(span - world, Math.max(0, v))
  return {
    k,
    x: clampAxis(w, worldW, cam.x),
    y: clampAxis(h, worldH, cam.y),
  }
}

/** Zoom so the point under (px, py) in stage pixels stays put. */
export function zoomAt(cam: AtlasCam, px: number, py: number, factor: number, w: number, h: number): AtlasCam {
  const k = Math.min(ATLAS_K_MAX, Math.max(ATLAS_K_MIN, cam.k * factor))
  if (k === cam.k) return clampCam(cam, w, h)
  const wx = (px - cam.x) / cam.k
  const wy = (py - cam.y) / cam.k
  return clampCam({ k, x: px - wx * k, y: py - wy * k }, w, h)
}

export function panBy(cam: AtlasCam, dx: number, dy: number, w: number, h: number): AtlasCam {
  return clampCam({ k: cam.k, x: cam.x + dx, y: cam.y + dy }, w, h)
}

/** Fit a world-space box in the stage, padded. */
export function fitRect(
  rect: { x0: number; y0: number; x1: number; y1: number },
  w: number,
  h: number,
  pad = 0.14,
): AtlasCam {
  const bw = Math.max(rect.x1 - rect.x0, 12)
  const bh = Math.max(rect.y1 - rect.y0, 12)
  const k = Math.min(ATLAS_K_MAX, Math.max(ATLAS_K_MIN, Math.min((w * (1 - 2 * pad)) / bw, (h * (1 - 2 * pad)) / bh)))
  const mx = (rect.x0 + rect.x1) / 2
  const my = (rect.y0 + rect.y1) / 2
  return clampCam({ k, x: w / 2 - mx * k, y: h / 2 - my * k }, w, h)
}

export function screenToWorld(cam: AtlasCam, px: number, py: number): readonly [number, number] {
  return [(px - cam.x) / cam.k, (py - cam.y) / cam.k]
}

/** Untransformed stage box currently on screen. */
export type AtlasWorldRect = { x0: number; y0: number; x1: number; y1: number }

export function visibleWorld(cam: AtlasCam, w: number, h: number): AtlasWorldRect {
  const [x0, y0] = screenToWorld(cam, 0, 0)
  const [x1, y1] = screenToWorld(cam, w, h)
  return {
    x0: Math.min(x0, x1),
    y0: Math.min(y0, y1),
    x1: Math.max(x0, x1),
    y1: Math.max(y0, y1),
  }
}

/** Geographic box the stage shows. Null from the atlas means the list is unfiltered. */
export type AtlasViewBounds = { minLat: number; maxLat: number; minLon: number; maxLon: number }

export type AtlasView = { w: number; h: number; scale: number; ox: number; oy: number }

/** Invert a linear lon/lat → x/y projection at one SVG point. */
export function xyToLonLat(
  toXY: (lon: number, lat: number) => readonly [number, number],
  x: number,
  y: number,
): { lon: number; lat: number } {
  const lon0 = -121
  const lat0 = 44
  const [x0, y0] = toXY(lon0, lat0)
  const [xLon] = toXY(lon0 + 1, lat0)
  const [, yLat] = toXY(lon0, lat0 + 1)
  const dLonX = xLon - x0
  const dLatY = yLat - y0
  return {
    lon: dLonX === 0 ? lon0 : lon0 + (x - x0) / dLonX,
    lat: dLatY === 0 ? lat0 : lat0 + (y - y0) / dLatY,
  }
}

/**
 * Visible lon/lat from camera + measured view. `ox`/`scale` invert `toPx`
 * (stage px → SVG), then `toXY` inverts to geography.
 */
export function visibleLonLat(
  cam: AtlasCam,
  view: AtlasView,
  toXY: (lon: number, lat: number) => readonly [number, number],
): AtlasViewBounds {
  const world = visibleWorld(cam, view.w, view.h)
  const scale = view.scale === 0 ? 1 : view.scale
  const corners = [
    xyToLonLat(toXY, (world.x0 - view.ox) / scale, (world.y0 - view.oy) / scale),
    xyToLonLat(toXY, (world.x1 - view.ox) / scale, (world.y0 - view.oy) / scale),
    xyToLonLat(toXY, (world.x0 - view.ox) / scale, (world.y1 - view.oy) / scale),
    xyToLonLat(toXY, (world.x1 - view.ox) / scale, (world.y1 - view.oy) / scale),
  ]
  return {
    minLon: Math.min(corners[0]!.lon, corners[1]!.lon, corners[2]!.lon, corners[3]!.lon),
    maxLon: Math.max(corners[0]!.lon, corners[1]!.lon, corners[2]!.lon, corners[3]!.lon),
    minLat: Math.min(corners[0]!.lat, corners[1]!.lat, corners[2]!.lat, corners[3]!.lat),
    maxLat: Math.max(corners[0]!.lat, corners[1]!.lat, corners[2]!.lat, corners[3]!.lat),
  }
}

/** `bounds == null` (full frame) keeps every row, including those without a point. */
export function inAtlasView(
  lat: number | null | undefined,
  lng: number | null | undefined,
  bounds: AtlasViewBounds | null,
): boolean {
  if (!bounds) return true
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return false
  return lat >= bounds.minLat && lat <= bounds.maxLat && lng >= bounds.minLon && lng <= bounds.maxLon
}

type AtlasViewListener = (bounds: AtlasViewBounds | null) => void
const atlasViewListeners = new Set<AtlasViewListener>()

export function subscribeAtlasView(listener: AtlasViewListener): () => void {
  atlasViewListeners.add(listener)
  return () => {
    atlasViewListeners.delete(listener)
  }
}

export function publishAtlasView(bounds: AtlasViewBounds | null): void {
  for (const listener of atlasViewListeners) listener(bounds)
}
