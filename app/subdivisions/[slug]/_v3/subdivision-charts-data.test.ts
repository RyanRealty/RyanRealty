import { describe, expect, it } from 'vitest'
import type { MartAnnualPoint } from '@/lib/data/analytics/getCoMarketAnnual'
import type { SubdivisionSalesYear } from '@/lib/data/subdivisions/getSubdivisionSalesHistory'
import {
  buildPeerPlatsCard,
  buildPlatHistoryCard,
  buildPlatVsAreaCard,
  PLAT_MEDIAN_MIN_CLOSINGS,
  SMALL_PEER_SOLD_FLOOR,
  type PeerPlatRow,
} from './subdivision-charts-data'

const CURRENT_YEAR = 2026

/** A thick plat: NorthWest Crossing's real shape, trimmed. */
const THICK: SubdivisionSalesYear[] = [
  { year: 2026, closedCount: 33, medianClosePrice: 1_120_000 },
  { year: 2025, closedCount: 75, medianClosePrice: 1_075_500 },
  { year: 2024, closedCount: 66, medianClosePrice: 1_142_500 },
  { year: 2023, closedCount: 67, medianClosePrice: 1_165_000 },
  { year: 2022, closedCount: 78, medianClosePrice: 1_177_500 },
  { year: 2021, closedCount: 88, medianClosePrice: 932_000 },
  { year: 2020, closedCount: 114, medianClosePrice: 785_950 },
]

/** A thin plat: Kitty Hawk's real shape, one to four sales a year. */
const THIN: SubdivisionSalesYear[] = [
  { year: 2024, closedCount: 3, medianClosePrice: 317_000 },
  { year: 2023, closedCount: 2, medianClosePrice: 287_500 },
  { year: 2021, closedCount: 4, medianClosePrice: 280_000 },
  { year: 2020, closedCount: 1, medianClosePrice: 235_000 },
  { year: 2019, closedCount: 2, medianClosePrice: 177_000 },
]

const BEND: MartAnnualPoint[] = [
  { year: 2020, soldCount: 3683, medianClose: 512_000 },
  { year: 2021, soldCount: 3666, medianClose: 645_000 },
  { year: 2022, soldCount: 2888, medianClose: 730_000 },
  { year: 2023, soldCount: 2247, medianClose: 720_000 },
  { year: 2024, soldCount: 2343, medianClose: 735_000 },
  { year: 2025, soldCount: 2535, medianClose: 740_000 },
]

describe('buildPlatHistoryCard', () => {
  it('drops the in-progress year and charts the complete ones', () => {
    const card = buildPlatHistoryCard(THICK, { platName: 'NorthWest Crossing', currentYear: CURRENT_YEAR })
    expect(card).toBeDefined()
    expect(card!.switcher).toBeDefined()
    const price = card!.switcher!.panels[0]!
    const ticks = price.series![0]!.points.map((p) => p.tick)
    expect(ticks).toEqual(['2020', '2021', '2022', '2023', '2024', '2025'])
    expect(card!.source).toContain('2026 is still in progress')
  })

  it('states the multiple between the first and last chartable year', () => {
    const card = buildPlatHistoryCard(THICK, { platName: 'NorthWest Crossing', currentYear: CURRENT_YEAR })
    // 1,075,500 / 785,950 = 1.368 -> 1.4x across 2020 to 2025
    expect(card!.title).toBe('Median 1.4x, 2020 to 2025')
  })

  it('counts every complete year in the volume view, thin years included', () => {
    const card = buildPlatHistoryCard(THIN, { platName: 'Kitty Hawk', currentYear: CURRENT_YEAR })
    expect(card).toBeDefined()
    expect(card!.switcher).toBeUndefined()
    expect(card!.chart!.kind).toBe('bars')
    expect(card!.chart!.series![0]!.points).toHaveLength(THIN.length)
  })

  it('withholds the median line when too few years clear the closings floor', () => {
    const card = buildPlatHistoryCard(THIN, { platName: 'Kitty Hawk', currentYear: CURRENT_YEAR })
    expect(card!.title).toBe('12 sales, 2019 to 2024')
    expect(card!.source).toContain(`at least ${PLAT_MEDIAN_MIN_CLOSINGS} closings`)
    expect(card!.source).toContain('No median price is charted')
    expect(card!.source).toContain('No year clears it')
  })

  it('counts the qualifying years in plural when one or two clear the floor', () => {
    const two: SubdivisionSalesYear[] = [
      { year: 2024, closedCount: 7, medianClosePrice: 500_000 },
      { year: 2023, closedCount: 6, medianClosePrice: 480_000 },
      { year: 2022, closedCount: 2, medianClosePrice: 460_000 },
    ]
    const card = buildPlatHistoryCard(two, { platName: 'Braeburn', currentYear: CURRENT_YEAR })
    expect(card!.switcher).toBeUndefined()
    expect(card!.source).toContain('Only 2 years clear it')
  })

  it('names the thin years withheld from a median line that did draw', () => {
    const mixed: SubdivisionSalesYear[] = [
      ...THICK.slice(1),
      { year: 2019, closedCount: 2, medianClosePrice: 700_000 },
      { year: 2018, closedCount: 1, medianClosePrice: 690_000 },
    ]
    const card = buildPlatHistoryCard(mixed, { platName: 'NorthWest Crossing', currentYear: CURRENT_YEAR })
    expect(card!.source).toContain('2 of the 8 years closed fewer than that')
  })

  it('does not claim the running year is withheld when the plat recorded none', () => {
    const card = buildPlatHistoryCard(THIN, { platName: 'Kitty Hawk', currentYear: CURRENT_YEAR })
    expect(card!.source).not.toContain('still in progress')
  })

  it('returns nothing when there are fewer than two complete years', () => {
    expect(
      buildPlatHistoryCard([{ year: 2025, closedCount: 9, medianClosePrice: 800_000 }], {
        platName: 'Braeburn',
        currentYear: CURRENT_YEAR,
      }),
    ).toBeUndefined()
  })
})

describe('buildPlatVsAreaCard', () => {
  const area = { label: 'Bend', slug: 'bend', kind: 'city' as const, rows: BEND }

  it('draws the plat and the area on one axis over their shared years', () => {
    const card = buildPlatVsAreaCard(THICK, area, {
      platName: 'NorthWest Crossing',
      currentYear: CURRENT_YEAR,
    })
    expect(card).toBeDefined()
    expect(card!.chart!.series).toHaveLength(2)
    expect(card!.chart!.series![0]!.name).toBe('NorthWest Crossing median')
    expect(card!.chart!.series![1]!.name).toBe('Bend median')
  })

  it('states the ratio at the latest shared year', () => {
    const card = buildPlatVsAreaCard(THICK, area, {
      platName: 'NorthWest Crossing',
      currentYear: CURRENT_YEAR,
    })
    // 1,075,500 / 740,000 = 1.453 -> 1.5x
    expect(card!.title).toBe('1.5x the Bend median, 2025')
    expect(card!.source).toContain('2,535 Bend closings')
  })

  it('returns nothing when the plat cannot clear the floor in enough shared years', () => {
    expect(
      buildPlatVsAreaCard(THIN, area, { platName: 'Kitty Hawk', currentYear: CURRENT_YEAR }),
    ).toBeUndefined()
  })

  it('returns nothing when the area carries none of the plat years', () => {
    const stale: MartAnnualPoint[] = [{ year: 1999, soldCount: 900, medianClose: 150_000 }]
    expect(
      buildPlatVsAreaCard(THICK, { ...area, rows: stale }, {
        platName: 'NorthWest Crossing',
        currentYear: CURRENT_YEAR,
      }),
    ).toBeUndefined()
  })
})

describe('buildPeerPlatsCard', () => {
  const stamp = {
    parentLabel: 'Sunriver',
    periodStart: '2026-01-01',
    periodEnd: '2026-08-19',
    methodologyVersion: 'v3-2026-05-07',
    computedAt: '2026-08-19T08:31:39.073806+00:00',
    unnamedCount: 4,
  }
  const peers: PeerPlatRow[] = [
    { slug: 'deer-park', name: 'Deer Park', soldCount: 9, medianSalePrice: 860_000 },
    { slug: 'mtn-village-east', name: 'Mtn Village East', soldCount: 10, medianSalePrice: 717_500 },
    { slug: 'fairway-crest-village', name: 'Fairway Crest Village', soldCount: 12, medianSalePrice: 935_000 },
    { slug: 'meadow-village', name: 'Meadow Village', soldCount: 6, medianSalePrice: 967_500 },
  ]

  it('ranks by median and labels every row with its own population', () => {
    const card = buildPeerPlatsCard(peers, 'deer-park', stamp)
    expect(card).toBeDefined()
    expect(card!.chart!.kind).toBe('range')
    expect(card!.chart!.rows!.map((r) => r.tick)).toEqual([
      'Meadow Village',
      'Fairway Crest Village',
      'Deer Park',
      'Mtn Village East',
    ])
    // market_stats_cache takes sold_count and median_sale_price off the same
    // closed_sales CTE, so soldCount IS this median's population and is drawn.
    expect(card!.chart!.sampleKey).toBe('closings year to date')
    expect(card!.chart!.rows![0]!.sample).toEqual({ n: 6 })
    expect(card!.chart!.rows![3]!.sample).toEqual({ n: 10 })
    expect(card!.chart!.rows![0]!.note).toBe('small sample')
    expect(card!.chart!.rows![3]!.note).toBeUndefined()
    // The row reading names the plat once, not twice.
    expect(card!.chart!.rows![0]!.tick).toBe('Meadow Village')
  })

  it('names the small samples and the window in the trace', () => {
    const card = buildPeerPlatsCard(peers, 'deer-park', stamp)
    expect(card!.source).toContain(`fewer than ${SMALL_PEER_SOLD_FLOOR} homes`)
    expect(card!.source).toContain("the closings that plat's median was computed over")
    expect(card!.source).toContain('2026-01-01 to 2026-08-19')
    expect(card!.source).toContain('v3-2026-05-07')
    expect(card!.source).toContain('4 carry an MLS token that is not a place name')
  })

  it('separates plats that sold but publish no median from plats that sold nothing', () => {
    const mixed: PeerPlatRow[] = [
      ...peers,
      { slug: 'forest-park', name: 'Forest Park', soldCount: 2, medianSalePrice: null },
      { slug: 'fremont-crossing', name: 'Fremont Crossing', soldCount: 1, medianSalePrice: null },
      { slug: 'skypark', name: 'Skypark', soldCount: 0, medianSalePrice: null },
    ]
    const card = buildPeerPlatsCard(mixed, 'deer-park', stamp)
    expect(card!.chart!.rows).toHaveLength(4)
    expect(card!.source).toContain('4 of the 7 named Sunriver plats publish a median')
    expect(card!.source).toContain('2 more closed a sale in the window but publish no median')
  })

  it('calls out the top and bottom of the ranking', () => {
    expect(buildPeerPlatsCard(peers, 'meadow-village', stamp)!.title).toBe(
      'Highest median in Sunriver',
    )
    expect(buildPeerPlatsCard(peers, 'mtn-village-east', stamp)!.title).toBe(
      'Lowest median in Sunriver',
    )
    expect(buildPeerPlatsCard(peers, 'deer-park', stamp)!.title).toBe(
      'Median $860K year to date',
    )
  })

  it('returns nothing when the subject plat closed nothing in the window', () => {
    expect(buildPeerPlatsCard(peers, 'quelah-condos', stamp)).toBeUndefined()
  })

  it('returns nothing when fewer than three plats have a median', () => {
    expect(buildPeerPlatsCard(peers.slice(0, 2), 'deer-park', stamp)).toBeUndefined()
  })
})
