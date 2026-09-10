/**
 * RIVERS AS A WALL (Matt 2026-09-09): "if we're in a city that doesn't really
 * have that [a mapped neighborhood], then we use other major things to
 * constrain us, like major roadways, rivers, stuff like that."
 *
 * A named river splits a buyer pool the way a highway does, and outside the
 * Bend GIS mesh nothing else holds a search in: Redmond, La Pine, Sisters and
 * Prineville have city limits and a radius and that is all. This is the river
 * half of that constraint, built on the SAME geometry the US-97 test uses
 * (lib/pricing/highway-cross.ts) so both read the same way at the call site.
 *
 * Centerlines: data/cma/rivers-centerline.json, decoded from the TIGER extract
 * the Atlas basemap already ships (scripts/build-river-centerlines.mjs). Six
 * rivers, the ones that actually divide a Central Oregon market. Missing
 * coordinates fail open — never invent a crossing.
 */

import centerline from '@/data/cma/rivers-centerline.json'
import { segmentsCrossForTest, type LatLng } from '@/lib/pricing/highway-cross'

type Seg = { a: LatLng; b: LatLng; minLat: number; maxLat: number; minLng: number; maxLng: number }

let SEGS: Seg[] | null = null

function segs(): Seg[] {
  if (SEGS) return SEGS
  const out: Seg[] = []
  for (const line of centerline.lines as number[][][]) {
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

function finitePoint(p: LatLng | null | undefined): p is LatLng {
  return (
    p != null &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180
  )
}

/** The rivers this test knows, for a disclosure that names what was crossed. */
export const RIVER_NAMES: readonly string[] = centerline.names as string[]

/** True when the straight line from A to B crosses a named Central Oregon river. */
export function crossesNamedRiver(a: LatLng | null | undefined, b: LatLng | null | undefined): boolean {
  if (!finitePoint(a) || !finitePoint(b)) return false
  const minLat = Math.min(a.lat, b.lat)
  const maxLat = Math.max(a.lat, b.lat)
  const minLng = Math.min(a.lng, b.lng)
  const maxLng = Math.max(a.lng, b.lng)
  for (const s of segs()) {
    if (s.maxLat < minLat || s.minLat > maxLat || s.maxLng < minLng || s.minLng > maxLng) continue
    if (segmentsCrossForTest(a, b, s.a, s.b)) return true
  }
  return false
}
