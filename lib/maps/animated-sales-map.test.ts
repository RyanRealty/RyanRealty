/**
 * Contract locks for the AnimatedSalesMap pure logic.
 *
 * The component's correctness lives here: the ODS licensing gate, oldest-first
 * ordering, the 3-5s stagger window, the §0 "drop it, never invent it" guards,
 * and every degraded case the map has to survive without crashing or showing an
 * empty grey box.
 */
import { describe, it, expect } from 'vitest'
import {
  boundaryToRings,
  computeBoundsLiteral,
  computeStagger,
  DEFAULT_MARKER_DURATION_MS,
  DEFAULT_MAX_RUN_MS,
  DEFAULT_MIN_RUN_MS,
  easeOutCubic,
  formatSaleLabel,
  hexToRgbTriplet,
  isDegenerateBounds,
  markerDelayMs,
  MAX_RING_POINTS,
  normalizeSales,
  resampleRing,
  ringDrawPath,
  salesForAudience,
  type AnimatedSale,
} from './animated-sales-map'

// ─── fixtures ─────────────────────────────────────────────────────────────────

const sale = (over: Partial<AnimatedSale> & { id: string }): AnimatedSale => ({
  lat: 44.058,
  lng: -121.315,
  price: 750_000,
  closedAt: '2026-03-01',
  ...over,
})

/** A square ring in GeoJSON [lng, lat] order, closed. */
const SQUARE: number[][] = [
  [-121.4, 44.0],
  [-121.4, 44.1],
  [-121.3, 44.1],
  [-121.3, 44.0],
  [-121.4, 44.0],
]

// ─── ODS §5-4 licensing gate ──────────────────────────────────────────────────

describe('salesForAudience — ODS §5-4', () => {
  const rows = [sale({ id: 'a' }), sale({ id: 'b' })]

  it('renders sales only for a VOW audience', () => {
    expect(salesForAudience(rows, 'vow')).toHaveLength(2)
  })

  it('drops every sale for a public audience', () => {
    expect(salesForAudience(rows, 'public')).toEqual([])
  })

  it('fails closed on a missing, null, or bogus audience', () => {
    expect(salesForAudience(rows, undefined)).toEqual([])
    expect(salesForAudience(rows, null)).toEqual([])
    // An untyped JS caller cannot talk its way past the gate.
    expect(salesForAudience(rows, 'VOW' as never)).toEqual([])
    expect(salesForAudience(rows, 'authenticated' as never)).toEqual([])
  })

  it('survives a null sales list', () => {
    expect(salesForAudience(null, 'vow')).toEqual([])
    expect(salesForAudience(undefined, 'vow')).toEqual([])
  })
})

// ─── ordering: oldest first ───────────────────────────────────────────────────

describe('normalizeSales — ordering', () => {
  it('orders oldest first regardless of input order', () => {
    const out = normalizeSales([
      sale({ id: 'newest', closedAt: '2026-07-15' }),
      sale({ id: 'oldest', closedAt: '2025-09-02' }),
      sale({ id: 'middle', closedAt: '2026-01-20' }),
    ])
    expect(out.map((s) => s.id)).toEqual(['oldest', 'middle', 'newest'])
  })

  it('is stable for identical close dates', () => {
    const ids = ['c', 'a', 'b'].map((id) => sale({ id, closedAt: '2026-04-01' }))
    expect(normalizeSales(ids).map((s) => s.id)).toEqual(['a', 'b', 'c'])
    // Re-running with a different input order gives the same output order, so
    // the pop sequence does not reshuffle between server and client renders.
    expect(normalizeSales(ids.slice().reverse()).map((s) => s.id)).toEqual(['a', 'b', 'c'])
  })

  it('parses full ISO timestamps as well as dates', () => {
    const out = normalizeSales([
      sale({ id: 'later', closedAt: '2026-03-01T18:00:00.000Z' }),
      sale({ id: 'earlier', closedAt: '2026-03-01T06:00:00.000Z' }),
    ])
    expect(out.map((s) => s.id)).toEqual(['earlier', 'later'])
  })
})

// ─── §0 guards: drop, never invent ────────────────────────────────────────────

describe('normalizeSales — guards', () => {
  it('returns [] for no sales at all', () => {
    expect(normalizeSales([])).toEqual([])
    expect(normalizeSales(null)).toEqual([])
    expect(normalizeSales(undefined)).toEqual([])
    expect(normalizeSales('nope' as never)).toEqual([])
  })

  it('handles exactly one sale', () => {
    const out = normalizeSales([sale({ id: 'only', price: 612_000 })])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ id: 'only', price: 612_000, label: '$612k' })
  })

  it('drops rows with a missing or non-finite coordinate', () => {
    const out = normalizeSales([
      sale({ id: 'no-lat', lat: null }),
      sale({ id: 'no-lng', lng: undefined }),
      sale({ id: 'nan', lat: Number.NaN }),
      sale({ id: 'inf', lng: Number.POSITIVE_INFINITY }),
      sale({ id: 'keep' }),
    ])
    expect(out.map((s) => s.id)).toEqual(['keep'])
  })

  it('drops out-of-range coordinates and the (0,0) null island', () => {
    const out = normalizeSales([
      sale({ id: 'off-lat', lat: 91 }),
      sale({ id: 'off-lng', lng: -181 }),
      sale({ id: 'null-island', lat: 0, lng: 0 }),
      sale({ id: 'keep' }),
    ])
    expect(out.map((s) => s.id)).toEqual(['keep'])
  })

  it('drops rows with a missing or non-positive price', () => {
    const out = normalizeSales([
      sale({ id: 'no-price', price: null }),
      sale({ id: 'zero', price: 0 }),
      sale({ id: 'negative', price: -1 }),
      sale({ id: 'keep' }),
    ])
    expect(out.map((s) => s.id)).toEqual(['keep'])
  })

  it('drops rows with a missing or unparseable close date', () => {
    const out = normalizeSales([
      sale({ id: 'no-date', closedAt: null }),
      sale({ id: 'empty', closedAt: '' }),
      sale({ id: 'garbage', closedAt: 'sometime last spring' }),
      sale({ id: 'keep' }),
    ])
    expect(out.map((s) => s.id)).toEqual(['keep'])
  })

  it('drops rows with no usable id and dedupes repeats', () => {
    const out = normalizeSales([
      sale({ id: '' }),
      sale({ id: 'dup', price: 500_000 }),
      sale({ id: 'dup', price: 999_000 }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0].price).toBe(500_000)
  })

  it('never repairs a bad row into a good one', () => {
    // Every field is junk; nothing is estimated, so nothing survives.
    const out = normalizeSales([sale({ id: 'junk', lat: null, price: null, closedAt: null })])
    expect(out).toEqual([])
  })
})

describe('normalizeSales — capping', () => {
  const many = Array.from({ length: 400 }, (_, i) =>
    sale({ id: `s${String(i).padStart(3, '0')}`, closedAt: `2026-01-01T00:00:${String(i % 60).padStart(2, '0')}.000Z` }),
  )

  it('keeps the most recent N and holds oldest-first order within them', () => {
    const out = normalizeSales(
      // shuffle-ish input
      many.slice().reverse(),
      { maxSales: 10 },
    )
    expect(out).toHaveLength(10)
    for (let i = 1; i < out.length; i++) {
      expect(out[i].closedAtMs).toBeGreaterThanOrEqual(out[i - 1].closedAtMs)
    }
    // The kept window is the tail of the full ordering, not the head.
    const full = normalizeSales(many, { maxSales: 400 })
    expect(out.map((s) => s.id)).toEqual(full.slice(-10).map((s) => s.id))
  })

  it('treats a nonsense cap as at least one', () => {
    expect(normalizeSales(many, { maxSales: 0 })).toHaveLength(1)
    expect(normalizeSales(many, { maxSales: -5 })).toHaveLength(1)
  })
})

describe('formatSaleLabel', () => {
  it('carries a currency unit at every magnitude', () => {
    expect(formatSaleLabel(475_000)).toBe('$475k')
    expect(formatSaleLabel(1_250_000)).toBe('$1.3M')
    expect(formatSaleLabel(900)).toBe('$900')
  })
})

// ─── stagger timing ───────────────────────────────────────────────────────────

describe('computeStagger', () => {
  it('produces a zero-length plan for no sales', () => {
    const plan = computeStagger(0)
    expect(plan.count).toBe(0)
    expect(plan.totalRunMs).toBe(0)
    expect(plan.perMarkerDelayMs).toBe(0)
  })

  it('runs a single sale for one marker duration with no gap', () => {
    const plan = computeStagger(1)
    expect(plan.perMarkerDelayMs).toBe(0)
    expect(plan.totalRunMs).toBe(DEFAULT_MARKER_DURATION_MS)
  })

  it('holds the 3-5s window for any count big enough to need pacing', () => {
    for (const n of [40, 60, 100, 150, 200, 500]) {
      const plan = computeStagger(n)
      expect(plan.totalRunMs).toBeGreaterThanOrEqual(DEFAULT_MIN_RUN_MS - 1)
      expect(plan.totalRunMs).toBeLessThanOrEqual(DEFAULT_MAX_RUN_MS + 1)
    }
  })

  it('compresses the gap as the count rises, so 200 sales still fit the window', () => {
    const small = computeStagger(60)
    const large = computeStagger(200)
    expect(large.perMarkerDelayMs).toBeLessThan(small.perMarkerDelayMs)
    expect(large.totalRunMs).toBeLessThanOrEqual(DEFAULT_MAX_RUN_MS + 1)
  })

  it('lets tiny sets finish early rather than stalling on the floor', () => {
    // Two pins should not sit through a 2.6s dead pause to satisfy a 3s floor.
    const plan = computeStagger(2)
    expect(plan.perMarkerDelayMs).toBeLessThanOrEqual(260)
    expect(plan.totalRunMs).toBeLessThan(DEFAULT_MIN_RUN_MS)
  })

  it('honors a caller-supplied window', () => {
    const plan = computeStagger(100, { minRunMs: 1000, maxRunMs: 1500 })
    expect(plan.totalRunMs).toBeLessThanOrEqual(1500 + 1)
    expect(plan.totalRunMs).toBeGreaterThanOrEqual(1000 - 1)
  })

  it('cannot be given an inverted window', () => {
    const plan = computeStagger(100, { minRunMs: 4000, maxRunMs: 1000 })
    expect(plan.totalRunMs).toBeGreaterThanOrEqual(4000 - 1)
  })

  it('survives a nonsense count', () => {
    expect(computeStagger(Number.NaN).count).toBe(0)
    expect(computeStagger(-10).count).toBe(0)
    expect(computeStagger(3.7).count).toBe(3)
  })

  it('delays markers monotonically, first at zero', () => {
    const plan = computeStagger(50)
    expect(markerDelayMs(plan, 0)).toBe(0)
    expect(markerDelayMs(plan, -3)).toBe(0)
    expect(markerDelayMs(plan, 10)).toBeGreaterThan(markerDelayMs(plan, 9))
    // The last marker starts exactly one duration before the run ends.
    expect(markerDelayMs(plan, 49) + plan.markerDurationMs).toBeCloseTo(plan.totalRunMs, 6)
  })
})

// ─── reduced motion ───────────────────────────────────────────────────────────

describe('reduced-motion path', () => {
  it('is the same ordered, guarded set the animated path draws', () => {
    // Reduced motion changes only WHEN pills appear, never WHICH or WHERE. The
    // component skips the stagger and paints the final state; the data it paints
    // is byte-identical to the animated run.
    const rows = [
      sale({ id: 'b', closedAt: '2026-05-01' }),
      sale({ id: 'a', closedAt: '2026-01-01' }),
      sale({ id: 'bad', lat: null }),
    ]
    const animated = normalizeSales(rows)
    const reduced = normalizeSales(rows)
    expect(reduced).toEqual(animated)
    expect(reduced.map((s) => s.id)).toEqual(['a', 'b'])
  })

  it('has a final-state plan available for any count, including zero', () => {
    // The component reads markerDelayMs only when animating, but the plan must
    // still be well-formed so the reduced-motion branch cannot divide by zero.
    for (const n of [0, 1, 2, 200]) {
      const plan = computeStagger(n)
      expect(Number.isFinite(plan.perMarkerDelayMs)).toBe(true)
      expect(Number.isFinite(plan.totalRunMs)).toBe(true)
      expect(plan.perMarkerDelayMs).toBeGreaterThanOrEqual(0)
    }
  })
})

// ─── boundary geometry ────────────────────────────────────────────────────────

describe('boundaryToRings', () => {
  it('reads a Polygon', () => {
    const rings = boundaryToRings({ type: 'Polygon', coordinates: [SQUARE] })
    expect(rings).toHaveLength(1)
    expect(rings[0][0]).toEqual({ lat: 44.0, lng: -121.4 })
  })

  it('reads a MultiPolygon and keeps holes', () => {
    const hole = SQUARE.map(([lng, lat]) => [lng + 0.01, lat + 0.01])
    const rings = boundaryToRings({
      type: 'MultiPolygon',
      coordinates: [[SQUARE, hole], [SQUARE]],
    })
    expect(rings).toHaveLength(3)
  })

  it('returns [] rather than guessing at an unusable boundary', () => {
    // Every one of these means "no boundary", never "approximate one".
    expect(boundaryToRings(null)).toEqual([])
    expect(boundaryToRings(undefined)).toEqual([])
    expect(boundaryToRings({})).toEqual([])
    expect(boundaryToRings('POLYGON((...))')).toEqual([])
    expect(boundaryToRings({ type: 'Point', coordinates: [-121.3, 44.0] })).toEqual([])
    expect(boundaryToRings({ type: 'FeatureCollection', features: [] })).toEqual([])
    expect(boundaryToRings({ type: 'Polygon', coordinates: 'nope' })).toEqual([])
  })

  it('discards corrupt rings and bad vertices instead of repairing them', () => {
    expect(boundaryToRings({ type: 'Polygon', coordinates: [[[0, 0], [1, 1]]] })).toEqual([])
    const rings = boundaryToRings({
      type: 'Polygon',
      coordinates: [[...SQUARE, [999, 999], ['x', 'y'], [-121.4]]],
    })
    expect(rings[0]).toHaveLength(SQUARE.length)
  })
})

describe('resampleRing', () => {
  const long = Array.from({ length: 5000 }, (_, i) => ({ lat: 44 + i / 100000, lng: -121 }))

  it('leaves a short ring untouched', () => {
    const ring = boundaryToRings({ type: 'Polygon', coordinates: [SQUARE] })[0]
    expect(resampleRing(ring)).toEqual(ring)
  })

  it('thins a huge ring to the cap and keeps both endpoints', () => {
    const out = resampleRing(long)
    expect(out).toHaveLength(MAX_RING_POINTS)
    expect(out[0]).toEqual(long[0])
    expect(out[out.length - 1]).toEqual(long[long.length - 1])
  })

  it('only ever returns original vertices — no invented points', () => {
    const set = new Set(long.map((p) => `${p.lat},${p.lng}`))
    for (const p of resampleRing(long)) {
      expect(set.has(`${p.lat},${p.lng}`)).toBe(true)
    }
  })
})

describe('ringDrawPath', () => {
  const ring = boundaryToRings({ type: 'Polygon', coordinates: [SQUARE] })[0]

  it('is empty at the start and whole at the end', () => {
    expect(ringDrawPath(ring, 0)).toEqual([])
    expect(ringDrawPath(ring, 1)).toEqual(ring)
  })

  it('grows monotonically', () => {
    let prev = 0
    for (const t of [0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      const len = ringDrawPath(ring, t).length
      expect(len).toBeGreaterThanOrEqual(prev)
      prev = len
    }
  })

  it('interpolates the leading edge so the stroke does not step', () => {
    // t=0.6 on a 5-vertex ring lands 40% along the leg from ring[2] to ring[3],
    // so the tip must be a new point on that leg, not a vertex.
    const partial = ringDrawPath(ring, 0.6)
    const tip = partial[partial.length - 1]
    expect(ring.some((p) => p.lat === tip.lat && p.lng === tip.lng)).toBe(false)
    expect(tip.lng).toBeCloseTo(ring[2].lng + (ring[3].lng - ring[2].lng) * 0.4, 10)
    expect(tip.lat).toBeCloseTo(ring[2].lat + (ring[3].lat - ring[2].lat) * 0.4, 10)
  })

  it('lands exactly on a vertex when progress lands on one', () => {
    const onVertex = ringDrawPath(ring, 0.5)
    expect(onVertex[onVertex.length - 1]).toEqual(ring[2])
  })

  it('clamps nonsense progress and survives an empty ring', () => {
    expect(ringDrawPath(ring, -1)).toEqual([])
    expect(ringDrawPath(ring, 5)).toEqual(ring)
    expect(ringDrawPath(ring, Number.NaN)).toEqual([])
    expect(ringDrawPath([], 0.5)).toEqual([])
  })
})

// ─── bounds ───────────────────────────────────────────────────────────────────

describe('computeBoundsLiteral', () => {
  const ring = boundaryToRings({ type: 'Polygon', coordinates: [SQUARE] })[0]

  it('frames the boundary and the sales together', () => {
    const sales = normalizeSales([sale({ id: 'far', lat: 44.5, lng: -121.0 })])
    const b = computeBoundsLiteral([ring], sales)
    expect(b).toEqual({ north: 44.5, south: 44.0, east: -121.0, west: -121.4 })
  })

  it('frames sales alone when there is no boundary', () => {
    const sales = normalizeSales([sale({ id: 'a', lat: 44.1, lng: -121.2 })])
    expect(computeBoundsLiteral([], sales)).toEqual({
      north: 44.1, south: 44.1, east: -121.2, west: -121.2,
    })
  })

  it('frames a boundary alone when there are no sales', () => {
    expect(computeBoundsLiteral([ring])).not.toBeNull()
  })

  it('returns null when there is nothing to frame — the render-nothing signal', () => {
    expect(computeBoundsLiteral([], [])).toBeNull()
    expect(computeBoundsLiteral([])).toBeNull()
  })

  it('flags a single-point bounds so fitBounds does not slam to max zoom', () => {
    const one = normalizeSales([sale({ id: 'a' })])
    const b = computeBoundsLiteral([], one)!
    expect(isDegenerateBounds(b)).toBe(true)
    expect(isDegenerateBounds(computeBoundsLiteral([ring])!)).toBe(false)
  })
})

// ─── small helpers ────────────────────────────────────────────────────────────

describe('easeOutCubic', () => {
  it('runs 0 to 1 and decelerates', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5)
  })

  it('clamps out-of-range and nonsense input', () => {
    expect(easeOutCubic(-2)).toBe(0)
    expect(easeOutCubic(9)).toBe(1)
    expect(easeOutCubic(Number.NaN)).toBe(0)
  })
})

describe('hexToRgbTriplet', () => {
  it('converts the brand navy without a second hard-coded copy of it', () => {
    expect(hexToRgbTriplet('#102742')).toBe('16 39 66')
    expect(hexToRgbTriplet('102742')).toBe('16 39 66')
    expect(hexToRgbTriplet('#fff')).toBe('255 255 255')
  })

  it('returns null on anything that is not a hex color', () => {
    expect(hexToRgbTriplet('navy')).toBeNull()
    expect(hexToRgbTriplet('#12')).toBeNull()
    expect(hexToRgbTriplet(null as never)).toBeNull()
  })
})

// ─── degraded cases, end to end through the pure layer ────────────────────────

describe('degraded cases', () => {
  it('geography with no data at all -> nothing to render', () => {
    const rings = boundaryToRings(null)
    const sales = normalizeSales([])
    expect(computeBoundsLiteral(rings, sales)).toBeNull()
  })

  it('no polygon but real sales -> sales still render', () => {
    const rings = boundaryToRings(null)
    const sales = normalizeSales([sale({ id: 'a' }), sale({ id: 'b', lat: 44.1 })])
    expect(rings).toEqual([])
    expect(sales).toHaveLength(2)
    expect(computeBoundsLiteral(rings, sales)).not.toBeNull()
  })

  it('real polygon but no sales -> boundary still renders', () => {
    const rings = boundaryToRings({ type: 'Polygon', coordinates: [SQUARE] })
    expect(computeBoundsLiteral(rings, normalizeSales([]))).not.toBeNull()
  })

  it('public audience on a geography with 200 sales -> boundary only', () => {
    const rows = Array.from({ length: 200 }, (_, i) => sale({ id: `s${i}` }))
    const licensed = salesForAudience(rows, 'public')
    const sales = normalizeSales(licensed as AnimatedSale[])
    const rings = boundaryToRings({ type: 'Polygon', coordinates: [SQUARE] })
    expect(sales).toEqual([])
    expect(computeBoundsLiteral(rings, sales)).not.toBeNull()
  })

  it('every sale is junk -> treated as no sales, not as a crash', () => {
    const rows = [
      sale({ id: 'a', lat: null }),
      sale({ id: 'b', price: 0 }),
      sale({ id: 'c', closedAt: 'nope' }),
    ]
    expect(normalizeSales(rows)).toEqual([])
    expect(computeStagger(0).totalRunMs).toBe(0)
  })
})
