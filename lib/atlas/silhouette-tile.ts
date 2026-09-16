/**
 * A place's recorded outline as a small SVG tile — the designed mark a ledger
 * row draws where it has no photograph of the place (SITE-92 round 4).
 *
 * The same boundary the Atlas draws, fitted and centred in a square: the
 * outer rings of the GeoJSON, projected the way lib/geo/project-svg.ts
 * projects everything else (equirectangular, longitude scaled by the cosine
 * of the mid-latitude so a town keeps its aspect), then scaled to the tile's
 * inner box on the tighter axis and centred on the other. Pure, no DOM, so a
 * server component can call it per row and a test can hold the geometry.
 *
 * Holes are dropped, as the Atlas drops them: the mark is a silhouette.
 */
import { bboxOfRings, outerRings } from '@/lib/geo/project-svg'

export type SilhouetteTile = {
  /** SVG path data, in the tile's own viewBox units. */
  d: string
  /** The tile's viewBox: `0 0 w h`. */
  viewBox: string
}

export type SilhouetteBox = { w: number; h: number; pad: number }

/** The Ledger's 44px media square with a five-unit margin inside it. */
export const SILHOUETTE_TILE: SilhouetteBox = { w: 44, h: 44, pad: 5 }

export function silhouetteTile(
  geometry: GeoJSON.Geometry | null | undefined,
  box: SilhouetteBox = SILHOUETTE_TILE,
): SilhouetteTile | null {
  const rings = outerRings(geometry)
  const b = bboxOfRings(rings)
  if (!b) return null
  const midLat = ((b.minLat + b.maxLat) / 2) * (Math.PI / 180)
  const kx = Math.cos(midLat)
  const spanX = (b.maxLon - b.minLon) * kx
  const spanY = b.maxLat - b.minLat
  if (!(spanX > 0) || !(spanY > 0)) return null
  const innerW = box.w - box.pad * 2
  const innerH = box.h - box.pad * 2
  if (!(innerW > 0) || !(innerH > 0)) return null
  const scale = Math.min(innerW / spanX, innerH / spanY)
  const ox = (box.w - spanX * scale) / 2
  const oy = (box.h - spanY * scale) / 2
  const f = (n: number) => n.toFixed(1)
  let d = ''
  for (const ring of rings) {
    if (ring.length < 3) continue
    ring.forEach(([lon, lat], i) => {
      const x = ox + (lon - b.minLon) * kx * scale
      const y = oy + (b.maxLat - lat) * scale
      d += `${i === 0 ? 'M' : 'L'}${f(x)} ${f(y)}`
    })
    d += 'Z'
  }
  return d ? { d, viewBox: `0 0 ${box.w} ${box.h}` } : null
}
