/**
 * Place first-look subject ring. Atlas paints every outline twice — cream
 * halo under navy ink — so the silhouette reads over the field.
 *
 * Mini-land ff126836a added halo + OverlayView + Bend chip, but live paint
 * on dpl_AXi1pkPDec4yt1B9Xzs8vp322vdA was still an 87×99 knot: the phone
 * island cancelled async fitBounds with setZoom(9), so the projected SVG
 * sat under the $ pile at the wrong scale. Same recorded paths. No invent
 * geom. Camera keeps the fitted zoom; overlay stroke is under pills; the
 * place chip sits above them at the north of that fitted ring.
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
 * Live rematch on dpl_AXi1pkPDec4yt1B9Xzs8vp322vdA measured the OverlayView
 * SVG at ~87×99px — a dark knot under the pill pile. That size is zoom 9 on
 * a 13rem island after an async fitBounds was cancelled by setZoom(9).
 */
export const SUBJECT_RING_KNOT_PX = 110
/** Fitted ring must cover this share of the island's shorter side. */
export const SUBJECT_RING_MIN_ISLAND_FILL = 0.7

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

/**
 * How much of the island the fitted ring occupies on its constraining axis.
 * Bend is taller than wide, so min(ring)/min(island) under-reads a correct
 * height-fit (137×162 on 335×208). max(w-ratio, h-ratio) is the fitBounds
 * axis. 87×99 is still ~0.48 — a knot.
 */
export function subjectRingIslandFill(island: IslandBox, ring: IslandBox): number {
  const wr = island.width > 0 ? ring.width / island.width : 0
  const hr = island.height > 0 ? ring.height / island.height : 0
  return Math.max(wr, hr)
}

export function subjectRingIsKnot(island: IslandBox, ring: IslandBox): boolean {
  const knotByPx = Math.max(ring.width, ring.height) > 0 && Math.max(ring.width, ring.height) < SUBJECT_RING_KNOT_PX
  return knotByPx || subjectRingIslandFill(island, ring) < SUBJECT_RING_MIN_ISLAND_FILL
}

/**
 * Keep the zoom fitBounds just chose. Only pull back from lot zoom that
 * crops the city. Never clamp to 9 — getZoom() before idle is the pre-fit
 * camera (often 11), and setZoom(9) cancels the fit (87×99 knot).
 */
export function subjectRingKeepFittedZoom(fittedZoom: number | null | undefined): number | null {
  if (fittedZoom == null || !Number.isFinite(fittedZoom)) return null
  if (fittedZoom > 14) return 14
  return fittedZoom
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
