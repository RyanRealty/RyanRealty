import { describe, expect, it } from 'vitest'
import { mosBandCounts, mosCompareIdleRead } from './V3MosCompare.client'

// The compare's caption at rest (SITE-92, 2026-09-16). The separate evaluator
// read "Balanced at 4.6 months · Balanced 4–6" as the same reading stated four
// times in one section. The caption now says the region's reading once and
// adds what the drawing does not: how many cities sit in each band.
const CITIES = [
  { mos: 2.1 }, // seller's
  { mos: 3.9 }, // seller's
  { mos: 4.0 }, // balanced (the 4 boundary belongs to balanced, as the thresholds say)
  { mos: 4.6 }, // balanced
  { mos: 6.0 }, // buyer's (≥ 6)
  { mos: 9.4 }, // buyer's
  { mos: null }, // no reading — not counted
  { mos: 0 }, // withheld — not counted
]

describe('mosBandCounts', () => {
  it('buckets on the canonical thresholds (≤4 seller · 4–6 balanced · ≥6 buyer) and skips missing readings', () => {
    expect(mosBandCounts(CITIES)).toEqual({ seller: 2, balanced: 2, buyer: 2, total: 6 })
  })
  it('is all zeros with nothing to count', () => {
    expect(mosBandCounts([])).toEqual({ seller: 0, balanced: 0, buyer: 0, total: 0 })
  })
})

describe('mosCompareIdleRead', () => {
  it('states the region once and then the band counts', () => {
    expect(
      mosCompareIdleRead({ regionLabel: 'Central Oregon', regionMosLabel: '4.6', regionVerdict: 'Balanced', cities: CITIES }),
    ).toBe("Central Oregon at 4.6 months, balanced · of 6 cities with a reading: 2 seller's, 2 balanced, 2 buyer's")
  })
  it('never repeats the band label after the verdict', () => {
    const read = mosCompareIdleRead({ regionLabel: 'Central Oregon', regionMosLabel: '4.6', regionVerdict: 'Balanced', cities: CITIES })
    expect(read).not.toMatch(/Balanced 4/)
    expect(read.match(/balanced/gi)?.length).toBe(2) // the verdict once, the count once
  })
  it('drops the tail when no city has a reading, and names one city in the singular', () => {
    expect(mosCompareIdleRead({ regionLabel: 'Central Oregon', regionMosLabel: '4.6', regionVerdict: 'Balanced', cities: [] })).toBe(
      'Central Oregon at 4.6 months, balanced',
    )
    expect(mosCompareIdleRead({ regionLabel: 'Central Oregon', regionMosLabel: '4.6', regionVerdict: 'Balanced', cities: [{ mos: 7 }] })).toBe(
      "Central Oregon at 4.6 months, balanced · of 1 city with a reading: 1 buyer's",
    )
  })
})
