/**
 * The Atlas's numbers, as pure functions (UXLIVE-3 / SEO-10 / COMP-4,
 * visibility audit 2026-09-22).
 *
 * WHY THIS FILE EXISTS. The Atlas used to receive its whole dot population as
 * props, so every figure it prints (the key's "708 for sale · 328 pending",
 * each place chip's count, a place card's median, the price scrubber's range,
 * the frame itself on a fit-to-dots map) was computed in the component from
 * those dots, on the server render and again in the browser. On /about that
 * was 5,650 dots, 2.0 MB of the RSC payload; on /cities/bend 1,664 dots and
 * 594 KB. The dots now load after paint from a cached JSON route
 * (app/api/atlas/dots), which means the server render no longer HAS them, and
 * the counts, boundaries and text must still be in the server HTML.
 *
 * So the derivations moved here, and both sides run the SAME functions:
 *
 *   - the page calls `summarizeAtlasDots` on the server with the full
 *     population and hands the Atlas a few hundred bytes of results (the
 *     frame box, the counts, each place's count and median, the scrubber
 *     range), and
 *   - V3Atlas calls the same functions on the dots once they arrive, which is
 *     what the visitor's type toggles and price scrubber re-run.
 *
 * One implementation, so the number in the server HTML and the number the
 * browser computes from the same population cannot drift apart (§0 rule 5).
 *
 * Isomorphic and dependency-light: imported by a 'use client' component and
 * by server code.
 */
import {
  bboxOfRings,
  makeProjection,
  outerRings,
  padBbox,
  pointInRings,
  type Bbox,
  type Projection,
  type Ring,
} from '@/lib/geo/project-svg'
import { recordFrame } from '@/lib/geo/record-frame'
import { atlasFramePad } from '@/lib/place/map-hierarchy'
import { isAtlasPulseSold } from '@/lib/atlas/sales-heat'

/* -------------------------------------------------------------------------- */
/* Shapes                                                                      */
/* -------------------------------------------------------------------------- */

/** The fields of an Atlas dot these derivations read. AtlasDot satisfies it. */
export type AtlasDerivableDot = {
  k: string
  lat: number
  lng: number
  p: number | null
  t: string
  s: 'active' | 'pending' | 'sold' | 'closed'
  soldAgo?: number | null
}

/** The fields of an Atlas region these derivations read. AtlasRegion satisfies it. */
export type AtlasDerivableRegion = {
  id: string
  kind: 'town' | 'community' | 'neighborhood' | 'subdivision'
  geometry: GeoJSON.Geometry
}

/** A region with its rings materialised once. */
export type AtlasShapeRings = {
  id: string
  kind: AtlasDerivableRegion['kind']
  rings: Ring[]
  /** Bounding-box area in square degrees: the "smallest place" tie-break. */
  area: number
}

export type AtlasPriceScale = { min: number; max: number; step: number }

export type AtlasCounts = {
  forSale: number
  pending: number
  /** Closes inside the pulse window (the "sold" figure). */
  sold: number
  /** A broker's historical closings (record maps). */
  closed: number
}

export type AtlasPlaceStat = { n: number; median: number | null }

/**
 * What the server hands the Atlas in place of the dots: every figure the
 * Atlas prints BEFORE a visitor touches a control, computed from the full
 * population with the functions below. A few hundred bytes where the dots
 * were hundreds of kilobytes.
 */
export type AtlasDotSummary = {
  /** The padded lon/lat box the projection frames (fit-to-dots maps need the dots for it). */
  box: Bbox
  counts: AtlasCounts
  /** Every dot is a closing and none is for sale: a broker's record map. */
  closingsMap: boolean
  priceScale: AtlasPriceScale
  /** Dots the frame does not hold, counted in every figure (the source line says so). */
  beyond: { n: number; on: number }
  /**
   * Per place id: [listed dots inside it, their median price (the default
   * median scope)]. Places with no listed dot are omitted (read as 0).
   */
  places: Readonly<Record<string, readonly [number, number | null]>>
  /** How many dots the summary was computed from. */
  n: number
}

/* -------------------------------------------------------------------------- */
/* Small helpers                                                               */
/* -------------------------------------------------------------------------- */

/** Property types whose prices are one "home price" median. */
export const ATLAS_RESIDENTIAL_TYPES: ReadonlySet<string> = new Set([
  'house',
  'condo',
  'townhouse',
  'manufactured',
  'multi',
])

/** Central Oregon, for a map with nothing to frame. */
export const ATLAS_FALLBACK_BOX: Bbox = { minLon: -121.9, maxLon: -120.9, minLat: 43.6, maxLat: 44.55 }

export function atlasMedian(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2)
}

export function atlasQuantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo)
}

/** Rings, bbox area and kind for every region, in the order given. */
export function atlasShapeRings(regions: readonly AtlasDerivableRegion[]): AtlasShapeRings[] {
  return regions.map((r) => {
    const rings = outerRings(r.geometry)
    const b = bboxOfRings(rings)
    return { id: r.id, kind: r.kind, rings, area: b ? (b.maxLon - b.minLon) * (b.maxLat - b.minLat) : 0 }
  })
}

/* -------------------------------------------------------------------------- */
/* The frame                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The padded lon/lat box the Atlas projects, exactly as V3Atlas has always
 * framed it:
 *
 *   - an explicit `frame` geometry wins (a lot view);
 *   - `fit: 'dots'` frames the record: the dots and the towns holding them,
 *     outliers out (lib/geo/record-frame.ts);
 *   - otherwise the base silhouettes plus the dots' 1st to 99th percentile in
 *     each axis, so a lone listing an hour into the high desert stays counted
 *     without shrinking the map.
 */
export function atlasFrameBox(input: {
  frame?: GeoJSON.Geometry | null
  subjectGrain?: boolean
  fit?: 'regions' | 'dots'
  dots: readonly { lat: number; lng: number }[]
  shapes: readonly Pick<AtlasShapeRings, 'id' | 'kind' | 'rings'>[]
}): Bbox {
  const { frame, subjectGrain = false, fit = 'regions', dots, shapes } = input
  if (frame) {
    const framed = bboxOfRings(outerRings(frame))
    if (framed) return padBbox(framed, atlasFramePad(subjectGrain))
  }
  const towns = shapes.filter((s) => s.kind === 'town')
  if (fit === 'dots') {
    const record = recordFrame(
      dots,
      towns.map((s) => ({ id: s.id, rings: s.rings })),
    )
    return padBbox(record.bbox ?? ATLAS_FALLBACK_BOX, 0.1)
  }
  const baseRings = towns.flatMap((s) => s.rings)
  const lons = dots.map((d) => d.lng).sort((a, b) => a - b)
  const lats = dots.map((d) => d.lat).sort((a, b) => a - b)
  const core: Ring =
    lons.length > 0
      ? [
          [atlasQuantile(lons, 0.01), atlasQuantile(lats, 0.01)],
          [atlasQuantile(lons, 0.99), atlasQuantile(lats, 0.99)],
        ]
      : []
  const b = bboxOfRings(core.length > 0 ? [...baseRings, core] : baseRings)
  return padBbox(b ?? ATLAS_FALLBACK_BOX, 0.04)
}

/** The Atlas projection for a box: a 1000-unit-wide viewBox. */
export function atlasProjection(box: Bbox): Projection {
  return makeProjection(box, 1000)
}

/* -------------------------------------------------------------------------- */
/* Figures                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The price scrubber's range: the 5th to the 95th percentile of the listed
 * dots' own prices, rounded outward to a clean step.
 */
export function atlasPriceScale(dots: readonly AtlasDerivableDot[]): AtlasPriceScale {
  const sorted = dots
    .flatMap((d) => (d.s !== 'sold' && d.p != null && d.p > 0 ? [d.p] : []))
    .sort((a, b) => a - b)
  const lo = Math.floor(atlasQuantile(sorted, 0.05) / 50_000) * 50_000
  const hi = Math.ceil(atlasQuantile(sorted, 0.95) / 100_000) * 100_000
  return { min: Math.max(lo, 50_000), max: Math.max(hi, lo + 100_000), step: 25_000 }
}

/**
 * A record map: every dot is a closing, none is for sale. Read from the whole
 * population, never the filtered counts: an empty price filter must not turn a
 * broker's record into a for-sale map.
 */
export function atlasIsClosingsMap(dots: readonly AtlasDerivableDot[]): boolean {
  return dots.some((d) => d.s === 'closed') && !dots.some((d) => d.s === 'active' || d.s === 'pending')
}

/**
 * The median is of HOMES unless the reader chose lots or commercial alone: a
 * lot's price beside a house's is not one median.
 */
export function atlasMedianScope(
  onKeys: readonly string[],
  closingsMap: boolean,
): { keys: ReadonlySet<string>; label: string } {
  const residentialOn = onKeys.some((k) => ATLAS_RESIDENTIAL_TYPES.has(k))
  if (closingsMap) return { keys: new Set(onKeys), label: 'median close' }
  if (residentialOn) return { keys: ATLAS_RESIDENTIAL_TYPES, label: 'median home price' }
  const onlyLots = onKeys.length > 0 && onKeys.every((k) => k === 'land')
  return { keys: new Set(onKeys), label: onlyLots ? 'median lot price' : 'median price' }
}

/** ONE filter for every layer, sold included: the counts the marks are drawn from. */
export function atlasCounts<D extends AtlasDerivableDot>(
  dots: readonly D[],
  isOn: (d: D) => boolean,
): AtlasCounts & { listed: number[] } {
  let forSale = 0
  let pending = 0
  let sold = 0
  let closed = 0
  const listed: number[] = []
  dots.forEach((d, i) => {
    if (!isOn(d)) return
    if (d.s === 'sold') {
      if (isAtlasPulseSold(d)) sold += 1
    } else {
      listed.push(i)
      if (d.s === 'pending') pending += 1
      else if (d.s === 'closed') closed += 1
      else forSale += 1
    }
  })
  return { forSale, pending, sold, closed, listed }
}

/**
 * Which places hold each dot, by id, in the order the shapes were given.
 * A point outside a shape's bounding box cannot be inside it, so the ring walk
 * runs only for the few shapes whose box holds the point (5,650 dots against
 * 111 regions on /about: the walk used to run for every pair).
 */
export function atlasMembership(
  dots: readonly { lat: number; lng: number }[],
  shapes: readonly Pick<AtlasShapeRings, 'id' | 'rings'>[],
): string[][] {
  const boxes = shapes.map((s) => bboxOfRings(s.rings))
  return dots.map((d) => {
    const ids: string[] = []
    shapes.forEach((s, i) => {
      const b = boxes[i]
      if (!b || d.lng < b.minLon || d.lng > b.maxLon || d.lat < b.minLat || d.lat > b.maxLat) return
      if (pointInRings(d.lng, d.lat, s.rings)) ids.push(s.id)
    })
    return ids
  })
}

/**
 * Per-place figures over the listed dots: the count on a chip, the count and
 * median on a place card. On a record map a closing counts in ONE place, the
 * smallest that holds it, so six chips reading 1 never sum above a map
 * claiming four.
 */
export function atlasRegionStats(input: {
  dots: readonly AtlasDerivableDot[]
  listed: readonly number[]
  membership: readonly (readonly string[])[]
  medianKeys: ReadonlySet<string>
  closingsMap: boolean
  areaById: ReadonlyMap<string, number>
}): Map<string, AtlasPlaceStat> {
  const { dots, listed, membership, medianKeys, closingsMap, areaById } = input
  const smallestOf = (ids: readonly string[]): string =>
    ids.reduce((best, id) => ((areaById.get(id) ?? Infinity) < (areaById.get(best) ?? Infinity) ? id : best), ids[0]!)
  const acc = new Map<string, { n: number; prices: number[] }>()
  for (const i of listed) {
    const d = dots[i]!
    const ids = membership[i] ?? []
    const owners = closingsMap && ids.length > 1 ? [smallestOf(ids)] : ids
    for (const rid of owners) {
      const rec = acc.get(rid) ?? { n: 0, prices: [] }
      rec.n += 1
      if (d.p != null && d.p > 0 && medianKeys.has(d.t)) rec.prices.push(d.p)
      acc.set(rid, rec)
    }
  }
  const out = new Map<string, AtlasPlaceStat>()
  for (const [rid, rec] of acc) out.set(rid, { n: rec.n, median: atlasMedian(rec.prices) })
  return out
}

/**
 * Dots the frame does not hold: counted in every figure, named in the source
 * line, never silently missing. Heat-only closes are the wash, not a figure.
 */
export function atlasBeyond<D extends AtlasDerivableDot>(
  dots: readonly D[],
  proj: Pick<Projection, 'toXY' | 'width' | 'height'>,
  isOn: (d: D) => boolean,
): { n: number; on: number } {
  let n = 0
  let on = 0
  for (const d of dots) {
    if (!isOn(d)) continue
    if (d.s === 'sold' && !isAtlasPulseSold(d)) continue
    on += 1
    const [x, y] = proj.toXY(d.lng, d.lat)
    if (x < 0 || y < 0 || x > proj.width || y > proj.height) n += 1
  }
  return { n, on }
}

/* -------------------------------------------------------------------------- */
/* The summary                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Every figure the Atlas prints at rest (every type on, no price ceiling),
 * computed on the server from the full population so the server HTML carries
 * the counts while the dots themselves load after paint.
 *
 * `regions` and `childRegions` must be the SAME arrays (same order) the page
 * hands the Atlas: membership walks them in that order.
 */
export function summarizeAtlasDots(input: {
  dots: readonly AtlasDerivableDot[]
  regions: readonly AtlasDerivableRegion[]
  childRegions?: readonly AtlasDerivableRegion[]
  /** The type toggles the Atlas will render (all on at rest). */
  types: readonly { key: string }[]
  fit?: 'regions' | 'dots'
  frame?: GeoJSON.Geometry | null
  subjectGrain?: boolean
}): AtlasDotSummary {
  const { dots, regions, childRegions = [], types, fit, frame, subjectGrain } = input
  const shapes = atlasShapeRings([...regions, ...childRegions])
  const box = atlasFrameBox({ frame, subjectGrain, fit, dots, shapes })
  const proj = atlasProjection(box)
  const all = () => true
  const { listed, ...counts } = atlasCounts(dots, all)
  const closingsMap = atlasIsClosingsMap(dots)
  const scope = atlasMedianScope(
    types.map((t) => t.key),
    closingsMap,
  )
  const stats = atlasRegionStats({
    dots,
    listed,
    membership: atlasMembership(dots, shapes),
    medianKeys: scope.keys,
    closingsMap,
    areaById: new Map(shapes.map((s) => [s.id, s.area])),
  })
  const places: Record<string, readonly [number, number | null]> = {}
  for (const [id, s] of stats) if (s.n > 0) places[id] = [s.n, s.median]
  return {
    box,
    counts,
    closingsMap,
    priceScale: atlasPriceScale(dots),
    beyond: atlasBeyond(dots, proj, all),
    places,
    n: dots.length,
  }
}
