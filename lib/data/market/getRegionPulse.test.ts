/**
 * lib/data/market/getRegionPulse.test.ts
 *
 * DATA-7 (migration 20260923014700_pulse_withhold_unverified_closed_side.sql):
 * a withheld market_pulse_live.sold_count_30d/90d column must stay `null`
 * through this DAL's conversion, never coalesced to `0` (CLAUDE.md §0 —
 * unknown/withheld is not zero).
 *
 * getDetachedOverlays is forced to reject so the region overlay branch takes
 * its catch path (withholdDetachedHeadlines), which does not touch
 * soldCount30d/soldCount90d — isolating this test to the row → RegionPulse
 * conversion in getRegionPulse.ts itself.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const rowMock = vi.fn()
vi.mock('@/lib/data/market/getMarketStatsCacheRows', () => ({
  getMarketPulseRowForGeo: (...args: unknown[]) => rowMock(...args),
}))
vi.mock('@/lib/data/market-truth/getSellBendMarket', () => ({
  getDetachedOverlays: vi.fn(async () => {
    throw new Error('market_metric timeout')
  }),
  overlayDetachedLayers: (row: unknown) => row,
  withholdDetachedHeadlines: (row: Record<string, unknown>) => ({
    ...row,
    activeCount: null,
    medianListPrice: null,
    monthsOfSupply: null,
    marketHealthLabel: null,
  }),
}))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))

function row(over: Record<string, unknown> = {}) {
  return {
    active_count: 412,
    pending_count: 88,
    new_count_30d: 51,
    median_list_price: 625_000,
    median_active_dom: 40,
    median_days_to_pending: 21,
    months_of_supply: 4.2,
    market_health_label: 'Warm',
    sold_count_30d: 88,
    sold_count_90d: 260,
    updated_at: '2026-09-23T00:00:00.000Z',
    ...over,
  }
}

describe('getRegionPulse — sold_count_30d/90d null preservation (DATA-7)', () => {
  beforeEach(() => {
    vi.resetModules()
    rowMock.mockReset()
  })

  it('keeps NULL sold_count_30d/90d columns as null, never coalesced to 0', async () => {
    const { getRegionPulse } = await import('./getRegionPulse')
    rowMock.mockResolvedValue(row({ sold_count_30d: null, sold_count_90d: null }))

    const pulse = await getRegionPulse()
    expect(pulse).not.toBeNull()
    expect(pulse!.soldCount30d).toBeNull()
    expect(pulse!.soldCount90d).toBeNull()
    expect(pulse!.soldCount30d).not.toBe(0)
    expect(pulse!.soldCount90d).not.toBe(0)
  })

  it('still converts real numeric sold counts, including a genuine zero', async () => {
    const { getRegionPulse } = await import('./getRegionPulse')
    rowMock.mockResolvedValue(row({ sold_count_30d: 0, sold_count_90d: 143 }))

    const pulse = await getRegionPulse()
    expect(pulse!.soldCount30d).toBe(0)
    expect(pulse!.soldCount90d).toBe(143)
  })
})
