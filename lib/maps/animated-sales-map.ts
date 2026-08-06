/**
 * animated-sales-map — the pure logic behind <AnimatedSalesMap>.
 *
 * Everything here is deterministic and free of `google.maps`, the DOM, and
 * timers, so the ordering contract, the stagger math, the licensing gate, and
 * every degraded case are unit-testable without a browser or an API key.
 *
 * The component (components/geo-page/AnimatedSalesMap.client.tsx) owns only the
 * imperative Maps wiring; every decision that could be silently wrong lives in
 * this file and is covered by animated-sales-map.test.ts.
 *
 * ── ODS §5-4 (compliance, outranks the feature) ───────────────────────────────
 * The IDX license covers ACTIVE display only. Row-level SOLD data (an address,
 * a coordinate, a close price) is VOW-only: registered consumer, broker-consumer
 * relationship, click-through terms, unique login. Public indexable sold pages
 * are prohibited. `salesForAudience` is the chokepoint that makes a public leak
 * impossible by construction — see its doc comment.
 *
 * ── CLAUDE.md §0 (data accuracy) ─────────────────────────────────────────────
 * Nothing here invents a coordinate, a price, or a boundary. Rows that are
 * missing any of those are DROPPED, never estimated, jittered, or filled in.
 * `resampleRing` thins an authoritative ring for draw performance and only ever
 * removes real vertices — it never adds an interpolated one to the stored shape.
 */

// ─── types ────────────────────────────────────────────────────────────────────

/** Minimal lat/lng pair. Structurally compatible with google.maps.LatLngLiteral. */
export type LatLngPoint = { lat: number; lng: number }

/** A closed sale as handed to the component. Every field is allowed to be junk. */
export type AnimatedSale = {
  /** Stable identity (ListingKey). Used for dedupe and React keys. */
  id: string
  lat: number | null | undefined
  lng: number | null | undefined
  /** ClosePrice. */
  price: number | null | undefined
  /** CloseDate, ISO-8601. */
  closedAt: string | null | undefined
  /** Optional, VOW-only. Never rendered in the public audience. */
  address?: string | null
}

/** A sale that passed every guard and is safe to draw. */
export type NormalizedSale = {
  id: string
  lat: number
  lng: number
  price: number
  closedAt: string
  closedAtMs: number
  /** Pill text, e.g. "$795k". */
  label: string
  address: string | null
}

/**
 * Who is looking at the map. No default anywhere — the caller must state it.
 */
export type SalesMapAudience = 'vow' | 'public'

export type StaggerPlan = {
  count: number
  /** Gap between two consecutive markers starting their pop, in ms. */
  perMarkerDelayMs: number
  /** How long one marker takes to scale from small to full, in ms. */
  markerDurationMs: number
  /** Wall-clock length of the whole run, in ms: last delay + one duration. */
  totalRunMs: number
}

// ─── tuning constants ─────────────────────────────────────────────────────────

/** Matt's brief: the full run reads as roughly 3 to 5 seconds regardless of count. */
export const DEFAULT_MIN_RUN_MS = 3000
export const DEFAULT_MAX_RUN_MS = 5000
/** One marker's scale-up. Sits on the §3 motion ladder (200-400ms entrances). */
export const DEFAULT_MARKER_DURATION_MS = 400
/** The gap we would use if the run length were unconstrained. */
const IDEAL_GAP_MS = 55
/**
 * Ceiling on the gap. Without it a 2-sale set would hold the floor and leave a
 * 2.6s dead pause between two pins, which reads as broken rather than paced.
 * Small sets simply finish early; the 3-5s window governs sets big enough to
 * need pacing.
 */
const MAX_GAP_MS = 260

/** Concurrency cap. More pills than this is mush on screen and DOM churn off it. */
export const DEFAULT_MAX_SALES = 150
/**
 * Vertex ceiling per ring while the stroke is being drawn. County plat rings run
 * to thousands of points; regrowing a 5000-point Polyline path every frame is
 * the single biggest jank risk in this component.
 */
export const MAX_RING_POINTS = 400

// ─── licensing gate ───────────────────────────────────────────────────────────

/**
 * ODS §5-4 chokepoint. Fails CLOSED: anything that is not exactly 'vow' gets an
 * empty array, so a missing prop, a typo, or an untyped JS caller cannot publish
 * row-level sold data. The map still draws its boundary — the geography renders,
 * the sales do not.
 */
export function salesForAudience<T>(
  sales: readonly T[] | null | undefined,
  audience: SalesMapAudience | null | undefined,
): readonly T[] {
  if (audience !== 'vow') return []
  return sales ?? []
}

// ─── sale normalization ───────────────────────────────────────────────────────

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** Short pill label. Mirrors lib/maps/markers formatPriceLabel so every map surface agrees. */
export function formatSaleLabel(price: number): string {
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(1)}M`
  if (price >= 1_000) return `$${(price / 1_000).toFixed(0)}k`
  return `$${price}`
}

/**
 * Guard, dedupe, order oldest-first, and cap.
 *
 * Dropped (never repaired): missing/non-finite lat or lng, out-of-range
 * coordinates, the (0,0) null-island sentinel, non-positive or missing price,
 * an unparseable close date. A row we cannot draw truthfully is not drawn.
 *
 * When more sales survive than `maxSales`, the MOST RECENT `maxSales` are kept
 * (they are the current picture) and the kept set stays in oldest-first order.
 */
export function normalizeSales(
  sales: readonly AnimatedSale[] | null | undefined,
  opts: { maxSales?: number } = {},
): NormalizedSale[] {
  const maxSales = Math.max(1, Math.floor(opts.maxSales ?? DEFAULT_MAX_SALES))
  if (!Array.isArray(sales) || sales.length === 0) return []

  const seen = new Set<string>()
  const out: NormalizedSale[] = []

  for (const s of sales) {
    if (!s || typeof s.id !== 'string' || s.id.length === 0) continue
    if (seen.has(s.id)) continue

    const { lat, lng, price } = s
    if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) continue
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue
    // Null island: a real Supabase landmine, never a Deschutes County home.
    if (lat === 0 && lng === 0) continue
    if (!isFiniteNumber(price) || price <= 0) continue
    if (typeof s.closedAt !== 'string' || s.closedAt.length === 0) continue

    const closedAtMs = Date.parse(s.closedAt)
    if (!Number.isFinite(closedAtMs)) continue

    seen.add(s.id)
    out.push({
      id: s.id,
      lat,
      lng,
      price,
      closedAt: s.closedAt,
      closedAtMs,
      label: formatSaleLabel(price),
      address: typeof s.address === 'string' && s.address.length > 0 ? s.address : null,
    })
  }

  // Oldest first. Tiebreak on id so equal close dates keep a stable order across
  // renders (otherwise the pop sequence reshuffles on every hydration).
  out.sort((a, b) => (a.closedAtMs - b.closedAtMs) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

  return out.length > maxSales ? out.slice(out.length - maxSales) : out
}

// ─── stagger math ─────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/**
 * Spread `count` markers so the run lands in the requested window.
 *
 * count 0 -> a zero-length plan (the caller renders no markers).
 * count 1 -> one pop, no gap; the run is just the marker duration.
 * count n -> gap = (target - duration) / (n - 1), where target is the ideal
 *            pacing clamped into [minRunMs, maxRunMs]; the gap is then capped at
 *            MAX_GAP_MS so tiny sets do not drag.
 *
 * 200 sales therefore compress to a ~23ms gap and still finish inside 5s, which
 * is what keeps concurrent animation work bounded.
 */
export function computeStagger(
  count: number,
  opts: {
    minRunMs?: number
    maxRunMs?: number
    markerDurationMs?: number
  } = {},
): StaggerPlan {
  const markerDurationMs = Math.max(1, opts.markerDurationMs ?? DEFAULT_MARKER_DURATION_MS)
  const minRunMs = Math.max(0, opts.minRunMs ?? DEFAULT_MIN_RUN_MS)
  // A caller passing max < min gets min; the window can never invert.
  const maxRunMs = Math.max(minRunMs, opts.maxRunMs ?? DEFAULT_MAX_RUN_MS)

  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
  if (n === 0) {
    return { count: 0, perMarkerDelayMs: 0, markerDurationMs, totalRunMs: 0 }
  }
  if (n === 1) {
    return { count: 1, perMarkerDelayMs: 0, markerDurationMs, totalRunMs: markerDurationMs }
  }

  const idealTotal = markerDurationMs + (n - 1) * IDEAL_GAP_MS
  const targetTotal = clamp(idealTotal, minRunMs, maxRunMs)
  const rawGap = Math.max(0, targetTotal - markerDurationMs) / (n - 1)
  const perMarkerDelayMs = Math.min(rawGap, MAX_GAP_MS)

  return {
    count: n,
    perMarkerDelayMs,
    markerDurationMs,
    totalRunMs: markerDurationMs + perMarkerDelayMs * (n - 1),
  }
}

/** Start offset for marker `index`, in ms from the first pop. */
export function markerDelayMs(plan: StaggerPlan, index: number): number {
  if (!Number.isFinite(index) || index <= 0) return 0
  return plan.perMarkerDelayMs * Math.floor(index)
}

// ─── boundary geometry ────────────────────────────────────────────────────────

type RingSource = ReadonlyArray<ReadonlyArray<number>>

function ringFromCoords(ring: RingSource): LatLngPoint[] {
  const out: LatLngPoint[] = []
  for (const pair of ring) {
    if (!Array.isArray(pair) || pair.length < 2) continue
    const [lng, lat] = pair
    if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) continue
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue
    out.push({ lat, lng })
  }
  return out
}

/**
 * GeoJSON Polygon / MultiPolygon -> ring arrays, holes preserved.
 *
 * Anything else (a Point, a null, a hand-rolled object, a FeatureCollection)
 * yields []. The component then draws NO boundary rather than an approximation.
 * Rings with fewer than 3 usable vertices are discarded — they are corrupt, not
 * a shape to guess at.
 */
export function boundaryToRings(geometry: unknown): LatLngPoint[][] {
  if (!geometry || typeof geometry !== 'object') return []
  const geo = geometry as { type?: unknown; coordinates?: unknown }

  if (geo.type === 'Polygon' && Array.isArray(geo.coordinates)) {
    return (geo.coordinates as RingSource[])
      .filter(Array.isArray)
      .map(ringFromCoords)
      .filter((r) => r.length >= 3)
  }

  if (geo.type === 'MultiPolygon' && Array.isArray(geo.coordinates)) {
    return (geo.coordinates as RingSource[][])
      .filter(Array.isArray)
      .flatMap((poly) => poly.filter(Array.isArray).map(ringFromCoords))
      .filter((r) => r.length >= 3)
  }

  return []
}

/**
 * Thin a ring to at most `maxPoints` by keeping every Nth ORIGINAL vertex, plus
 * the first and last. No vertex is invented, so the drawn stroke is a subset of
 * the authoritative shape rather than a smoothed approximation of it.
 */
export function resampleRing(ring: readonly LatLngPoint[], maxPoints = MAX_RING_POINTS): LatLngPoint[] {
  const limit = Math.max(3, Math.floor(maxPoints))
  if (ring.length <= limit) return ring.slice()

  const step = (ring.length - 1) / (limit - 1)
  const out: LatLngPoint[] = []
  for (let i = 0; i < limit - 1; i++) {
    out.push(ring[Math.round(i * step)])
  }
  out.push(ring[ring.length - 1])
  return out
}

/**
 * The portion of `ring` visible at draw progress `t` (0..1), with the leading
 * edge interpolated so the stroke grows smoothly instead of stepping vertex to
 * vertex. This interpolation is presentation only — it never reaches the data.
 */
export function ringDrawPath(ring: readonly LatLngPoint[], t: number): LatLngPoint[] {
  if (ring.length === 0) return []
  const p = Number.isFinite(t) ? clamp(t, 0, 1) : 0
  if (p >= 1) return ring.slice()
  if (p <= 0) return []

  const exact = p * (ring.length - 1)
  const idx = Math.floor(exact)
  const frac = exact - idx

  const out = ring.slice(0, idx + 1)
  const next = ring[idx + 1]
  if (next && frac > 0) {
    const cur = ring[idx]
    out.push({
      lat: cur.lat + (next.lat - cur.lat) * frac,
      lng: cur.lng + (next.lng - cur.lng) * frac,
    })
  }
  return out
}

export type BoundsLiteral = { north: number; south: number; east: number; west: number }

/**
 * Bounding box across every boundary vertex and every sale point.
 * Returns null when there is nothing to frame, which is the signal to render
 * nothing at all rather than an empty grey map.
 */
export function computeBoundsLiteral(
  rings: ReadonlyArray<readonly LatLngPoint[]>,
  sales: readonly NormalizedSale[] = [],
): BoundsLiteral | null {
  let north = -Infinity
  let south = Infinity
  let east = -Infinity
  let west = Infinity
  let seen = false

  const visit = (lat: number, lng: number) => {
    seen = true
    if (lat > north) north = lat
    if (lat < south) south = lat
    if (lng > east) east = lng
    if (lng < west) west = lng
  }

  for (const ring of rings) for (const p of ring) visit(p.lat, p.lng)
  for (const s of sales) visit(s.lat, s.lng)

  return seen ? { north, south, east, west } : null
}

/** A bounds covering a single point (or several stacked on one). fitBounds would over-zoom. */
export function isDegenerateBounds(b: BoundsLiteral): boolean {
  return b.north === b.south && b.east === b.west
}

// ─── motion + style helpers ───────────────────────────────────────────────────

/** §3 motion ladder: ease-out entrances. */
export function easeOutCubic(t: number): number {
  const p = Number.isFinite(t) ? clamp(t, 0, 1) : 0
  return 1 - Math.pow(1 - p, 3)
}

/**
 * "#102742" -> "16 39 66", so a navy-tinted shadow can be written as
 * `rgb(16 39 66 / 0.35)` without a second hard-coded copy of the brand navy.
 * Returns null on anything that is not a 3- or 6-digit hex.
 */
export function hexToRgbTriplet(hex: string): string | null {
  if (typeof hex !== 'string') return null
  const raw = hex.trim().replace(/^#/, '')
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null
  const n = parseInt(full, 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}
