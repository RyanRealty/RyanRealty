import { describe, expect, it, vi } from 'vitest'
import type { MarketPulse } from '@/lib/data/types/market'

vi.mock('@/lib/data/market/getMarketPulse', () => ({ getMarketPulse: vi.fn() }))
vi.mock('@/lib/data/market/getMarketStatsCacheRows', () => ({
  getMarketPulseRowsByGeoType: vi.fn(),
  getMarketPulseRowForGeo: vi.fn(),
}))
vi.mock('@/lib/data/cma/builderReads', () => ({
  findCmaSubjectByAddress: vi.fn(),
  findCmaSubjectByMls: vi.fn(),
}))

const { figuresFromPulse } = await import('./subjects')

function pulse(over: Partial<MarketPulse>): MarketPulse {
  return {
    geoType: 'neighborhood',
    geoSlug: 'bend-summit-west',
    activeCount: 81,
    medianListPrice: 1_150_000,
    newThisWeek: 3,
    priceDropsThisWeek: 0,
    closedLast30Days: 2,
    monthsOfSupply: 48.6,
    medianDaysToPending: 21,
    refreshedAt: '2026-09-23T00:44:06.216Z',
    ...over,
  }
}

describe('figuresFromPulse (audit DATA-7)', () => {
  it('never captions a neighborhood sold count or days to pending (alias-attributed closes)', () => {
    const { figures, citations } = figuresFromPulse(pulse({}))
    expect(figures['homes closed in the last 30 days']).toBeUndefined()
    expect(figures['median days to pending']).toBeUndefined()
    expect(citations.some((c) => c.column === 'sold_count_30d')).toBe(false)
  })

  it('publishes a neighborhood months of supply only as the Market Truth cell getMarketPulse overlaid, and says so', () => {
    const { figures, citations } = figuresFromPulse(pulse({ activeCount: 55, monthsOfSupply: 6.47058823529412, geoSlug: 'sunriver' }))
    expect(figures['months of supply']).toBeDefined()
    const trace = citations.find((c) => String(c.filter ?? '').includes("stat_id='months_of_supply'"))
    expect(trace?.table).toBe('market_metric (via getMarketPulse overlay)')
    expect(String(trace?.filter)).toContain("geo_type='neighborhood'")
    // The active count beside it names the same source, not market_pulse_live.
    const active = citations.find((c) => c.figure === '55')
    expect(active?.table).toBe('market_metric (via getMarketPulse overlay)')
  })

  it('omits months of supply when getMarketPulse withheld it (null is not zero)', () => {
    const { figures } = figuresFromPulse(pulse({ monthsOfSupply: null }))
    expect(figures['months of supply']).toBeUndefined()
  })

  it('keeps city closed-side figures, whose closes and actives share one predicate', () => {
    const { figures, citations } = figuresFromPulse(
      pulse({ geoType: 'city', geoSlug: 'bend', activeCount: 754, monthsOfSupply: 4.25587958607714, closedLast30Days: 137, medianDaysToPending: 24 }),
    )
    expect(figures['homes closed in the last 30 days']).toBe('137')
    expect(figures['median days to pending']).toBe('24')
    expect(figures['months of supply']).toBeDefined()
    expect(citations.find((c) => c.column === 'sold_count_30d')?.table).toBe('market_pulse_live (via getMarketPulse)')
  })

  it('never turns a zero close count into a caption figure', () => {
    const { figures } = figuresFromPulse(pulse({ geoType: 'city', geoSlug: 'tumalo', closedLast30Days: 0 }))
    expect(figures['homes closed in the last 30 days']).toBeUndefined()
  })
})
