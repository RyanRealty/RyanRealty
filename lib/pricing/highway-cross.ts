/**
 * Geometric US-97 / Bend Parkway cut. The Bend neighborhood-bank table in
 * divides.ts fails open outside the GIS mesh (Redmond, Tumalo, rural). This
 * file tests the actual centerline: if the crow-flies line from subject to
 * sale crosses US-97, it is a different buyer pool.
 *
 * Centerline: data/cma/us-97-centerline.json, TIGER/Line 2024. Business 97
 * is omitted. Missing coordinates fail open — do not invent a crossing.
 */

import centerline from '@/data/cma/us-97-centerline.json'

export type LatLng = { lat: number; lng: number }

type Seg = { a: LatLng; b: LatLng; minLat: number; maxLat: number; minLng: number; maxLng: number }

let SEGS: Seg[] | null = null

function segs(): Seg[] {
  if (SEGS) return SEGS
  const out: Seg[] = []
  for (const line of centerline.lines) {
    for (let i = 0; i < line.length - 1; i++) {
      const p = line[i]!
      const q = line[i + 1]!
      const lng1 = p[0]!
      const lat1 = p[1]!
      const lng2 = q[0]!
      const lat2 = q[1]!
      out.push({
        a: { lat: lat1, lng: lng1 },
        b: { lat: lat2, lng: lng2 },
        minLat: Math.min(lat1, lat2),
        maxLat: Math.max(lat1, lat2),
        minLng: Math.min(lng1, lng2),
        maxLng: Math.max(lng1, lng2),
      })
    }
  }
  SEGS = out
  return out
}

function orient(p: LatLng, q: LatLng, r: LatLng): number {
  return (q.lng - p.lng) * (r.lat - p.lat) - (q.lat - p.lat) * (r.lng - p.lng)
}

function onSeg(p: LatLng, q: LatLng, r: LatLng): boolean {
  return (
    Math.min(p.lng, q.lng) - 1e-12 <= r.lng &&
    r.lng <= Math.max(p.lng, q.lng) + 1e-12 &&
    Math.min(p.lat, q.lat) - 1e-12 <= r.lat &&
    r.lat <= Math.max(p.lat, q.lat) + 1e-12
  )
}

function segmentsCross(p1: LatLng, p2: LatLng, q1: LatLng, q2: LatLng): boolean {
  const o1 = orient(p1, p2, q1)
  const o2 = orient(p1, p2, q2)
  const o3 = orient(q1, q2, p1)
  const o4 = orient(q1, q2, p2)
  if (o1 === 0 && onSeg(p1, p2, q1)) return true
  if (o2 === 0 && onSeg(p1, p2, q2)) return true
  if (o3 === 0 && onSeg(q1, q2, p1)) return true
  if (o4 === 0 && onSeg(q1, q2, p2)) return true
  return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0)
}

function finitePoint(p: LatLng | null | undefined): p is LatLng {
  return (
    p != null &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180
  )
}

/** True when the straight line from A to B crosses US-97. */
export function crossesUs97(a: LatLng | null | undefined, b: LatLng | null | undefined): boolean {
  if (!finitePoint(a) || !finitePoint(b)) return false
  const minLat = Math.min(a.lat, b.lat)
  const maxLat = Math.max(a.lat, b.lat)
  const minLng = Math.min(a.lng, b.lng)
  const maxLng = Math.max(a.lng, b.lng)
  for (const s of segs()) {
    if (s.maxLat < minLat || s.minLat > maxLat || s.maxLng < minLng || s.minLng > maxLng) continue
    if (segmentsCross(a, b, s.a, s.b)) return true
  }
  return false
}

/** A pin this close to the TIGER centerline sits on the highway, not east or west of it. */
const ON_BANK_MILES = 0.1

export function distanceToUs97(p: LatLng | null | undefined): number | null {
  if (!finitePoint(p)) return null
  return closestOnUs97(p)?.miles ?? null
}

function closestOnUs97(center: LatLng): { point: LatLng; miles: number } | null {
  const latM = MILES_PER_DEG_LAT
  const lngM = MILES_PER_DEG_LAT * Math.cos((center.lat * Math.PI) / 180)
  let best: { point: LatLng; miles: number } | null = null
  for (const s of segs()) {
    const vx = (s.b.lng - s.a.lng) * lngM
    const vy = (s.b.lat - s.a.lat) * latM
    const wx = (center.lng - s.a.lng) * lngM
    const wy = (center.lat - s.a.lat) * latM
    const len2 = vx * vx + vy * vy
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2))
    const point = {
      lat: s.a.lat + t * (s.b.lat - s.a.lat),
      lng: s.a.lng + t * (s.b.lng - s.a.lng),
    }
    const dx = t * vx - wx
    const dy = t * vy - wy
    const miles = Math.sqrt(dx * dx + dy * dy)
    if (!best || miles < best.miles) best = { point, miles }
  }
  return best
}

export type Us97Bank = 'east' | 'west' | 'on'

/** Which side of US-97 a pin sits on. Null when the pin has no coordinates. */
export function us97Bank(p: LatLng | null | undefined): Us97Bank | null {
  if (!finitePoint(p)) return null
  const hit = closestOnUs97(p)
  if (!hit) return null
  if (hit.miles <= ON_BANK_MILES) return 'on'
  return p.lng > hit.point.lng ? 'east' : 'west'
}

/**
 * True when A and B are different buyer pools across US-97: opposite banks,
 * or one on the frontage and the other inland. Missing coordinates fail open.
 */
export function differentUs97Bank(
  a: LatLng | null | undefined,
  b: LatLng | null | undefined,
): boolean {
  const sa = us97Bank(a)
  const sb = us97Bank(b)
  if (sa == null || sb == null) return false
  if (sa === 'on' && sb === 'on') return false
  return sa !== sb
}

const MILES_PER_DEG_LAT = 69.0

/** True when a search disk around the pin reaches US-97. */
export function us97IntersectsDisk(
  center: LatLng | null | undefined,
  radiusMiles: number,
): boolean {
  if (!finitePoint(center) || !(radiusMiles > 0)) return false
  const dLat = radiusMiles / MILES_PER_DEG_LAT
  const dLng = radiusMiles / (MILES_PER_DEG_LAT * Math.cos((center.lat * Math.PI) / 180))
  const minLat = center.lat - dLat
  const maxLat = center.lat + dLat
  const minLng = center.lng - dLng
  const maxLng = center.lng + dLng
  const r2 = radiusMiles * radiusMiles
  const latM = MILES_PER_DEG_LAT
  const lngM = MILES_PER_DEG_LAT * Math.cos((center.lat * Math.PI) / 180)
  const dist2 = (p: LatLng) => {
    const dy = (p.lat - center.lat) * latM
    const dx = (p.lng - center.lng) * lngM
    return dx * dx + dy * dy
  }
  for (const s of segs()) {
    if (s.maxLat < minLat || s.minLat > maxLat || s.maxLng < minLng || s.minLng > maxLng) continue
    if (dist2(s.a) <= r2 || dist2(s.b) <= r2) return true
    // Closest point on the segment to the center.
    const vx = (s.b.lng - s.a.lng) * lngM
    const vy = (s.b.lat - s.a.lat) * latM
    const wx = (center.lng - s.a.lng) * lngM
    const wy = (center.lat - s.a.lat) * latM
    const len2 = vx * vx + vy * vy
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2))
    const cx = t * vx - wx
    const cy = t * vy - wy
    if (cx * cx + cy * cy <= r2) return true
  }
  return false
}
