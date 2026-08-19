import { describe, expect, it } from 'vitest'
import type { MarketPulseSnapshot } from '@/lib/data/market/getMarketPulseSnapshot'
import type { CityQuarterPair } from '@/lib/data/pricing/getCityQuarterSaleToAsk'
import type { CityYearPricingRow } from '@/lib/data/pricing/getCityYearPricing'
import {
  MOS_SCALE_MAX,
  buildCutsCard,
  buildDtpCard,
  buildMosCard,
  buildStoCard,
  buildYearCard,
  type CityRankInput,
} from './city-market-charts-data'

function town(partial: Partial<MarketPulseSnapshot> & { geo_slug: string; geo_label: string }): MarketPulseSnapshot {
  return {
    active_count: 100,
    median_list_price: 500000,
    months_of_supply: 5,
    market_health_label: null,
    sold_count_30d: 20,
    new_count_7d: 5,
    median_active_dom: null,
    median_days_to_pending: 20,
    price_reduction_share: 8,
    methodology_version: 'v3-2026-05-07',
    updated_at: '2026-08-19T04:48:03Z',
    ...partial,
  }
}

const TOWNS: MarketPulseSnapshot[] = [
  town({ geo_slug: 'bend', geo_label: 'Bend', active_count: 475, months_of_supply: 3.47, median_days_to_pending: 18, price_reduction_share: 6.6, sold_count_30d: 167 }),
  town({ geo_slug: 'redmond', geo_label: 'Redmond', active_count: 180, months_of_supply: 4.25, median_days_to_pending: 20, price_reduction_share: 8.2, sold_count_30d: 30 }),
  town({ geo_slug: 'terrebonne', geo_label: 'Terrebonne', active_count: 6, months_of_supply: 36, median_days_to_pending: null, price_reduction_share: 16.67, sold_count_30d: 0 }),
]

const INPUT: CityRankInput = {
  towns: TOWNS,
  region: town({ geo_slug: 'central-oregon', geo_label: 'Central Oregon', active_count: 1801, price_reduction_share: 8.46 }),
  subjectGeoSlug: 'bend',
  subjectName: 'Bend',
  publishedMos: 3.47,
  publishedDtp: 18,
}

describe('buildMosCard', () => {
  it('binds the subject row to the published figure and derives the finding', () => {
    const card = buildMosCard(INPUT)!
    expect(card).not.toBeNull()
    expect(card.title).toBe('Bend tightest at 3.5 months')
    expect(card.clampMax).toBe(MOS_SCALE_MAX)
    // Sorted ascending; the degenerate outlier is present with its true label.
    expect(card.rows!.map((r) => r.tick)).toEqual(['Bend', 'Redmond', 'Terrebonne'])
    expect(card.rows![2]!.value).toBe(36)
    expect(card.rows![2]!.label).toBe('36.0 mo')
    // Population is in the reading, labeled, with small samples named.
    expect(card.rows![0]!.note).toContain('475 active single-family')
    expect(card.rows![2]!.note).toContain('small sample')
    // Trace cites the stamp on the rows, not a remembered constant.
    expect(card.source).toContain('methodology v3-2026-05-07')
  })

  it('falls back to the pulse row and names the universe split when the pill withheld', () => {
    const card = buildMosCard({ ...INPUT, publishedMos: null, displayedActiveCount: 980 })!
    expect(card).not.toBeNull()
    // The subject row is the pulse city figure, and the trace names the split
    // instead of claiming the verdict binding.
    expect(card.title).toBe('Bend tightest at 3.5 months')
    expect(card.source).toContain("The page's inventory count (980)")
    expect(card.source).toContain('pulse city population')
    expect(card.source).not.toContain('verdict above')
  })

  it('claims the verdict binding only when the published figure exists', () => {
    const bound = buildMosCard({ ...INPUT, displayedActiveCount: 475 })!
    expect(bound.source).toContain('same published figure as the verdict above')
  })

  it('uses the non-superlative finding when the subject is not tightest', () => {
    const card = buildMosCard({ ...INPUT, subjectGeoSlug: 'redmond', subjectName: 'Redmond', publishedMos: 4.25 })!
    expect(card.title).toBe('Redmond supply: 4.3 months')
  })
})

describe('buildDtpCard', () => {
  it('omits towns with no median and names them in the trace', () => {
    const card = buildDtpCard(INPUT)!
    expect(card.title).toBe('Bend pends in 18 days')
    expect(card.rows!.map((r) => r.tick)).toEqual(['Bend', 'Redmond'])
    expect(card.source).toContain('Terrebonne')
    expect(card.source).toContain('median is undefined')
  })

  it('returns null without the subject city', () => {
    expect(buildDtpCard({ ...INPUT, subjectGeoSlug: 'sisters', subjectName: 'Sisters' })).toBeNull()
  })
})

describe('buildCutsCard', () => {
  it('sorts descending, carries the region rule, and labels populations', () => {
    const card = buildCutsCard(INPUT)!
    expect(card.title).toBe('6.6% of Bend actives cut')
    expect(card.rows!.map((r) => r.tick)).toEqual(['Terrebonne', 'Redmond', 'Bend'])
    expect(card.refValue).toBeCloseTo(8.46, 9)
    expect(card.refLabel).toBe('Region 8.5%')
    // The region universe is named as broader than the towns charted.
    expect(card.source).toContain('1,801 actives')
    expect(card.source).toContain('broader than')
  })

  it('drops the region rule when the region row is missing', () => {
    const card = buildCutsCard({ ...INPUT, region: null })!
    expect(card.refValue).toBeUndefined()
  })
})

describe('buildStoCard', () => {
  const PAIRS: CityQuarterPair[] = [
    { citySlug: 'redmond', city: 'Redmond', quarter: 2, currentYear: 2026, priorYear: 2025, currentClosings: 180, priorClosings: 211, currentMedian: 0.9875, priorMedian: 0.9991 },
    { citySlug: 'bend', city: 'Bend', quarter: 2, currentYear: 2026, priorYear: 2025, currentClosings: 514, priorClosings: 574, currentMedian: 0.9845, priorMedian: 0.9779 },
    { citySlug: 'black-butte-ranch', city: 'Black Butte Ranch', quarter: 2, currentYear: 2026, priorYear: 2025, currentClosings: 12, priorClosings: 7, currentMedian: 0.9015, priorMedian: 0.96 },
  ]

  it('builds dumbbell rows with the window named on both sides', () => {
    const card = buildStoCard(PAIRS, { subjectCitySlug: 'bend', subjectName: 'Bend', factsAsOf: null })!
    expect(card.title).toBe('Bend at 98.5% of ask')
    expect(card.displayLine).toContain('Q2 2025 vs Q2 2026')
    expect(card.rangeKeyLabel).toBe('Q2 2026')
    expect(card.rangeBaseKeyLabel).toBe('Q2 2025')
    expect(card.refValue).toBe(100)
    const bbr = card.rows!.find((r) => r.tick === 'Black Butte Ranch')!
    expect(bbr.baseValue).toBeCloseTo(96, 9)
    expect(bbr.note).toContain('small sample')
  })

  it('returns null without the subject pair', () => {
    expect(buildStoCard(PAIRS.slice(0, 1), { subjectCitySlug: 'bend', subjectName: 'Bend', factsAsOf: null })).toBeNull()
  })
})

describe('buildYearCard', () => {
  const YEARS: CityYearPricingRow[] = [
    { citySlug: 'bend', city: 'Bend', year: 1997, closings: 1228, medianClose: 128103, medianPpsf: 84, medianDaysToOffer: 92, medianSaleToOriginal: 0.98, newConstructionCount: 8, newConstructionShare: 8 / 1228 },
    { citySlug: 'bend', city: 'Bend', year: 2025, closings: 1200, medianClose: 765000, medianPpsf: 400, medianDaysToOffer: 20, medianSaleToOriginal: 0.98, newConstructionCount: 200, newConstructionShare: 200 / 1200 },
    // The running year must never chart as a complete year (§0).
    { citySlug: 'bend', city: 'Bend', year: 2026, closings: 1219, medianClose: 765000, medianPpsf: 404, medianDaysToOffer: 19, medianSaleToOriginal: 0.98, newConstructionCount: 233, newConstructionShare: 233 / 1219 },
  ]

  it('charts complete years only and derives the multiple', () => {
    const card = buildYearCard(YEARS, { subjectName: 'Bend', currentYear: 2026, factsAsOf: null })!
    expect(card.title).toBe('Bend median 6.0x since 1997')
    expect(card.displayLine).toBe('Median detached close price per year, 1997–2025.')
    const points = card.series![0]!.points
    expect(points.map((p) => p.tick)).toEqual(['1997', '2025'])
    expect(points[0]!.label).toBe('$128,103')
    expect(card.source).toContain('2026 is still in progress')
  })

  it('returns null with fewer than two complete years', () => {
    expect(buildYearCard(YEARS.slice(1), { subjectName: 'Bend', currentYear: 2026, factsAsOf: null })).toBeNull()
  })
})
