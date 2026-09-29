import { describe, expect, it } from 'vitest'
import {
  ensureMinBandWidth,
  salesForBandEndpoints,
  syncRangeRuleToHeroBand,
} from '@/lib/pricing/estimate'
import type { PricingRangeRule } from '@/lib/pricing/estimate'

describe('band endpoints — Slate and Oakside', () => {
  it('drops a 1.6% comp from the ends and keeps the capped top-weight sale', () => {
    const rows = [
      { id: 'rolen', ppsfTimeAdjusted: 370, adjustedPrice: 594_000, weight: 0.4 },
      { id: 'a', ppsfTimeAdjusted: 380, adjustedPrice: 619_000, weight: 0.2 },
      { id: 'b', ppsfTimeAdjusted: 382, adjustedPrice: 621_000, weight: 0.2 },
      { id: 'c', ppsfTimeAdjusted: 384, adjustedPrice: 623_000, weight: 0.184 },
      { id: 'aldrich', ppsfTimeAdjusted: 250, adjustedPrice: 430_000, weight: 0.016 },
    ]
    const ends = salesForBandEndpoints(rows)
    expect(ends.map((r) => r.id)).not.toContain('aldrich')
    expect(ends.map((r) => r.id)).toContain('rolen')
    const prices = ends.map((r) => r.adjustedPrice).sort((a, b) => a - b)
    expect(prices[0]).toBe(594_000)
    expect(prices[prices.length - 1]).toBe(623_000)
  })

  it('opens a $3k band to about ±2.5% and leaves a Meridian-width band alone', () => {
    const tight = ensureMinBandWidth(620_000, 623_000, 620_000)
    expect(tight.high - tight.low).toBeGreaterThanOrEqual(620_000 * 0.05 - 1)
    expect(tight.low).toBeLessThanOrEqual(620_000 * 0.975)
    expect(tight.high).toBeGreaterThanOrEqual(620_000 * 1.025)

    const meridian = ensureMinBandWidth(483_000, 505_000, 485_000)
    expect(meridian.low).toBe(483_000)
    expect(meridian.high).toBe(505_000)
  })

  it('rewrites a stale range sentence onto the hero band', () => {
    const rule: PricingRangeRule = {
      rule: 'min-max',
      n: 5,
      kept: 5,
      adjustedLow: 594_000,
      adjustedHigh: 623_000,
      saleToAskRatio: 0.967,
      saleToAskSource: 'city-index',
      ratiosExcluded: 0,
      sentence:
        'The range is the spread of all five sale prices adjusted for date and size: $594,000 to $623,000. The range is those adjusted sale prices.',
    }
    const synced = syncRangeRuleToHeroBand({
      valueLow: 620_000,
      valueHigh: 623_000,
      rangeRule: rule,
    })
    expect(synced.rangeRule?.sentence).toContain('$620,000 to $623,000')
    expect(synced.rangeRule?.sentence).not.toContain('$594,000')
    expect(synced.rangeRule?.sentence).not.toMatch(/carried to an asking price/)
  })
})
