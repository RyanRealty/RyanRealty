import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { pairedDeltas, riseFloorBasis } from '../taste-rise-floor.mjs'
import { RISE_FLOOR } from '../lib/taste-receipt.mjs'

describe('taste-rise-floor — the floor is measured, not typed', () => {
  it('is deterministic for a given table and seed', () => {
    const table = { rows: Array.from({ length: 27 }, (_, i) => ({ key: `c${i}`, median: 50, scores: [50 - (i % 5), 50, 50 + (i % 7)] })) }
    const a = riseFloorBasis(table, { n: 20000 })
    const b = riseFloorBasis(table, { n: 20000 })
    expect(a.q95).toBe(b.q95)
    expect(a.residuals).toBe(81)
    expect(a.pNoiseRiseAtLeast[a.q95]).toBeLessThanOrEqual(0.05 + 0.02)
  })

  it('a noiseless judge needs no floor; a noisy one needs a bigger one', () => {
    const quiet = { rows: Array.from({ length: 10 }, (_, i) => ({ key: `q${i}`, median: 50, scores: [50, 50, 50] })) }
    const loud = { rows: Array.from({ length: 10 }, (_, i) => ({ key: `l${i}`, median: 50, scores: [35, 50, 65] })) }
    expect(riseFloorBasis(quiet, { n: 5000 }).q95).toBe(0)
    expect(riseFloorBasis(loud, { n: 5000 }).q95).toBeGreaterThan(6)
  })

  it('refuses a table too thin to measure', () => {
    expect(() => riseFloorBasis({ rows: [{ key: 'a', median: 1, scores: [1, 1, 1] }] })).toThrow(/residuals/)
  })

  it('the committed manifest agrees with the committed table and with RISE_FLOOR', () => {
    const manifest = JSON.parse(readFileSync('design_system/public/taste-rule-freeze.json', 'utf8'))
    const table = JSON.parse(readFileSync(manifest.table, 'utf8'))
    const basis = riseFloorBasis(table)
    expect(manifest.riseFloor).toBe(RISE_FLOOR)
    expect(manifest.riseFloorBasis.q95).toBe(manifest.riseFloor)
    expect(basis.q95).toBe(manifest.riseFloorBasis.q95)
    expect(basis.residuals).toBe(manifest.riseFloorBasis.residuals)
  })

  it('pairs two table passes by class and reports the spread', () => {
    const a = { rows: [{ key: 'x', median: 50 }, { key: 'y', median: 60 }, { key: 'z', median: null }] }
    const b = { rows: [{ key: 'x', median: 53 }, { key: 'y', median: 52 }, { key: 'z', median: 40 }] }
    const p = pairedDeltas(a, b)
    expect(p.n).toBe(2)
    expect(p.pairs.map((q) => q.delta)).toEqual([3, -8])
    expect(p.maxAbsDelta).toBe(8)
    expect(p.atOrAboveFloor(6)).toBe(1)
  })
})
