/**
 * The plat's own frame, and the plat's own drawn ground (SITE-56).
 *
 * THE FRAME. Until 2026-09-09 a plat with no recorded polygon framed its Atlas
 * with `basemapForRegions([], { dots, fit: 'dots' })` — the record-map frame,
 * which is the dots' own extent. One home has no extent: the bbox collapsed to
 * a point, the projection divided by zero, and the map shipped
 * `viewBox="0 0 1000 NaN"` with twenty-one road paths reading `MInfinity
 * -Infinity`. The frame sampled flat cream at nine points (measured on the lane
 * server, /subdivisions/diamond-bar-ranch, 2026-09-09). A single home is still
 * a map: it needs a frame with a real span around it.
 *
 * HOW WIDE. Not a constant, because the right answer is "wide enough to show
 * the streets this place sits on", and that is a different distance in the
 * middle of Redmond than it is off Buck Drive. `platFrame` walks a ladder of
 * spans, asks the TIGER basemap (lib/geo/basemap-source, public-domain US
 * Census data compiled into the repo, no read) how many features each one
 * would draw, and takes the first span that draws a real map — capped, so a
 * plat with nothing around it gets the widest frame in the ladder rather than
 * an endless zoom-out. Every span in the ladder still CONTAINS the plat.
 *
 * THE ASPECT. `.v3-atlas__stage` sizes itself from the projection's aspect
 * (`--atlas-aspect`), so a frame far from the stage's own proportions
 * letterboxes into cream bands. The ladder builds every candidate at
 * FRAME_ASPECT, which is the 1000/554 the CSS is written around.
 *
 * V3ATLAS PADS WHAT IT IS GIVEN by 60% on each edge (`padBbox(framed, 0.6)`),
 * so the basemap is clipped at that same padding — otherwise the map draws
 * roads for the middle of the frame and cream around it.
 *
 * Pure: arithmetic over coordinates plus the compiled basemap. No I/O.
 */

import { basemapForFrame } from '@/lib/geo/basemap-source'
import type { Bbox } from '@/lib/geo/project-svg'
import { fitStaticMapView, type LatLng } from '@/lib/cma/static-map-projection'
import { renderMapGroundSvg, svgDataUri, viewBbox } from '@/lib/cma/map-ground'

/** What V3Atlas adds to every edge of the frame it is handed. */
export const ATLAS_FRAME_PAD = 0.6

/** The stage's own proportions (components/site/v3/V3Atlas.css). */
export const FRAME_ASPECT = 1000 / 554

/**
 * How many times the place fits into the VISIBLE map at each rung. The first
 * rung is the place with a margin around it; the last is the town it sits in.
 * Relative, not absolute, because the subject is the plat: a frame is right
 * when the plat fills it, and a 400 m plat and a 4 km one want different
 * distances. Measured against what a reader SEES, so the Atlas's own 60% pad
 * is divided back out below rather than compounding into a frame four times
 * wider than the one this file asked for.
 */
export const FRAME_LADDER_MULTIPLES = [1.6, 2.6, 4.5, 8] as const

/**
 * The smallest thing worth framing: a quarter mile, 0.0036° of latitude. One
 * home has no extent at all, and a frame of nothing is the collapsed
 * projection this file exists to stop.
 */
export const FRAME_MIN_CONTENT_DEG = 0.0036

/** No frame wider than this, whatever the ladder says: 0.06° is about 6.7 km. */
export const FRAME_MAX_DEG = 0.06

/** Roads, waterways and water bodies below which a frame is not yet a map. */
export const FRAME_MIN_FEATURES = 20

export type PlatFrame = {
  /** What V3Atlas is handed. It pads this by ATLAS_FRAME_PAD on every edge. */
  bbox: Bbox
  /** What a reader actually sees: `bbox` with that padding applied. */
  visibleBbox: Bbox
  /** The same box as a geometry, for V3Atlas's `frame` prop. */
  geometry: GeoJSON.Polygon
  /** Basemap features the frame draws at the padding the Atlas applies. */
  features: number
  /** Degrees of latitude the frame spans. */
  latSpanDeg: number
}

/** The box as a closed ring, counter-clockwise from the south-west corner. */
export function bboxPolygon(b: Bbox): GeoJSON.Polygon {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [b.minLon, b.minLat],
        [b.maxLon, b.minLat],
        [b.maxLon, b.maxLat],
        [b.minLon, b.maxLat],
        [b.minLon, b.minLat],
      ],
    ],
  }
}

/** The box holding every finite point, or null when there are none. */
export function bboxOfPoints(points: readonly LatLng[]): Bbox | null {
  let minLon = Infinity
  let minLat = Infinity
  let maxLon = -Infinity
  let maxLat = -Infinity
  let n = 0
  for (const p of points) {
    if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue
    if (Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180) continue
    n += 1
    if (p.lng < minLon) minLon = p.lng
    if (p.lng > maxLon) maxLon = p.lng
    if (p.lat < minLat) minLat = p.lat
    if (p.lat > maxLat) maxLat = p.lat
  }
  return n > 0 ? { minLon, minLat, maxLon, maxLat } : null
}

/** A box of `latSpan` degrees at FRAME_ASPECT, centred on a point. */
export function frameAt(centreLon: number, centreLat: number, latSpan: number): Bbox {
  const kx = Math.max(0.05, Math.cos((centreLat * Math.PI) / 180))
  const lonSpan = (latSpan * FRAME_ASPECT) / kx
  return {
    minLon: centreLon - lonSpan / 2,
    maxLon: centreLon + lonSpan / 2,
    minLat: centreLat - latSpan / 2,
    maxLat: centreLat + latSpan / 2,
  }
}

function featureCount(bbox: Bbox): number {
  const bm = basemapForFrame({ bbox, pad: ATLAS_FRAME_PAD })
  return bm.roads.length + bm.waterways.length + bm.bodies.length
}

/**
 * The frame a plat's Atlas should be projected through: the smallest box on
 * the ladder that both CONTAINS the plat and draws a real map around it.
 *
 * `content` is the plat's recorded footprint when it has one, and otherwise
 * the box holding its homes. Null in, null out — a plat with neither has
 * nothing to frame, and the section is omitted rather than framed on a guess.
 */
export function platFrame(content: Bbox | null): PlatFrame | null {
  if (!content) return null
  const centreLon = (content.minLon + content.maxLon) / 2
  const centreLat = (content.minLat + content.maxLat) / 2
  const kx = Math.max(0.05, Math.cos((centreLat * Math.PI) / 180))
  // The span this content needs at the stage's aspect, whichever axis binds,
  // floored so a single home is still something to frame.
  const needed = Math.max(
    FRAME_MIN_CONTENT_DEG,
    content.maxLat - content.minLat,
    ((content.maxLon - content.minLon) * kx) / FRAME_ASPECT,
  )
  let last: PlatFrame | null = null
  for (const multiple of FRAME_LADDER_MULTIPLES) {
    // The rung is what a reader sees; V3Atlas pads what it is handed, so the
    // frame this function returns is the visible span with that pad taken out.
    const visible = Math.min(needed * multiple, FRAME_MAX_DEG)
    const latSpan = visible / (1 + 2 * ATLAS_FRAME_PAD)
    const bbox = frameAt(centreLon, centreLat, latSpan)
    const features = featureCount(bbox)
    last = {
      bbox,
      visibleBbox: frameAt(centreLon, centreLat, visible),
      geometry: bboxPolygon(bbox),
      features,
      latSpanDeg: latSpan,
    }
    if (features >= FRAME_MIN_FEATURES) return last
    if (visible >= FRAME_MAX_DEG) return last
  }
  return last
}

export type PlatGround = {
  /** The SVG as a data URI, for an <img>. */
  src: string
  /** Roads, waterways and bodies actually drawn. */
  featureCount: number
  width: number
  height: number
}

export type PlatGroundInput = {
  frame: Bbox
  /** The recorded footprint, drawn as the outline. Empty draws none. */
  rings: readonly (readonly (readonly [number, number])[])[]
  /** The plat's homes, drawn as marks. */
  homes: readonly LatLng[]
  width?: number
  height?: number
}

/**
 * The plat's ground, drawn: the TIGER streets and water inside its frame, its
 * recorded outline when it has one, and its homes as marks — the same ground
 * the CMA letter draws (lib/cma/map-ground.ts), at the opening's proportions.
 *
 * Returns null when the frame draws nothing at all: an empty cream rectangle
 * is not an opening image, and a page with nothing to show says so by showing
 * nothing rather than by showing a blank.
 */
export function platGround(input: PlatGroundInput): PlatGround | null {
  const width = input.width ?? 1600
  const height = input.height ?? 900
  const view = fitStaticMapView(
    [
      { lat: input.frame.minLat, lng: input.frame.minLon },
      { lat: input.frame.maxLat, lng: input.frame.maxLon },
    ],
    { width, height, padding: 0, fractional: true, maxZoom: 20 },
  )
  if (!view) return null
  const ground = renderMapGroundSvg({
    view,
    basemap: basemapForFrame({ bbox: viewBbox(view), pad: 0 }),
    boundaryRings: input.rings.map((ring) => ring.map(([lng, lat]) => ({ lat, lng }))),
    radius: null,
    labels: [],
    pins: [],
    marks: input.homes,
  })
  if (ground.featureCount === 0 && input.rings.length === 0) return null
  return { src: svgDataUri(ground.svg), featureCount: ground.featureCount, width, height }
}
