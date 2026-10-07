/**
 * CMA comp-location map — Google Static Maps rendered at BUILD time and
 * embedded in the stored HTML as a data URI. Self-contained: no per-slug
 * proxy route, no API key in the client-facing document, and the PDF renderer
 * needs no network hop.
 *
 * ONE MAP FOR THE WHOLE DOCUMENT (Delta 3, 2026-09-08). It carries three pin
 * families over one comp area: the closed sales that set the price, the homes
 * for sale or under contract in the same area, and the listings that came off
 * that area unsold. The tile is the ground; every pin is DOM
 * (`lib/cma/comp-pin-map.ts`), because a bitmap cannot answer a tap.
 *
 * Reuses the styled URL builder from lib/cma-map.ts (the legacy per-slug
 * registry stays for the file-based CMAs).
 */

import { getBoundaryGeoJSON } from '@/lib/data/geo/getBoundaryGeoJSON'
import { getResortCommunityBySlug } from '@/lib/data/communities/registry'
import { assignSubdivisionSlugs, getSubdivisionRing, readBoundaryLabel } from '@/lib/data/geo/subdivision-ring'
import { labelsForUsedPlats, platSlugsToDraw, type OutlineMapLabel } from '@/lib/cma/map-outlines'
import { parentPlaceArea } from '@/lib/pricing/comp-area'
import { spreadStackedMapPoints, type CmaMapPoint } from '@/lib/cma-map'
import { circlePath, pathParam, ringsFromGeometry, simplifyRing, type MapLatLng } from '@/lib/cma/map-overlay'
import { renderMapGroundSvg, svgDataUri, viewBbox } from '@/lib/cma/map-ground'
import { basemapForFrame } from '@/lib/geo/basemap-source'
import { fitStaticMapView, type StaticMapView } from '@/lib/cma/static-map-projection'
import { letterProductMatch } from '@/lib/cma/market-area'
import { describeCompSearch } from '@/lib/pricing/search-story'
import { polygonHoldsAnyPoint } from '@/lib/cma/render-place-polygon'
import { keyFor, type CmaMapFamily } from '@/lib/cma/map-families'
import { matrixSetsFromArgs, readCompArea, type CmaCompArea } from '@/lib/cma/matrix-sets'

export { readCompArea, compAreaSentence } from '@/lib/cma/matrix-sets'
export type { CmaCompArea } from '@/lib/cma/matrix-sets'
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
   * Whether the comp-area outline was actually drawn.
   *
   * Round-four class F: 19968's polygon contained neither the subject nor any
   * sale, under a caption that named it. The caption reads this rather than
   * assuming a boundary was on file, so the drawing and the sentence about it
   * can never disagree.
   */
  boundaryShown: boolean
  /**
   * The neighborhood or community outline was drawn. The caption may name
   * that outer line when this is true.
   */
  parentShown: boolean
  /** Whether the search radius was drawn as a ring. */
  radiusShown: boolean
}

/**
 * A pin the DOCUMENT draws, not Google.
 *
 * `key` is what the matrix row carries in `data-comp` — `1`, `A`, `iii` — and
 * null on the subject. One vocabulary, `lib/cma/map-families.ts`, so a tap on
 * a pin and a tap on a row can only ever mean the same home.
 */
export interface CmaMapPin {
  key: string | null
  family: CmaMapFamily | 'subject'
  lat: number
  lng: number
}

/** One home offered to the map, in whatever family it belongs to. */
export type CmaMapEntry = {
  latitude?: number | null
  longitude?: number | null
  address?: string | null
}

function finite(n: unknown): number | null {
  const v = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(v) ? v : null
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

async function ringsFor(
  geoType: 'subdivision' | 'neighborhood',
  slug: string | null | undefined,
): Promise<MapLatLng[][]> {
  const id = slug?.trim() ?? ''
  if (!id) return []
  try {
    const geom = await getBoundaryGeoJSON({ geoType, geoSlug: id })
    // The recorded shape, not the 40-point URL sample: the hold test and the
    // drawn outline both read it, so a home inside its plat is drawn inside
    // it. The Static Maps fallback samples at the URL (below).
    return ringsFromGeometry(geom, { maxPoints: Infinity, maxPolygons: Infinity })
  } catch (e) {
    console.warn('[buildCmaMapDataUri] boundary', e instanceof Error ? e.message : String(e))
    return []
  }
}

async function boundaryRings(name: string | null | undefined): Promise<MapLatLng[][]> {
  const slug = name?.trim() ? slugify(name.trim()) : ''
  return ringsFor('subdivision', slug)
}

/**
 * Points per drawn ring. A plat keeps its recorded shape (a lot-traced plat
 * runs to several hundred vertices); a neighborhood is drawn lighter, behind
 * it. The hold tests read the full recorded rings either way.
 */
const DRAWN_PLAT_POINTS = 2000
const DRAWN_PARENT_POINTS = 600

type DrawnOutlines = {
  plats: MapLatLng[][]
  parent: MapLatLng[][]
  shown: boolean
  parentShown: boolean
  labels: OutlineMapLabel[]
}

/**
 * Subject plat, then each plat a priced sale sits in, plus the parent
 * neighborhood or community when its polygon holds this home. Each used plat
 * and the parent get one place-name label.
 *
 * On a plat area (rule 24) the plat each home for sale and each listing that
 * came off sits in is drawn too: those homes passed the same polygon test the
 * area applies, so the line around them is part of the area, and a pin is
 * never left floating outside every outline (20676 Wild Rose, 2026-10-07).
 */
async function outlinesFor(
  subject: CmaSubject,
  comps: readonly CmaComp[],
  area: CmaCompArea | null,
  marks: readonly MapLatLng[],
  opts: {
    parentName?: string | null
    platLabels?: Readonly<Record<string, string>> | null
    others?: readonly MapLatLng[]
  } = {},
): Promise<DrawnOutlines> {
  const platArea = area?.kind === 'subdivision' || area?.kind === 'subdivisions'
  const located = [
    finite(subject.latitude) != null && finite(subject.longitude) != null
      ? { lat: subject.latitude as number, lng: subject.longitude as number }
      : { lat: null as number | null, lng: null as number | null },
    ...comps.map((c) => {
      const lat = finite(c.latitude)
      const lng = finite(c.longitude)
      return lat != null && lng != null
        ? { lat, lng }
        : { lat: null as number | null, lng: null as number | null }
    }),
    ...(platArea ? (opts.others ?? []).map((p) => ({ lat: p.lat as number | null, lng: p.lng as number | null })) : []),
  ]
  let assigned: Array<string | null> = []
  try {
    assigned = await assignSubdivisionSlugs(located)
  } catch (e) {
    console.warn('[buildCmaMapDataUri] plats', e instanceof Error ? e.message : String(e))
    assigned = []
  }
  const plats: MapLatLng[][] = []
  const drawnPlats: Array<{ slug: string; rings: MapLatLng[][] }> = []
  for (const slug of platSlugsToDraw(assigned)) {
    const recorded = await ringsFor('subdivision', slug)
    if (!polygonHoldsAnyPoint(recorded, marks)) continue
    const rings = recorded.map((r) => simplifyRing(r, DRAWN_PLAT_POINTS))
    plats.push(...rings)
    drawnPlats.push({ slug, rings })
  }
  let parent: MapLatLng[][] = []
  let parentLabel = opts.parentName?.trim() || null
  const subjectLat = finite(subject.latitude)
  const subjectLng = finite(subject.longitude)
  if (subjectLat != null && subjectLng != null) {
    try {
      const ring = await getSubdivisionRing(subjectLat, subjectLng)
      const parentRings = await ringsFor('neighborhood', ring?.neighborhoodSlug)
      const subjectPoint = [{ lat: subjectLat, lng: subjectLng }]
      if (polygonHoldsAnyPoint(parentRings, subjectPoint) || polygonHoldsAnyPoint(parentRings, marks)) {
        parent = parentRings.map((r) => simplifyRing(r, DRAWN_PARENT_POINTS))
      }
      if (!parentLabel && ring?.neighborhoodSlug) {
        parentLabel = await readBoundaryLabel('neighborhood', ring.neighborhoodSlug)
      }
    } catch (e) {
      console.warn('[buildCmaMapDataUri] parent', e instanceof Error ? e.message : String(e))
    }
  }
  if (!parentLabel && subject.communitySlug) {
    parentLabel = getResortCommunityBySlug(subject.communitySlug)?.label?.trim() || null
  }
  if (plats.length === 0 && parent.length === 0) {
    for (const name of areaNames(area, subject)) {
      const recorded = await boundaryRings(name)
      if (!polygonHoldsAnyPoint(recorded, marks)) continue
      const rings = recorded.map((r) => simplifyRing(r, DRAWN_PLAT_POINTS))
      plats.push(...rings)
      drawnPlats.push({ slug: '', rings })
    }
  }
  const supplied = opts.platLabels ?? {}
  const labeled = await Promise.all(
    drawnPlats.map(async (plat) => {
      const fromCaller = plat.slug ? supplied[plat.slug]?.trim() : ''
      const label = fromCaller || (plat.slug ? await readBoundaryLabel('subdivision', plat.slug) : null)
      return { label, rings: plat.rings }
    }),
  )
  const parentAnchor = parent.length > 0 ? parent : subjectLat != null && subjectLng != null ? [[{ lat: subjectLat, lng: subjectLng }]] : []
  return {
    plats,
    parent,
    shown: plats.length > 0 || parent.length > 0,
    parentShown: parent.length > 0,
    labels: labelsForUsedPlats({
      plats: labeled,
      parent: parentLabel ? { label: parentLabel, rings: parentAnchor } : null,
    }),
  }
}

/**
 * The names whose outlines this map may draw.
 *
 * `compArea.names` when the row carries them — that is the pricing side saying
 * where it actually looked — and the subject's own subdivision otherwise. At
 * most two, because a Static Maps URL has a length the request has to fit in.
 */
function areaNames(area: CmaCompArea | null, subject: CmaSubject): string[] {
  const named = (area?.names ?? []).filter(Boolean)
  if (named.length > 0) return named.slice(0, 2)
  return subject.subdivision?.trim() ? [subject.subdivision.trim()] : []
}

/** Subject pin and the subdivision outline. No numbered comps. */
export async function buildSubjectLocationMapDataUri(
  subject: CmaSubject,
): Promise<CmaMapResult | null> {
  return buildCmaMapDataUri(subject, [])
}

export type CmaMapOptions = {
  tiersUsed?: string[]
  /** Homes for sale or under contract in the same area, in matrix-3 order. */
  active?: readonly CmaMapEntry[]
  /** Listings that came off the same area unsold, in matrix-2 order. */
  unsold?: readonly CmaMapEntry[]
  /** `render_args.compArea`. Absent on older rows; the map degrades. */
  compArea?: CmaCompArea | null
  /**
   * Parent neighborhood or community, one place name. When omitted, the map
   * reads the neighborhood label, then the resort community label.
   */
  parentName?: string | null
  /** Recorded plat labels keyed by slug. A missing slug is read from boundaries. */
  platLabels?: Readonly<Record<string, string>> | null
}

/** Build the subject + comps map as a base64 PNG data URI. Null when the API
 *  key is missing or no coordinates are available. */
export async function buildCmaMapDataUri(
  subject: CmaSubject,
  comps: readonly CmaComp[],
  opts: CmaMapOptions = {},
): Promise<CmaMapResult | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()
  if (!apiKey) return null
  const points: CmaMapPoint[] = []
  const families: Array<{ key: string | null; family: CmaMapFamily | 'subject' }> = []
  const push = (
    e: CmaMapEntry,
    family: CmaMapFamily | 'subject',
    key: string | null,
  ): void => {
    const lat = finite(e.latitude)
    const lng = finite(e.longitude)
    if (lat == null || lng == null) return
    points.push({ label: key ?? 'S', color: family === 'subject' ? 'red' : '0x102742', lat, lng })
    families.push({ key, family })
  }
  push(subject, 'subject', null)
  // Nine is the ceiling the numbered set has always had — past it the pins
  // knot however far they are spread — and each family gets its own.
  // A pin with no address is not a home. Closed pins are the same subtype
  // the table keeps, in the same order, so the key still names the row.
  const sales = comps.filter(
    (c) => Boolean(c.address?.trim()) && letterProductMatch(subject.propertySubType, c.propertySubType),
  )
  sales.slice(0, 9).forEach((c, i) => push({ ...c, address: c.address }, 'closed', keyFor('closed', i)))
  const addressed = (rows: readonly CmaMapEntry[]) => rows.filter((r) => Boolean(r.address?.trim()))
  addressed(opts.active ?? []).slice(0, 9).forEach((r, i) => push(r, 'active', keyFor('active', i)))
  addressed(opts.unsold ?? []).slice(0, 9).forEach((r, i) => push(r, 'unsold', keyFor('unsold', i)))
  if (points.length < 1) return null
  const area = opts.compArea ?? null
  const story = describeCompSearch({ subdivision: subject.subdivision, tiersUsed: opts.tiersUsed ?? [] })
  const paths: string[] = []
  // THE OUTLINE HAS TO CONTAIN SOMETHING ON THE MAP (class F). An MLS
  // subdivision NAME and a recorded plat SLUG are different keys, so
  // `slugify(name)` can resolve to a plat that holds neither this home nor any
  // of its sales — which is what 19968 drew. The check is the one a reader
  // makes: is my house in that shape, or is one of the marks?
  const drawn: MapLatLng[] = points.map((p) => ({ lat: p.lat, lng: p.lng }))
  const outlines = await outlinesFor(subject, comps.slice(0, 9), area, drawn, {
    parentName: opts.parentName,
    platLabels: opts.platLabels,
    others: points
      .filter((_, i) => families[i]?.family === 'active' || families[i]?.family === 'unsold')
      .map((p) => ({ lat: p.lat, lng: p.lng })),
  })
  const boundaryShown = outlines.shown
  const parentShown = outlines.parentShown
  // The Static Maps URL has a length cap: it gets a sampled ring, a few at most.
  for (const ring of [...outlines.parent, ...outlines.plats].slice(0, 12)) {
    const path = pathParam('0x102742CC', '0x10274222', simplifyRing(ring))
    if (path) paths.push(path)
  }
  // THE COMP AREA'S OWN RADIUS FIRST, the search story's second. `compArea`
  // is what the pricing side says it searched; the story is what the renderer
  // could work out on its own before that field existed.
  const centre = area?.centre ??
    (finite(subject.latitude) != null && finite(subject.longitude) != null
      ? { lat: subject.latitude as number, lng: subject.longitude as number }
      : null)
  const radiusMiles = area?.radiusMiles ?? story.radiusMiles ?? null
  let radiusShown = false
  let radiusCentre: MapLatLng | null = null
  let radiusDrawnMiles: number | null = null
  if (centre && radiusMiles != null && radiusMiles > 0 && !us97IntersectsDisk(centre, radiusMiles)) {
    const circle = pathParam('0x10274299', '0x10274211', circlePath(centre, radiusMiles))
    if (circle) {
      paths.push(circle)
      radiusShown = true
      radiusCentre = centre
      radiusDrawnMiles = radiusMiles
    }
  }
  try {
    // Two pins on one rooftop cover each other whoever draws them, so the same
    // nudge the Google markers used still applies to ours.
    const spread = spreadStackedMapPoints(points)
    // The frame is every pin: the subject, the sales that set the price, the
    // homes for sale and the listings that came off. All three come from the
    // one sales area (rule 24), so none of them opens a mile ring, and a row
    // whose pin fell off the frame would be a row with no pin (2382 Jackson,
    // 2020 Hall, 2026-10-07: "Every pin below is a row" with one missing).
    const framed = spread
    // The document's own ground (lib/cma/map-ground.ts): a fractional zoom
    // fits the pins tight, and the TIGER skeleton under them is the Atlas
    // register. The Google tile stays as the fallback for a frame outside
    // the basemap tiers.
    const tightView = fitStaticMapView(framed, {
      width: MAP_W,
      height: MAP_H,
      padding: MAP_PAD,
      maxZoom: points.length === 1 ? 15 : 17,
      fractional: true,
    })
    if (tightView) {
      const ground = renderMapGroundSvg({
        view: tightView,
        basemap: basemapForFrame({ bbox: viewBbox(tightView), pad: 0.1 }),
        boundaryRings: outlines.plats,
        parentRings: outlines.parent,
        radius: radiusCentre && radiusDrawnMiles != null ? { centre: radiusCentre, miles: radiusDrawnMiles } : null,
        labels: outlines.labels,
        pins: spread.map((p) => ({ lat: p.lat, lng: p.lng })),
      })
      if (ground.featureCount > 0) {
        return {
          dataUri: svgDataUri(ground.svg),
          pointCount: points.length,
          view: tightView,
          pins: points.map((p, i) => ({
            key: families[i]!.key,
            family: families[i]!.family,
            lat: spread[i]!.lat,
            lng: spread[i]!.lng,
          })),
          boundaryShown,
          parentShown,
          radiusShown,
        }
      }
    }
    const view = fitStaticMapView(framed, {
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
      pins: spread.map((p, i) => ({
        key: families[i]?.key ?? null,
        family: families[i]?.family ?? 'closed',
        lat: p.lat,
        lng: p.lng,
      })),
      boundaryShown,
      parentShown,
      radiusShown,
    }
  } catch (e) {
    console.warn('[buildCmaMapDataUri]', e instanceof Error ? e.message : String(e))
    return null
  }
}

/**
 * The three families and the comp area, read off one stored `render_args`.
 *
 * Both serve paths (`lib/cma/serve-document.ts`, `lib/cma/print-html.ts`)
 * rebuild the tile on the request, so this is where the peers and the rivals
 * become map points. Reading them here rather than at each call site is what
 * keeps the letter and the immersive drawing the same map.
 */
export function cmaMapOptionsFromArgs(args: unknown): CmaMapOptions {
  const a = args as {
    tiersUsed?: string[]
    subject?: { latitude?: number | null; longitude?: number | null }
  } | null | undefined
  const sets = matrixSetsFromArgs(args)
  const compArea = readCompArea(args)
  const namedParent =
    compArea && (compArea.kind === 'neighborhood' || compArea.kind === 'community')
      ? compArea.names?.[0]?.trim() || null
      : null
  const lat = a?.subject?.latitude
  const lng = a?.subject?.longitude
  const fromPoint =
    !namedParent && typeof lat === 'number' && typeof lng === 'number'
      ? parentPlaceArea({ latitude: lat, longitude: lng })?.names[0] ?? null
      : null
  return {
    tiersUsed: a?.tiersUsed ?? [],
    unsold: sets.unsold,
    active: sets.active,
    compArea,
    parentName: namedParent ?? fromPoint,
  }
}
