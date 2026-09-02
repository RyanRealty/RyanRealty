'use client'
/**
 * PATTERN 8: ATLAS. The living map — every listing on the market as a point on
 * Central Oregon, every place as a touchable silhouette, a heat field where
 * homes crowd, pulses on real events, one price scrubber, one row of type
 * toggles, and a card that answers "what is here" on hover or tap. The
 * page's opening, replacing the photo-and-headline Stage.
 *
 * Why it exists (Matt 2026-09-01): "a buyer does not want every home in
 * Central Oregon" — a buyer wants THEIR place, price, and type, and the site's
 * moat is that it knows every one of them. "Look alive like real activity
 * happening." The Atlas lets the reader find their place by looking.
 *
 * Honest by construction (section 0): every number the Atlas prints is a
 * count or a median of the dots on screen — the listings the caller passed,
 * filtered by the visitor's own price and type choices, sold dots included
 * in the same filter. One population, one source, named in the source line
 * the caller passes. A caller whose read came back short says so through
 * `incomplete`, and the claim says so too. Nothing is estimated.
 *
 * Three compositions behind one prop for the decision sheet; the losers are
 * deleted in the commit that records Matt's pick (TASTE.md variants rule):
 *   dots  — a point per listing over a soft heat field.
 *   heat  — the heat field alone, places filled by how much is for sale.
 *   split — the dots map beside a live ranked list of places, hover-synced.
 *
 * LAYERS, and why each is where it is (evaluator passes one and two):
 *   canvas   the heat field — radial kernels, one bitmap, no DOM nodes, no
 *            SVG filter to re-raster. Drawn after hydration; fades in.
 *   svg      silhouettes and the dots. Dots are zero-length stroked paths
 *            with vector-effect: non-scaling-stroke, so their diameter is
 *            screen pixels at any scale and the server-rendered map is the
 *            final map — no hydration flash, no per-resize rewrite.
 *   html     town labels, positioned from the measured view, in real type.
 *   svg      the pulses, alone, on their own layer, capped, and paused by
 *            IntersectionObserver when the section is off-screen: 160 rings
 *            animated inside the main SVG re-rastered the whole map every
 *            frame (20 fps page-wide).
 *   html     the card and the dock. The dock is in flow under the stage, so
 *            it can never cover the basin's south end.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
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
  kind: AtlasRegionKind
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
  /** The caller's read came back short: the claim says the counts run low. */
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
const PULSE_CAP = 40

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

type RegionShape = AtlasRegion & { rings: Ring[]; anchor: readonly [number, number] | null; area: number }
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
      return { ...r, rings, anchor: labelAt, area }
    })
  }, [regions])

  const proj = useMemo(() => {
    // Frame the basin, not the outliers: the base silhouettes plus the dots'
    // 3rd–97th percentile in each axis. A lone listing an hour into the high
    // desert stays on the map (SVG overflow is visible) without shrinking
    // everything else to make room for it.
    const baseRings = shapes.filter((s) => s.kind === 'town').flatMap((s) => s.rings)
    const lons = dots.map((d) => d.lng).sort((a, b) => a - b)
    const lats = dots.map((d) => d.lat).sort((a, b) => a - b)
    const core: Ring =
      lons.length > 0
        ? [
            [quantile(lons, 0.03), quantile(lats, 0.03)],
            [quantile(lons, 0.97), quantile(lats, 0.97)],
          ]
        : []
    const b = bboxOfRings(core.length > 0 ? [...baseRings, core] : baseRings)
    const padded = padBbox(b ?? { minLon: -121.9, maxLon: -120.9, minLat: 43.6, maxLat: 44.55 }, 0.05)
    return makeProjection(padded, 1000)
  }, [shapes, dots])

  const paths = useMemo<PlacedShape[]>(
    () => shapes.map((s) => ({ ...s, d: ringsToPath(s.rings, proj) })),
    [shapes, proj],
  )
  const towns = useMemo(() => paths.filter((s) => s.kind === 'town'), [paths])
  /* Largest first, so a community inside a neighborhood is painted on top
     and takes the pointer (evaluator pass two, N5). */
  const places = useMemo(() => paths.filter((s) => s.kind !== 'town').sort((a, b) => b.area - a.area), [paths])

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

  /* ONE filter for every layer, sold included (section 0: the sold count in
     the claim and the sold glow on the map are the same set). */
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
  const noun = useCallback((n: number) => nounFor(n, typesOn, types), [typesOn, types])
  /* The median is of HOMES unless the reader chose lots or commercial alone:
     a lot's price beside a house's is not one median (pass two, A4). */
  const medianScope = useMemo(() => {
    const onKeys = typesOn.map((t) => t.key)
    const residentialOn = onKeys.some((k) => RESIDENTIAL.has(k))
    return residentialOn ? { keys: RESIDENTIAL, label: onKeys.every((k) => RESIDENTIAL.has(k)) ? 'median list' : 'median home list' } : { keys: new Set(onKeys), label: 'median list' }
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
    const ceiling = atCeiling ? '' : ` under ${fmtShort(maxPrice)}`
    const parts = [`${counts.forSale.toLocaleString('en-US')} ${noun(counts.forSale)} for sale${ceiling}`]
    if (counts.pending > 0) parts.push(`${counts.pending.toLocaleString('en-US')} pending`)
    if (counts.sold > 0) parts.push(`${counts.sold.toLocaleString('en-US')} sold in the last 30 days`)
    const low = incomplete ? ' Some listings could not be read, so these counts run low.' : ''
    return `${parts.join(', ')}.${low} Tap a place for its numbers, or slide the price.`
  }, [counts, atCeiling, maxPrice, noun, incomplete])

  /* The pulses: the newest real events, capped so the map breathes. */
  const pulses = useMemo(() => {
    const out: { i: number; kind: 'new' | 'pending' | 'sold'; recency: number }[] = []
    dots.forEach((d, i) => {
      if (!isOn(d)) return
      if (d.s === 'sold' && d.soldAgo != null && d.soldAgo <= 30) out.push({ i, kind: 'sold', recency: d.soldAgo })
      else if (d.s === 'active' && d.age != null && d.age <= 7) out.push({ i, kind: 'new', recency: d.age })
      else if (d.s === 'pending' && d.age != null && d.age <= 14) out.push({ i, kind: 'pending', recency: d.age })
    })
    out.sort((a, b) => a.recency - b.recency)
    return out.slice(0, PULSE_CAP)
  }, [dots, isOn])

  const ranked = useMemo(
    () =>
      places
        .map((s) => ({ shape: s, n: regionStats.get(s.id)?.n ?? 0, median: regionStats.get(s.id)?.median ?? null }))
        .filter((r) => r.n > 0)
        .sort((a, b) => b.n - a.n)
        .slice(0, 12),
    [places, regionStats],
  )

  /* The heat field, on a canvas: one radial kernel per listing on screen.
     Redrawn when the view or the filter changes; never part of the SVG. */
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
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, view.w, view.h)
    const [r, g, b] = readNavy(stage)
    const heat = variant === 'heat'
    const radius = heat ? 26 : 15
    const paint = (x: number, y: number, alpha: number, rad: number) => {
      const grad = ctx.createRadialGradient(x, y, 0, x, y, rad)
      grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`)
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(x, y, rad, 0, Math.PI * 2)
      ctx.fill()
    }
    dots.forEach((d, i) => {
      if (!isOn(d)) return
      const [x, y] = toPx(xy[i]![0], xy[i]![1])
      if (d.s === 'sold') paint(x, y, heat ? 0.05 : 0.035, radius * 0.9)
      else paint(x, y, heat ? 0.11 : 0.06, radius)
    })
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

  /* Escape and an outside click release a pinned card. */
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
      const el = sectionRef.current
      if (el && !el.contains(e.target as Node)) dismiss()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [pinned, dismiss])

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

  const cardInStage = variant !== 'split'
  const cardAnchor = pinned ? pinned.at : pointer ? ([pointer.x, pointer.y] as const) : null
  const cardStyle =
    cardInStage && cardAnchor && view
      ? {
          left: Math.min(cardAnchor[0] + 16, Math.max(0, view.w - 270)),
          top: Math.max(0, Math.min(cardAnchor[1] + 16, view.h - 260)),
        }
      : undefined

  const card =
    activeShape && activeStats ? (
      <div className={cn('v3-atlas__card', pinned && 'is-pinned')} role="status" style={cardStyle}>
        <button type="button" className="v3-atlas__card-close" onClick={dismiss} aria-label="Close">
          ×
        </button>
        <p className="v3-atlas__card-kind">
          {activeShape.kind === 'town' ? 'Town' : activeShape.kind === 'community' ? 'Community' : 'Neighborhood'}
        </p>
        <p className="v3-atlas__card-name">{activeShape.name}</p>
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
        <Link href={activeShape.href} className="v3-atlas__card-door">
          See {activeShape.name}
        </Link>
      </div>
    ) : null

  const railSlot = (
    <div className="v3-atlas__rail-card" aria-live="polite">
      {card ?? <p className="v3-atlas__rail-empty">Hover or tap a place for its numbers.</p>}
    </div>
  )

  const dock = (
    <div className="v3-atlas__dock">
      <div className="v3-atlas__types" role="group" aria-label="Property types">
        {types.map((t) => (
          <button
            key={t.key}
            type="button"
            className="v3-btn v3-btn--ghost v3-atlas__type"
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
      className={cn(V3_ROOT_CLASS, 'v3-atlas', `v3-atlas--${variant}`, !inView && 'is-offscreen', className)}
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
                aria-label={`Map with ${counts.forSale.toLocaleString('en-US')} listings for sale`}
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
                <g className="v3-atlas__places">
                  {places.map((s) => (
                    <path
                      key={s.id}
                      d={s.d}
                      className={cn(
                        'v3-atlas__place',
                        `v3-atlas__place--${s.kind}`,
                        variant === 'heat' && `v3-atlas__place--step-${fillStep(s.id)}`,
                        active === s.id && 'is-active',
                      )}
                      onPointerEnter={() => setHover(s.id)}
                      onClick={() => pin(s)}
                    />
                  ))}
                </g>
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
              </svg>

              {/* Pulses: their own layer, capped, paused off-screen. */}
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
                    .filter((s) => s.anchor)
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

              {cardInStage ? card : null}
            </div>
            {dock}
          </div>

          {variant === 'split' ? (
            <div className="v3-atlas__rail">
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
              {railSlot}
            </div>
          ) : null}
        </div>

        {/* The aside: the live line, the source, the search. Under the map on
            a phone; under the head in the desktop column. */}
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
              <p className="v3-atlas__source-body">{source}</p>
            </details>
          ) : null}
        </div>
      </div>
    </section>
  )
}
