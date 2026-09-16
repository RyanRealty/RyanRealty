import { describe, expect, it } from 'vitest'
import {
  mosBandCounts,
  mosCompareIdleRead,
  mosOverlayOptions,
  V3_MOS_COMPARE_REGION_KEY,
  type V3MosCompareCity,
} from './V3MosCompare.client'

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

// The overlay's option rows (SITE-92 round 4): the region alone first, as the
// resting choice the catalog control always holds, then every city with a
// publishable reading carrying its own months and verdict — never a city whose
// reading was withheld, and never a figure this file computed.
describe('mosOverlayOptions', () => {
  const region = { regionLabel: 'Central Oregon', regionMosLabel: '4.6', regionVerdict: 'Balanced market' }
  const cities: V3MosCompareCity[] = [
    { slug: 'bend', name: 'Bend', mos: 3.5, mosLabel: '3.5', verdictLabel: "Seller's market", activeLabel: '616 for sale' },
    { slug: 'la-pine', name: 'La Pine', mos: 8.7, mosLabel: '8.7', verdictLabel: "Buyer's market", activeLabel: '146 for sale' },
    { slug: 'metolius', name: 'Metolius', mos: null, mosLabel: null, verdictLabel: null, activeLabel: '4 for sale' },
    { slug: 'culver', name: 'Culver', mos: 0, mosLabel: '0.0', verdictLabel: 'Balanced market', activeLabel: null },
  ]

  it('leads with the region alone and lists only cities with a published reading', () => {
    const options = mosOverlayOptions({ ...region, cities })
    expect(options.map((o) => o.key)).toEqual([V3_MOS_COMPARE_REGION_KEY, 'bend', 'la-pine'])
    expect(options[0]).toEqual({ key: V3_MOS_COMPARE_REGION_KEY, label: 'Central Oregon alone', count: '4.6 mo · Balanced' })
    expect(options[1]!.count).toBe("3.5 mo · Seller's")
    expect(options[2]!.count).toBe("8.7 mo · Buyer's")
  })

  it('offers nothing when no city has a reading, so the control is not drawn', () => {
    expect(mosOverlayOptions({ ...region, cities: cities.slice(2) })).toEqual([])
  })
})
