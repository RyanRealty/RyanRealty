/**
 * The address of an Atlas basemap subset (UXLIVE-3, visibility audit
 * 2026-09-22).
 *
 * The roads, rivers and lakes under an Atlas are static TIGER/Line data that
 * ships in the repo (data/basemap). A page used to clip them to its frame and
 * inline the result twice: as encoded client props (39 to 93 KB) and as drawn
 * SVG paths (68 to 129 KB). The page now names the frame in a URL and the
 * browser fetches the same clipped subset from `GET /api/atlas/basemap` after
 * paint; the route runs the same basemapForFrame, and the response is cached
 * at the edge and in the browser.
 *
 *   b  minLon,minLat,maxLon,maxLat of the frame (degrees, full precision)
 *   t  tier, when the page forced one (region | near)
 *   p  pad fraction, when the page set one
 *
 * Isomorphic and import-free.
 */

export const ATLAS_BASEMAP_ROUTE = '/api/atlas/basemap'

export type AtlasBasemapFrame = {
  bbox: { minLon: number; minLat: number; maxLon: number; maxLat: number }
  tier?: 'region' | 'near'
  pad?: number
}

/** Oregon and a margin: a frame outside it is not one of our maps. */
const LON_RANGE = [-125, -116] as const
const LAT_RANGE = [41, 47] as const

function inRange(n: number, [lo, hi]: readonly [number, number]): boolean {
  return Number.isFinite(n) && n >= lo && n <= hi
}

export function atlasBasemapHref(frame: AtlasBasemapFrame | null | undefined): string | null {
  if (!frame) return null
  const { minLon, minLat, maxLon, maxLat } = frame.bbox
  if (!inRange(minLon, LON_RANGE) || !inRange(maxLon, LON_RANGE)) return null
  if (!inRange(minLat, LAT_RANGE) || !inRange(maxLat, LAT_RANGE)) return null
  if (!(maxLon > minLon) || !(maxLat >= minLat)) return null
  const params = new URLSearchParams()
  params.set('b', [minLon, minLat, maxLon, maxLat].map((n) => String(n)).join(','))
  if (frame.tier) params.set('t', frame.tier)
  if (frame.pad != null && Number.isFinite(frame.pad)) params.set('p', String(frame.pad))
  return `${ATLAS_BASEMAP_ROUTE}?${params.toString()}`
}

export function parseAtlasBasemapFrame(params: URLSearchParams): AtlasBasemapFrame | null {
  const raw = params.get('b')
  if (!raw) return null
  const parts = raw.split(',')
  if (parts.length !== 4) return null
  const nums = parts.map((p) => (/^-?\d{1,3}(\.\d{1,17})?(e-?\d+)?$/i.test(p) ? Number(p) : NaN))
  const [minLon, minLat, maxLon, maxLat] = nums as [number, number, number, number]
  if (!inRange(minLon, LON_RANGE) || !inRange(maxLon, LON_RANGE)) return null
  if (!inRange(minLat, LAT_RANGE) || !inRange(maxLat, LAT_RANGE)) return null
  if (!(maxLon > minLon) || !(maxLat >= minLat)) return null
  const t = params.get('t')
  if (t != null && t !== 'region' && t !== 'near') return null
  const p = params.get('p')
  const pad = p == null ? undefined : Number(p)
  if (pad !== undefined && !(Number.isFinite(pad) && pad >= 0 && pad <= 1)) return null
  return {
    bbox: { minLon, minLat, maxLon, maxLat },
    ...(t ? { tier: t } : {}),
    ...(pad !== undefined ? { pad } : {}),
  }
}
