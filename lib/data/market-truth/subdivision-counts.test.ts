import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  EMPTY_SUBDIVISION_COUNTS,
  subdivisionCountItems,
  subdivisionCountsHasRow,
  subdivisionExtraItems,
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
        extras: [],
      }).map((i) => i.key),
    ).toEqual(['active', 'pending', 'closed'])
    expect(subdivisionCountsHasRow(EMPTY_SUBDIVISION_COUNTS)).toBe(false)
    expect(
      subdivisionCountItems({ activeCount: 0, pendingCount: null, closedCount: null, extras: [] }),
    ).toEqual([])
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
    // MOVED, NOT DROPPED (2026-08-26). PublicSubdivisionCounts rendered the KB
    // panel; on the v3 barrel the detached counts are figures on the market
    // Instrument (subdivisionCountItems) and the extras are the barrel's
    // property-type enumeration. Same two reads, same two surfaces.
    expect(page).toMatch(/subdivisionCountItems/)
    expect(page).toMatch(/PlaceTypeSlider/)
    expect(page).not.toMatch(/getDetachedMarket/)
  })

  it('extra types print counts only — no MOS, median, or verdict', () => {
    const items = subdivisionExtraItems([
      { segment: 'land', activeCount: 3, pendingCount: 1, closedCount: 8 },
      { segment: 'condo', activeCount: null, pendingCount: null, closedCount: null },
      { segment: 'manufactured_land', activeCount: 2, pendingCount: 2, closedCount: 10 },
      { segment: 'farm', activeCount: null, pendingCount: 1, closedCount: null },
    ])
    expect(items.map((i) => i.key)).toEqual(['land', 'manufactured_land', 'farm'])
    expect(items[0]?.label).toContain('lots')
    expect(items[0]?.bits).toBe('1 pending · now · 8 closed · 12 months')
    expect(items[2]?.label).toContain('pending')
    expect(items.map((i) => `${i.label} ${i.bits ?? ''}`).join(' ')).not.toMatch(/months of supply/i)
    expect(items.map((i) => `${i.label} ${i.bits ?? ''}`).join(' ')).not.toMatch(/\$/)
    const src = readFileSync(resolve('lib/data/market-truth/subdivision-counts.ts'), 'utf8')
    expect(src).toMatch(/PUBLIC_PLACE_SEGMENTS/)
    expect(src).toMatch(/pending_count/)
    expect(src).toMatch(/closed_count/)
    expect(src).not.toMatch(/months_of_supply/)
    expect(src).not.toMatch(/median_list/)
    // The surface that renders the extras is now the barrel's enumeration. The
    // rule it has to hold is the same one: counts only at plat grain. The plat
    // rows carry no median and no months of supply, so the component's own
    // optional figures never fire, and the component must not invent them.
    const ui = readFileSync(resolve('components/site/v3/V3PlacePropertyTypes.tsx'), 'utf8')
    expect(ui).toMatch(/pendingCount/)
    expect(ui).toMatch(/closedCount/)
    expect(ui).not.toMatch(/publicSegmentDisplayBits/)
    // A type the layer withheld is absent, never an empty section and never a 0.
    expect(ui).toMatch(/rows\.length === 0/)
  })
})
