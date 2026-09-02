'use client'
/**
 * PATTERN 8: ATLAS. The living map — every home on the market as a point on
 * Central Oregon, every place as a touchable silhouette, one price scrubber,
 * one row of type toggles, and a card that answers "what is here" on hover
 * or tap. The page's opening, replacing the photo-and-headline Stage.
 *
 * Why it exists (Matt 2026-09-01): "a buyer does not want every home in
 * Central Oregon" — a buyer wants THEIR place, price, and type, and the site's
 * moat is that it knows every one of them. The Atlas lets the reader find
 * their place by looking, not by reading. It is the first section on the
 * site that is data the reader can DO something with (TASTE.md ritual 3).
 *
 * Honest by construction (section 0): every number the Atlas prints is a
 * count or a median of the dots on screen — the active listings the caller
 * passed, already filtered by the visitor's own price and type choices. One
 * population, one source, and the reader can see it. Nothing is estimated.
 *
 * Three compositions behind one prop for the decision sheet; the losers are
 * deleted in the commit that records Matt's pick (TASTE.md variants rule):
 *   dots  — full-bleed map, a point per home over a soft heat field.
 *   heat  — the heat field alone (a navy glow where homes crowd, sales in a
 *           lighter tint), places filled by how much is for sale in them.
 *   split — the dots map beside a live ranked list of places with a bar per
 *           row, hover-synced both ways.
 *
 * CLIENT BOUNDARY: the scrubber, the toggles, and the hover card are visitor
 * state. The SVG itself is plain markup and renders on the server for the
 * first paint; only the interaction hydrates.
 */
import { useCallback, useId, useMemo, useRef, useState, type ReactNode } from 'react'
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
  /** Listing key — the React key and the door. */
  k: string
  lat: number
  lng: number
  /** List price in dollars, null when the feed withheld it. */
  p: number | null
  /** Type key: house · condo · townhouse · land · multi · other. */
  t: string
  href: string
  /** Days since the listing went on market; null when the feed withheld it. */
  age: number | null
  /** active · pending · sold — the dot's own status, for the activity layer. */
  s: 'active' | 'pending' | 'sold'
  /** Days since close for a sold dot; null otherwise. */
  soldAgo?: number | null
  /** The list price has been cut since it went on market. */
  cut?: boolean
}

/** A recent, real event on the map: what pulses. */
export type AtlasEvent = { key: string; kind: 'new' | 'pending' | 'sold' | 'cut'; label: string; href: string }

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
  /** "Updated Sep 1, 8:40 PM" — the dots' own stamp, already formatted. */
  stamp?: string
  /** The newest real events, already formatted, for the live line. */
  events?: readonly AtlasEvent[]
  /** The search control, rendered in the head beside the claim. */
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

type RegionShape = AtlasRegion & { rings: Ring[]; d: string; anchor: readonly [number, number] | null }

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
  stamp,
  events,
  children,
  className,
}: V3AtlasProps) {
  const uid = useId()
  const Heading = headingLevel === 1 ? 'h1' : 'h2'

  /* Geometry: rings, bbox, projection — once per data set. */
  const shapes = useMemo<RegionShape[]>(() => {
    return regions.map((r) => {
      const rings = outerRings(r.geometry)
      const anchor = labelAnchor(rings)
      const b = bboxOfRings(rings)
      // Label under the silhouette's bottom edge so the dense centre stays clean.
      const labelAt = anchor && b ? ([anchor[0], b.minLat] as const) : anchor
      return { ...r, rings, d: '', anchor: labelAt }
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

  const paths = useMemo(
    () => shapes.map((s) => ({ ...s, d: ringsToPath(s.rings, proj) })),
    [shapes, proj],
  )

  /* Membership: which regions hold each dot. Computed once; ~1.7K dots × ~40
     silhouettes of ray casts is a few milliseconds. */
  const membership = useMemo(() => {
    return dots.map((d) => {
      const ids: string[] = []
      for (const s of shapes) if (pointInRings(d.lng, d.lat, s.rings)) ids.push(s.id)
      return ids
    })
  }, [dots, shapes])

  /* Price scale: the scrubber runs from the 5th to the 95th percentile of the
     dots' own prices, rounded outward to a clean step. */
  const priceScale = useMemo(() => {
    const sorted = dots.flatMap((d) => (d.p != null && d.p > 0 ? [d.p] : [])).sort((a, b) => a - b)
    const lo = Math.floor(quantile(sorted, 0.05) / 50_000) * 50_000
    const hi = Math.ceil(quantile(sorted, 0.95) / 100_000) * 100_000
    return { min: Math.max(lo, 50_000), max: Math.max(hi, lo + 100_000), step: 25_000 }
  }, [dots])

  /* Visitor state. */
  const [maxPriceRaw, setMaxPriceRaw] = useState<number | null>(null)
  const maxPrice = maxPriceRaw ?? priceScale.max
  const setMaxPrice = (v: number) => setMaxPriceRaw(v >= priceScale.max ? null : v)
  const [offTypes, setOffTypes] = useState<ReadonlySet<string>>(() => new Set())
  const [hover, setHover] = useState<string | null>(null)
  const [pinned, setPinned] = useState<string | null>(null)
  /* Pointer position inside the frame plus the frame's width, captured in the
     move handler so render never reads the ref (react-hooks/refs). */
  const [pointer, setPointer] = useState<{ x: number; y: number; w: number } | null>(null)
  const frameRef = useRef<HTMLDivElement>(null)

  const atCeiling = maxPrice >= priceScale.max
  const visible = useMemo(() => {
    const out: number[] = []
    dots.forEach((d, i) => {
      if (d.s === 'sold') return
      if (offTypes.has(d.t)) return
      if (!atCeiling && d.p != null && d.p > maxPrice) return
      out.push(i)
    })
    return out
  }, [dots, offTypes, maxPrice, atCeiling])

  /* Per-region figures over the VISIBLE dots — the numbers the card prints. */
  const regionStats = useMemo(() => {
    const counts = new Map<string, { n: number; prices: number[] }>()
    for (const i of visible) {
      for (const rid of membership[i] ?? []) {
        const rec = counts.get(rid) ?? { n: 0, prices: [] }
        rec.n += 1
        const p = dots[i]!.p
        if (p != null && p > 0) rec.prices.push(p)
        counts.set(rid, rec)
      }
    }
    const out = new Map<string, { n: number; median: number | null }>()
    for (const [rid, rec] of counts) out.set(rid, { n: rec.n, median: median(rec.prices) })
    return out
  }, [visible, membership, dots])

  const maxRegionCount = useMemo(() => {
    let m = 0
    for (const s of paths) if (s.kind !== 'town') m = Math.max(m, regionStats.get(s.id)?.n ?? 0)
    return m
  }, [paths, regionStats])

  const active = pinned ?? hover
  const activeShape = active ? paths.find((s) => s.id === active) ?? null : null
  const activeStats = active ? regionStats.get(active) ?? { n: 0, median: null } : null

  const claim = useMemo(() => {
    let forSale = 0
    let pending = 0
    for (const i of visible) {
      if (dots[i]!.s === 'pending') pending += 1
      else forSale += 1
    }
    let sold = 0
    for (const d of dots) if (d.s === 'sold' && !offTypes.has(d.t) && (atCeiling || d.p == null || d.p <= maxPrice)) sold += 1
    const ceiling = atCeiling ? '' : ` under ${fmtShort(maxPrice)}`
    const typesOn = types.filter((t) => !offTypes.has(t.key))
    const typeWord =
      typesOn.length === types.length
        ? ''
        : typesOn.length === 1
          ? ` ${typesOn[0]!.label.toLowerCase()}s`
          : ' of the types you picked'
    const parts = [`${forSale.toLocaleString('en-US')}${typeWord} for sale${ceiling}`]
    if (pending > 0) parts.push(`${pending.toLocaleString('en-US')} pending`)
    if (sold > 0) parts.push(`${sold.toLocaleString('en-US')} sold in the last 30 days`)
    return `${parts.join(', ')}. Tap a place for its numbers, or slide the price.`
  }, [visible, dots, atCeiling, maxPrice, types, offTypes])

  const onMove = useCallback((e: React.PointerEvent) => {
    const el = frameRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPointer({ x: e.clientX - r.left, y: e.clientY - r.top, w: r.width })
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
    if (maxRegionCount === 0) return 0
    const n = regionStats.get(rid)?.n ?? 0
    if (n === 0) return 0
    return Math.min(4, 1 + Math.floor((n / maxRegionCount) * 3.999))
  }

  const ranked = useMemo(() => {
    return paths
      .filter((s) => s.kind !== 'town')
      .map((s) => ({ shape: s, n: regionStats.get(s.id)?.n ?? 0, median: regionStats.get(s.id)?.median ?? null }))
      .filter((r) => r.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, 12)
  }, [paths, regionStats])

  const listId = `${uid}-list`
  const cardId = `${uid}-card`

  const card =
    activeShape && activeStats ? (
      <div
        id={cardId}
        className="v3-atlas__card"
        role="status"
        style={
          variant !== 'split' && pointer && !pinned
            ? { left: Math.min(pointer.x + 16, Math.max(0, pointer.w - 260)), top: pointer.y + 16 }
            : undefined
        }
      >
        <p className="v3-atlas__card-kind">{activeShape.kind === 'town' ? 'Town' : activeShape.kind === 'community' ? 'Community' : 'Neighborhood'}</p>
        <p className="v3-atlas__card-name">{activeShape.name}</p>
        <p className="v3-atlas__card-figures">
          <span className="v3-atlas__card-n">{activeStats.n.toLocaleString('en-US')}</span>
          <span className="v3-atlas__card-label">{activeStats.n === 1 ? 'home' : 'homes'}{atCeiling ? '' : ` under ${fmtShort(maxPrice)}`}</span>
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
          {stamp ? <span className="v3-atlas__stamp"> {stamp}.</span> : null}
        </p>
        {events && events.length > 0 ? (
          <ul className="v3-atlas__live" aria-label="Latest activity">
            {events.slice(0, 3).map((e) => (
              <li key={e.key} className={`v3-atlas__live-item v3-atlas__live-item--${e.kind}`}>
                <Link href={e.href} className="v3-atlas__live-link">{e.label}</Link>
              </li>
            ))}
          </ul>
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
            className="v3-atlas__svg"
            viewBox={`0 0 ${proj.width} ${proj.height}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={`Map of Central Oregon with ${visible.length.toLocaleString('en-US')} homes for sale`}
          >
            <g className="v3-atlas__towns">
              {paths
                .filter((s) => s.kind === 'town')
                .map((s) => (
                  <path
                    key={s.id}
                    d={s.d}
                    className={cn('v3-atlas__town', active === s.id && 'is-active')}
                    onPointerEnter={() => setHover(s.id)}
                    onClick={() => setPinned((p) => (p === s.id ? null : s.id))}
                  />
                ))}
            </g>
            <g className="v3-atlas__places">
              {paths
                .filter((s) => s.kind !== 'town')
                .map((s) => (
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
            {/* HEAT: the same points, blurred and stacked at alpha, so where
                homes crowd the map glows darker. One hue, light to dark. */}
            <defs>
              <filter id={`${uid}-heat`} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation={variant === 'heat' ? 9 : 6} />
              </filter>
            </defs>
            <g className="v3-atlas__heat" filter={`url(#${uid}-heat)`} aria-hidden="true">
              {dots.map((d) => {
                const on = d.s === 'sold' ? true : !offTypes.has(d.t) && (atCeiling || d.p == null || d.p <= maxPrice)
                if (!on) return null
                const [x, y] = proj.toXY(d.lng, d.lat)
                return (
                  <circle
                    key={`h-${d.k}`}
                    cx={x.toFixed(1)}
                    cy={y.toFixed(1)}
                    r={variant === 'heat' ? 9 : 6}
                    className={cn('v3-atlas__heat-dot', d.s === 'sold' && 'v3-atlas__heat-dot--sold')}
                  />
                )
              })}
            </g>
            {variant !== 'heat' ? (
              <g className="v3-atlas__dots">
                {dots.map((d, i) => {
                  if (d.s === 'sold') return null
                  const [x, y] = proj.toXY(d.lng, d.lat)
                  const on = !offTypes.has(d.t) && (atCeiling || d.p == null || d.p <= maxPrice)
                  return (
                    <circle
                      key={d.k}
                      cx={x.toFixed(1)}
                      cy={y.toFixed(1)}
                      r={d.s === 'pending' ? 2.2 : 1.8}
                      className={cn(
                        'v3-atlas__dot',
                        `v3-atlas__dot--${d.t}`,
                        d.s === 'pending' && 'v3-atlas__dot--pending',
                        !on && 'is-off',
                      )}
                      style={{ animationDelay: `${(i % 60) * 8}ms` }}
                    />
                  )
                })}
              </g>
            ) : null}
            {/* ALIVE: real recent events pulse — listed this week, gone pending,
                a price cut, a sale closed. Nothing pulses that did not happen. */}
            <g className="v3-atlas__pulses" aria-hidden="true">
              {dots.map((d, i) => {
                const isNew = d.s === 'active' && d.age != null && d.age <= 7
                const isSold = d.s === 'sold' && d.soldAgo != null && d.soldAgo <= 30
                const isPending = d.s === 'pending' && d.age != null && d.age <= 14
                if (!isNew && !isSold && !isPending && !d.cut) return null
                const on = d.s === 'sold' ? true : !offTypes.has(d.t) && (atCeiling || d.p == null || d.p <= maxPrice)
                if (!on) return null
                const [x, y] = proj.toXY(d.lng, d.lat)
                const kind = isSold ? 'sold' : isNew ? 'new' : isPending ? 'pending' : 'cut'
                return (
                  <circle
                    key={`p-${d.k}`}
                    cx={x.toFixed(1)}
                    cy={y.toFixed(1)}
                    r={3}
                    className={`v3-atlas__pulse v3-atlas__pulse--${kind}`}
                    style={{ animationDelay: `${(i % 37) * 160}ms` }}
                  />
                )
              })}
            </g>
            <g className="v3-atlas__labels" aria-hidden="true">
              {paths
                .filter((s) => s.kind === 'town' && s.anchor)
                .map((s) => {
                  const [x, y] = proj.toXY(s.anchor![0], s.anchor![1])
                  return (
                    <text key={s.id} x={x} y={y + 14} className="v3-atlas__label">
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
            <ol id={listId} className="v3-atlas__rank" aria-label="Places with the most homes for sale">
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
                      <span className="v3-atlas__rank-fill" style={{ width: `${Math.max(2, (r.n / (ranked[0]?.n ?? 1)) * 100)}%` }} />
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
