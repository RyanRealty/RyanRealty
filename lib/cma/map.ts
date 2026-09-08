/**
 * CMA comp-location map — Google Static Maps rendered at BUILD time and
 * embedded in the stored HTML as a data URI. Self-contained: no per-slug
 * proxy route, no API key in the client-facing document, and the PDF renderer
 * needs no network hop.
 *
 * Reuses the styled URL builder from lib/cma-map.ts (the legacy per-slug
 * registry stays for the file-based CMAs).
 */

import { getBoundaryGeoJSON } from '@/lib/data'
import { spreadStackedMapPoints, type CmaMapPoint } from '@/lib/cma-map'
import { circlePath, pathParam, ringsFromGeometry } from '@/lib/cma/map-overlay'
import { fitStaticMapView, type StaticMapView } from '@/lib/cma/static-map-projection'
import { describeCompSearch } from '@/lib/pricing/search-story'
import { mapPointsFor, polygonHoldsAnyPoint } from '@/lib/cma/render-place-polygon'
import { us97IntersectsDisk } from '@/lib/pricing/highway-cross'
import { slugify } from '@/lib/slug'
import type { CmaComp, CmaSubject } from '@/lib/cma/types'

export interface CmaMapResult {
  dataUri: string
  pointCount: number
  /**
   * The centre and zoom this tile was drawn at, so the document can put its
   * own pins on it as DOM (tasteReview item 2). Without it the map is a
   * bitmap and three of chapter 3's promised interactions cannot exist.
   */
  view: StaticMapView
  /** Every pin, at the coordinates the tile was drawn for, in grid order. */
  pins: CmaMapPin[]
  /**
   * Whether the subdivision outline was actually drawn.
   *
   * Round-four class F: 19968's polygon contained neither the subject nor any
   * sale, under a caption that named it. The caption reads this rather than
   * assuming a boundary was on file, so the drawing and the sentence about it
   * can never disagree.
   */
  boundaryShown: boolean
}

/** A pin the DOCUMENT draws, not Google. `n` is null on the subject. */
export interface CmaMapPin {
  n: number | null
  lat: number
  lng: number
}

/** Logical pixels. `scale=2` doubles the image and leaves the geometry alone. */
const MAP_W = 640
const MAP_H = 360
/** Room for a 44px tap target plus its label, at both edges. */
const MAP_PAD = 46

/**
 * A cream field with navy marks, not a Google default.
 *
 * TASTE.md names the default roadmap exactly — "Not a Google default map" —
 * and the evaluator found tan/blue/green tiles with a red balloon on chapter
 * 3. Every colour below is the two-colour palette or a tint of it: cream
 * ground, warm-stone water, white roads on a stone stroke, navy labels, no POI
 * icons, no transit, no parcel lines. Google's own attribution stays on the
 * tile — that is a licence term, not a style choice.
 */
const MONO_STYLE: string[] = [
  'feature:all|element:labels.icon|visibility:off',
  'feature:poi|visibility:off',
  'feature:transit|visibility:off',
  'feature:administrative.land_parcel|visibility:off',
  'feature:administrative|element:geometry|visibility:off',
  'feature:landscape|element:geometry|color:0xfaf8f4',
  'feature:poi.park|element:geometry|color:0xf1ede2',
  'feature:water|element:geometry|color:0xe4e0d6',
  'feature:road|element:geometry.fill|color:0xffffff',
  'feature:road|element:geometry.stroke|color:0xe6e1d5',
  'feature:road.highway|element:geometry.fill|color:0xf4efe4',
  'feature:road.highway|element:geometry.stroke|color:0xded8ca',
  'feature:road|element:labels.text.fill|color:0x102742',
  'feature:road|element:labels.text.stroke|color:0xfaf8f4',
  'feature:administrative|element:labels.text.fill|color:0x102742',
  'feature:administrative|element:labels.text.stroke|color:0xfaf8f4',
]

/**
 * The tile URL. No `markers` — the document draws its own, so a pin can be
 * tapped, can highlight its row, and can be a 44px target on a phone.
 */
export function buildMonochromeStaticMapUrl(
  view: StaticMapView,
  apiKey: string,
  paths: string[] = [],
): string {
  const params = new URLSearchParams()
  params.set('size', `${view.width}x${view.height}`)
  params.set('scale', '2')
  params.set('maptype', 'roadmap')
  params.set('center', `${view.centerLat.toFixed(6)},${view.centerLng.toFixed(6)}`)
  params.set('zoom', String(view.zoom))
  for (const path of paths) {
    if (path) params.append('path', path)
  }
  for (const s of MONO_STYLE) params.append('style', s)
  params.set('key', apiKey)
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`
}

async function subdivisionRings(subdivision: string | null | undefined) {
  const slug = subdivision?.trim() ? slugify(subdivision.trim()) : ''
  if (!slug) return []
  try {
    const geom = await getBoundaryGeoJSON({ geoType: 'subdivision', geoSlug: slug })
    return ringsFromGeometry(geom)
  } catch (e) {
    console.warn('[buildCmaMapDataUri] boundary', e instanceof Error ? e.message : String(e))
    return []
  }
}

/** Subject pin and the subdivision outline. No numbered comps. */
export async function buildSubjectLocationMapDataUri(
  subject: CmaSubject,
): Promise<CmaMapResult | null> {
  return buildCmaMapDataUri(subject, [])
}

/** Build the subject + comps map as a base64 PNG data URI. Null when the API
 *  key is missing or no coordinates are available. */
export async function buildCmaMapDataUri(
  subject: CmaSubject,
  comps: CmaComp[],
  opts: { tiersUsed?: string[] } = {},
): Promise<CmaMapResult | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()
  if (!apiKey) return null
  const points: CmaMapPoint[] = []
  if (subject.latitude != null && subject.longitude != null) {
    points.push({ label: 'S', color: 'red', lat: subject.latitude, lng: subject.longitude })
  }
  comps.forEach((comp, i) => {
    if (comp.latitude != null && comp.longitude != null && i < 9) {
      points.push({ label: String(i + 1), color: '0x102742', lat: comp.latitude, lng: comp.longitude })
    }
  })
  if (points.length < 1) return null
  const story = describeCompSearch({ subdivision: subject.subdivision, tiersUsed: opts.tiersUsed ?? [] })
  const paths: string[] = []
  // THE OUTLINE HAS TO CONTAIN SOMETHING ON THE MAP (class F). An MLS
  // subdivision NAME and a recorded plat SLUG are different keys, so
  // `slugify(subject.subdivision)` can resolve to a plat that holds neither
  // this home nor any of its sales — which is what 19968 drew. The check is
  // the one a reader makes: is my house in that shape, or is one of the sales?
  const rings = await subdivisionRings(subject.subdivision)
  const boundaryShown = polygonHoldsAnyPoint(rings, mapPointsFor(subject, comps))
  if (boundaryShown) {
    for (const ring of rings) {
      const path = pathParam('0x102742CC', '0x10274222', ring)
      if (path) paths.push(path)
    }
  }
  if (
    story.radiusMiles != null &&
    subject.latitude != null &&
    subject.longitude != null &&
    !us97IntersectsDisk(
      { lat: subject.latitude, lng: subject.longitude },
      story.radiusMiles,
    )
  ) {
    const circle = pathParam(
      '0x10274299',
      '0x10274211',
      circlePath({ lat: subject.latitude, lng: subject.longitude }, story.radiusMiles),
    )
    if (circle) paths.push(circle)
  }
  try {
    // Two pins on one rooftop cover each other whoever draws them, so the same
    // nudge the Google markers used still applies to ours.
    const spread = spreadStackedMapPoints(points)
    const view = fitStaticMapView(spread, {
      width: MAP_W,
      height: MAP_H,
      padding: MAP_PAD,
      maxZoom: points.length === 1 ? 15 : 17,
    })
    if (!view) return null
    const url = buildMonochromeStaticMapUrl(view, apiKey, paths)
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    return {
      dataUri: `data:image/png;base64,${buf.toString('base64')}`,
      pointCount: points.length,
      view,
      pins: spread.map((p) => ({
        n: p.label === 'S' ? null : Number(p.label),
        lat: p.lat,
        lng: p.lng,
      })),
      boundaryShown,
    }
  } catch (e) {
    console.warn('[buildCmaMapDataUri]', e instanceof Error ? e.message : String(e))
    return null
  }
}
