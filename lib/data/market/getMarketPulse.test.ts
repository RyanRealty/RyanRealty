/**
 * lib/data/market/getMarketPulse.test.ts
 *
 * DATA-7 (migration 20260923014700_pulse_withhold_unverified_closed_side.sql):
 * market_pulse_live.sold_count_30d is withheld (NULL) at neighborhood grain
 * because no same-population close attribution exists there. This locks the
 * conversion in fetchMarketPulse: a NULL column must stay `null`, never
 * coalesce to `0` (CLAUDE.md §0 — unknown/withheld is not zero).
 *
 * geoType 'zip' is used for the null-preserving cases so the test exercises
 * ONLY the row → MarketPulse conversion, without going through the city/
 * region/neighborhood/community Market Truth overlay branch (a separate
 * concern covered by getSellBendMarket.test.ts).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const maybeSingle = vi.fn()
const eq3 = vi.fn(() => ({ maybeSingle }))
const eq2 = vi.fn(() => ({ eq: eq3 }))
const eq1 = vi.fn(() => ({ eq: eq2 }))
const select = vi.fn(() => ({ eq: eq1 }))
const from = vi.fn(() => ({ select }))

vi.mock('@/lib/data/client', () => ({ supabaseAnon: () => ({ from }) }))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))

function row(over: Record<string, unknown> = {}) {
  return {
    geo_type: 'zip',
    geo_slug: '97701',
    active_count: 40,
    median_list_price: 610_000,
    new_count_7d: 3,
    price_reduction_share: 0.1,
    sold_count_30d: 12,
    months_of_supply: 4.1,
    median_days_to_pending: 18,
    updated_at: '2026-09-23T00:00:00.000Z',
    ...over,
  }
}

describe('getMarketPulse — sold_count_30d null preservation (DATA-7)', () => {
  beforeEach(() => {
    vi.resetModules()
    maybeSingle.mockReset()
  })

  it('keeps a NULL sold_count_30d column as null, never coalesced to 0', async () => {
    const { getMarketPulse } = await import('./getMarketPulse')
    maybeSingle.mockResolvedValue({ data: row({ sold_count_30d: null }), error: null })

    const pulse = await getMarketPulse({ geoType: 'zip', geoSlug: '97701' })
    expect(pulse).not.toBeNull()
    expect(pulse!.closedLast30Days).toBeNull()
    expect(pulse!.closedLast30Days).not.toBe(0)
  })

  it('still converts a real numeric sold_count_30d to a number', async () => {
    const { getMarketPulse } = await import('./getMarketPulse')
    maybeSingle.mockResolvedValue({ data: row({ sold_count_30d: 0 }), error: null })

    const pulse = await getMarketPulse({ geoType: 'zip', geoSlug: '97701' })
    expect(pulse!.closedLast30Days).toBe(0)

    maybeSingle.mockResolvedValue({ data: row({ sold_count_30d: 27 }), error: null })
    const pulse2 = await getMarketPulse({ geoType: 'zip', geoSlug: '97701' })
    expect(pulse2!.closedLast30Days).toBe(27)
  })
})
