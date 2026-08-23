import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  SALE_SEGMENTS,
  collapseCitySegmentRows,
  type RawSegmentCell,
} from '@/lib/data/market-truth/city-segment-collapse'

const SRC = readFileSync(resolve('lib/data/market-truth/city-segments.ts'), 'utf8')
const COLLAPSE = readFileSync(resolve('lib/data/market-truth/city-segment-collapse.ts'), 'utf8')
const PAGE = readFileSync(
  resolve('app/admin/(protected)/analytics/city-segments/page.tsx'),
  'utf8',
)
const CATALOG = readFileSync(
  resolve('app/admin/(protected)/analytics/_components/ReportCatalog.tsx'),
  'utf8',
)

describe('getCitySegmentBoard', () => {
  it('reads publishable market_metric city cells for the 11 sale segments', () => {
    expect(SRC).toMatch(/from\('market_metric'\)/)
    expect(SRC).toMatch(/is_publishable/)
    expect(SRC).toMatch(/definition_id/)
    expect(SRC).toMatch(/DEFINITION_ID/)
    expect(SRC).toMatch(/geo_type',\s*'city'/)
    expect(SRC).toMatch(/BOARD_STATS/)
    expect(SRC).toMatch(/SALE_SEGMENTS/)
    expect(SRC).not.toMatch(/market_pulse_live/)
    expect(SRC).not.toMatch(/'commercial_lease'/)
    expect(COLLAPSE).not.toMatch(/'commercial_lease'/)
    expect(COLLAPSE).not.toMatch(/market_pulse_live/)
    for (const id of SALE_SEGMENTS) {
      expect(COLLAPSE).toContain(`'${id}'`)
    }
    expect([...SALE_SEGMENTS]).toEqual([
      'detached',
      'condo',
      'townhome',
      'manufactured_land',
      'manufactured_park',
      'multifamily_2_4',
      'land',
      'farm',
      'commercial_sale',
      'business',
      'all_residential',
    ])
    expect(SALE_SEGMENTS).toHaveLength(11)
  })

  it('collapses latest period_end then window 0 for point stats and 6 for MOS/verdict', () => {
    const cell = (
      partial: Partial<RawSegmentCell> & Pick<RawSegmentCell, 'stat_id' | 'value' | 'window_months' | 'period_end'>,
    ): RawSegmentCell => ({
      segment: 'condo',
      value_text: null,
      sample_n: 40,
      computed_at: '2026-08-23T01:00:00Z',
      complete_through: '2026-08-22',
      is_publishable: true,
      ...partial,
    })
    const rows = collapseCitySegmentRows([
      cell({
        stat_id: 'active_count',
        value: 12,
        window_months: 0,
        period_end: '2026-08-22',
      }),
      cell({
        stat_id: 'active_count',
        value: 66,
        window_months: 0,
        period_end: '2026-08-23',
      }),
      cell({
        stat_id: 'months_of_supply',
        value: 99,
        window_months: 12,
        period_end: '2026-08-23',
      }),
      cell({
        stat_id: 'months_of_supply',
        value: 12.8,
        window_months: 6,
        period_end: '2026-08-23',
      }),
      cell({
        stat_id: 'market_verdict',
        value: 12.8,
        value_text: 'buyer',
        window_months: 6,
        period_end: '2026-08-23',
      }),
      cell({
        stat_id: 'median_list_active',
        value: 425000,
        window_months: 0,
        period_end: '2026-08-23',
        is_publishable: false,
      }),
    ])
    const condo = rows.find((r) => r.segment === 'condo')
    expect(condo?.activeCount).toBe(66)
    expect(condo?.monthsOfSupply).toBeCloseTo(12.8)
    expect(condo?.verdict).toBe('buyer')
    expect(condo?.medianList).toBeNull()
    const farm = rows.find((r) => r.segment === 'farm')
    expect(farm?.activeCount).toBeNull()
    expect(farm?.medianList).toBeNull()
    expect(farm?.monthsOfSupply).toBeNull()
    expect(farm?.verdict).toBeNull()
    expect(farm?.sampleN).toBeNull()
    expect(SRC).toMatch(/A missing cell is null, never 0/)
  })
})

describe('admin city-segment board', () => {
  it('is an internal mt-v1 page, not pulse, office ranks, or neighborhood MOS', () => {
    expect(PAGE).toMatch(/force-dynamic/)
    expect(PAGE).toMatch(/getCitySegmentBoard/)
    expect(PAGE).toMatch(/formatPriceExact/)
    expect(PAGE).toMatch(/formatMonthsOfSupply/)
    expect(PAGE).not.toMatch(/formatPriceExact=\{/)
    expect(PAGE).not.toMatch(/formatMonthsOfSupply=\{/)
    expect(PAGE).toMatch(/\/cities\//)
    expect(PAGE).toMatch(/\/admin\/analytics\/city-leaderboard/)
    expect(PAGE).toMatch(/searchParams/)
    expect(PAGE).toMatch(/city/)
    expect(PAGE).toMatch(/bend/)
    expect(PAGE).not.toMatch(/market_pulse_live/)
    expect(PAGE).not.toMatch(/av2-chiprow/)
    expect(PAGE).toMatch(/Not office share/)
    expect(PAGE).not.toMatch(/getCoOfficeShare/)
    expect(PAGE).not.toMatch(/geo_type['"],\s*['"]neighborhood/)
  })

  it('adds one catalog tile after City market ranks', () => {
    expect(CATALOG).toMatch(/\/admin\/analytics\/city-segments/)
    expect(CATALOG).toMatch(/City segment board/)
    const ranks = CATALOG.indexOf("href: '/admin/analytics/city-leaderboard'")
    const segments = CATALOG.indexOf("href: '/admin/analytics/city-segments'")
    expect(ranks).toBeGreaterThan(0)
    expect(segments).toBeGreaterThan(ranks)
  })
})
