/**
 * Park / trail LIST thumbs. Always a map. Never omitted.
 *
 * Uses existing geo only: a real boundary or trail line when the caller has
 * one, otherwise a point. Does not invent a polygon.
 */

export type PlaceListThumbKind = 'boundary' | 'path' | 'point'

export type PlaceListThumbGeo =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] }
  | { type: 'LineString'; coordinates: number[][] }
  | { type: 'MultiLineString'; coordinates: number[][][] }

export type PlaceListThumb = {
  kind: PlaceListThumbKind
  svg: string
}

const W = 160
const H = 120
const PAD = 12
const MAX_RING = 48

function isPair(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  )
}

function downsample(ring: [number, number][]): [number, number][] {
  if (ring.length <= MAX_RING) return ring
  const step = ring.length / MAX_RING
  const out: [number, number][] = []
  for (let i = 0; i < MAX_RING; i += 1) {
    out.push(ring[Math.min(ring.length - 1, Math.floor(i * step))]!)
  }
  return out
}

function asRing(value: unknown): [number, number][] | null {
  if (!Array.isArray(value)) return null
  const pts = value.filter(isPair)
  return pts.length >= 2 ? downsample(pts) : null
}

export function readPlaceListThumbGeo(value: unknown): PlaceListThumbGeo | null {
  if (!value || typeof value !== 'object') return null
  const rec = value as { type?: unknown; coordinates?: unknown }
  const type = rec.type
  const coords = rec.coordinates
  if (type === 'Polygon' && Array.isArray(coords)) {
    const rings = coords.map(asRing).filter((r): r is [number, number][] => r != null && r.length >= 3)
    if (rings.length === 0) return null
    return { type: 'Polygon', coordinates: rings }
  }
  if (type === 'MultiPolygon' && Array.isArray(coords)) {
    const polys: number[][][] = []
    for (const poly of coords) {
      if (!Array.isArray(poly)) continue
      const rings = poly.map(asRing).filter((r): r is [number, number][] => r != null && r.length >= 3)
      if (rings[0]) polys.push(rings)
    }
    if (polys.length === 0) return null
    return { type: 'MultiPolygon', coordinates: polys }
  }
  if (type === 'LineString') {
    const ring = asRing(coords)
    if (!ring || ring.length < 2) return null
    return { type: 'LineString', coordinates: ring }
  }
  if (type === 'MultiLineString' && Array.isArray(coords)) {
    const lines = coords.map(asRing).filter((r): r is [number, number][] => r != null && r.length >= 2)
    if (lines.length === 0) return null
    return { type: 'MultiLineString', coordinates: lines }
  }
  return null
}

function collectPairs(geo: PlaceListThumbGeo): [number, number][] {
  if (geo.type === 'Polygon') return geo.coordinates.flat() as [number, number][]
  if (geo.type === 'MultiPolygon') return geo.coordinates.flat(2) as [number, number][]
  if (geo.type === 'LineString') return geo.coordinates as [number, number][]
  return geo.coordinates.flat() as [number, number][]
}

function project(lng: number, lat: number, west: number, south: number, east: number, north: number) {
  const spanX = Math.max(east - west, 1e-6)
  const spanY = Math.max(north - south, 1e-6)
  const innerW = W - PAD * 2
  const innerH = H - PAD * 2
  const x = PAD + ((lng - west) / spanX) * innerW
  const y = PAD + (1 - (lat - south) / spanY) * innerH
  return `${x.toFixed(1)},${y.toFixed(1)}`
}

function pathFromRing(
  ring: number[][],
  west: number,
  south: number,
  east: number,
  north: number,
  close: boolean,
): string {
  const pts = ring.filter(isPair)
  if (pts.length < 2) return ''
  const d = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${project(p[0], p[1], west, south, east, north)}`)
    .join(' ')
  return close ? `${d} Z` : d
}

function wrap(body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" aria-hidden="true"><rect width="${W}" height="${H}" fill="var(--v3-cream)"/>${body}</svg>`
}

function pointSvg(): string {
  return wrap(
    '<path fill="var(--v3-navy)" d="M80 28c12.2 0 22 10.1 22 22.6 0 18.4-22 41.4-22 41.4S58 69 58 50.6C58 38.1 67.8 28 80 28zm0 16.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13z"/>',
  )
}

function creamOnly(): string {
  return wrap('')
}

export function publishPlaceListThumb(input: {
  lat?: number | null
  lng?: number | null
  geometry?: unknown
}): PlaceListThumb {
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
    return { kind: 'point', svg: creamOnly() }
  }

  const geo = readPlaceListThumbGeo(input.geometry)
  if (!geo) return { kind: 'point', svg: pointSvg() }

  const pairs = collectPairs(geo)
  if (pairs.length < 2) return { kind: 'point', svg: pointSvg() }

  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  for (const [lng, lat] of pairs) {
    if (lng < west) west = lng
    if (lng > east) east = lng
    if (lat < south) south = lat
    if (lat > north) north = lat
  }

  const kind: PlaceListThumbKind = geo.type === 'LineString' || geo.type === 'MultiLineString' ? 'path' : 'boundary'
  const fill = kind === 'boundary' ? ' color-mix(in srgb, var(--v3-navy) 16%, var(--v3-cream))' : 'none'
  const parts: string[] = []

  if (geo.type === 'Polygon') {
    for (const ring of geo.coordinates) {
      const d = pathFromRing(ring, west, south, east, north, true)
      if (d) parts.push(`<path d="${d}" fill="${fill}" stroke="var(--v3-navy)" stroke-width="2"/>`)
    }
  } else if (geo.type === 'MultiPolygon') {
    for (const poly of geo.coordinates) {
      for (const ring of poly) {
        const d = pathFromRing(ring, west, south, east, north, true)
        if (d) parts.push(`<path d="${d}" fill="${fill}" stroke="var(--v3-navy)" stroke-width="2"/>`)
      }
    }
  } else if (geo.type === 'LineString') {
    const d = pathFromRing(geo.coordinates, west, south, east, north, false)
    if (d) parts.push(`<path d="${d}" fill="none" stroke="var(--v3-navy)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`)
  } else {
    for (const line of geo.coordinates) {
      const d = pathFromRing(line, west, south, east, north, false)
      if (d) parts.push(`<path d="${d}" fill="none" stroke="var(--v3-navy)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`)
    }
  }

  if (parts.length === 0) return { kind: 'point', svg: pointSvg() }
  return { kind, svg: wrap(parts.join('')) }
}

export function placeListThumbDataUri(input: {
  lat: number
  lng: number
  geometry?: unknown
}): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(publishPlaceListThumb(input).svg)}`
}
