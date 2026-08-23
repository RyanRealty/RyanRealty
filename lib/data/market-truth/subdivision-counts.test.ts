import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  EMPTY_SUBDIVISION_COUNTS,
  subdivisionCountItems,
  subdivisionCountsHasRow,
} from '@/lib/data/market-truth/subdivision-counts'

vi.mock('@/lib/data/market-truth/getMetric', () => ({
  getMetric: vi.fn(),
}))

describe('subdivision counts-only grain', () => {
  it('prints counts and withholds a miss', () => {
    expect(
      subdivisionCountItems({
        activeCount: 4,
        pendingCount: 1,
        closedCount: 9,
      }).map((i) => i.key),
    ).toEqual(['active', 'pending', 'closed'])
    expect(subdivisionCountsHasRow(EMPTY_SUBDIVISION_COUNTS)).toBe(false)
    expect(subdivisionCountItems({ activeCount: 0, pendingCount: null, closedCount: null })).toEqual([])
  })

  it('compute writes counts only — no price, MOS, or verdict cells', () => {
    const sql = readFileSync(
      resolve('supabase/migrations/20260823260000_compute_market_metrics_subdivision.sql'),
      'utf8',
    )
    expect(sql).toMatch(/compute_market_metrics_subdivision_shadow/)
    expect(sql).toMatch(/AND geo_type = 'subdivision'/)
    expect(sql).toMatch(/'active_count'/)
    expect(sql).toMatch(/'pending_count'/)
    expect(sql).toMatch(/'closed_count'/)
    expect(sql).not.toMatch(/median_close/)
    expect(sql).not.toMatch(/median_list/)
    expect(sql).not.toMatch(/months_of_supply/)
    expect(sql).not.toMatch(/market_verdict/)
    expect(sql).not.toMatch(/commercial_lease/)
    expect(sql).not.toMatch(/all_residential/)
    expect(sql).not.toMatch(/geo_type = 'neighborhood'/)
    expect(sql).not.toMatch(/geo_type = 'city'/)
  })

  it('reader goes through getMetric, never pulse', () => {
    const src = readFileSync(resolve('lib/data/market-truth/subdivision-counts.ts'), 'utf8')
    expect(src).toMatch(/getMetric\(/)
    expect(src).toMatch(/geoType: 'subdivision'/)
    expect(src).toMatch(/segment: 'detached'/)
    expect(src).not.toMatch(/market_pulse_live/)
    expect(src).not.toMatch(/getMarketPulse/)
  })

  it('plat page overlays membership counts beside MLS-name inventory', () => {
    const page = readFileSync(resolve('app/subdivisions/[slug]/page.tsx'), 'utf8')
    expect(page).toMatch(/getSubdivisionCounts/)
    expect(page).toMatch(/PublicSubdivisionCounts/)
    expect(page).not.toMatch(/getDetachedMarket/)
  })
})
