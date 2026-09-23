/**
 * lib/agent/tools/market.test.ts — unit tests for the `market_stats` tool.
 *
 * DATA-7 (migration 20260923014700_pulse_withhold_unverified_closed_side.sql):
 * pulse.closedLast30Days is null when withheld or unknown, and the tool must
 * omit the "closed in 30d" citation entirely rather than print "null closed
 * in 30d" or coalesce to a fabricated "0 closed in 30d" (CLAUDE.md §0).
 *
 * Mocked only (no live Supabase): getMarketPulse, getCityMarketDetail, and
 * getCompleteMonthlyMarketDetail are all stubbed.
 */
import { describe, expect, it, vi } from 'vitest'
import type { MarketPulse } from '@/lib/data/types/market'

const getMarketPulseMock = vi.fn()
vi.mock('@/lib/data/market/getMarketPulse', () => ({
  getMarketPulse: (...args: unknown[]) => getMarketPulseMock(...args),
}))

const getCityMarketDetailMock = vi.fn()
const getCompleteMonthlyMarketDetailMock = vi.fn()
vi.mock('@/lib/data/market/getCityMarketDetail', () => ({
  getCityMarketDetail: (...args: unknown[]) => getCityMarketDetailMock(...args),
  getCompleteMonthlyMarketDetail: (...args: unknown[]) => getCompleteMonthlyMarketDetailMock(...args),
}))

const { marketTools } = await import('./market')
const handler = marketTools[0]!.handler

const CTX = {
  brokerSlug: 'matt' as const,
  brokerEmail: 'matt@ryan-realty.com',
  brokerDisplayName: 'Matt Ryan',
  sessionId: 'session-1',
  brokerCell: '+15415550100',
}

function pulse(over: Partial<MarketPulse> = {}): MarketPulse {
  return {
    geoType: 'city',
    geoSlug: 'bend',
    activeCount: 754,
    medianListPrice: 799_000,
    newThisWeek: 14,
    priceDropsThisWeek: 22,
    closedLast30Days: 137,
    monthsOfSupply: 3.54,
    medianDaysToPending: 18,
    refreshedAt: '2026-09-23T00:00:00.000Z',
    ...over,
  }
}

describe('market_stats tool — closedLast30Days (DATA-7)', () => {
  it('cites "closed in 30d" when the pulse figure is a real number', async () => {
    getMarketPulseMock.mockResolvedValue(pulse({ closedLast30Days: 137 }))
    getCityMarketDetailMock.mockResolvedValue(null)
    getCompleteMonthlyMarketDetailMock.mockResolvedValue(null)

    const outcome = await handler({ city: 'Bend' }, CTX)
    const citation = outcome.citations?.find((c) => c.source.includes('sold_count_30d'))
    expect(citation?.figure).toBe('137 closed in 30d')
  })

  it('omits the closed-30d citation entirely when the pulse figure is null (withheld)', async () => {
    getMarketPulseMock.mockResolvedValue(pulse({ closedLast30Days: null }))
    getCityMarketDetailMock.mockResolvedValue(null)
    getCompleteMonthlyMarketDetailMock.mockResolvedValue(null)

    const outcome = await handler({ city: 'Tumalo', geoType: 'neighborhood' }, CTX)
    const citation = outcome.citations?.find((c) => c.source.includes('sold_count_30d'))
    expect(citation).toBeUndefined()
    // Never a literal "null" in any citation figure.
    for (const c of outcome.citations ?? []) {
      expect(c.figure).not.toMatch(/\bnull\b/)
    }
  })

  it('still prints a genuine zero close count (not the same as withheld null)', async () => {
    getMarketPulseMock.mockResolvedValue(pulse({ closedLast30Days: 0 }))
    getCityMarketDetailMock.mockResolvedValue(null)
    getCompleteMonthlyMarketDetailMock.mockResolvedValue(null)

    const outcome = await handler({ city: 'Bend' }, CTX)
    const citation = outcome.citations?.find((c) => c.source.includes('sold_count_30d'))
    expect(citation?.figure).toBe('0 closed in 30d')
  })
})
