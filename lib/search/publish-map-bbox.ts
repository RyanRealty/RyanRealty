/**
 * Search-map camera only. Encodes the current map extent so Split → Map
 * keeps the same view. Not a stats path. Not a filter.
 *
 * Query shape: bbox=west,south,east,north
 */

export type MapBbox = {
  west: number
  south: number
  east: number
  north: number
}

function quantize(n: number): string {
  return n.toFixed(5)
}

export function encodeMapBbox(b: MapBbox): string {
  return `${quantize(b.west)},${quantize(b.south)},${quantize(b.east)},${quantize(b.north)}`
}

export function decodeMapBbox(raw: string | null | undefined): MapBbox | null {
  if (raw == null) return null
  const text = String(raw).trim()
  if (!text) return null
  const parts = text.split(',').map((p) => Number(p.trim()))
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null
  const [west, south, east, north] = parts as [number, number, number, number]
  if (west >= east || south >= north) return null
  if (Math.abs(west) > 180 || Math.abs(east) > 180) return null
  if (Math.abs(south) > 90 || Math.abs(north) > 90) return null
  return { west, south, east, north }
}

export function bboxFromSearchParam(
  value: string | string[] | undefined | null,
): MapBbox | null {
  const raw = Array.isArray(value) ? value[0] : value
  return decodeMapBbox(raw)
}

/** Returns true when the param changed. */
export function applyMapBboxToParams(params: URLSearchParams, bbox: MapBbox): boolean {
  const encoded = encodeMapBbox(bbox)
  if (params.get('bbox') === encoded) return false
  params.set('bbox', encoded)
  return true
}

/** Camera URL for router.replace({ scroll: false }). Null when unchanged. */
export function nextSearchUrlWithBbox(
  pathname: string,
  currentSearch: string,
  bbox: MapBbox,
): string | null {
  const raw = currentSearch.startsWith('?') ? currentSearch.slice(1) : currentSearch
  const params = new URLSearchParams(raw)
  if (!applyMapBboxToParams(params, bbox)) return null
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}
