/**
 * lib/data/market/getMarketPulseSnapshot.test.ts
 *
 * DATA-7 (migration 20260923014700_pulse_withhold_unverified_closed_side.sql):
 * `toSnapshot`'s sold_count_30d/90d conversion must keep a withheld (NULL)
 * column `null`, never coalesce it to `0` (CLAUDE.md §0 — unknown/withheld is
 * not zero). getDetachedOverlays is forced to reject so the region path
 * takes its catch branch, which does not touch sold_count_30d/90d — isolating
 * this test to the row → MarketPulseSnapshot conversion itself.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const maybeSingle = vi.fn()
const eq3 = vi.fn(() => ({ maybeSingle }))
const eq2 = vi.fn(() => ({ eq: eq3 }))
const eq1 = vi.fn(() => ({ eq: eq2 }))
const select = vi.fn(() => ({ eq: eq1 }))
const from = vi.fn(() => ({ select }))

vi.mock('@/lib/data/client', () => ({ supabaseAnon: () => ({ from }) }))
vi.mock('@/lib/data/market-truth/getSellBendMarket', () => ({
  getDetachedOverlays: vi.fn(async () => {
    throw new Error('market_metric timeout')
  }),
  overlayDetachedLayers: (row: unknown) => row,
  withholdDetachedHeadlines: (row: Record<string, unknown>) => ({
    ...row,
    active_count: null,
    median_list_price: null,
    months_of_supply: null,
    market_health_label: null,
  }),
  cityDetachedSlug: (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
}))
vi.mock('@/lib/data/market-truth/getMetric', () => ({ getMetrics: vi.fn(async () => []) }))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))

function row(over: Record<string, unknown> = {}) {
  return {
    geo_slug: 'central-oregon',
    geo_label: 'Central Oregon',
    active_count: 412,
    median_list_price: 625_000,
    months_of_supply: 4.2,
    market_health_label: 'Warm',
    sold_count_30d: 88,
    sold_count_90d: 260,
    new_count_7d: 12,
    median_active_dom: 40,
    median_days_to_pending: 21,
    price_reduction_share: 8.4,
    methodology_version: 'v3-2026-05-07',
    updated_at: '2026-09-23T00:00:00.000Z',
    ...over,
  }
}

describe('getMarketPulseRegionSnapshot — sold_count_30d/90d null preservation (DATA-7)', () => {
  beforeEach(() => {
    vi.resetModules()
    maybeSingle.mockReset()
  })

  it('keeps NULL sold_count_30d/90d columns as null, never coalesced to 0', async () => {
    const { getMarketPulseRegionSnapshot } = await import('./getMarketPulseSnapshot')
    maybeSingle.mockResolvedValue({
      data: row({ sold_count_30d: null, sold_count_90d: null }),
      error: null,
    })

    const snap = await getMarketPulseRegionSnapshot('central-oregon')
    expect(snap).not.toBeNull()
    expect(snap!.sold_count_30d).toBeNull()
    expect(snap!.sold_count_90d).toBeNull()
    expect(snap!.sold_count_30d).not.toBe(0)
    expect(snap!.sold_count_90d).not.toBe(0)
  })

  it('still converts real numeric sold counts, including a genuine zero', async () => {
    const { getMarketPulseRegionSnapshot } = await import('./getMarketPulseSnapshot')
    maybeSingle.mockResolvedValue({
      data: row({ sold_count_30d: 0, sold_count_90d: 199 }),
      error: null,
    })

    const snap = await getMarketPulseRegionSnapshot('central-oregon')
    expect(snap!.sold_count_30d).toBe(0)
    expect(snap!.sold_count_90d).toBe(199)
  })
})
