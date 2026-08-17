/**
 * Geometry for the CMA search map: a subdivision outline and, when the
 * ladder left that outline, a radius circle. Coordinates come from
 * public.boundaries or the subject pin. This file does not invent a plat.
 */

export type MapLatLng = { lat: number; lng: number }

const EARTH_MI = 3958.8

export function circlePath(center: MapLatLng, miles: number, steps = 36): MapLatLng[] {
  if (!(miles > 0) || steps < 8) return []
  const lat0 = (center.lat * Math.PI) / 180
  const lng0 = (center.lng * Math.PI) / 180
  const ang = miles / EARTH_MI
  const out: MapLatLng[] = []
  for (let i = 0; i <= steps; i++) {
    const brng = (2 * Math.PI * i) / steps
    const lat = Math.asin(Math.sin(lat0) * Math.cos(ang) + Math.cos(lat0) * Math.sin(ang) * Math.cos(brng))
    const lng =
      lng0 +
      Math.atan2(
        Math.sin(brng) * Math.sin(ang) * Math.cos(lat0),
        Math.cos(ang) - Math.sin(lat0) * Math.sin(lat),
      )
    out.push({ lat: (lat * 180) / Math.PI, lng: (lng * 180) / Math.PI })
  }
  return out
}

function ringFromCoords(coords: number[][]): MapLatLng[] {
  return coords
    .map((c) => {
      const lng = c[0]
      const lat = c[1]
      if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
      return { lat, lng }
    })
    .filter((p): p is MapLatLng => p != null)
}

/** Sample a ring so the Static Maps URL stays under the request cap. */
export function simplifyRing(ring: MapLatLng[], maxPoints = 40): MapLatLng[] {
  if (ring.length <= maxPoints) return ring
  const step = ring.length / maxPoints
  const out: MapLatLng[] = []
  for (let i = 0; i < maxPoints; i++) {
    const p = ring[Math.min(ring.length - 1, Math.floor(i * step))]
    if (p) out.push(p)
  }
  const first = out[0]
  const last = out[out.length - 1]
  if (first && last && (first.lat !== last.lat || first.lng !== last.lng)) out.push(first)
  return out
}

export function ringsFromGeometry(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon | null | undefined): MapLatLng[][] {
  if (!geometry) return []
  if (geometry.type === 'Polygon') {
    const ring = ringFromCoords(geometry.coordinates[0] ?? [])
    return ring.length >= 4 ? [simplifyRing(ring)] : []
  }
  return geometry.coordinates
    .map((poly) => simplifyRing(ringFromCoords(poly[0] ?? [])))
    .filter((ring) => ring.length >= 4)
    .slice(0, 2)
}

export function pathParam(color: string, fill: string, ring: MapLatLng[]): string | null {
  if (ring.length < 4) return null
  const coords = ring.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|')
  return `color:${color}|weight:2|fillcolor:${fill}|${coords}`
}
