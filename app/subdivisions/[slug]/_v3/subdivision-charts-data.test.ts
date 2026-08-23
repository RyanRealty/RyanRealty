import { describe, expect, it } from 'vitest'
import type { MartAnnualPoint } from '@/lib/data/analytics/getCoMarketAnnual'
import type { SubdivisionSalesYear } from '@/lib/data/subdivisions/getSubdivisionSalesHistory'
import {
  buildPeerPlatsCard,
  buildPlatHistoryCard,
  buildPlatVsAreaCard,
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
  it('drops the in-progress year and charts counts for the complete ones', () => {
    const card = buildPlatHistoryCard(THICK, { platName: 'NorthWest Crossing', currentYear: CURRENT_YEAR })
    expect(card).toBeDefined()
    expect(card!.switcher).toBeUndefined()
    expect(card!.chart!.kind).toBe('bars')
    const ticks = card!.chart!.series![0]!.points.map((p) => p.tick)
    expect(ticks).toEqual(['2020', '2021', '2022', '2023', '2024', '2025'])
    expect(card!.source).toContain('2026 is still in progress')
    expect(card!.source).toContain('No median price is charted')
  })

  it('titles the count window, never a median multiple', () => {
    const card = buildPlatHistoryCard(THICK, { platName: 'NorthWest Crossing', currentYear: CURRENT_YEAR })
    expect(card!.title).toBe('488 sales, 2020 to 2025')
    expect(card!.title).not.toMatch(/median/i)
  })

  it('counts every complete year, thin years included', () => {
    const card = buildPlatHistoryCard(THIN, { platName: 'Kitty Hawk', currentYear: CURRENT_YEAR })
    expect(card).toBeDefined()
    expect(card!.switcher).toBeUndefined()
    expect(card!.chart!.kind).toBe('bars')
    expect(card!.chart!.series![0]!.points).toHaveLength(THIN.length)
    expect(card!.title).toBe('12 sales, 2019 to 2024')
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

  it('withholds the vs-area median card even for a thick plat', () => {
    expect(
      buildPlatVsAreaCard(THICK, area, {
        platName: 'NorthWest Crossing',
        currentYear: CURRENT_YEAR,
      }),
    ).toBeUndefined()
  })

  it('withholds the vs-area median card for a thin plat', () => {
    expect(
      buildPlatVsAreaCard(THIN, area, { platName: 'Kitty Hawk', currentYear: CURRENT_YEAR }),
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
    { slug: 'deer-park', name: 'Deer Park', soldCount: 9 },
    { slug: 'mtn-village-east', name: 'Mtn Village East', soldCount: 10 },
    { slug: 'fairway-crest-village', name: 'Fairway Crest Village', soldCount: 12 },
    { slug: 'meadow-village', name: 'Meadow Village', soldCount: 6 },
  ]

  it('ranks by closed count, not median', () => {
    const card = buildPeerPlatsCard(peers, 'deer-park', stamp)
    expect(card).toBeDefined()
    expect(card!.chart!.kind).toBe('range')
    expect(card!.chart!.rows!.map((r) => r.tick)).toEqual([
      'Fairway Crest Village',
      'Mtn Village East',
      'Deer Park',
      'Meadow Village',
    ])
    expect(card!.chart!.sampleKey).toBe('closings year to date')
    expect(card!.chart!.rows![0]!.sample).toEqual({ n: 12 })
    expect(card!.chart!.rows![3]!.sample).toEqual({ n: 6 })
    expect(card!.source).toContain('Count only')
    expect(card!.source).not.toMatch(/median close/i)
    expect(card!.source).not.toMatch(/median sale/i)
  })

  it('names the window in the trace', () => {
    const card = buildPeerPlatsCard(peers, 'deer-park', stamp)
    expect(card!.source).toContain('2026-01-01 to 2026-08-19')
    expect(card!.source).toContain('v3-2026-05-07')
    expect(card!.source).toContain('4 carry an MLS token that is not a place name')
  })

  it('includes plats that sold without a median, and drops plats that sold nothing', () => {
    const mixed: PeerPlatRow[] = [
      ...peers,
      { slug: 'forest-park', name: 'Forest Park', soldCount: 2 },
      { slug: 'fremont-crossing', name: 'Fremont Crossing', soldCount: 1 },
      { slug: 'skypark', name: 'Skypark', soldCount: 0 },
    ]
    const card = buildPeerPlatsCard(mixed, 'deer-park', stamp)
    expect(card!.chart!.rows).toHaveLength(6)
    expect(card!.source).toContain('6 of the 7 named Sunriver plats closed a sale')
  })

  it('calls out the top and bottom of the ranking', () => {
    expect(buildPeerPlatsCard(peers, 'fairway-crest-village', stamp)!.title).toBe(
      'Most sales in Sunriver',
    )
    expect(buildPeerPlatsCard(peers, 'meadow-village', stamp)!.title).toBe(
      'Fewest sales in Sunriver',
    )
    expect(buildPeerPlatsCard(peers, 'deer-park', stamp)!.title).toBe('9 sales year to date')
  })

  it('returns nothing when the subject plat closed nothing in the window', () => {
    expect(buildPeerPlatsCard(peers, 'quelah-condos', stamp)).toBeUndefined()
  })

  it('returns nothing when fewer than three plats closed a sale', () => {
    expect(buildPeerPlatsCard(peers.slice(0, 2), 'deer-park', stamp)).toBeUndefined()
  })
})
