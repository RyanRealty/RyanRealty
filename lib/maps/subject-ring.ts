/**
 * Place first-look subject ring. Atlas paints every outline twice — cream
 * halo under navy ink — so the silhouette reads over the field.
 *
 * 381997f27 kept the fitted zoom (no setZoom(9)) but Cos rematch on
 * dpl_8mPgUD1TnSYE6efbuk2E1mbYGp1k still failed: fitBounds settles on
 * integer z10, the projected SVG is ~101×126 on a 320×187 island, and
 * placeLookFill stamped 0.00 because pixelBox() was read before OverlayView
 * drew. Same recorded paths. No invent geom. Camera now zooms to fill
 * (fractional) until fill ≥ 0.7 and box ≥ 110, then restamps after draw.
 */

export const SUBJECT_RING_INK_WEIGHT = 8
export const SUBJECT_RING_HALO_WEIGHT = 18
/** OverlayView pills use zIndex 1. The ring stroke stays under them. */
export const SUBJECT_RING_Z_UNDER_PILLS = 0
/** Chip sits above $ pills at the north of the fitted ring so "Bend" reads. */
export const SUBJECT_RING_CHIP_Z = 3
export const SUBJECT_RING_HALO_Z = 1
export const SUBJECT_RING_INK_Z = 2
/**
 * Cos rematch on dpl_8mPgUD1TnSYE6efbuk2E1mbYGp1k measured the OverlayView
 * SVG at ~101×126px on a 320×187 island (z10 after 381997f27). Still a
 * knot: fill 101/187 ≈ 0.54. 87×99 was the older z9 cancel.
 */
export const SUBJECT_RING_KNOT_PX = 110
/** Fitted ring must cover this share of the island's shorter side. */
export const SUBJECT_RING_MIN_ISLAND_FILL = 0.7
/** Web Mercator tile width. OverlayView CSS pixels scale the same way. */
export const SUBJECT_RING_TILE_PX = 256

export type RingPoint = { lat: number; lng: number }

/** "Bend Oregon" → "Bend". Neighborhood queries keep their leading name. */
export function subjectRingLabel(placeQuery?: string | null): string | null {
  const raw = placeQuery?.trim()
  if (!raw) return null
  const named = raw.replace(/\s+Oregon\s*$/i, '').trim()
  return named || null
}

export function subjectRingInkWeight(boundaryStrokeWeight?: number): number {
  return boundaryStrokeWeight ?? SUBJECT_RING_INK_WEIGHT
}

export function subjectRingHaloWeight(ink: number): number {
  return Math.max(SUBJECT_RING_HALO_WEIGHT, ink + 10)
}

export type IslandBox = { width: number; height: number }

/** Projected ring vs the map island. 87×99 on 335×208 is a knot (~0.48). */
export function subjectRingIslandFill(island: IslandBox, ring: IslandBox): number {
  const islandMin = Math.min(island.width, island.height)
  const ringMin = Math.min(ring.width, ring.height)
  if (!(islandMin > 0) || !(ringMin > 0)) return 0
  return ringMin / islandMin
}

export function subjectRingIsKnot(island: IslandBox, ring: IslandBox): boolean {
  const knotByPx = Math.max(ring.width, ring.height) > 0 && Math.max(ring.width, ring.height) < SUBJECT_RING_KNOT_PX
  return knotByPx || subjectRingIslandFill(island, ring) < SUBJECT_RING_MIN_ISLAND_FILL
}

/**
 * Keep the zoom fitBounds just chose. Only pull back from lot zoom that
 * crops the city. Never clamp to 9 — getZoom() before idle is the pre-fit
 * camera (often 11), and setZoom(9) cancels the fit (87×99 knot).
 *
 * Keeping z10 is not enough: integer fitBounds on a 13rem island still
 * projects Bend to ~101×126 (fill 0.54). Pair with subjectRingZoomFromMeasuredBox.
 */
export function subjectRingKeepFittedZoom(fittedZoom: number | null | undefined): number | null {
  if (fittedZoom == null || !Number.isFinite(fittedZoom)) return null
  if (fittedZoom > 14) return 14
  if (fittedZoom < 7) return 7
  return fittedZoom
}

/**
 * Scale the current camera so the already-projected SVG meets fill ≥ 0.7
 * and max(box) ≥ 110. Returns null when the box is 0 (overlay has not
 * drawn — remasure) or when the ring already reads.
 *
 * Mercator CSS pixels double per zoom step, so +log2(scale) is exact.
 * Cos kick: 101×126 @ z10 on 320×187 → ~10.37 (fill 0.70, box 163).
 */
export function subjectRingZoomFromMeasuredBox(
  zoom: number,
  island: IslandBox,
  ring: IslandBox,
): number | null {
  if (!Number.isFinite(zoom)) return null
  const islandMin = Math.min(island.width, island.height)
  const ringMin = Math.min(ring.width, ring.height)
  const ringMax = Math.max(ring.width, ring.height)
  if (!(islandMin > 0) || !(ringMin > 0) || !(ringMax > 0)) return null

  const scaleFill = (SUBJECT_RING_MIN_ISLAND_FILL * islandMin) / ringMin
  const scaleBox = ringMax < SUBJECT_RING_KNOT_PX ? SUBJECT_RING_KNOT_PX / ringMax : 1
  const scale = Math.max(scaleFill, scaleBox, 1)
  if (scale <= 1 && !subjectRingIsKnot(island, ring)) return null

  return subjectRingKeepFittedZoom(zoom + Math.log2(scale))
}

export function subjectRingMercatorWorld(
  lat: number,
  lng: number,
  zoom: number,
): { x: number; y: number } {
  const scale = SUBJECT_RING_TILE_PX * 2 ** zoom
  const x = ((lng + 180) / 360) * scale
  const sin = Math.sin((lat * Math.PI) / 180)
  const clipped = Math.min(1 - 1e-12, Math.max(-1 + 1e-12, sin))
  const y = (0.5 - Math.log((1 + clipped) / (1 - clipped)) / (4 * Math.PI)) * scale
  return { x, y }
}

/**
 * Project recorded vertices the same way OverlayView lastBox does (path
 * bbox + halo on each side). Fallback when pixelBox is still 0.
 */
export function subjectRingProjectedBox(
  paths: readonly (readonly RingPoint[])[],
  zoom: number,
  halo = SUBJECT_RING_HALO_WEIGHT,
): IslandBox {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const path of paths) {
    for (const p of path) {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue
      const { x, y } = subjectRingMercatorWorld(p.lat, p.lng, zoom)
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }
  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return { width: 0, height: 0 }
  return {
    width: maxX - minX + halo * 2,
    height: maxY - minY + halo * 2,
  }
}

/** Smallest zoom in 7..14 where the recorded paths are not a knot. */
export function subjectRingZoomFromPaths(
  paths: readonly (readonly RingPoint[])[],
  island: IslandBox,
  halo = SUBJECT_RING_HALO_WEIGHT,
): number | null {
  if (!(island.width > 0) || !(island.height > 0) || paths.flat().length < 2) return null
  let lo = 7
  let hi = 14
  let found: number | null = null
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2
    const box = subjectRingProjectedBox(paths, mid, halo)
    if (subjectRingIsKnot(island, box)) {
      lo = mid
    } else {
      found = mid
      hi = mid
    }
  }
  return subjectRingKeepFittedZoom(found ?? lo)
}

/**
 * Chip sits just inside the recorded ring at the northern vertex so it
 * is not parked on the stroke under edge pills. Centroid is the mean of
 * the same vertices — not a second geometry.
 */
export function ringLabelAnchor(paths: readonly (readonly RingPoint[])[]): RingPoint | null {
  let north: RingPoint | null = null
  let sumLat = 0
  let sumLng = 0
  let n = 0
  for (const path of paths) {
    for (const p of path) {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue
      sumLat += p.lat
      sumLng += p.lng
      n += 1
      if (!north || p.lat > north.lat) north = p
    }
  }
  if (!north || n === 0) return null
  return {
    lat: north.lat * 0.85 + (sumLat / n) * 0.15,
    lng: north.lng * 0.85 + (sumLng / n) * 0.15,
  }
}

/** Keep the Bend / count chip inside the visible island (SITE-128 rematch). */
export function clampRingChip(
  anchor: { x: number; y: number },
  island: IslandBox,
  halfW = 36,
  halfH = 14,
): { x: number; y: number } {
  const maxX = Math.max(halfW, island.width - halfW)
  const maxY = Math.max(halfH, island.height - halfH)
  return {
    x: Math.min(maxX, Math.max(halfW, anchor.x)),
    y: Math.min(maxY, Math.max(halfH, anchor.y)),
  }
}
