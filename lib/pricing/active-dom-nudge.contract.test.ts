/**
 * Matt 2026-09-17 high-DOM overpriced-active Recommended nudge.
 * Tip Ready: node scripts/lib/taste-receipt.mjs --ship lib/pricing/active-dom-nudge.parity.json
 */
import { describe, expect, it } from 'vitest'
import {
  HIGH_DOM_ACTIVE_DAYS,
  isHighDomOverpricedActive,
  nudgeRecommendedDownForHighDomActives,
} from '@/lib/pricing/active-dom-nudge'
import { storyAdjustment } from '@/lib/pricing/classes'

describe('high-DOM overpriced active Recommended nudge', () => {
  it('contract: high-dom-threshold-is-60', () => {
    expect(HIGH_DOM_ACTIVE_DAYS).toBe(60)
  })

  it('contract: overpriced-means-ask-above-closed-band-high', () => {
    const hi = 705_000
    expect(
      isHighDomOverpricedActive({ status: 'Active', listPrice: 729_000, daysOnMarket: 201 }, hi),
    ).toBe(true)
    expect(
      isHighDomOverpricedActive({ status: 'Active', listPrice: 679_000, daysOnMarket: 201 }, hi),
    ).toBe(false)
    expect(
      isHighDomOverpricedActive({ status: 'Active', listPrice: 729_000, daysOnMarket: 59 }, hi),
    ).toBe(false)
    expect(
      isHighDomOverpricedActive({ status: 'Pending', listPrice: 729_000, daysOnMarket: 201 }, hi),
    ).toBe(false)
  })

  it('contract: nudge-down-within-closed-band-only', () => {
    const out = nudgeRecommendedDownForHighDomActives({
      recommended: 701_000,
      bandLow: 675_000,
      bandHigh: 705_000,
      actives: [{ status: 'Active', listPrice: 729_000, daysOnMarket: 201 }],
    })
    expect(out.nudged).toBe(true)
    expect(out.recommended).toBeLessThan(701_000)
    expect(out.recommended).toBeGreaterThanOrEqual(675_000)
    expect(out.recommended).toBeLessThanOrEqual(705_000)
    // No story-adj invent
    expect(storyAdjustment('one', 'two', 701_000)).toBe(0)
  })

  it('contract: no-nudge-without-high-dom-overpriced-active', () => {
    const out = nudgeRecommendedDownForHighDomActives({
      recommended: 701_000,
      bandLow: 675_000,
      bandHigh: 705_000,
      actives: [
        { status: 'Active', listPrice: 679_000, daysOnMarket: 201 },
        { status: 'Active', listPrice: 729_000, daysOnMarket: 12 },
      ],
    })
    expect(out.nudged).toBe(false)
    expect(out.recommended).toBe(701_000)
  })
})
