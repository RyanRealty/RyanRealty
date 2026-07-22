/**
 * underContractStory — the "went pending, fell through" line the price-history
 * drawer renders from days_to_pending + back_on_market_count (the columns the
 * DAL previously queried and dropped). Locks the fail-quiet rules: no claim on
 * clean closes, no claim on in-flight cycles, and a claim ONLY when the source
 * columns prove a fall-through.
 */
import { describe, expect, it } from 'vitest'
import { underContractStory } from '@/components/admin/prospecting/ProspectPriceHistory.client'
import type { ProspectPriceCycle } from './types'

function cycle(overrides: Partial<ProspectPriceCycle>): ProspectPriceCycle {
  return {
    listDate: '2025-04-01',
    status: 'Expired',
    originalListPrice: 800000,
    finalListPrice: 749000,
    closePrice: null,
    daysOnMarket: 120,
    priceDropCount: 2,
    offMarketDate: '2025-08-01',
    daysToPending: null,
    wasRelisted: false,
    backOnMarketCount: null,
    ...overrides,
  }
}

describe('underContractStory', () => {
  it('returns null when the cycle never went under contract', () => {
    expect(underContractStory(cycle({}))).toBeNull()
    expect(underContractStory(cycle({ backOnMarketCount: 0 }))).toBeNull()
  })

  it('returns null on a clean list-to-close (pending data but no fall-through)', () => {
    expect(
      underContractStory(cycle({ daysToPending: 12, closePrice: 780000, backOnMarketCount: 0 })),
    ).toBeNull()
  })

  it('tells the fall-through-then-closed story with counts', () => {
    expect(
      underContractStory(cycle({ daysToPending: 30, closePrice: 780000, backOnMarketCount: 2 })),
    ).toBe('Went pending after 30 days, fell through 2 times before closing')
    expect(underContractStory(cycle({ closePrice: 780000, backOnMarketCount: 1 }))).toBe(
      'Fell out of contract once before closing',
    )
  })

  it('never claims a fall-through on an in-flight cycle', () => {
    for (const status of ['Active', 'Pending', 'Active Under Contract', 'Coming Soon']) {
      expect(underContractStory(cycle({ status, daysToPending: 45, backOnMarketCount: 1 }))).toBeNull()
    }
  })

  it('tells the expired fall-through story from days_to_pending', () => {
    expect(underContractStory(cycle({ daysToPending: 45, backOnMarketCount: 1 }))).toBe(
      'Went pending after 45 days, fell through',
    )
    expect(underContractStory(cycle({ daysToPending: 45, backOnMarketCount: 3 }))).toBe(
      'Went pending after 45 days, fell through (back on market 3 times)',
    )
    // back_on_market_count proves the contract even when days_to_pending is null
    expect(underContractStory(cycle({ backOnMarketCount: 1 }))).toBe(
      'Went under contract, fell through',
    )
  })
})
