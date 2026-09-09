/**
 * The map's ground, drawn by the document itself.
 *
 * Until 2026-09-09 the ground under the pins was a Google Static Maps tile:
 * an integer zoom that left the frame up to twice as wide as the pins needed,
 * town labels under the pins, and a Google logo on a Ryan Realty document.
 * This draws the same ground the site's Atlas draws — the US Census TIGER
 * skeleton in lib/geo/basemap (highways, named rivers, lakes, local streets
 * when the frame is close), the comp-area outline, the search ring, and the
 * towns — as one SVG in the document's own register, projected with the same
 * Web Mercator view the DOM pins use (lib/cma/static-map-projection.ts), so a
 * pin lands on the road it stands on. Matt 2026-09-08: "make the map look
 * cooler and put better pins on it."
 *
 * Pure: everything here is arithmetic over data the caller hands in.
 */
import { decodeBasemapFeature, type Basemap } from '@/lib/geo/basemap'
import { atlasLabelBox } from '@/lib/atlas/pack-labels'
import { latLngToWorld, worldToLatLng, type StaticMapView } from '@/lib/cma/static-map-projection'
import type { MapLatLng } from '@/lib/cma/map-overlay'

const NAVY = '#102742'
const CREAM = '#faf8f4'

export type MapGroundLabel = {
  text: string
  lat: number
  lng: number
  /** town: a city or CDP; place: a resort or planned community. */
  kind: 'town' | 'place'
  /** Higher wins a collision. Cities by size, then communities. */
  rank: number
}

export type MapGroundInput = {
  view: StaticMapView
  basemap: Basemap | null
  /** The comp-area outline(s), lat/lng rings. */
  boundaryRings: readonly MapLatLng[][]
  /** The search ring, when the area is a radius. */
  radius: { centre: MapLatLng; miles: number } | null
  labels: readonly MapGroundLabel[]
  /** Where the pins will sit (DOM, on top): labels are packed around them. */
  pins: readonly MapLatLng[]
}

export type MapGroundResult = {
  svg: string
  /** Roads + waterways + bodies drawn. Zero means the frame is outside the basemap. */
  featureCount: number
  labelsDrawn: string[]
}

/** The lat/lng box a view shows, for the basemap clip. */
export function viewBbox(view: StaticMapView): { minLon: number; minLat: number; maxLon: number; maxLat: number } {
  const scale = Math.pow(2, view.zoom)
  const c = latLngToWorld({ lat: view.centerLat, lng: view.centerLng })
  const tl = worldToLatLng({ x: c.x - view.width / 2 / scale, y: c.y - view.height / 2 / scale })
  const br = worldToLatLng({ x: c.x + view.width / 2 / scale, y: c.y + view.height / 2 / scale })
  return { minLon: tl.lng, minLat: br.lat, maxLon: br.lng, maxLat: tl.lat }
}

function projector(view: StaticMapView): (p: MapLatLng) => { x: number; y: number } {
  const scale = Math.pow(2, view.zoom)
  const c = latLngToWorld({ lat: view.centerLat, lng: view.centerLng })
  return (p) => {
    const w = latLngToWorld(p)
    return { x: (w.x - c.x) * scale + view.width / 2, y: (w.y - c.y) * scale + view.height / 2 }
  }
}

function fmt(n: number): string {
  return (Math.round(n * 10) / 10).toString()
}

function pathD(points: ReadonlyArray<{ x: number; y: number }>, close = false): string {
  if (points.length < 2) return ''
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${fmt(p.x)} ${fmt(p.y)}`).join('')
  return close ? `${d}Z` : d
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Miles → a lat/lng ring around a centre, for the search radius. */
function ringAround(centre: MapLatLng, miles: number, steps = 48): MapLatLng[] {
  const R = 3958.7613
  const out: MapLatLng[] = []
  const lat0 = (centre.lat * Math.PI) / 180
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * 2 * Math.PI
    const dLat = (miles / R) * Math.cos(t)
    const dLng = ((miles / R) * Math.sin(t)) / Math.max(0.01, Math.cos(lat0))
    out.push({ lat: centre.lat + (dLat * 180) / Math.PI, lng: centre.lng + (dLng * 180) / Math.PI })
  }
  return out
}

const FONT = "Geist, -apple-system, 'Segoe UI', sans-serif"

export function renderMapGroundSvg(input: MapGroundInput): MapGroundResult {
  const { view } = input
  const W = view.width
  const H = view.height
  const project = projector(view)
  const parts: string[] = []
  let featureCount = 0

  parts.push(`<rect width="${W}" height="${H}" fill="${CREAM}"/>`)

  const bm = input.basemap
  if (bm) {
    const q = bm.q
    const toD = (f: (typeof bm.roads)[number], close: boolean) =>
      decodeBasemapFeature(f, q)
        .map((line) => pathD(line.map(([lng, lat]) => project({ lat, lng })), close))
        .filter(Boolean)
        .join('')
    const bodies = bm.bodies.map((f) => toD(f, true)).filter(Boolean)
    const streams = bm.waterways.map((f) => ({ d: toD(f, false), canal: f.c === 'canal' })).filter((x) => x.d)
    const roads = bm.roads.map((f) => ({ d: toD(f, false), primary: f.c === 'primary' })).filter((x) => x.d)
    featureCount = bodies.length + streams.length + roads.length
    // The Atlas register (components/site/v3/V3Atlas.css): navy at 12% for
    // water, 26% for a river, 16% dashed for a canal, 22% / 34% for a road.
    for (const d of bodies) {
      parts.push(`<path d="${d}" fill="${NAVY}" fill-opacity="0.12" stroke="${NAVY}" stroke-opacity="0.26" stroke-width="0.8"/>`)
    }
    for (const s of streams) {
      parts.push(
        s.canal
          ? `<path d="${s.d}" fill="none" stroke="${NAVY}" stroke-opacity="0.16" stroke-width="0.7" stroke-dasharray="5 4" stroke-linecap="round" stroke-linejoin="round"/>`
          : `<path d="${s.d}" fill="none" stroke="${NAVY}" stroke-opacity="0.26" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>`,
      )
    }
    for (const r of roads.filter((x) => !x.primary)) {
      parts.push(`<path d="${r.d}" fill="none" stroke="${NAVY}" stroke-opacity="0.22" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"/>`)
    }
    for (const r of roads.filter((x) => x.primary)) {
      parts.push(`<path d="${r.d}" fill="none" stroke="${NAVY}" stroke-opacity="0.34" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`)
    }
  }

  // The comp area, and the search ring: the same inks the Google path used.
  for (const ring of input.boundaryRings) {
    const d = pathD(ring.map(project), true)
    if (d) parts.push(`<path d="${d}" fill="${NAVY}" fill-opacity="0.13" stroke="${NAVY}" stroke-opacity="0.8" stroke-width="1"/>`)
  }
  if (input.radius && input.radius.miles > 0) {
    const d = pathD(ringAround(input.radius.centre, input.radius.miles).map(project), true)
    if (d) parts.push(`<path d="${d}" fill="${NAVY}" fill-opacity="0.07" stroke="${NAVY}" stroke-opacity="0.6" stroke-width="1" stroke-dasharray="4 3"/>`)
  }

  // Towns, packed around each other and around the pins (which sit on top as
  // DOM). A town's point is often a pin — the subject in Tumalo stands on
  // Tumalo's label — so a colliding label is nudged below, above, right or
  // left before it is dropped. The Atlas does the same by hanging a town's
  // label under its boundary.
  type Box = { x: number; y: number; hw: number; hh: number }
  const overlaps = (a: Box, b: Box, gap: number) =>
    Math.abs(a.x - b.x) < a.hw + b.hw + gap && Math.abs(a.y - b.y) < a.hh + b.hh + gap
  const taken: Box[] = input.pins.map((p) => ({ ...project(p), hw: 15, hh: 15 }))
  const labelsDrawn: string[] = []
  const placed: Array<{ text: string; kind: 'town' | 'place'; x: number; y: number }> = []
  const ordered = [...input.labels].sort((a, b) => b.rank - a.rank || a.text.localeCompare(b.text))
  for (const l of ordered) {
    const at = project({ lat: l.lat, lng: l.lng })
    if (at.x < -40 || at.x > W + 40 || at.y < -20 || at.y > H + 20) continue
    const box = atlasLabelBox(l.text, l.kind)
    // Eight directions at two distances, nearest first. A city (rank ≥ 100)
    // is the answer to "where all of this is" and is never dropped: when every
    // spot collides it takes the one that collides least.
    const dy = box.hh + 20
    const dx = box.hw + 22
    const tries: Array<[number, number]> = [[0, 0]]
    for (const m of [1, 2]) {
      tries.push([0, dy * m], [0, -dy * m], [dx * m, 0], [-dx * m, 0], [dx * m, dy * m], [-dx * m, dy * m], [dx * m, -dy * m], [-dx * m, -dy * m])
    }
    const inside = (c: Box) => c.x - c.hw >= 4 && c.x + c.hw <= W - 4 && c.y - c.hh >= 4 && c.y + c.hh <= H - 4
    let chosen: Box | null = null
    let leastBad: { box: Box; hits: number } | null = null
    for (const [ox, oy] of tries) {
      const c: Box = { x: at.x + ox, y: at.y + oy, hw: box.hw, hh: box.hh }
      if (!inside(c)) continue
      const hits = taken.filter((t) => overlaps(c, t, 6)).length
      if (hits === 0) {
        chosen = c
        break
      }
      if (!leastBad || hits < leastBad.hits) leastBad = { box: c, hits }
    }
    if (!chosen && l.kind === 'town' && l.rank >= 100 && leastBad) chosen = leastBad.box
    if (!chosen) continue
    taken.push(chosen)
    placed.push({ text: l.text, kind: l.kind, x: chosen.x, y: chosen.y })
    labelsDrawn.push(l.text)
  }
  for (const p of placed) {
    const size = p.kind === 'town' ? 12 : 11
    parts.push(
      `<text x="${fmt(p.x)}" y="${fmt(p.y)}" font-family="${FONT}" font-size="${size}" font-weight="${p.kind === 'town' ? 600 : 500}" fill="${NAVY}" fill-opacity="${p.kind === 'town' ? 0.85 : 0.7}" text-anchor="middle" dominant-baseline="middle" paint-order="stroke" stroke="${CREAM}" stroke-width="3" stroke-linejoin="round">${esc(p.text)}</text>`,
    )
  }

  // Provenance, quietly, where the tile's logo used to sit.
  if (bm && featureCount > 0) {
    parts.push(
      `<text x="${W - 8}" y="${H - 7}" font-family="${FONT}" font-size="8" fill="${NAVY}" fill-opacity="0.45" text-anchor="end">Roads and water: US Census TIGER</text>`,
    )
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Map">${parts.join('')}</svg>`
  return { svg, featureCount, labelsDrawn }
}

/** The SVG as an <img> source, so the pin overlay and the print letter need no change. */
export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`
}
