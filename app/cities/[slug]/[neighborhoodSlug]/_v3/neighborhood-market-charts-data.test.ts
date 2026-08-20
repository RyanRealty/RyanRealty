import { describe, expect, it } from 'vitest'
import type { NeighborhoodPublicInventory } from '@/lib/data/geo/neighborhood-public-inventory'
import {
  ALL_BEND_DISTRICTS_SLUG,
  type NeighborhoodYearPricingRow,
} from '@/lib/data/geo/getNeighborhoodYearPricing'
import {
  buildAskingRankCard,
  buildClosedRankCard,
  buildDistrictHistoryCard,
  buildIndexedCard,
  completeYears,
  ordinal,
} from './neighborhood-market-charts-data'

const CURRENT_YEAR = 2026

function yr(
  partial: Partial<NeighborhoodYearPricingRow> & { geoSlug: string; year: number },
): NeighborhoodYearPricingRow {
  return {
    geoLabel: partial.geoSlug === ALL_BEND_DISTRICTS_SLUG ? 'All Bend districts' : 'Awbrey Butte',
    closings: 50,
    medianClose: 500_000,
    medianPpsf: 250,
    totalVolume: 25_000_000,
    ...partial,
  }
}

/** Awbrey Butte, verified live 2026-08-19 against neighborhood_year_pricing_mv. */
const AWBREY: NeighborhoodYearPricingRow[] = [
  yr({ geoSlug: 'bend-awbrey-butte', year: 1997, closings: 46, medianClose: 259_500, medianPpsf: 109.43 }),
  yr({ geoSlug: 'bend-awbrey-butte', year: 2005, closings: 177, medianClose: 614_910, medianPpsf: 206.77 }),
  yr({ geoSlug: 'bend-awbrey-butte', year: 2015, closings: 163, medianClose: 595_000, medianPpsf: 231.23 }),
  yr({ geoSlug: 'bend-awbrey-butte', year: 2022, closings: 120, medianClose: 1_150_000, medianPpsf: 430 }),
  yr({ geoSlug: 'bend-awbrey-butte', year: 2023, closings: 110, medianClose: 1_200_000, medianPpsf: 435 }),
  yr({ geoSlug: 'bend-awbrey-butte', year: 2024, closings: 127, medianClose: 1_235_000, medianPpsf: 440 }),
  yr({ geoSlug: 'bend-awbrey-butte', year: 2025, closings: 135, medianClose: 1_285_000, medianPpsf: 446.73 }),
  // The running year is present in the MV and must never be charted.
  yr({ geoSlug: 'bend-awbrey-butte', year: 2026, closings: 78, medianClose: 1_207_500, medianPpsf: 447.8 }),
]

const ALL_DISTRICTS: NeighborhoodYearPricingRow[] = [
  yr({ geoSlug: ALL_BEND_DISTRICTS_SLUG, year: 1997, closings: 873, medianClose: 121_500, medianPpsf: 82.39 }),
  yr({ geoSlug: ALL_BEND_DISTRICTS_SLUG, year: 2005, closings: 2649, medianClose: 279_900, medianPpsf: 159.12 }),
  yr({ geoSlug: ALL_BEND_DISTRICTS_SLUG, year: 2015, closings: 2363, medianClose: 329_900, medianPpsf: 181.68 }),
  yr({ geoSlug: ALL_BEND_DISTRICTS_SLUG, year: 2022, closings: 1800, medianClose: 700_000, medianPpsf: 380 }),
  yr({ geoSlug: ALL_BEND_DISTRICTS_SLUG, year: 2023, closings: 1449, medianClose: 715_000, medianPpsf: 388 }),
  yr({ geoSlug: ALL_BEND_DISTRICTS_SLUG, year: 2024, closings: 1453, medianClose: 730_000, medianPpsf: 392 }),
  yr({ geoSlug: ALL_BEND_DISTRICTS_SLUG, year: 2025, closings: 1513, medianClose: 740_000, medianPpsf: 396.83 }),
  yr({ geoSlug: ALL_BEND_DISTRICTS_SLUG, year: 2026, closings: 875, medianClose: 749_900, medianPpsf: 398.29 }),
]

function inv(
  partial: Partial<NeighborhoodPublicInventory> & { slug: string; label: string },
): NeighborhoodPublicInventory {
  // pricedCount defaults to the district count: every active listing carries a
  // price unless a case deliberately says otherwise. A fixture that set only
  // activeCount would otherwise describe a district whose median rests on more
  // listings than the district holds.
  return {
    geoSlug: `bend-${partial.slug}`,
    activeCount: 20,
    pricedCount: partial.activeCount ?? 20,
    medianListPrice: 700_000,
    listingKeys: [],
    href: `/cities/bend/${partial.slug}`,
    ...partial,
  }
}

describe('completeYears', () => {
  it('drops the running year and anything without a median', () => {
    const rows = completeYears(
      [...AWBREY, yr({ geoSlug: 'bend-awbrey-butte', year: 2021, medianClose: null })],
      CURRENT_YEAR,
    )
    expect(rows.map((r) => r.year)).toEqual([1997, 2005, 2015, 2022, 2023, 2024, 2025])
  })
})

describe('buildDistrictHistoryCard', () => {
  const card = buildDistrictHistoryCard(AWBREY, {
    districtName: 'Awbrey Butte',
    currentYear: CURRENT_YEAR,
  })!

  it('derives the finding from the first and last complete year', () => {
    // 1,285,000 / 259,500 = 4.95 -> 5.0x
    expect(card.title).toBe('Awbrey Butte median 5.0x since 1997')
    expect(card.wide).toBe(true)
  })

  it('offers price, per-sqft and homes-sold as views of one population', () => {
    expect(card.views!.items.map((i) => i.key)).toEqual(['price', 'ppsf', 'sold'])
    expect(card.views!.panels).toHaveLength(3)
    expect(card.views!.panels[0]!.kind).toBe('line')
    expect(card.views!.panels[2]!.kind).toBe('bars')
    // Consecutive periods of one population: one tone, no per-bar key legend.
    expect(card.views!.panels[2]!.run).toBe(true)
  })

  it('prints exact medians and never charts the running year', () => {
    const points = card.views!.panels[0]!.series![0]!.points
    expect(points.map((p) => p.tick)).not.toContain('2026')
    expect(points[0]!.label).toBe('$259,500')
    expect(points[points.length - 1]!.label).toBe('$1,285,000')
  })

  it('traces the population, both endpoints, and the excluded year', () => {
    expect(card.source).toContain('neighborhood_year_pricing_mv')
    expect(card.source).toContain('1997: 46 closings, median $259,500')
    expect(card.source).toContain('2025: 135 closings, median $1,285,000')
    expect(card.source).toContain('2026 is still running')
  })

  it('withholds the card when the district has too few complete years', () => {
    expect(
      buildDistrictHistoryCard(AWBREY.slice(0, 3), {
        districtName: 'Awbrey Butte',
        currentYear: CURRENT_YEAR,
      }),
    ).toBeNull()
  })
})

describe('buildIndexedCard', () => {
  const card = buildIndexedCard(AWBREY, ALL_DISTRICTS, {
    districtName: 'Awbrey Butte',
    allLabel: 'All Bend districts',
    currentYear: CURRENT_YEAR,
  })!

  it('states both multiples as the finding', () => {
    // 1,285,000/259,500 = 4.95 -> 5.0 ; 740,000/121,500 = 6.09 -> 6.1
    expect(card.title).toBe('5.0x here, 6.1x across Bend')
    expect(card.displayLine).toContain('1997 = 100')
  })

  it('indexes both series to the same base year', () => {
    const [mine, all] = card.view!.series!
    expect(mine!.points[0]!.label).toBe('100')
    expect(all!.points[0]!.label).toBe('100')
    expect(mine!.points[mine!.points.length - 1]!.label).toBe('495')
    expect(all!.points[all!.points.length - 1]!.label).toBe('609')
    // Both lines share the x key so the geometry aligns on the year.
    expect(mine!.points.map((p) => p.at)).toEqual(all!.points.map((p) => p.at))
  })

  it('names the narrower-than-the-city universe in the trace', () => {
    expect(card.source).toContain('narrower than the city of Bend')
    expect(card.source).toContain('1997 base: Awbrey Butte $259,500')
  })

  it('withholds the card when the two series share too few years', () => {
    expect(
      buildIndexedCard(AWBREY, ALL_DISTRICTS.slice(0, 2), {
        districtName: 'Awbrey Butte',
        allLabel: 'All Bend districts',
        currentYear: CURRENT_YEAR,
      }),
    ).toBeNull()
  })
})

describe('buildClosedRankCard', () => {
  const ROWS: NeighborhoodYearPricingRow[] = [
    ...AWBREY,
    ...ALL_DISTRICTS,
    yr({ geoSlug: 'bend-old-bend', geoLabel: 'Old Bend', year: 2025, closings: 24, medianClose: 1_050_000 }),
    yr({ geoSlug: 'bend-larkspur', geoLabel: 'Larkspur', year: 2025, closings: 120, medianClose: 640_000 }),
    yr({ geoSlug: 'bend-thin', geoLabel: 'Thin District', year: 2025, closings: 4, medianClose: 900_000 }),
  ]
  const card = buildClosedRankCard(ROWS, {
    subjectGeoSlug: 'bend-awbrey-butte',
    districtName: 'Awbrey Butte',
    currentYear: CURRENT_YEAR,
  })!

  it('ranks the districts and leaves the synthetic union out', () => {
    expect(card.title).toBe('1st of 4 by 2025 median')
    expect(card.view!.rows!.map((r) => r.tick)).toEqual([
      'Awbrey Butte',
      'Old Bend',
      'Thin District',
      'Larkspur',
    ])
  })

  it('draws the closings each median was computed over, and names them', () => {
    // neighborhood_year_pricing_mv takes count(*) and the close-price
    // percentile over the same group with no further filter, so `closings` IS
    // that median's population and can sit beside it.
    expect(card.view!.sampleKey).toBe('closings in 2025')
    expect(card.view!.rows![0]!.sample).toEqual({ n: 135 })
    expect(card.view!.rows!.every((r) => r.sample != null)).toBe(true)
    expect(card.view!.rows![2]!.note).toBe('small sample')
    expect(card.source).toContain('the closings that district')
  })

  it('withholds the card when the subject district has no complete year', () => {
    expect(
      buildClosedRankCard(ROWS, {
        subjectGeoSlug: 'bend-not-here',
        districtName: 'Nowhere',
        currentYear: CURRENT_YEAR,
      }),
    ).toBeNull()
  })
})

describe('buildAskingRankCard', () => {
  const INVENTORY: NeighborhoodPublicInventory[] = [
    inv({ slug: 'awbrey-butte', label: 'Awbrey Butte', activeCount: 52, medianListPrice: 1_375_000 }),
    inv({ slug: 'old-bend', label: 'Old Bend', activeCount: 7, medianListPrice: 1_122_500 }),
    inv({ slug: 'larkspur', label: 'Larkspur', activeCount: 32, medianListPrice: 649_999 }),
    // A measured empty is omitted rather than drawn at zero.
    inv({ slug: 'ghost', label: 'Ghost', activeCount: 0, medianListPrice: null }),
  ]
  const card = buildAskingRankCard(INVENTORY, {
    subjectGeoSlug: 'bend-awbrey-butte',
    districtName: 'Awbrey Butte',
  })!

  it('states the subject figure and its rank as the finding', () => {
    expect(card.title).toBe('Asking $1,375,000, 1st of 3')
  })

  it('omits districts with no priced active listing', () => {
    expect(card.view!.rows!.map((r) => r.tick)).toEqual(['Awbrey Butte', 'Old Bend', 'Larkspur'])
    expect(card.view!.rows![1]!.note).toContain('small sample')
  })

  it('draws the PRICED count, not the district count, beside the median', () => {
    const mixed = buildAskingRankCard(
      [
        inv({ slug: 'awbrey-butte', label: 'Awbrey Butte', activeCount: 52, pricedCount: 48, medianListPrice: 1_375_000 }),
        inv({ slug: 'larkspur', label: 'Larkspur', activeCount: 32, pricedCount: 32, medianListPrice: 649_999 }),
      ],
      { subjectGeoSlug: 'bend-awbrey-butte', districtName: 'Awbrey Butte' },
    )!
    expect(mixed.view!.sampleKey).toBe('priced active single-family listings')
    // 48, never the 52 listings the median never saw.
    expect(mixed.view!.rows![0]!.sample).toEqual({ n: 48 })
    expect(mixed.view!.rows![1]!.sample).toEqual({ n: 32 })
  })

  it('separates asking from closed in the trace', () => {
    expect(card.source).toContain('listing_boundary_xref_mv')
    expect(card.source).toContain('what buyers paid')
  })

  it('withholds the card when the subject district is not in the batch', () => {
    expect(
      buildAskingRankCard(INVENTORY, {
        subjectGeoSlug: 'bend-not-here',
        districtName: 'Nowhere',
      }),
    ).toBeNull()
  })
})

describe('ordinal', () => {
  it('reads in plain English through the teens', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '23rd',
    ])
  })
})
