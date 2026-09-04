/**
 * Pan/zoom camera for V3Atlas. World space is the untransformed stage
 * (the SVG already fills the box). Screen = world * k + (x, y).
 */
export type AtlasCam = { k: number; x: number; y: number }

export const ATLAS_K_MIN = 1
/** CSS scale past this rasterizes the map into unreadable blocks. */
export const ATLAS_K_MAX = 5

export const ATLAS_CAM_HOME: AtlasCam = { k: 1, x: 0, y: 0 }

export function clampCam(cam: AtlasCam, w: number, h: number): AtlasCam {
  const k = Math.min(ATLAS_K_MAX, Math.max(ATLAS_K_MIN, cam.k))
  const minX = w - w * k
  const minY = h - h * k
  return {
    k,
    x: Math.min(0, Math.max(minX, cam.x)),
    y: Math.min(0, Math.max(minY, cam.y)),
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
