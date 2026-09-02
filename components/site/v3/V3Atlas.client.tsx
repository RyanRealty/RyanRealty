'use client'
/**
 * PATTERN 8: ATLAS. The living map — every listing on the market as a point on
 * Central Oregon, every place as a touchable silhouette, a heat field where
 * homes crowd, pulses on real events, one price scrubber, one row of type
 * toggles, and a card that answers "what is here" on hover or tap. The
 * page's opening, replacing the photo-and-headline Stage; scoped to a
 * boundary, the living map of a city, a neighborhood, a community, a plat.
 *
 * Why it exists (Matt 2026-09-01): "a buyer does not want every home in
 * Central Oregon" — a buyer wants THEIR place, price, and type, and the site's
 * moat is that it knows every one of them. "Look alive like real activity
 * happening." "Heat maps on every page."
 *
 * Honest by construction (section 0): every number the Atlas prints is a
 * count or a median of the dots on screen — the listings the caller passed,
 * filtered by the visitor's own price and type choices, sold dots included
 * in the same filter. One population, one source, named in the source line.
 * A caller whose read came back short says so through `incomplete`, and the
 * Atlas then prints NO counts: a partial count is a wrong number.
 *
 * Three compositions behind one prop for the decision sheet; the losers are
 * deleted in the commit that records Matt's pick (TASTE.md variants rule):
 *   dots  — a point per listing over a soft heat field.
 *   heat  — the heat field alone, places filled by how much is for sale.
 *   split — the dots map beside a live ranked list of places, hover-synced.
 *
 * LAYERS (evaluator passes one to three):
 *   canvas   the heat field — radial kernels, one bitmap, no DOM nodes. The
 *            kernel alpha scales with 1/√N and the whole field is composited
 *            under a ceiling, so 4,000 listings cannot saturate to black
 *            and hide the places drawn over them (pass three, P1).
 *   svg      silhouettes and the dots. Each place is drawn twice: a cream
 *            halo under a navy line, so the outline reads over any field.
 *            Dots are zero-length stroked paths with non-scaling-stroke, so
 *            their diameter is screen pixels at any scale — the server-
 *            rendered map is the final map.
 *   html     town labels, positioned from the measured view, in real type.
 *   svg      the pulses, alone, on their own layer, capped with slots for
 *            each kind of event so a close always shows, paused off-screen.
 *   html     the card and the dock. The dock is a legend in flow — under
 *            the map on a phone, under the head in the desktop column — so
 *            the map keeps its full height.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  bboxOfRings,
  labelAnchor,
  makeProjection,
  outerRings,
  padBbox,
  pointInRings,
  ringsToPath,
  type Ring,
} from '@/lib/geo/project-svg'
import { V3_ROOT_CLASS, type V3Text } from './atoms'
import './tokens.css'
import './V3Atlas.css'

/* -------------------------------------------------------------------------- */
/* Data                                                                        */
/* -------------------------------------------------------------------------- */

export type AtlasDot = {
  /** Listing key — the React key. Dots are not doors; places are. */
  k: string
  lat: number
  lng: number
  /** List price (close price for a sold dot) in dollars; null when withheld. */
  p: number | null
  /** Type key: house · condo · townhouse · manufactured · land · multi · commercial · other. */
  t: string
  /** Days since the listing went on market; null when the feed withheld it. */
  age: number | null
  /** active · pending · sold — the dot's own status, for the activity layer. */
  s: 'active' | 'pending' | 'sold'
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

export type V3AtlasVariant = 'dots' | 'heat' | 'split'

export type V3AtlasProps = {
  id: string
  variant: V3AtlasVariant
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
  children?: ReactNode
  className?: string
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const RESIDENTIAL = new Set(['house', 'condo', 'townhouse', 'manufactured', 'multi'])
/** Pulse slots per event kind, so a month of closes always has living marks. */
const PULSE_SLOTS = { new: 16, pending: 6, sold: 18 } as const
const KIND_LABEL: Record<AtlasRegionKind, string> = { town: 'Town', community: 'Community', neighborhood: 'Neighborhood' }

function fmtShort(usd: number): string {
  if (usd >= 1_000_000) {
    const m = usd / 1_000_000
    return `$${m >= 10 ? m.toFixed(0) : m.toFixed(1).replace(/\.0$/, '')}M`
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

/** Parse the navy token once, for the canvas. Falls back to the brand hex. */
function readNavy(el: Element): [number, number, number] {
  const raw = getComputedStyle(el).getPropertyValue('--v3-navy').trim()
  const m = /^#([0-9a-f]{6})$/i.exec(raw)
  if (!m) return [16, 39, 66]
  const n = parseInt(m[1]!, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
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
  variant,
  headline,
  headingLevel = 1,
  dots,
  regions,
  types,
  source,
  stamp,
  incomplete,
  events,
  children,
  className,
}: V3AtlasProps) {
  const uid = useId()
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
    // Frame the basin, not the outliers: the base silhouettes plus the dots'
    // 1st–99th percentile in each axis. A lone listing an hour into the high
    // desert stays counted (the source says so) without shrinking the map.
    const baseRings = shapes.filter((s) => s.kind === 'town').flatMap((s) => s.rings)
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
  }, [shapes, dots])

  const paths = useMemo<PlacedShape[]>(
    () => shapes.map((s) => ({ ...s, d: ringsToPath(s.rings, proj) })),
    [shapes, proj],
  )
  const towns = useMemo(() => paths.filter((s) => s.kind === 'town'), [paths])
  /* Largest first, so a community inside a neighborhood is painted on top
     and takes the pointer. */
  const places = useMemo(() => paths.filter((s) => s.kind !== 'town').sort((a, b) => b.area - a.area), [paths])
  /* A town whose silhouette spans most of the frame IS the frame (a scoped
     page's own place): the headline names it, so its label would only clip
     at the edge (pass five). */
  const isFrame = useCallback(
    (s: RegionShape) => {
      if (!s.bbox) return false
      const [x0, y0] = proj.toXY(s.bbox.minLon, s.bbox.maxLat)
      const [x1, y1] = proj.toXY(s.bbox.maxLon, s.bbox.minLat)
      return Math.abs(x1 - x0) / proj.width > 0.8 || Math.abs(y1 - y0) / proj.height > 0.8
    },
    [proj],
  )
  const wide = proj.width / proj.height > 1.35

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
    dots.forEach((d, i) => {
      if (!isOn(d)) return
      if (d.s === 'sold') sold += 1
      else {
        listed.push(i)
        if (d.s === 'pending') pending += 1
        else forSale += 1
      }
    })
    return { forSale, pending, sold, listed }
  }, [dots, isOn])

  const typesOn = useMemo(() => types.filter((t) => !offTypes.has(t.key)), [types, offTypes])
  const allTypesOn = typesOn.length === types.length
  const noun = useCallback((n: number) => nounFor(n, typesOn, types), [typesOn, types])
  /* The median is of HOMES unless the reader chose lots or commercial alone:
     a lot's price beside a house's is not one median. */
  const medianScope = useMemo(() => {
    const onKeys = typesOn.map((t) => t.key)
    const residentialOn = onKeys.some((k) => RESIDENTIAL.has(k))
    if (residentialOn) return { keys: RESIDENTIAL, label: 'median home price' }
    const onlyLots = onKeys.length > 0 && onKeys.every((k) => k === 'land')
    return { keys: new Set(onKeys), label: onlyLots ? 'median lot price' : 'median price' }
  }, [typesOn])

  /* Per-place figures over the listed dots on screen — the card's numbers. */
  const regionStats = useMemo(() => {
    const acc = new Map<string, { n: number; prices: number[] }>()
    for (const i of counts.listed) {
      const d = dots[i]!
      for (const rid of membership[i] ?? []) {
        const rec = acc.get(rid) ?? { n: 0, prices: [] }
        rec.n += 1
        if (d.p != null && d.p > 0 && medianScope.keys.has(d.t)) rec.prices.push(d.p)
        acc.set(rid, rec)
      }
    }
    const out = new Map<string, { n: number; median: number | null }>()
    for (const [rid, rec] of acc) out.set(rid, { n: rec.n, median: median(rec.prices) })
    return out
  }, [counts.listed, membership, dots, medianScope])

  const maxPlaceCount = useMemo(() => {
    let m = 0
    for (const s of places) m = Math.max(m, regionStats.get(s.id)?.n ?? 0)
    return m
  }, [places, regionStats])

  const claim = useMemo(() => {
    if (incomplete) return 'Live counts are unavailable right now. The map shows what could be read.'
    const ceiling = atCeiling ? '' : ` under ${fmtShort(maxPrice)}`
    const every = allTypesOn ? ' of every type' : ''
    const parts = [`${counts.forSale.toLocaleString('en-US')} ${noun(counts.forSale)}${every} for sale${ceiling}`]
    if (counts.pending > 0) parts.push(`${counts.pending.toLocaleString('en-US')} pending`)
    if (counts.sold > 0) parts.push(`${counts.sold.toLocaleString('en-US')} sold in the last 30 days`)
    return `${parts.join(', ')}. Tap a place for its numbers, or slide the price.`
  }, [counts, atCeiling, maxPrice, noun, incomplete, allTypesOn])

  /* The pulses: the newest real events, with slots per kind so closes always
     show; capped so the map breathes and the main thread never notices. */
  const pulses = useMemo(() => {
    const byKind: Record<'new' | 'pending' | 'sold', { i: number; recency: number }[]> = { new: [], pending: [], sold: [] }
    dots.forEach((d, i) => {
      if (!isOn(d)) return
      if (d.s === 'sold' && d.soldAgo != null && d.soldAgo <= 30) byKind.sold.push({ i, recency: d.soldAgo })
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

  const ranked = useMemo(
    () =>
      (incomplete ? [] : places)
        .map((s) => ({ shape: s, n: regionStats.get(s.id)?.n ?? 0, median: regionStats.get(s.id)?.median ?? null }))
        .filter((r) => r.n > 0)
        .sort((a, b) => b.n - a.n)
        .slice(0, 10),
    [places, regionStats, incomplete],
  )

  /* The heat field, on a canvas. Kernel alpha scales with 1/√N and the field
     is composited under a ceiling, so density reads as darkness without ever
     hiding the places drawn over it. */
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    const stage = stageRef.current
    if (!canvas || !stage || !view) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(view.w * dpr)
    canvas.height = Math.round(view.h * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const off = document.createElement('canvas')
    off.width = canvas.width
    off.height = canvas.height
    const octx = off.getContext('2d')
    if (!octx) return
    octx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const [r, g, b] = readNavy(stage)
    const heat = variant === 'heat'
    const on = dots.filter((d) => isOn(d)).length
    const base = heat ? 0.9 : 0.55
    const alpha = Math.min(0.12, Math.max(0.012, base / Math.sqrt(Math.max(on, 1))))
    const radius = heat ? 19 : 15
    const paint = (x: number, y: number, a: number, rad: number) => {
      const grad = octx.createRadialGradient(x, y, 0, x, y, rad)
      grad.addColorStop(0, `rgba(${r},${g},${b},${a})`)
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
      octx.fillStyle = grad
      octx.beginPath()
      octx.arc(x, y, rad, 0, Math.PI * 2)
      octx.fill()
    }
    dots.forEach((d, i) => {
      if (!isOn(d)) return
      const [x, y] = toPx(xy[i]![0], xy[i]![1])
      if (d.s === 'sold') paint(x, y, alpha * 0.6, radius * 0.9)
      else paint(x, y, alpha, radius)
    })
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.globalAlpha = heat ? 0.8 : 0.62
    ctx.drawImage(off, 0, 0)
    ctx.globalAlpha = 1
    canvas.dataset.painted = '1'
  }, [dots, xy, isOn, view, variant, toPx])

  const active = pinned?.id ?? hover
  const activeShape = active ? paths.find((s) => s.id === active) ?? null : null
  const activeStats = active ? regionStats.get(active) ?? { n: 0, median: null } : null

  const onMove = useCallback((e: React.PointerEvent) => {
    const el = stageRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPointer({ x: e.clientX - r.left, y: e.clientY - r.top })
  }, [])

  const pin = useCallback(
    (shape: PlacedShape) => {
      setPinned((p) => {
        if (p?.id === shape.id) return null
        const at = pointer ? ([pointer.x, pointer.y] as const) : shape.anchor ? toPx(...proj.toXY(shape.anchor[0], shape.anchor[1])) : ([16, 16] as const)
        return { id: shape.id, at }
      })
    },
    [pointer, toPx, proj],
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
  })

  const toggleType = (key: string) =>
    setOffTypes((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else if (next.size < types.length - 1) next.add(key)
      return next
    })

  /* Choropleth fill step, 0..4, by share of the strongest place. */
  const fillStep = (rid: string) => {
    if (maxPlaceCount === 0) return 0
    const n = regionStats.get(rid)?.n ?? 0
    if (n === 0) return 0
    return Math.min(4, 1 + Math.floor((n / maxPlaceCount) * 3.999))
  }

  const cardAnchor = pinned ? pinned.at : pointer ? ([pointer.x, pointer.y] as const) : null
  const cardStyle =
    cardAnchor && view
      ? {
          left: Math.min(cardAnchor[0] + 16, Math.max(0, view.w - 270)),
          top: Math.max(0, Math.min(cardAnchor[1] + 16, view.h - cardH - 8)),
        }
      : undefined

  const card =
    activeShape && activeStats ? (
      <div ref={cardRef} className={cn('v3-atlas__card', pinned && 'is-pinned')} role="status" style={cardStyle}>
        <button type="button" className="v3-atlas__card-close" onClick={dismiss} aria-label="Close">
          ×
        </button>
        <p className="v3-atlas__card-kind">{activeShape.kindLabel ?? KIND_LABEL[activeShape.kind]}</p>
        <p className="v3-atlas__card-name">{activeShape.name}</p>
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
        <Link href={activeShape.href} className="v3-atlas__card-door">
          See {activeShape.name}
        </Link>
      </div>
    ) : null

  const dock = (
    <div className="v3-atlas__dock">
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
      className={cn(V3_ROOT_CLASS, 'v3-atlas', `v3-atlas--${variant}`, wide && 'is-wide', !inView && 'is-offscreen', className)}
      aria-labelledby={`${uid}-h`}
    >
      <div className="v3-atlas__grid">
        {/* The head: the H1 and the claim. On a phone the map follows at once. */}
        <div className="v3-atlas__head">
          <Heading id={`${uid}-h`} className="v3-atlas__headline">
            {headline}
          </Heading>
          <p className="v3-atlas__claim" aria-live="polite">
            {claim}
          </p>
        </div>

        <div className="v3-atlas__body">
          <div className="v3-atlas__frame">
            <div
              ref={stageRef}
              className="v3-atlas__stage"
              style={{ aspectRatio: `${proj.width} / ${proj.height}` }}
              onPointerMove={onMove}
              onPointerLeave={() => {
                setHover(null)
                setPointer(null)
              }}
            >
              <canvas ref={canvasRef} className="v3-atlas__heat" aria-hidden="true" />

              <svg
                className="v3-atlas__svg"
                viewBox={`0 0 ${proj.width} ${proj.height}`}
                preserveAspectRatio="xMidYMid meet"
                role="img"
                aria-label={incomplete ? 'Map of listings' : `Map with ${counts.forSale.toLocaleString('en-US')} listings for sale`}
              >
                <g className="v3-atlas__towns">
                  {towns.map((s) => (
                    <path
                      key={s.id}
                      d={s.d}
                      className={cn('v3-atlas__town', active === s.id && 'is-active')}
                      onPointerEnter={() => setHover(s.id)}
                      onClick={() => pin(s)}
                    />
                  ))}
                </g>
                {/* 2. Dots: the listings, UNDER the places so no outline is
                    ever painted over (pass four, Q1). */}
                {variant !== 'heat' ? (
                  <g className="v3-atlas__dots" aria-hidden="true">
                    {dots.map((d, i) => {
                      if (d.s === 'sold') return null
                      const [x, y] = xy[i]!
                      return (
                        <path
                          key={d.k}
                          d={`M${x.toFixed(1)} ${y.toFixed(1)}h0`}
                          className={cn(
                            'v3-atlas__dot',
                            `v3-atlas__dot--${d.t}`,
                            d.s === 'pending' && 'v3-atlas__dot--pending',
                            !isOn(d) && 'is-off',
                          )}
                        />
                      )
                    })}
                  </g>
                ) : null}
                {/* 3. Hit clones UNDER the places: a wide transparent edge that
                    takes the taps landing in the gaps between fills on a phone.
                    An interior tap reaches the place itself first (R1). */}
                <g className="v3-atlas__hits" aria-hidden="true">
                  {places.map((s, i) => (
                    <use
                      key={`t-${s.id}`}
                      href={`#${uid}-p-${i}`}
                      className="v3-atlas__hit"
                      onPointerEnter={() => setHover(s.id)}
                      onClick={() => pin(s)}
                    />
                  ))}
                </g>
                {/* 4. Halos: the same places cloned in cream, so every outline
                    reads over the field. */}
                <g className="v3-atlas__halos" aria-hidden="true">
                  {places.map((s, i) => (
                    <use key={`h-${s.id}`} href={`#${uid}-p-${i}`} />
                  ))}
                </g>
                {/* 5. Places: the doors, and the one copy of every path. A place
                    with nothing on it stays a door but wears less ink. */}
                <g className="v3-atlas__places">
                  {places.map((s, i) => (
                    <path
                      key={s.id}
                      id={`${uid}-p-${i}`}
                      d={s.d}
                      className={cn(
                        'v3-atlas__place',
                        `v3-atlas__place--${s.kind}`,
                        variant === 'heat' && `v3-atlas__place--step-${fillStep(s.id)}`,
                        (regionStats.get(s.id)?.n ?? 0) === 0 && 'is-empty',
                        active === s.id && 'is-active',
                      )}
                      onPointerEnter={() => setHover(s.id)}
                      onClick={() => pin(s)}
                    />
                  ))}
                </g>
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

              {/* Town labels in real type, placed from the measured view. */}
              {view ? (
                <div className="v3-atlas__labels" aria-hidden="true">
                  {towns
                    .filter((s) => s.anchor && !isFrame(s))
                    .map((s) => {
                      const [x, y] = toPx(...proj.toXY(s.anchor![0], s.anchor![1]))
                      return (
                        <span key={s.id} className="v3-atlas__label" style={{ left: x, top: y + 6 }}>
                          {s.name}
                        </span>
                      )
                    })}
                </div>
              ) : null}

              {card}
            </div>
          </div>

          {variant === 'split' ? (
            <div className="v3-atlas__rail">
              <div className="v3-atlas__rail-card" aria-live="polite">
                {card ?? <p className="v3-atlas__rail-empty">Hover or tap a place for its numbers.</p>}
              </div>
              <ol className="v3-atlas__rank" aria-label="Places with the most for sale">
                {ranked.map((r) => (
                  <li key={r.shape.id} className={cn('v3-atlas__rank-row', active === r.shape.id && 'is-active')}>
                    <Link
                      href={r.shape.href}
                      className="v3-atlas__rank-link"
                      onPointerEnter={() => setHover(r.shape.id)}
                      onFocus={() => setHover(r.shape.id)}
                    >
                      <span className="v3-atlas__rank-name">{r.shape.name}</span>
                      <span className="v3-atlas__rank-bar" aria-hidden="true">
                        <span
                          className="v3-atlas__rank-fill"
                          style={{ width: `${Math.max(2, (r.n / (ranked[0]?.n ?? 1)) * 100)}%` }}
                        />
                      </span>
                      <span className="v3-atlas__rank-n">{r.n.toLocaleString('en-US')}</span>
                      <span className="v3-atlas__rank-median">{r.median != null ? fmtShort(r.median) : ''}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>

        {/* The legend: type toggles and the price scrubber. Under the map on a
            phone; under the head in the desktop column. */}
        {dock}

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
          {source ? (
            <details className="v3-atlas__source">
              <summary className="v3-atlas__source-summary">Source{stamp ? ` · updated ${stamp}` : ''}</summary>
              <p className="v3-atlas__source-body">
                {source}
                {towns.length > 1
                  ? ` The map outlines the ${towns.length} places with a recorded boundary; listings outside them are counted and drawn as dots with no outline to tap.`
                  : ''}
                {incomplete ? ' A read failed on this render, so no count is printed.' : ''}
              </p>
            </details>
          ) : null}
        </div>
      </div>
    </section>
  )
}
