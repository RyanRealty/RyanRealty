'use client'
/**
 * PATTERN 8: ATLAS. The living map — every listing on the market as a point on
 * Central Oregon, every place as a touchable silhouette, a sales-heat wash
 * from closings, pulses on real events, one price scrubber, one row of type
 * toggles, and a card that answers "what is here" on hover or tap. The
 * homepage Stage (owned flyover) sits above it; scoped to a boundary, the
 * living map of a city, a neighborhood, a community, a plat.
 *
 * Why it exists (Matt 2026-09-01): "a buyer does not want every home in
 * Central Oregon" — a buyer wants THEIR place, price, and type, and the site's
 * moat is that it knows every one of them. "Look alive like real activity
 * happening."
 *
 * Honest by construction (section 0): every number the Atlas prints is a
 * count or a median of the dots on screen — the listings the caller passed,
 * filtered by the visitor's own price and type choices, sold dots included
 * in the same filter. One population, one source, named in the source line.
 * A caller whose read came back short says so through `incomplete`, and the
 * Atlas then prints NO counts: a partial count is a wrong number.
 *
 * The map is inventory as marks, sales as a field. Closings in the heat
 * window paint a navy-on-cream kernel in this map's projection; active and
 * pending stay as dots on top and stay clickable. Sold dots are omitted as
 * marks so the field is not double-encoded. Quiet and lot maps draw no heat.
 * Incomplete reads print no heat, same as no counts. Pending and active
 * never count as heat.
 *
 * LAYERS:
 *   svg      silhouettes, the sales wash, and the inventory dots. Each place
 *            is drawn twice: a cream halo under a navy line, so the outline
 *            reads over the field. Dots are zero-length stroked paths with
 *            non-scaling-stroke, so their diameter is screen pixels at any
 *            scale — the server-rendered map is the final map.
 *   html     town labels, positioned from the measured view, in real type.
 *   svg      the pulses, alone, on their own layer, capped with slots for
 *            each kind of event so a close always shows, paused off-screen.
 *   html     the card and the dock. The dock is a legend in flow — under
 *            the map on a phone, under the head in the desktop column — so
 *            the map keeps its full height.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  bboxOfRings,
  labelAnchor,
  makeProjection,
  outerRings,
  padBbox,
  pointInRings,
  pointsToPath,
  ringsToPath,
  type Ring,
} from '@/lib/geo/project-svg'
import { recordFrame } from '@/lib/geo/record-frame'
import { decodeBasemapFeature, type Basemap, type BasemapFeature } from '@/lib/geo/basemap'
import {
  ATLAS_CAM_HOME,
  ATLAS_K_MAX,
  ATLAS_K_MIN,
  panBy,
  publishAtlasView,
  screenToWorld,
  visibleLonLat,
  zoomAt,
  type AtlasCam,
  type AtlasViewBounds,
} from '@/lib/geo/atlas-camera'
import { shortPlaceLabel } from '@/lib/place/short-place-label'

export type { AtlasViewBounds }
import {
  ATLAS_HEAT_WINDOW_DAYS,
  atlasHeatWindowLabel,
  isAtlasHeatClosing,
  isAtlasPulseSold,
  salesHeatField,
} from '@/lib/atlas/sales-heat'
import { atlasLabelBox, packAtlasLabels, type AtlasLabelCandidate } from '@/lib/atlas/pack-labels'
import { V3_ROOT_CLASS, type V3Text } from './atoms'
import './tokens.css'
import './V3Atlas.css'

/* -------------------------------------------------------------------------- */
/* Data                                                                        */
/* -------------------------------------------------------------------------- */

export type AtlasDot = {
  /** Listing key — the React key. */
  k: string
  /** Canonical listing URL. Absent on a closing with no public page. */
  href?: string
  lat: number
  lng: number
  /** List price (close price for a sold dot) in dollars; null when withheld. */
  p: number | null
  /** Type key: house · condo · townhouse · manufactured · land · multi · commercial · other. */
  t: string
  /** Days since the listing went on market; null when the feed withheld it. */
  age: number | null
  /**
   * active · pending · sold — the dot's own status, for the activity layer.
   * closed: a historical closing (a broker's record), drawn as a dot, counted
   * as a closing, never pulsed.
   */
  s: 'active' | 'pending' | 'sold' | 'closed'
  /** Days since close for a sold dot; null otherwise. */
  soldAgo?: number | null
}

/** A recent, real event: what the live line prints. */
export type AtlasEvent = { key: string; kind: 'new' | 'pending' | 'sold'; label: string; href: string }

export type AtlasRegionKind = 'town' | 'community' | 'neighborhood'

export type AtlasRegion = {
  id: string
  /** town = the base silhouette(s); community/neighborhood = the places on it. */
  kind: AtlasRegionKind
  /** What the card calls it: "City", "Community", "Subdivision". Defaults by kind. */
  kindLabel?: string
  name: string
  href: string
  geometry: GeoJSON.Geometry
}

export type AtlasType = { key: string; label: string }

/** One lot line. `subject` is the lot the page's own home sits on. */
export type AtlasParcel = {
  id: string
  subject: boolean
  name?: string
  geometry: GeoJSON.Geometry
}


export type V3AtlasProps = {
  id: string
  /** The page H1 (D11 lock on the homepage), or the section title. */
  headline: V3Text
  headingLevel?: 1 | 2
  dots: readonly AtlasDot[]
  regions: readonly AtlasRegion[]
  /** Type toggles, in display order. Keys match AtlasDot.t. */
  types: readonly AtlasType[]
  /** The section 0 trace: what the dots are and where they come from. */
  source?: string
  /** "Sep 1, 2026, 9:40 PM" — when the dots were read, already formatted. */
  stamp?: string
  /** The caller's read came back short: the Atlas prints no counts. */
  incomplete?: boolean
  /** The newest real events, already formatted, for the live line. */
  events?: readonly AtlasEvent[]
  /** The search control, rendered in the aside under the live line. */
  /**
   * The word for one dot: "closing" / "closings" on a broker's record map.
   * Absent, the map speaks of listings (or the single type on).
   */
  noun?: { one: string; many: string }
  /**
   * What the frame fits: every region (the default), or the dots' own extent
   * — a broker's closings sit in two towns and should fill the frame, not a
   * corner of the whole region. Regions outside the frame are clipped.
   */
  fit?: 'regions' | 'dots'
  /**
   * One dot held above the rest and named — the home a listing page is about.
   * Matched by the dot's key; absent from the dots, nothing is drawn.
   */
  highlight?: { key: string; label: string }
  /**
   * How many places with a recorded boundary the frame holds when the
   * outlines are a subset (a plat cap): the source line says "N of M".
   */
  outlinedOf?: number
  /**
   * The roads, rivers and lakes drawn under everything else — context, so a
   * dot has a place rather than floating in cream. Clipped and thinned to the
   * frame by the page (lib/geo/basemap-source.ts); absent, the map draws none.
   */
  basemap?: Basemap | null
  /**
   * Lot lines: the parcel the page is about, and the parcels around it. From
   * the county assessor's cadastral layer, so it is the recorded shape of a
   * lot and NOT a survey — a page drawing these carries the disclaimer beside
   * the map (lib/data/geo/getTaxlots.ts, TAXLOT_DISCLAIMER).
   */
  parcels?: readonly AtlasParcel[]
  /**
   * Frame the map on this geometry and nothing else. Not drawn — it only sets
   * the projection. A lot view needs it: a 0.18-acre parcel on a map framed by
   * its neighborhood renders four pixels across, which is a line nobody can
   * read.
   */
  frame?: GeoJSON.Geometry | null
  /**
   * This map is one object, not a population: no type switches, no price
   * scrubber, no count claim. A lot view has one dot and one polygon, and
   * "1 listing of every type for sale, slide the price" is noise on it.
   */
  quiet?: boolean
  children?: ReactNode
  className?: string
  /**
   * Visible geographic box after pan/zoom. `null` at k===1 (full frame) so
   * the photographed list below stays unfiltered at rest.
   */
  onViewChange?: (bounds: AtlasViewBounds | null) => void
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const RESIDENTIAL = new Set(['house', 'condo', 'townhouse', 'manufactured', 'multi'])
/** Pulse slots per event kind, so a month of closes always has living marks. */
const PULSE_SLOTS = { new: 16, pending: 6, sold: 18 } as const
const KIND_LABEL: Record<AtlasRegionKind, string> = { town: 'Town', community: 'Community', neighborhood: 'Neighborhood' }

/**
 * The price a control is actually set to. Two decimals under ten million,
 * because the scrubber steps in twenty-five thousands: one decimal printed
 * "$1.8M" for both $1,775,000 and $1,750,000, so the number on screen was not
 * the number being applied (evaluator round five, LISTING-NOBOUNDARY-3).
 */
function fmtShort(usd: number): string {
  if (usd >= 1_000_000) {
    const m = usd / 1_000_000
    return `$${m >= 10 ? m.toFixed(0) : m.toFixed(2).replace(/\.?0+$/, '')}M`
  }
  return `$${Math.round(usd / 1000)}K`
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2)
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo)
}

/** The noun for a count, honest to the types on screen: lots are not homes. */
const NOUNS: Record<string, readonly [string, string]> = {
  house: ['house', 'houses'],
  condo: ['condo', 'condos'],
  townhouse: ['townhome', 'townhomes'],
  manufactured: ['manufactured home', 'manufactured homes'],
  land: ['lot', 'lots'],
  multi: ['multi-family building', 'multi-family buildings'],
  commercial: ['commercial property', 'commercial properties'],
}
function nounFor(count: number, typesOn: readonly AtlasType[], allTypes: readonly AtlasType[]): string {
  const single = typesOn.length === 1 && typesOn.length !== allTypes.length ? NOUNS[typesOn[0]!.key] : null
  if (single) return count === 1 ? single[0] : single[1]
  return count === 1 ? 'listing' : 'listings'
}

type RegionShape = AtlasRegion & {
  rings: Ring[]
  anchor: readonly [number, number] | null
  area: number
  bbox: ReturnType<typeof bboxOfRings>
}
type PlacedShape = RegionShape & { d: string }
type View = { w: number; h: number; scale: number; ox: number; oy: number }

/* -------------------------------------------------------------------------- */
/* V3Atlas                                                                     */
/* -------------------------------------------------------------------------- */

export function V3Atlas({
  id,
  headline,
  headingLevel = 1,
  dots,
  regions,
  types,
  source,
  stamp,
  fit = 'regions',
  highlight,
  outlinedOf,
  basemap,
  parcels,
  frame,
  quiet,
  noun: nounProp,
  incomplete,
  events,
  children,
  className,
  onViewChange,
}: V3AtlasProps) {
  const uid = useId()
  const router = useRouter()
  const Heading = headingLevel === 1 ? 'h1' : 'h2'

  /* Geometry: rings, label anchors, areas, projection — once per data set. */
  const shapes = useMemo<RegionShape[]>(() => {
    return regions.map((r) => {
      const rings = outerRings(r.geometry)
      const anchor = labelAnchor(rings)
      const b = bboxOfRings(rings)
      const area = b ? (b.maxLon - b.minLon) * (b.maxLat - b.minLat) : 0
      // Label under the silhouette's bottom edge so the dense centre stays clean.
      const labelAt = anchor && b ? ([anchor[0], b.minLat] as const) : anchor
      return { ...r, rings, anchor: labelAt, area, bbox: b }
    })
  }, [regions])

  const proj = useMemo(() => {
    // An explicit frame wins: the caller has told the map what it is about.
    if (frame) {
      const framed = bboxOfRings(outerRings(frame))
      if (framed) return makeProjection(padBbox(framed, 0.6), 1000)
    }
    // Frame the basin, not the outliers: the base silhouettes plus the dots'
    // 1st–99th percentile in each axis. A lone listing an hour into the high
    // desert stays counted (the source says so) without shrinking the map.
    const baseRings = shapes.filter((s) => s.kind === 'town').flatMap((s) => s.rings)
    // A record map (fit: dots) has no boundary of its own to sit inside, so
    // the frame is computed from the dots and the towns that hold them:
    // outliers stay out (Ashland is counted and named beyond the edge, pass
    // two C1) and a tight cluster still frames wide enough for a town label
    // to land in the stage (round five). See lib/geo/record-frame.ts.
    if (fit === 'dots') {
      const frame = recordFrame(
        dots,
        shapes.filter((s) => s.kind === 'town').map((s) => ({ id: s.id, rings: s.rings })),
      )
      const padded = padBbox(frame.bbox ?? { minLon: -121.9, maxLon: -120.9, minLat: 43.6, maxLat: 44.55 }, 0.1)
      return makeProjection(padded, 1000)
    }
    // The regional map frames the basin, not the outliers: the base
    // silhouettes plus the dots' 1st–99th percentile in each axis.
    const lons = dots.map((d) => d.lng).sort((a, b) => a - b)
    const lats = dots.map((d) => d.lat).sort((a, b) => a - b)
    const core: Ring =
      lons.length > 0
        ? [
            [quantile(lons, 0.01), quantile(lats, 0.01)],
            [quantile(lons, 0.99), quantile(lats, 0.99)],
          ]
        : []
    const b = bboxOfRings(core.length > 0 ? [...baseRings, core] : baseRings)
    const padded = padBbox(b ?? { minLon: -121.9, maxLon: -120.9, minLat: 43.6, maxLat: 44.55 }, 0.04)
    return makeProjection(padded, 1000)
  }, [shapes, dots, fit, frame])


  const paths = useMemo<PlacedShape[]>(
    () => shapes.map((s) => ({ ...s, d: ringsToPath(s.rings, proj) })),
    [shapes, proj],
  )

  /* Lot lines, projected the same way as every other geometry on this map, so
     a parcel edge meets the plat outline it actually sits inside. */
  const parcelPaths = useMemo(() => {
    if (!parcels || parcels.length === 0) return []
    return parcels
      .map((p) => ({ id: p.id, subject: p.subject, name: p.name, d: ringsToPath(outerRings(p.geometry), proj) }))
      .filter((p) => p.d.length > 0)
  }, [parcels, proj])

  /* The basemap, decoded once and projected with the same functions the
     recorded boundaries use — one projection, so a road meets the city limit
     it actually runs through. */
  const basemapPaths = useMemo(() => {
    if (!basemap) return null
    const place = (features: readonly BasemapFeature[], close: boolean) =>
      features
        .flatMap((f) =>
          decodeBasemapFeature(f, basemap.q).map((points) => ({
            cls: f.c,
            name: f.n,
            d: close ? ringsToPath([points], proj) : pointsToPath(points, proj),
          })),
        )
        .filter((p) => p.d.length > 0)
    const built = {
      bodies: place(basemap.bodies, true),
      waterways: place(basemap.waterways, false),
      roads: place(basemap.roads, false),
    }
    return built.bodies.length + built.waterways.length + built.roads.length > 0 ? built : null
  }, [basemap, proj])
  const towns = useMemo(() => paths.filter((s) => s.kind === 'town'), [paths])
  /* Largest first, so a community inside a neighborhood is painted on top
     and takes the pointer. */
  const places = useMemo(() => paths.filter((s) => s.kind !== 'town').sort((a, b) => b.area - a.area), [paths])
  /* A town whose silhouette spans most of the frame IS the frame (a scoped
     page's own place): the headline names it, so its label would only clip
     at the edge (pass five). */
  const isFrame = useCallback(
    (s: RegionShape) => {
      // A record map's frame is computed, not named by the headline: the town
      // filling it is the answer to "where", so it keeps its label.
      if (fit === 'dots') return false
      if (!s.bbox) return false
      const [x0, y0] = proj.toXY(s.bbox.minLon, s.bbox.maxLat)
      const [x1, y1] = proj.toXY(s.bbox.maxLon, s.bbox.minLat)
      return Math.abs(x1 - x0) / proj.width > 0.8 || Math.abs(y1 - y0) / proj.height > 0.8
    },
    [proj, fit],
  )
  const wide = proj.width / proj.height > 1.35
  /* A frame at least as wide as it is tall does not need the phone's
     minimum height: the aspect already gives it one, and the floor was
     leaving 16% of the stage empty at 375 (evaluator round five,
     LISTING-NOBOUNDARY-9). */
  const fitsPhone = proj.width / proj.height >= 1

  const xy = useMemo(() => dots.map((d) => proj.toXY(d.lng, d.lat)), [dots, proj])

  const membership = useMemo(
    () =>
      dots.map((d) => {
        const ids: string[] = []
        for (const s of shapes) if (pointInRings(d.lng, d.lat, s.rings)) ids.push(s.id)
        return ids
      }),
    [dots, shapes],
  )

  /* The map is one tab stop: the roving index says which place holds it. */
  const placesRef = useRef<SVGGElement>(null)
  const [roving, setRoving] = useState(0)

  /* The measured view: where the viewBox lands inside the stage (meet fit). */
  const stageRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View | null>(null)
  useEffect(() => {
    const el = stageRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const r = el.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) return
      const scale = Math.min(r.width / proj.width, r.height / proj.height)
      setView({ w: r.width, h: r.height, scale, ox: (r.width - proj.width * scale) / 2, oy: (r.height - proj.height * scale) / 2 })
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => ro.disconnect()
  }, [proj.width, proj.height])

  const toPx = useCallback(
    (x: number, y: number): readonly [number, number] => (view ? [view.ox + x * view.scale, view.oy + y * view.scale] : [0, 0]),
    [view],
  )

  const [cam, setCam] = useState<AtlasCam>(ATLAS_CAM_HOME)
  const camRef = useRef(cam)
  camRef.current = cam
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const ptsRef = useRef(new Map<number, { x: number; y: number }>())
  const pinchRef = useRef<{ d: number } | null>(null)
  const stageSize = view ? { w: view.w, h: view.h } : { w: 1, h: 1 }

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const dy = e.deltaY
      if (dy === 0) return
      const factor = e.ctrlKey ? Math.exp(-dy * 0.01) : dy < 0 ? 1.18 : 1 / 1.18
      setCam((c) => zoomAt(c, e.clientX - r.left, e.clientY - r.top, factor, r.width, r.height))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [view?.w, view?.h])

  useEffect(() => {
    const t = window.setTimeout(() => {
      const next =
        !view || view.scale <= 0 || cam.k === 1 ? null : visibleLonLat(cam, view, proj.toXY)
      onViewChange?.(next)
      publishAtlasView(next)
    }, 100)
    return () => window.clearTimeout(t)
  }, [cam, view, proj, onViewChange])

  /* In view? The pulses only breathe while the reader can see them. */
  const sectionRef = useRef<HTMLElement>(null)
  const [inView, setInView] = useState(true)
  useEffect(() => {
    const el = sectionRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setInView(Boolean(entry?.isIntersecting)), { threshold: 0.05 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  /* Price scale: the scrubber runs from the 5th to the 95th percentile of the
     listed dots' own prices, rounded outward to a clean step. */
  const priceScale = useMemo(() => {
    const sorted = dots
      .flatMap((d) => (d.s !== 'sold' && d.p != null && d.p > 0 ? [d.p] : []))
      .sort((a, b) => a - b)
    const lo = Math.floor(quantile(sorted, 0.05) / 50_000) * 50_000
    const hi = Math.ceil(quantile(sorted, 0.95) / 100_000) * 100_000
    return { min: Math.max(lo, 50_000), max: Math.max(hi, lo + 100_000), step: 25_000 }
  }, [dots])

  /* Visitor state. */
  const [maxPriceRaw, setMaxPriceRaw] = useState<number | null>(null)
  const maxPrice = maxPriceRaw ?? priceScale.max
  const atCeiling = maxPrice >= priceScale.max
  const setMaxPrice = (v: number) => setMaxPriceRaw(v >= priceScale.max ? null : v)
  const [offTypes, setOffTypes] = useState<ReadonlySet<string>>(() => new Set())
  const [hover, setHover] = useState<string | null>(null)
  const [pinned, setPinned] = useState<{ id: string; at: readonly [number, number] } | null>(null)
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [cardH, setCardH] = useState(240)

  /* ONE filter for every layer, sold included. */
  const isOn = useCallback(
    (d: AtlasDot) => !offTypes.has(d.t) && (atCeiling || d.p == null || d.p <= maxPrice),
    [offTypes, atCeiling, maxPrice],
  )

  const counts = useMemo(() => {
    let forSale = 0
    let pending = 0
    let sold = 0
    const listed: number[] = []
    let closed = 0
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
  }, [dots, isOn])
  /* Dots the frame does not hold: counted in every figure, named in the
     source line, never silently missing. */
  const beyond = useMemo(() => {
    let n = 0
    let on = 0
    for (const d of dots) {
      if (!isOn(d)) continue
      // Heat-only closes are the wash, not a figure, so they do not belong
      // in "counted in every figure, not drawn."
      if (d.s === 'sold' && !isAtlasPulseSold(d)) continue
      on += 1
      const [x, y] = proj.toXY(d.lng, d.lat)
      if (x < 0 || y < 0 || x > proj.width || y > proj.height) n += 1
    }
    return { n, on }
  }, [dots, proj, isOn])

  /* A record map: every dot is a closing, none is for sale. Read from the
     whole population, never the filtered counts: an empty price filter must
     not turn a broker's record into a for-sale map (pass three, D1). */
  const closingsMap = useMemo(
    () => dots.some((d) => d.s === 'closed') && !dots.some((d) => d.s === 'active' || d.s === 'pending'),
    [dots],
  )

  const typesOn = useMemo(() => types.filter((t) => !offTypes.has(t.key)), [types, offTypes])
  const allTypesOn = typesOn.length === types.length
  const noun = useCallback(
    (n: number) => (nounProp ? (n === 1 ? nounProp.one : nounProp.many) : nounFor(n, typesOn, types)),
    [nounProp, typesOn, types],
  )
  /* The median is of HOMES unless the reader chose lots or commercial alone:
     a lot's price beside a house's is not one median. */
  const medianScope = useMemo(() => {
    const onKeys = typesOn.map((t) => t.key)
    const residentialOn = onKeys.some((k) => RESIDENTIAL.has(k))
    if (closingsMap) return { keys: new Set(onKeys), label: 'median close' }
    if (residentialOn) return { keys: RESIDENTIAL, label: 'median home price' }
    const onlyLots = onKeys.length > 0 && onKeys.every((k) => k === 'land')
    return { keys: new Set(onKeys), label: onlyLots ? 'median lot price' : 'median price' }
  }, [typesOn, closingsMap])

  /* The smallest shape among a set of ids: the place a reader would name. */
  const areaById = useMemo(() => new Map(shapes.map((s) => [s.id, s.area])), [shapes])
  const smallestOf = useCallback(
    (ids: readonly string[]): string =>
      ids.reduce((best, id) => ((areaById.get(id) ?? Infinity) < (areaById.get(best) ?? Infinity) ? id : best), ids[0]!),
    [areaById],
  )

  /* Per-place figures over the listed dots on screen — the card's numbers. */
  const regionStats = useMemo(() => {
    const acc = new Map<string, { n: number; prices: number[] }>()
    for (const i of counts.listed) {
      const d = dots[i]!
      // On a record map a closing counts in ONE place, the smallest that
      // holds it (places are sorted largest first), so six chips reading 1
      // never sum above a map claiming four (pass three, D4).
      const ids = membership[i] ?? []
      // `membership` walks the unsorted shapes, so the last id was whatever the
      // page listed last — a city, often, which is why the map named Century
      // West where the ledger and the listing's own URL said Broken Top
      // (evaluator round five, TEAM-REBECCA-3). Pick the smallest by area.
      const owners = closingsMap && ids.length > 1 ? [smallestOf(ids)] : ids
      for (const rid of owners) {
        const rec = acc.get(rid) ?? { n: 0, prices: [] }
        rec.n += 1
        if (d.p != null && d.p > 0 && medianScope.keys.has(d.t)) rec.prices.push(d.p)
        acc.set(rid, rec)
      }
    }
    const out = new Map<string, { n: number; median: number | null }>()
    for (const [rid, rec] of acc) out.set(rid, { n: rec.n, median: median(rec.prices) })
    return out
  }, [counts.listed, membership, dots, medianScope, closingsMap, smallestOf])



  /* Every place as a door a thumb can hit: on a phone most silhouettes are
     under 20px, so the chips carry the reach the map cannot (pass five, R2).
     Places with listings first, by count; empty ones after, still doors. */
  /* A record map draws only the places the record touches; an outline with
     nothing in it would open a card reading 0 closings (pass three, D5). */
  const drawnPlaces = useMemo(
    () => (closingsMap ? places.filter((s) => (regionStats.get(s.id)?.n ?? 0) > 0) : places),
    [places, closingsMap, regionStats],
  )
  /* A filter can shrink the drawn set under the tab stop: keep it in range, or
     the map loses its one keyboard entry. */
  useEffect(() => {
    setRoving((r) => (r < drawnPlaces.length ? r : 0))
  }, [drawnPlaces.length])

  /* What the source line may claim: the outlines actually on screen. A record
     map draws a subset, and a frame clips what falls outside it, so counting
     the regions the page handed over overstated it by two to one (evaluator
     round five, TEAM-MATT-2). */
  const drawnCount = towns.length + drawnPlaces.length


  /* What the numbers are filtered to, in the reader's words. A claim that says
     only "under $700K" while three of four types are switched off is counting
     one thing and describing another (evaluator round five, TEAM-MATT-3). */
  const filterPhrase = useMemo(() => {
    if (allTypesOn) return ''
    const on = typesOn.map((t) => t.label.toLowerCase())
    // One type on: the noun already IS that type ("houses"), so naming it here
    // too printed "274 house houses for sale" (round six).
    if (on.length <= 1) return ''
    return `${on.slice(0, -1).join(', ')} and ${on[on.length - 1]!} `
  }, [allTypesOn, typesOn])

  const claim = useMemo(() => {
    if (incomplete) return 'Live counts are unavailable right now. The map shows what could be read.'
    const ceiling = atCeiling ? '' : ` under ${fmtShort(maxPrice)}`
    // "Tap a place" is an instruction only where places are drawn: under a
    // filter that leaves none, it pointed at nothing (TEAM-MATT-4).
    const every = allTypesOn ? ' of every type' : ''
    if (closingsMap) {
      return `${counts.closed.toLocaleString('en-US')} ${filterPhrase}${noun(counts.closed)}${every}${ceiling}.`
    }
    if (counts.forSale <= 0 && counts.pending <= 0 && counts.sold <= 0) {
      return 'Switch a type back on, or slide the price.'
    }
    return `${counts.forSale.toLocaleString('en-US')} ${filterPhrase}${noun(counts.forSale)}${every} for sale${ceiling}.`
  }, [counts, atCeiling, maxPrice, noun, incomplete, filterPhrase, allTypesOn, closingsMap])

  /* The pulses: the newest real events, with slots per kind so closes always
     show; capped so the map breathes and the main thread never notices. */
  const pulses = useMemo(() => {
    const byKind: Record<'new' | 'pending' | 'sold', { i: number; recency: number }[]> = { new: [], pending: [], sold: [] }
    dots.forEach((d, i) => {
      if (!isOn(d)) return
      if (isAtlasPulseSold(d) && d.soldAgo != null) byKind.sold.push({ i, recency: d.soldAgo })
      else if (d.s === 'active' && d.age != null && d.age <= 7) byKind.new.push({ i, recency: d.age })
      else if (d.s === 'pending' && d.age != null && d.age <= 14) byKind.pending.push({ i, recency: d.age })
    })
    const out: { i: number; kind: 'new' | 'pending' | 'sold' }[] = []
    for (const kind of ['new', 'pending', 'sold'] as const) {
      byKind[kind].sort((a, b) => a.recency - b.recency)
      for (const { i } of byKind[kind].slice(0, PULSE_SLOTS[kind])) out.push({ i, kind })
    }
    return out
  }, [dots, isOn])

  /* Sales heat: kernel density of closings in this map's projection. Quiet
     maps, incomplete reads, and a broker's record of closings (the dots ARE
     the subject) draw none. */
  const heat = useMemo(() => {
    if (quiet || incomplete || closingsMap) return { cells: [] as const, n: 0, max: 0 }
    const points: { x: number; y: number }[] = []
    dots.forEach((d, i) => {
      if (!isAtlasHeatClosing(d.s) || !isOn(d)) return
      const p = xy[i]
      if (!p) return
      points.push({ x: p[0], y: p[1] })
    })
    return salesHeatField(points, { width: proj.width, height: proj.height })
  }, [quiet, incomplete, closingsMap, dots, isOn, xy, proj.width, proj.height])

  const active = pinned?.id ?? hover
  const activeShape = active ? paths.find((s) => s.id === active) ?? null : null
  const activeStats = active ? regionStats.get(active) ?? { n: 0, median: null } : null
  const inActivePlace = useCallback(
    (i: number) => Boolean(active && (membership[i] ?? []).includes(active)),
    [active, membership],
  )

  /* Every dot in stage pixels, so the nearest one to a pointer is a scan and
     not a projection per event. */
  const dotPx = useMemo(() => (view ? xy.map(([x, y]) => toPx(x, y)) : []), [xy, toPx, view])

  /* The mark under the pointer. Until now the dots — the data the map is made
     of — answered nothing: they are pointer-transparent so 4,676 of them cost
     no hit testing, and on a frame with no places the whole map was inert
     (evaluator round five, LISTING-NOBOUNDARY-2, LISTING-BEND-7). */
  const [dotHit, setDotHit] = useState<number | null>(null)
  const REACH = 14

  const nearestDot = useCallback(
    (wx: number, wy: number, reach: number): number | null => {
      if (dotPx.length === 0) return null
      let best: number | null = null
      let bestD = reach * reach
      for (let i = 0; i < dotPx.length; i += 1) {
        const d = dots[i]
        if (!d || !isOn(d)) continue
        // Sold closes are the wash, not marks, except on a record map
        // or the home this page is about.
        if (d.s === 'sold' && !closingsMap && d.k !== highlight?.key) continue
        const p = dotPx[i]
        if (!p) continue
        const dx = p[0] - wx
        const dy = p[1] - wy
        const dd = dx * dx + dy * dy
        if (dd < bestD) {
          bestD = dd
          best = i
        }
      }
      return best
    },
    [dotPx, dots, isOn, closingsMap, highlight],
  )

  const pointerOnStage = (e: { clientX: number; clientY: number }) => {
    const el = stageRef.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { px: e.clientX - r.left, py: e.clientY - r.top }
  }

  const zoomBy = useCallback((factor: number) => {
    const el = stageRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setCam((c) => zoomAt(c, r.width / 2, r.height / 2, factor, r.width, r.height))
  }, [])

  const onMove = useCallback(
    (e: React.PointerEvent) => {
      const at = pointerOnStage(e)
      if (!at) return
      ptsRef.current.set(e.pointerId, { x: at.px, y: at.py })
      if (ptsRef.current.size >= 2 && pinchRef.current) {
        const pts = [...ptsRef.current.values()]
        const a = pts[0]
        const b = pts[1]
        if (!a || !b) return
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (!(d > 0) || !(pinchRef.current.d > 0)) return
        const factor = d / pinchRef.current.d
        const midX = (a.x + b.x) / 2
        const midY = (a.y + b.y) / 2
        setCam((c) => zoomAt(c, midX, midY, factor, stageSize.w, stageSize.h))
        pinchRef.current.d = d
        if (dragRef.current) dragRef.current.moved = true
        return
      }
      const drag = dragRef.current
      if (drag && e.buttons) {
        const dx = at.px - drag.x
        const dy = at.py - drag.y
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true
        if (drag.moved) {
          setCam((c) => panBy(c, dx, dy, stageSize.w, stageSize.h))
          drag.x = at.px
          drag.y = at.py
          return
        }
      }
      setPointer({ x: at.px, y: at.py })
      const [wx, wy] = screenToWorld(camRef.current, at.px, at.py)
      setDotHit(nearestDot(wx, wy, REACH / camRef.current.k))
    },
    [nearestDot, stageSize.w, stageSize.h],
  )

  const openPlace = useCallback(
    (shape: PlacedShape) => {
      const at = shape.anchor
        ? toPx(...proj.toXY(shape.anchor[0], shape.anchor[1]))
        : pointer
          ? screenToWorld(camRef.current, pointer.x, pointer.y)
          : ([0, 0] as const)
      setPinned((prev) => (prev?.id === shape.id ? null : { id: shape.id, at: [at[0], at[1]] }))
      setHover(shape.id)
    },
    [pointer, proj, toPx],
  )

  /* Every place as a door a thumb can hit: on a phone most silhouettes are
     under 20px, so the chips carry the reach the map cannot (pass five, R2).
     Places with listings first, by count; empty ones after, still doors. */
  const chipPlaces = useMemo(
    () =>
      incomplete
        ? []
        : places
            .map((s) => ({ shape: s, n: regionStats.get(s.id)?.n ?? 0 }))
            // A record map lists only the places the record touches; a rail
            // of zeros is brokerage chrome on a personal page (C5).
            .filter((r) => !closingsMap || r.n > 0)
            .sort((a, b) => b.n - a.n || a.shape.name.localeCompare(b.shape.name))
            /* A rail, not a list: the fullest places (E5) — but never fewer
               than the map DRAWS.
               The cap was a flat 24 while the homepage draws 27, so the three
               with the fewest listings — Crosswater, Vandevert Ranch, Awbrey
               Glen — were rendered as buttons with no reachable target
               anywhere. They are also three of the four smallest polygons on
               the map (5x11, 5x9, 5x8 at 375), so the chip was the only thumb
               could ever reach them by. Every chip measures 100x44; a drawn
               place without one is a promise the page cannot keep. */
            .slice(0, Math.max(24, drawnPlaces.length)),
    [places, regionStats, incomplete, closingsMap, drawnPlaces.length],
  )

  /* Escape, a click on empty map, or a click outside the stage release a
     pinned card. */
  const dismiss = useCallback(() => {
    setPinned(null)
    setHover(null)
  }, [])
  useEffect(() => {
    if (!pinned) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
    }
    const onDown = (e: PointerEvent) => {
      const stage = stageRef.current
      const target = e.target as Element | null
      if (!stage || !target) return
      if (!stage.contains(target)) {
        dismiss()
        return
      }
      const onPlace = target.closest('.v3-atlas__place, .v3-atlas__town, .v3-atlas__card')
      if (!onPlace) dismiss()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [pinned, dismiss])

  useLayoutEffect(() => {
    const el = cardRef.current
    if (el) setCardH(el.offsetHeight)
  }, [active, pinned, view])

  const toggleType = (key: string) =>
    setOffTypes((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else if (next.size < types.length - 1) next.add(key)
      return next
    })

  /* Choropleth fill step, 0..4, by share of the strongest place. */

  const screenOf = useCallback(
    (lon: number, lat: number): readonly [number, number] => {
      const [x, y] = toPx(...proj.toXY(lon, lat))
      return [x * cam.k + cam.x, y * cam.k + cam.y]
    },
    [toPx, proj, cam.k, cam.x, cam.y],
  )

  const packedLabels = useMemo(() => {
    if (!view) return []
    const candidates: AtlasLabelCandidate[] = []
    if (highlight) {
      const d = dots.find((dot) => dot.k === highlight.key)
      if (d) {
        const [x, y] = screenOf(d.lng, d.lat)
        const text = highlight.label
        candidates.push({ id: 'home', kind: 'home', text, x, y: y - 14, rank: 10_000, ...atlasLabelBox(text, 'home') })
      }
    }
    for (const s of towns) {
      if (!s.anchor || isFrame(s) || s.id === active) continue
      const text = shortPlaceLabel(s.name)
      const [x, y] = screenOf(s.anchor[0], s.anchor[1])
      candidates.push({
        id: s.id,
        kind: 'town',
        text,
        x,
        y: y + 6,
        rank: 1_000 + s.area * 1e6,
        ...atlasLabelBox(text, 'town'),
      })
    }
    if (cam.k > 1.2) {
      for (const s of places) {
        if (!s.anchor || isFrame(s) || s.id === active || !s.bbox) continue
        const [x0, y0] = screenOf(s.bbox.minLon, s.bbox.maxLat)
        const [x1, y1] = screenOf(s.bbox.maxLon, s.bbox.minLat)
        if (Math.min(Math.abs(x1 - x0), Math.abs(y1 - y0)) < 32) continue
        const text = shortPlaceLabel(s.name)
        const [x, y] = screenOf(s.anchor[0], s.anchor[1])
        const n = regionStats.get(s.id)?.n ?? 0
        candidates.push({
          id: `pl-${s.id}`,
          kind: 'place',
          text,
          x,
          y,
          rank: 100 + n * 8 + s.area * 1e6,
          ...atlasLabelBox(text, 'place'),
        })
      }
    }
    if (activeShape?.anchor && !isFrame(activeShape)) {
      const text = shortPlaceLabel(activeShape.name)
      const [x, y] = screenOf(activeShape.anchor[0], activeShape.anchor[1])
      candidates.push({
        id: `on-${activeShape.id}`,
        kind: 'active',
        text,
        x,
        y,
        rank: 9_000,
        ...atlasLabelBox(text, 'active'),
      })
    }
    return packAtlasLabels(candidates, view)
  }, [view, highlight, dots, towns, places, active, activeShape, cam.k, screenOf, isFrame, regionStats])

  const activeHomes = useMemo(() => {
    if (!active || incomplete) return []
    const rows: { href: string; price: string; type: string }[] = []
    for (const i of counts.listed) {
      const d = dots[i]
      if (!d?.href || d.s === 'closed' || d.s === 'sold') continue
      if (!(membership[i] ?? []).includes(active)) continue
      rows.push({
        href: d.href,
        price: d.p != null ? fmtShort(d.p) : 'Price withheld',
        type: types.find((t) => t.key === d.t)?.label ?? 'Listing',
      })
      if (rows.length >= 3) break
    }
    return rows
  }, [active, incomplete, counts.listed, dots, membership, types])

  const cardAnchor = pinned
    ? ([pinned.at[0] * cam.k + cam.x, pinned.at[1] * cam.k + cam.y] as const)
    : pointer
      ? ([pointer.x, pointer.y] as const)
      : activeShape?.anchor
        ? screenOf(activeShape.anchor[0], activeShape.anchor[1])
        : null
  const cardStyle =
    cardAnchor && view
      ? {
          left: Math.min(cardAnchor[0] + 16, Math.max(0, view.w - 270)),
          top: Math.max(0, Math.min(cardAnchor[1] + 16, view.h - cardH - 8)),
        }
      : undefined

  /* The readout for one mark: what it is, what it costs, when it moved. */
  const tip = (() => {
    if (dotHit == null || pinned || hover || !view) return null
    const d = dots[dotHit]
    const p = dotPx[dotHit]
    if (!d || !p) return null
    const state =
      d.s === 'closed' ? 'Closed' : d.s === 'sold' ? 'Sold' : d.s === 'pending' ? 'Pending' : 'For sale'
    const when =
      d.s === 'sold' || d.s === 'closed'
        ? d.soldAgo != null
          ? d.soldAgo === 0
            ? 'today'
            : `${d.soldAgo} ${d.soldAgo === 1 ? 'day' : 'days'} ago`
          : null
        : d.age != null && d.age <= 14
          ? d.age === 0
            ? 'listed today'
            : `listed ${d.age} ${d.age === 1 ? 'day' : 'days'} ago`
          : null
    const type = types.find((t) => t.key === d.t)?.label
    const sx = p[0] * cam.k + cam.x
    const sy = p[1] * cam.k + cam.y
    const body = (
      <>
        <span className="v3-atlas__tip-state">{state}</span>
        {d.p != null ? <span className="v3-atlas__tip-price">{fmtShort(d.p)}</span> : null}
        {type ? <span className="v3-atlas__tip-type">{type}</span> : null}
        {when ? <span className="v3-atlas__tip-type">{when}</span> : null}
      </>
    )
    const style = {
      left: Math.min(Math.max(sx, 8), Math.max(8, view.w - 8)),
      top: Math.max(0, sy - 12),
    }
    return d.href ? (
      <Link href={d.href} className="v3-atlas__tip" style={style}>
        {body}
      </Link>
    ) : (
      <p className="v3-atlas__tip" role="status" style={style}>
        {body}
      </p>
    )
  })()

  const showCard = Boolean(activeShape && activeStats && (pinned || hover))
  const card =
    showCard && activeShape && activeStats ? (
      <div ref={cardRef} className={cn('v3-atlas__card', pinned && 'is-pinned')} role="status" style={cardStyle}>
        <button type="button" className="v3-atlas__card-close" onClick={dismiss} aria-label="Close">
          ×
        </button>
        <p className="v3-atlas__card-kind">{activeShape.kindLabel ?? KIND_LABEL[activeShape.kind]}</p>
        <p className="v3-atlas__card-name">{shortPlaceLabel(activeShape.name)}</p>
        {incomplete ? (
          <p className="v3-atlas__card-label">Counts unavailable right now</p>
        ) : (
          <p className="v3-atlas__card-figures">
            <span className="v3-atlas__card-n">{activeStats.n.toLocaleString('en-US')}</span>
            <span className="v3-atlas__card-label">
              {noun(activeStats.n)}
              {atCeiling ? '' : ` under ${fmtShort(maxPrice)}`}
            </span>
            {activeStats.median != null ? (
              <>
                <span className="v3-atlas__card-n">{fmtShort(activeStats.median)}</span>
                <span className="v3-atlas__card-label">{medianScope.label}</span>
              </>
            ) : null}
          </p>
        )}
        {activeHomes.length > 0 ? (
          <ul className="v3-atlas__card-homes">
            {activeHomes.map((h) => (
              <li key={h.href}>
                {pinned ? (
                  <Link href={h.href} className="v3-atlas__card-home">
                    <span className="v3-atlas__card-home-price">{h.price}</span>
                    <span className="v3-atlas__card-home-type">{h.type}</span>
                  </Link>
                ) : (
                  <span className="v3-atlas__card-home">
                    <span className="v3-atlas__card-home-price">{h.price}</span>
                    <span className="v3-atlas__card-home-type">{h.type}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : null}
        <Link href={activeShape.href} className="v3-atlas__card-door">
          {/* A long plat name is already the card's heading; repeating all 64
              characters here printed it twice, once clipped and once one word
              per line (evaluator round five, LISTING-BEND-3). */}
          {activeShape.name.length > 28
            ? `See this ${(activeShape.kindLabel ?? KIND_LABEL[activeShape.kind]).toLowerCase()}`
            : `See ${activeShape.name}`}
        </Link>
      </div>
    ) : null

  /* The key: one entry per state the map actually draws, with the mark it
     draws it in. A reader matches a dot to a word without guessing. */
  const keyItems = useMemo(() => {
    if (incomplete) return []
    if (closingsMap) {
      return counts.closed > 0
        ? [{ kind: 'closed', label: `${counts.closed.toLocaleString('en-US')} ${noun(counts.closed)}` }]
        : []
    }
    const out: { kind: string; label: string }[] = []
    if (counts.forSale > 0) out.push({ kind: 'active', label: `${counts.forSale.toLocaleString('en-US')} for sale` })
    if (counts.pending > 0) out.push({ kind: 'pending', label: `${counts.pending.toLocaleString('en-US')} pending` })
    return out
  }, [counts, closingsMap, noun, incomplete])

  const dock = (
    <div className="v3-atlas__dock">
      {heat.cells.length > 0 ? (
        <div
          className="v3-atlas__sales-legend"
          role="img"
          aria-label={`Sales heat, fewer sales to more sales, ${atlasHeatWindowLabel(ATLAS_HEAT_WINDOW_DAYS)}.`}
        >
          <span className="v3-atlas__sales-legend-end">fewer sales</span>
          <ol className="v3-atlas__sales-swatches" aria-hidden="true">
            {([1, 2, 3, 4] as const).map((step) => (
              <li key={step} className={`v3-atlas__sales-swatch v3-atlas__sales-swatch--${step}`} />
            ))}
          </ol>
          <span className="v3-atlas__sales-legend-end">more sales</span>
          <p className="v3-atlas__sales-legend-window">{atlasHeatWindowLabel(ATLAS_HEAT_WINDOW_DAYS)}</p>
        </div>
      ) : null}
      {keyItems.length > 0 ? (
        <ul className="v3-atlas__key" aria-label="What the marks mean">
          {keyItems.map((k) => (
            <li key={k.kind} className="v3-atlas__key-item">
              <span className={`v3-atlas__key-mark v3-atlas__key-mark--${k.kind}`} aria-hidden="true" />
              {k.label}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="v3-atlas__types" role="group" aria-label="Property types">
        {types.map((t) => (
          <button
            key={t.key}
            type="button"
            className="v3-atlas__type"
            aria-pressed={!offTypes.has(t.key)}
            onClick={() => toggleType(t.key)}
          >
            <span className={`v3-atlas__type-mark v3-atlas__type-mark--${t.key}`} aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>
      <label className="v3-atlas__scrub">
        <span className="v3-atlas__scrub-label">
          Up to <strong className="v3-atlas__scrub-value">{atCeiling ? 'any price' : fmtShort(maxPrice)}</strong>
        </span>
        <input
          className="v3-atlas__range"
          type="range"
          min={priceScale.min}
          max={priceScale.max}
          step={priceScale.step}
          value={maxPrice}
          onChange={(e) => setMaxPrice(Number(e.target.value))}
          aria-valuetext={atCeiling ? 'Any price' : `Up to ${fmtShort(maxPrice)}`}
        />
      </label>
    </div>
  )

  return (
    <section
      ref={sectionRef}
      id={id}
      className={cn(V3_ROOT_CLASS, 'v3-atlas', wide && 'is-wide', fitsPhone && 'is-fits', !inView && 'is-offscreen', className)}
      aria-labelledby={`${uid}-h`}
    >
      <div className="v3-atlas__grid">
        {/* The head: the H1 and the claim. On a phone the map follows at once. */}
        <div className="v3-atlas__head">
          <Heading
            id={`${uid}-h`}
            className={cn(
              'v3-atlas__headline',
              headingLevel === 1 && 'v3-atlas__headline--h1',
            )}
          >
            {headline}
          </Heading>
          {quiet ? null : (
            <p className="v3-atlas__claim" aria-live="polite">
              {claim}
            </p>
          )}
        </div>

        <div className="v3-atlas__body">
          <div className="v3-atlas__frame">
            <div className="v3-atlas__zoom" role="group" aria-label="Map zoom">
              <button
                type="button"
                className="v3-atlas__zoom-btn"
                aria-label="Zoom in"
                disabled={cam.k >= ATLAS_K_MAX - 1e-6}
                onClick={() => zoomBy(1.18)}
              >
                +
              </button>
              <button
                type="button"
                className="v3-atlas__zoom-btn"
                aria-label="Zoom out"
                disabled={cam.k <= ATLAS_K_MIN + 1e-6}
                onClick={() => zoomBy(1 / 1.18)}
              >
                −
              </button>
            </div>
            <div
              ref={stageRef}
              className="v3-atlas__stage"
              /* The box IS the painting: with only a height clamp, a portrait
                 frame painted 71% of a full-width box and left the rest tinted
                 cream (evaluator round five, LISTING-NOBOUNDARY-4). */
              style={{
                aspectRatio: `${proj.width} / ${proj.height}`,
                ['--atlas-aspect' as string]: `${(proj.width / proj.height).toFixed(4)}`,
              }}
              onPointerMove={onMove}
              /* Drag pans. A tap that did not move opens the listing under
                 the mark, or the place. Wheel zoom is bound in an effect so
                 it can preventDefault. */
              onPointerDown={(e) => {
                if (e.button !== 0) return
                const at = pointerOnStage(e)
                if (!at) return
                ptsRef.current.set(e.pointerId, { x: at.px, y: at.py })
                e.currentTarget.setPointerCapture(e.pointerId)
                if (ptsRef.current.size >= 2) {
                  const pts = [...ptsRef.current.values()]
                  const a = pts[0]
                  const b = pts[1]
                  pinchRef.current = a && b ? { d: Math.hypot(a.x - b.x, a.y - b.y) } : null
                  dragRef.current = { x: at.px, y: at.py, moved: true }
                  return
                }
                dragRef.current = { x: at.px, y: at.py, moved: false }
                const [wx, wy] = screenToWorld(camRef.current, at.px, at.py)
                setPointer({ x: at.px, y: at.py })
                setDotHit(nearestDot(wx, wy, REACH / camRef.current.k))
              }}
              onPointerUp={(e) => {
                ptsRef.current.delete(e.pointerId)
                if (ptsRef.current.size < 2) pinchRef.current = null
                const drag = dragRef.current
                dragRef.current = ptsRef.current.size > 0 ? drag : null
                if (drag?.moved) return
                const at = pointerOnStage(e)
                if (!at) return
                const [wx, wy] = screenToWorld(camRef.current, at.px, at.py)
                const hit = nearestDot(wx, wy, REACH / camRef.current.k)
                const d = hit != null ? dots[hit] : null
                if (d?.href) {
                  router.push(d.href)
                }
              }}
              onPointerLeave={(e) => {
                if (dragRef.current) return
                if (e.pointerType !== 'mouse') return
                setHover(null)
                setPointer(null)
                setDotHit(null)
              }}
            >
              <div
                className="v3-atlas__world"
                style={{
                  transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.k})`,
                  transformOrigin: '0 0',
                }}
              >
              <svg
                className="v3-atlas__svg"
                viewBox={`0 0 ${proj.width} ${proj.height}`}
                preserveAspectRatio="xMidYMid meet"
                role="img"
                aria-label={
                  /* The map's name counts every mark it draws. It used to name
                     the for-sale figure alone over a map holding three
                     (evaluator round five, LISTING-BEND-11). */
                  /* The held home is the one thing a listing page's map adds
                     over the neighborhood's own, and the label naming it is
                     aria-hidden, so the map's own name carries it (evaluator
                     round five, LISTING-BEND-4). */
                  incomplete
                    ? 'Map of listings'
                    : `Map. ${claim}${highlight && dots.some((d) => d.k === highlight.key) ? ` ${highlight.label} is marked.` : ''}`
                }
              >
                {/* 0. The basemap: the highway skeleton, the named rivers and
                    the lakes, drawn in the register under everything so a
                    reader can place a dot without a foreign tile layer. */}
                {basemapPaths ? (
                  <g className="v3-atlas__basemap" aria-hidden="true">
                    {basemapPaths.bodies.map((p, i) => (
                      <path key={`w-${i}`} d={p.d} className={`v3-atlas__water v3-atlas__water--${p.cls}`}>
                        {p.name ? <title>{p.name}</title> : null}
                      </path>
                    ))}
                    {basemapPaths.waterways.map((p, i) => (
                      <path key={`s-${i}`} d={p.d} className={`v3-atlas__stream v3-atlas__stream--${p.cls}`}>
                        {p.name ? <title>{p.name}</title> : null}
                      </path>
                    ))}
                    {basemapPaths.roads.map((p, i) => (
                      <path key={`r-${i}`} d={p.d} className={`v3-atlas__road v3-atlas__road--${p.cls}`}>
                        {p.name ? <title>{p.name}</title> : null}
                      </path>
                    ))}
                  </g>
                ) : null}
                <g className="v3-atlas__towns">
                  {towns.map((s) => (
                    <path
                      key={s.id}
                      d={s.d}
                      className={cn('v3-atlas__town', active === s.id && 'is-active')}
                      onPointerEnter={() => setHover(s.id)}
                      onClick={(e) => {
                        if (dotHit != null && dots[dotHit]?.href) {
                          e.stopPropagation()
                          return
                        }
                        openPlace(s)
                      }}
                    />
                  ))}
                </g>
                {/* Sales wash: kernel density of closings. Under the inventory
                    marks and the place outlines. Not the old inventory fog. */}
                {heat.cells.length > 0 && cam.k <= 1.35 ? (
                  <g className="v3-atlas__sales-heat" aria-hidden="true">
                    {heat.cells.map((c, i) => (
                      <rect
                        key={`h-${c.x}-${c.y}-${i}`}
                        x={c.x}
                        y={c.y}
                        width={c.size}
                        height={c.size}
                        className={`v3-atlas__sales-cell v3-atlas__sales-cell--${c.step}`}
                      />
                    ))}
                  </g>
                ) : null}
                {/* 2. Dots: inventory, UNDER the places so no outline is
                    ever painted over (pass four, Q1). Sold closes are the
                    wash, not a second mark, except on a record map. */}
                {(
                  <g className="v3-atlas__dots" aria-hidden="true">
                    {dots.map((d, i) => {
                      if (d.s === 'sold' && !closingsMap && d.k !== highlight?.key) return null
                      const [x, y] = xy[i]!
                      return (
                        <path
                          key={d.k}
                          d={`M${x.toFixed(1)} ${y.toFixed(1)}h0`}
                          className={cn(
                            'v3-atlas__dot',
                            `v3-atlas__dot--${d.t}`,
                            d.s === 'pending' && 'v3-atlas__dot--pending',
                            d.s === 'sold' && 'v3-atlas__dot--sold',
                            d.s === 'closed' && 'v3-atlas__dot--closed',
                            highlight && d.k === highlight.key && 'is-home',
                            !isOn(d) && 'is-off',
                            active && !inActivePlace(i) && 'is-away',
                          )}
                        />
                      )
                    })}
                  </g>
                )}
                {/* 3. Hit clones UNDER the places: a wide transparent edge that
                    takes the taps landing in the gaps between fills on a phone.
                    An interior tap reaches the place itself first (R1). */}
                <g className="v3-atlas__hits" aria-hidden="true">
                  {drawnPlaces.map((s, i) => (
                    <use
                      key={`t-${s.id}`}
                      href={`#${uid}-p-${i}`}
                      className="v3-atlas__hit"
                      /* A `use` clones a focusable path, so the clone becomes a
                         tab stop of its own — twenty-seven silent, invisible
                         stops before the keyboard reached a real door
                         (evaluator round five, HOMEPAGE-1). The clones are
                         pointer targets and nothing else. */
                      focusable="false"
                      tabIndex={-1}
                      onPointerEnter={() => setHover(s.id)}
                      onClick={(e) => {
                        if (dotHit != null && dots[dotHit]?.href) {
                          e.stopPropagation()
                          return
                        }
                        openPlace(s)
                      }}
                    />
                  ))}
                </g>
                {/* 4. Halos: the same places cloned in cream, so every outline
                    reads over the field. */}
                <g className="v3-atlas__halos" aria-hidden="true">
                  {drawnPlaces.map((s, i) => (
                    <use key={`h-${s.id}`} href={`#${uid}-p-${i}`} focusable="false" tabIndex={-1} />
                  ))}
                </g>
                {/* 5. Places: the doors, and the one copy of every path. A place
                    with nothing on it stays a door but wears less ink. */}
                <g className="v3-atlas__places" ref={placesRef}>
                  {drawnPlaces.map((s, i) => (
                    <path
                      key={s.id}
                      id={`${uid}-p-${i}`}
                      d={s.d}
                      className={cn(
                        'v3-atlas__place',
                        `v3-atlas__place--${s.kind}`,
                        (regionStats.get(s.id)?.n ?? 0) === 0 && 'is-empty',
                        active === s.id && 'is-active',
                      )}
                      /* One tab stop for the whole map; arrows walk the places.
                         Twenty-seven stops here plus twenty-four chips below
                         put fifty-one presses between the chrome and the search
                         box (evaluator round five, HOMEPAGE-1). */
                      tabIndex={i === roving ? 0 : -1}
                      role="button"
                      aria-label={s.name}
                      onFocus={() => {
                        setHover(s.id)
                        setRoving(i)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          openPlace(s)
                          return
                        }
                        const step =
                          e.key === 'ArrowRight' || e.key === 'ArrowDown'
                            ? 1
                            : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
                              ? -1
                              : 0
                        if (step === 0 && e.key !== 'Home' && e.key !== 'End') return
                        e.preventDefault()
                        const last = drawnPlaces.length - 1
                        const next =
                          e.key === 'Home' ? 0 : e.key === 'End' ? last : (i + step + drawnPlaces.length) % drawnPlaces.length
                        setRoving(next)
                        placesRef.current?.querySelectorAll<SVGPathElement>('.v3-atlas__place')[next]?.focus()
                      }}
                      onPointerEnter={() => setHover(s.id)}
                      onClick={(e) => {
                        if (dotHit != null && dots[dotHit]?.href) {
                          e.stopPropagation()
                          return
                        }
                        openPlace(s)
                      }}
                    />
                  ))}
                </g>
                {/* Homes in the hovered/pinned place, painted ON TOP of the
                    fill so the inventory that belongs here is the thing you
                    see, not a wash of every other mark. */}
                {active ? (
                  <g className="v3-atlas__dots v3-atlas__dots--here" aria-hidden="true">
                    {dots.map((d, i) => {
                      if (!isOn(d) || !inActivePlace(i)) return null
                      if (d.s === 'sold' && !closingsMap && d.k !== highlight?.key) return null
                      const [x, y] = xy[i]!
                      return (
                        <path
                          key={`here-${d.k}`}
                          d={`M${x.toFixed(1)} ${y.toFixed(1)}h0`}
                          className={cn(
                            'v3-atlas__dot',
                            'is-here',
                            `v3-atlas__dot--${d.t}`,
                            d.s === 'pending' && 'v3-atlas__dot--pending',
                            d.s === 'sold' && 'v3-atlas__dot--sold',
                            d.s === 'closed' && 'v3-atlas__dot--closed',
                            highlight && d.k === highlight.key && 'is-home',
                          )}
                        />
                      )
                    })}
                  </g>
                ) : null}
                {/* 6. Lot lines. The assessor's recorded shape of a parcel:
                    the subject in full ink, its neighbours as hairlines, and
                    a disclaimer beside the map because this is not a survey. */}
                {parcelPaths.length > 0 ? (
                  <g className="v3-atlas__parcels" aria-hidden="true">
                    {parcelPaths.map((p) => (
                      <path
                        key={`lot-${p.id}`}
                        d={p.d}
                        className={cn('v3-atlas__parcel', p.subject && 'is-subject')}
                      >
                        {p.name ? <title>{p.name}</title> : null}
                      </path>
                    ))}
                  </g>
                ) : null}
              </svg>

              {/* Pulses: their own layer, slots per kind, paused off-screen. */}
              <svg
                className="v3-atlas__pulses"
                viewBox={`0 0 ${proj.width} ${proj.height}`}
                preserveAspectRatio="xMidYMid meet"
                aria-hidden="true"
              >
                {pulses.map(({ i, kind }, n) => {
                  const [x, y] = xy[i]!
                  return (
                    <path
                      key={`p-${dots[i]!.k}`}
                      d={`M${x.toFixed(1)} ${y.toFixed(1)}h0`}
                      className={`v3-atlas__pulse v3-atlas__pulse--${kind}`}
                      style={{ animationDelay: `${(n % 13) * 190}ms` }}
                    />
                  )
                })}
              </svg>
              </div>

              {/* Names sit in SCREEN space, outside the camera transform, so
                  zoom does not stack type on itself. Packed so one name
                  occupies a point. */}
              {view && packedLabels.length > 0 ? (
                <div className="v3-atlas__labels" aria-hidden="true">
                  {packedLabels.map((l) => (
                    <span
                      key={l.id}
                      className={cn(
                        'v3-atlas__label',
                        l.kind === 'home' && 'v3-atlas__label--home',
                        l.kind === 'place' && 'v3-atlas__label--place',
                        l.kind === 'active' && 'v3-atlas__label--active',
                      )}
                      style={{ left: l.x, top: l.y }}
                    >
                      {l.text}
                    </span>
                  ))}
                </div>
              ) : null}

              {tip}
            </div>
            {/* The card sits in the frame, not the stage: on a phone it drops
                below the map in flow, because pinned over a 208px stage it
                covered the map it belongs to on 14 of 20 taps (evaluator
                round five, LISTING-BEND-1). */}
            {card}
          </div>

        </div>

        {/* The legend: type toggles and the price scrubber. Under the map on a
            phone; under the head in the desktop column. */}
        {quiet ? null : dock}

        {/* The aside: the live line, the search, the source. */}
        <div className="v3-atlas__aside">
          {events && events.length > 0 ? (
            <ul className="v3-atlas__live" aria-label="Latest activity">
              {events.slice(0, 3).map((e) => (
                <li key={e.key} className={`v3-atlas__live-item v3-atlas__live-item--${e.kind}`}>
                  <Link href={e.href} className="v3-atlas__live-link">
                    {e.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          {children ? <div className="v3-atlas__search">{children}</div> : null}
          {/* Every place as a door, under the search: on a phone because the
              silhouettes are too small to tap, on a desktop because this
              column was otherwise empty beside a map full of unnamed shapes
              (evaluator round five, TEAM-MATT-5). It sits AFTER the search so
              it fills the column rather than pushing the search off screen. */}
          {chipPlaces.length > 0 ? (
            <div className="v3-atlas__chips" role="group" aria-label="Places on this map">
              {chipPlaces.map((r) => (
                <button
                  key={r.shape.id}
                  type="button"
                  className={cn('v3-atlas__chip', active === r.shape.id && 'is-active')}
                  aria-pressed={active === r.shape.id}
                  onPointerEnter={() => {
                    setDotHit(null)
                    setHover(r.shape.id)
                  }}
                  onPointerLeave={() => {
                    if (!pinned) setHover(null)
                  }}
                  onClick={() => openPlace(r.shape)}
                >
                  <span className="v3-atlas__chip-name">{shortPlaceLabel(r.shape.name)}</span>
                  {r.n > 0 ? <span className="v3-atlas__chip-n">{r.n.toLocaleString('en-US')}</span> : null}
                </button>
              ))}
            </div>
          ) : null}
          {source ? (
            <details className="v3-atlas__source">
              <summary className="v3-atlas__source-summary">Source{stamp ? ` · updated ${stamp}` : ''}</summary>
              <p className="v3-atlas__source-body">
                {source}
                {drawnCount > 1
                  ? outlinedOf != null && outlinedOf > drawnCount
                    ? ` The map outlines ${drawnCount} of the ${outlinedOf.toLocaleString('en-US')} places with a recorded boundary here; listings outside an outline are counted and drawn as dots with no outline to tap.`
                    : ` The map outlines the ${drawnCount} places with a recorded boundary; listings outside them are counted and drawn as dots with no outline to tap.`
                  : ''}
                {beyond.n > 0
                  ? ` ${beyond.n} of the ${beyond.on.toLocaleString('en-US')} ${beyond.n === 1 ? 'sits' : 'sit'} beyond the frame's edges: counted in every figure, not drawn.`
                  : ''}
                {incomplete ? ' A read failed on this render, so no count is printed.' : ''}
                {basemapPaths && basemap?.source
                  ? ` Roads, rivers and lakes: ${basemap.source}, drawn in this map's own projection.`
                  : ''}
              </p>
            </details>
          ) : null}
        </div>
      </div>
    </section>
  )
}
