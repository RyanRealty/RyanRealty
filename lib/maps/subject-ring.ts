/**
 * Place first-look subject ring. Atlas paints every outline twice — cream
 * halo under navy ink — so the silhouette reads over the field. The Google
 * look island was Cos FAIL after Look rematch: GeoJSON + strokeWeight 8
 * were present, but navy alone disappeared under the $ pill pile at 375.
 *
 * Same recorded paths. No invented geom. Halo + ink + a place chip from
 * the existing placeQuery. Overlay lives above the basemap and under pills.
 */

export const SUBJECT_RING_INK_WEIGHT = 8
export const SUBJECT_RING_HALO_WEIGHT = 18
/** OverlayView pills use zIndex 1. The ring chip stays under them. */
export const SUBJECT_RING_Z_UNDER_PILLS = 0
export const SUBJECT_RING_HALO_Z = 1
export const SUBJECT_RING_INK_Z = 2

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
