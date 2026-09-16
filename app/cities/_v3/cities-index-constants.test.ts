import { describe, expect, it } from 'vitest'
import { indexBarTicks, indexBarWeight, liveForSaleLabel } from './cities-index-constants'

describe('indexBarWeight', () => {
  it('is the square root of the row share of the largest count, so a small town still shows', () => {
    expect(indexBarWeight(25, 100)).toBe(0.5)
    expect(indexBarWeight(50, 100)).toBeCloseTo(Math.SQRT1_2, 6)
    expect(indexBarWeight(100, 100)).toBe(1)
    expect(indexBarWeight(0, 100)).toBe(0)
    // The live spread the scale exists for: 5 against 616 is a visible bar,
    // not the encode's 1.5% floor, and the order still holds.
    expect(indexBarWeight(5, 616)).toBeGreaterThan(0.08)
    expect(indexBarWeight(4, 616)!).toBeLessThan(indexBarWeight(5, 616)!)
    expect(indexBarWeight(146, 616)!).toBeLessThan(indexBarWeight(616, 616)!)
  })

  it('never exceeds the full track', () => {
    expect(indexBarWeight(700, 616)).toBe(1)
  })

  it('withholds a bar when the count or the max is not a figure', () => {
    expect(indexBarWeight(null, 100)).toBeUndefined()
    expect(indexBarWeight(12, 0)).toBeUndefined()
    expect(indexBarWeight(Number.NaN, 10)).toBeUndefined()
  })
})

describe('indexBarTicks', () => {
  it('marks round counts on the same square-root scale the bars use, and the top at the full track', () => {
    const ticks = indexBarTicks(616)
    expect(ticks.at(-1)).toEqual({ at: 1, count: 616 })
    expect(ticks.length).toBeLessThanOrEqual(4)
    for (const t of ticks) {
      expect(t.at).toBeCloseTo(indexBarWeight(t.count, 616)!, 9)
      expect(t.at).toBeGreaterThan(0)
      expect(t.at).toBeLessThanOrEqual(1)
    }
    // Inner ticks stop short of the top's label.
    for (const t of ticks.slice(0, -1)) expect(t.at).toBeLessThanOrEqual(Math.sqrt(0.72) + 1e-9)
  })

  it('spreads three inner ticks across the round steps when there are more than three', () => {
    const inner = indexBarTicks(5000).slice(0, -1).map((t) => t.count)
    expect(inner).toHaveLength(3)
    expect(inner[0]).toBe(5)
    expect(inner[2]).toBe(2500)
  })

  it('is empty without a positive top count', () => {
    expect(indexBarTicks(0)).toEqual([])
    expect(indexBarTicks(Number.NaN)).toEqual([])
  })
})

describe('liveForSaleLabel', () => {
  it('names the listed set, and zero as none listed', () => {
    expect(liveForSaleLabel(12)).toBe('12 for sale')
    expect(liveForSaleLabel(0)).toBe('None listed now')
  })
})
