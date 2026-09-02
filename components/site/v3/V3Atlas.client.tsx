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
 * the caller passes. Nothing is estimated.
 *
 * Three compositions behind one prop for the decision sheet; the losers are
 * deleted in the commit that records Matt's pick (TASTE.md variants rule):
 *   dots  — full-bleed map, a point per listing over a soft heat field.
 *   heat  — the heat field alone; places filled by how much is for sale.
 *   split — the dots map beside a live ranked list of places with a bar per
 *           row, hover-synced both ways.
 *
 * SCREEN-SPACE SIZING. The projection is a portrait viewBox that renders at
 * a third of its unit size on a laptop, so every radius, stroke, blur, and
 * label reads the rendered scale (`k` = viewBox units per CSS pixel, from a
 * ResizeObserver) and stays the same size on screen at any viewport. The
 * 2026-09-01 evaluator measured 5px labels and 1.2px dots without it.
 *
 * WEIGHT. The heat field is ONE `<use>` of the dots group behind a blur, not
 * a second set of circles; dots carry no hrefs (they are not doors, places
 * are); pulses are capped to the newest events. The dots group fades in
 * once, as a group.
 *
 * CLIENT BOUNDARY: the scrubber, the toggles, the card, and the scale are
 * visitor state. The SVG renders on the server for the first paint.
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
  /** Type key: house · condo · townhouse · manufactured · land · multi · other. */
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
  /** The page H1 (D11 lock on the homepage). */
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
  /** The newest real events, already formatted, for the live line. */
  events?: readonly AtlasEvent[]
  /** The search control, rendered in the head under the claim. */
  children?: ReactNode
  className?: string
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

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
}
function nounFor(count: number, typesOn: readonly AtlasType[], allTypes: readonly AtlasType[]): string {
  const single = typesOn.length === 1 && typesOn.length !== allTypes.length ? NOUNS[typesOn[0]!.key] : null
  if (single) return count === 1 ? single[0] : single[1]
  return count === 1 ? 'listing' : 'listings'
}

type RegionShape = AtlasRegion & { rings: Ring[]; anchor: readonly [number, number] | null }
type PlacedShape = RegionShape & { d: string }

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
  events,
  children,
  className,
}: V3AtlasProps) {
  const uid = useId()
  const Heading = headingLevel === 1 ? 'h1' : 'h2'
  const dotsId = `${uid}-dots`
  const blurId = `${uid}-blur`

  /* Geometry: rings, label anchors, projection — once per data set. */
  const shapes = useMemo<RegionShape[]>(() => {
    return regions.map((r) => {
      const rings = outerRings(r.geometry)
      const anchor = labelAnchor(rings)
      const b = bboxOfRings(rings)
      // Label under the silhouette's bottom edge so the dense centre stays clean.
      const labelAt = anchor && b ? ([anchor[0], b.minLat] as const) : anchor
      return { ...r, rings, anchor: labelAt }
    })
  }, [regions])

  const proj = useMemo(() => {
    // Frame the basin, not the outliers: the town silhouettes plus the dots'
    // 3rd–97th percentile in each axis. A lone listing an hour into the high
    // desert stays on the map (SVG overflow is visible) without shrinking
    // everything else to make room for it.
    const townRings = shapes.filter((s) => s.kind === 'town').flatMap((s) => s.rings)
    const lons = dots.map((d) => d.lng).sort((a, b) => a - b)
    const lats = dots.map((d) => d.lat).sort((a, b) => a - b)
    const core: Ring =
      lons.length > 0
        ? [
            [quantile(lons, 0.03), quantile(lats, 0.03)],
            [quantile(lons, 0.97), quantile(lats, 0.97)],
          ]
        : []
    const b = bboxOfRings(core.length > 0 ? [...townRings, core] : townRings)
    const padded = padBbox(b ?? { minLon: -121.9, maxLon: -120.9, minLat: 43.6, maxLat: 44.55 }, 0.05)
    return makeProjection(padded, 1000)
  }, [shapes, dots])

  const paths = useMemo<PlacedShape[]>(
    () => shapes.map((s) => ({ ...s, d: ringsToPath(s.rings, proj) })),
    [shapes, proj],
  )
  const towns = useMemo(() => paths.filter((s) => s.kind === 'town'), [paths])
  const places = useMemo(() => paths.filter((s) => s.kind !== 'town'), [paths])

  /* Projected dot positions, once. */
  const xy = useMemo(() => dots.map((d) => proj.toXY(d.lng, d.lat)), [dots, proj])

  /* Membership: which places hold each dot. ~4K dots × ~30 silhouettes of
     ray casts is a few milliseconds, once. */
  const membership = useMemo(
    () =>
      dots.map((d) => {
        const ids: string[] = []
        for (const s of shapes) if (pointInRings(d.lng, d.lat, s.rings)) ids.push(s.id)
        return ids
      }),
    [dots, shapes],
  )

  /* Screen-space scale: viewBox units per CSS pixel of the rendered SVG. */
  const svgRef = useRef<SVGSVGElement>(null)
  const [k, setK] = useState(1)
  useEffect(() => {
    const el = svgRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) setK(Math.max(proj.width / r.width, proj.height / r.height))
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => ro.disconnect()
  }, [proj.width, proj.height])

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
  const [pinned, setPinned] = useState<string | null>(null)
  const [pointer, setPointer] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const frameRef = useRef<HTMLDivElement>(null)

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

  /* Per-place figures over the listed dots on screen — the card's numbers. */
  const regionStats = useMemo(() => {
    const acc = new Map<string, { n: number; prices: number[] }>()
    for (const i of counts.listed) {
      for (const rid of membership[i] ?? []) {
        const rec = acc.get(rid) ?? { n: 0, prices: [] }
        rec.n += 1
        const p = dots[i]!.p
        if (p != null && p > 0) rec.prices.push(p)
        acc.set(rid, rec)
      }
    }
    const out = new Map<string, { n: number; median: number | null }>()
    for (const [rid, rec] of acc) out.set(rid, { n: rec.n, median: median(rec.prices) })
    return out
  }, [counts.listed, membership, dots])

  const maxPlaceCount = useMemo(() => {
    let m = 0
    for (const s of places) m = Math.max(m, regionStats.get(s.id)?.n ?? 0)
    return m
  }, [places, regionStats])

  const typesOn = useMemo(() => types.filter((t) => !offTypes.has(t.key)), [types, offTypes])
  const noun = useCallback((n: number) => nounFor(n, typesOn, types), [typesOn, types])

  const claim = useMemo(() => {
    const ceiling = atCeiling ? '' : ` under ${fmtShort(maxPrice)}`
    const parts = [`${counts.forSale.toLocaleString('en-US')} ${noun(counts.forSale)} for sale${ceiling}`]
    if (counts.pending > 0) parts.push(`${counts.pending.toLocaleString('en-US')} pending`)
    if (counts.sold > 0) parts.push(`${counts.sold.toLocaleString('en-US')} sold in the last 30 days`)
    return `${parts.join(', ')}. Tap a place for its numbers, or slide the price.`
  }, [counts, atCeiling, maxPrice, noun])

  /* The pulses: real recent events, newest first, capped so the map breathes
     instead of shimmering — and so 4K animated nodes never hit the main thread. */
  const pulses = useMemo(() => {
    const out: { i: number; kind: 'new' | 'pending' | 'sold'; recency: number }[] = []
    dots.forEach((d, i) => {
      if (!isOn(d)) return
      if (d.s === 'sold' && d.soldAgo != null && d.soldAgo <= 30) out.push({ i, kind: 'sold', recency: d.soldAgo })
      else if (d.s === 'active' && d.age != null && d.age <= 7) out.push({ i, kind: 'new', recency: d.age })
      else if (d.s === 'pending' && d.age != null && d.age <= 14) out.push({ i, kind: 'pending', recency: d.age })
    })
    out.sort((a, b) => a.recency - b.recency)
    return out.slice(0, 160)
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

  const active = pinned ?? hover
  const activeShape = active ? paths.find((s) => s.id === active) ?? null : null
  const activeStats = active ? regionStats.get(active) ?? { n: 0, median: null } : null

  const onMove = useCallback((e: React.PointerEvent) => {
    const el = frameRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPointer({ x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height })
  }, [])

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

  const dismiss = () => {
    setPinned(null)
    setHover(null)
  }

  const cardStyle =
    variant !== 'split' && pointer && !pinned
      ? {
          left: Math.min(pointer.x + 16, Math.max(0, pointer.w - 270)),
          top: Math.max(0, Math.min(pointer.y + 16, pointer.h - 330)),
        }
      : undefined

  const card =
    activeShape && activeStats ? (
      <div className="v3-atlas__card" role="status" style={cardStyle}>
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
              <span className="v3-atlas__card-label">median list</span>
            </>
          ) : null}
        </p>
        <Link href={activeShape.href} className="v3-atlas__card-door">
          See {activeShape.name}
        </Link>
      </div>
    ) : null

  const dotR = 2.1 * k
  const labelSize = 12 * k

  return (
    <section
      id={id}
      className={cn(V3_ROOT_CLASS, 'v3-atlas', `v3-atlas--${variant}`, className)}
      aria-labelledby={`${uid}-h`}
    >
      <div className="v3-atlas__grid">
        <div className="v3-atlas__head">
          <Heading id={`${uid}-h`} className="v3-atlas__headline">
            {headline}
          </Heading>
          <p className="v3-atlas__claim" aria-live="polite">
            {claim}
          </p>
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
          {source ? (
            <p className="v3-atlas__source">
              {source}
              {stamp ? ` Updated ${stamp}.` : ''}
            </p>
          ) : null}
          {children ? <div className="v3-atlas__search">{children}</div> : null}
        </div>

        <div className="v3-atlas__body">
          <div
            ref={frameRef}
            className="v3-atlas__frame"
            onPointerMove={onMove}
            onPointerLeave={() => {
              setHover(null)
              setPointer(null)
            }}
          >
            <svg
              ref={svgRef}
              className="v3-atlas__svg"
              viewBox={`0 0 ${proj.width} ${proj.height}`}
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label={`Map of Central Oregon with ${counts.forSale.toLocaleString('en-US')} listings for sale`}
            >
              <defs>
                <filter id={blurId} x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation={(variant === 'heat' ? 7 : 5) * k} />
                </filter>
              </defs>

              {/* 1. Towns: the base map. */}
              <g className="v3-atlas__towns">
                {towns.map((s) => (
                  <path
                    key={s.id}
                    d={s.d}
                    className={cn('v3-atlas__town', active === s.id && 'is-active')}
                    onPointerEnter={() => setHover(s.id)}
                    onClick={() => setPinned((p) => (p === s.id ? null : s.id))}
                  />
                ))}
              </g>

              {/* 2. HEAT: one blurred copy of the dots group plus the month's
                  closes. Under the places, and never a pointer target. */}
              <g className="v3-atlas__heat" filter={`url(#${blurId})`} aria-hidden="true">
                <use href={`#${dotsId}`} className="v3-atlas__heat-use" style={{ strokeWidth: 9 * k }} />
                <g className="v3-atlas__heat-sold">
                  {dots.map((d, i) => {
                    if (d.s !== 'sold' || !isOn(d)) return null
                    const [x, y] = xy[i]!
                    return <circle key={`s-${d.k}`} cx={x.toFixed(1)} cy={y.toFixed(1)} r={5 * k} />
                  })}
                </g>
              </g>

              {/* 3. Places: the doors. */}
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
                    onClick={() => setPinned((p) => (p === s.id ? null : s.id))}
                  />
                ))}
              </g>

              {/* 4. Dots: the listings. Ghosted (not removed) in the heat
                  variant so the heat <use> still has something to blur. */}
              <g className={cn('v3-atlas__crisp', variant === 'heat' && 'v3-atlas__crisp--ghost')} aria-hidden="true">
                <g id={dotsId} className="v3-atlas__dots">
                  {dots.map((d, i) => {
                    if (d.s === 'sold') return null
                    const [x, y] = xy[i]!
                    return (
                      <circle
                        key={d.k}
                        cx={x.toFixed(1)}
                        cy={y.toFixed(1)}
                        r={d.s === 'pending' ? dotR * 1.15 : dotR}
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
              </g>

              {/* 5. ALIVE: the newest real events pulse. */}
              <g className="v3-atlas__pulses" aria-hidden="true">
                {pulses.map(({ i, kind }, n) => {
                  const [x, y] = xy[i]!
                  return (
                    <circle
                      key={`p-${dots[i]!.k}`}
                      cx={x.toFixed(1)}
                      cy={y.toFixed(1)}
                      r={3 * k}
                      className={`v3-atlas__pulse v3-atlas__pulse--${kind}`}
                      style={{ animationDelay: `${(n % 41) * 140}ms` }}
                    />
                  )
                })}
              </g>

              {/* 6. Town labels, in screen space. */}
              <g className="v3-atlas__labels" aria-hidden="true">
                {towns
                  .filter((s) => s.anchor)
                  .map((s) => {
                    const [x, y] = proj.toXY(s.anchor![0], s.anchor![1])
                    return (
                      <text
                        key={s.id}
                        x={x}
                        y={y + labelSize * 1.2}
                        fontSize={labelSize}
                        strokeWidth={4 * k}
                        className="v3-atlas__label"
                      >
                        {s.name}
                      </text>
                    )
                  })}
              </g>
            </svg>

            {variant !== 'split' ? card : null}

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
          </div>

          {variant === 'split' ? (
            <div className="v3-atlas__rail">
              {card}
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
      </div>
    </section>
  )
}
