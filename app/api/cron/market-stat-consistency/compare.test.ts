import { describe, it, expect } from 'vitest'
import {
  CROSS_PATH_TOLERANCE_PCT,
  VERDICT_CITIES,
  crossPathDelta,
  compareCityCrossPath,
  crossPathFailureLines,
} from './compare'

describe('crossPathDelta', () => {
  it('computes a signed percent delta against the cache (canonical) value', () => {
    const d = crossPathDelta('Bend', 'median close price', 812_000, 800_000)
    expect(d.deltaPct).toBe(1.5)
    expect(d.exceeds).toBe(true)
  })

  it('negative drift is signed and still trips the tolerance on magnitude', () => {
    const d = crossPathDelta('Bend', 'median close price', 784_000, 800_000)
    expect(d.deltaPct).toBe(-2)
    expect(d.exceeds).toBe(true)
  })

  it('a delta at exactly the 1% tolerance does NOT alert (threshold is strictly greater)', () => {
    const d = crossPathDelta('Redmond', 'median close price', 808_000, 800_000)
    expect(d.deltaPct).toBe(1)
    expect(d.exceeds).toBe(false)
  })

  it('a delta inside tolerance does not alert', () => {
    const d = crossPathDelta('Sisters', 'active count', 201, 200)
    expect(d.deltaPct).toBe(0.5)
    expect(d.exceeds).toBe(false)
  })

  it('uses the unrounded delta for the exceeds decision, not the displayed 2-decimal figure', () => {
    // 1.004% raw → displays 1.0 but still within nothing... verify the inverse:
    // 1.006% raw rounds to 1.01 and exceeds; 0.996% rounds to 1.0 and does not.
    const over = crossPathDelta('Bend', 'active count', 100_503, 100_000)
    expect(over.deltaPct).toBe(0.5)
    expect(over.exceeds).toBe(false)
    const justOver = crossPathDelta('Bend', 'active count', 101_006, 100_000)
    expect(justOver.exceeds).toBe(true)
    const justUnder = crossPathDelta('Bend', 'active count', 100_996, 100_000)
    expect(justUnder.exceeds).toBe(false)
  })

  it('identical values produce a zero delta and no alert', () => {
    const d = crossPathDelta('Tumalo', 'months of supply', 4.2, 4.2)
    expect(d.deltaPct).toBe(0)
    expect(d.exceeds).toBe(false)
  })

  it('both paths missing → not comparable, no alert', () => {
    const d = crossPathDelta('Terrebonne', 'months of supply', null, null)
    expect(d.deltaPct).toBeNull()
    expect(d.exceeds).toBe(false)
    expect(d.note).toBe('no value on either path')
  })

  it('exactly one path missing → alert (a served figure is dark on one path)', () => {
    const rpcOnly = crossPathDelta('La Pine', 'months of supply', 5.1, null)
    expect(rpcOnly.exceeds).toBe(true)
    const cacheOnly = crossPathDelta('La Pine', 'months of supply', null, 5.1)
    expect(cacheOnly.exceeds).toBe(true)
  })

  it('cache zero vs RPC zero → no alert; cache zero vs RPC nonzero → alert', () => {
    const bothZero = crossPathDelta('Sunriver', 'active count', 0, 0)
    expect(bothZero.deltaPct).toBe(0)
    expect(bothZero.exceeds).toBe(false)
    const drift = crossPathDelta('Sunriver', 'active count', 3, 0)
    expect(drift.deltaPct).toBeNull()
    expect(drift.exceeds).toBe(true)
  })

  it('non-finite inputs are treated as missing', () => {
    const d = crossPathDelta('Bend', 'active count', Number.NaN, 100)
    expect(d.rpcValue).toBeNull()
    expect(d.exceeds).toBe(true)
  })
})

describe('compareCityCrossPath', () => {
  const cache = { medianSalePrice: 800_000, activeCount: 500, monthsOfSupply: 4.0 }

  it('builds the 3 per-city figures in a fixed order', () => {
    const deltas = compareCityCrossPath(
      'Bend',
      { median_price: 800_000, current_listings: 500, inventory_months: 4.0 },
      cache,
    )
    expect(deltas.map((d) => d.figure)).toEqual([
      'median close price',
      'active count',
      'months of supply',
    ])
    expect(deltas.every((d) => !d.exceeds)).toBe(true)
  })

  it('maps the RPC COALESCE-to-0 median to null (no closed sales is not a $0 median)', () => {
    const deltas = compareCityCrossPath(
      'Tumalo',
      { median_price: 0, current_listings: 500, inventory_months: 4.0 },
      cache,
    )
    const median = deltas[0]
    expect(median.rpcValue).toBeNull()
    // Cache HAS a median while the RPC says none — that is drift, alert.
    expect(median.exceeds).toBe(true)
  })

  it('fixture: real drift shape (RPC over-count from unfiltered property types)', () => {
    const deltas = compareCityCrossPath(
      'Bend',
      { median_price: 845_000, current_listings: 788, inventory_months: 5.6 },
      { medianSalePrice: 800_000, activeCount: 500, monthsOfSupply: 4.1 },
    )
    expect(deltas[0].deltaPct).toBe(5.63)
    expect(deltas[0].exceeds).toBe(true)
    expect(deltas[1].deltaPct).toBe(57.6)
    expect(deltas[1].exceeds).toBe(true)
    expect(deltas[2].deltaPct).toBe(36.59)
    expect(deltas[2].exceeds).toBe(true)
  })
})

describe('crossPathFailureLines', () => {
  it('emits one line per exceeding delta only, with both values and the signed delta', () => {
    const deltas = compareCityCrossPath(
      'Bend',
      { median_price: 845_000, current_listings: 500, inventory_months: 4.0 },
      { medianSalePrice: 800_000, activeCount: 500, monthsOfSupply: 4.0 },
    )
    const lines = crossPathFailureLines(deltas)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('Bend cross-path median close price')
    expect(lines[0]).toContain('$845,000')
    expect(lines[0]).toContain('$800,000')
    expect(lines[0]).toContain('+5.63%')
    expect(lines[0]).toContain(`tolerance ${CROSS_PATH_TOLERANCE_PCT}%`)
  })

  it('one-path-missing lines carry the note instead of a delta percent', () => {
    const lines = crossPathFailureLines([
      crossPathDelta('La Pine', 'months of supply', null, 5.1),
    ])
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('only one path produced a value')
    expect(lines[0]).toContain('no value')
    expect(lines[0]).toContain('5.1')
  })

  it('clean deltas produce no lines', () => {
    expect(
      crossPathFailureLines([crossPathDelta('Bend', 'active count', 500, 500)]),
    ).toEqual([])
  })
})

describe('VERDICT_CITIES', () => {
  it('pins the 7 verdict cities the report engine serves', () => {
    expect([...VERDICT_CITIES]).toEqual([
      'Bend',
      'Redmond',
      'Sisters',
      'Sunriver',
      'Tumalo',
      'La Pine',
      'Terrebonne',
    ])
  })
})
