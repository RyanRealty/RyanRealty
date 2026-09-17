/**
 * Matt 2026-09-17 high-DOM sitting-active Recommended nudge (market cool).
 * Pending high-DOM 60+ = letter signal only; never sets Recommended.
 * Tip Ready: node scripts/lib/taste-receipt.mjs --ship lib/pricing/active-dom-nudge.parity.json
 */
import { describe, expect, it } from 'vitest'
import {
  HIGH_DOM_ACTIVE_DAYS,
  HIGH_DOM_NUDGE_PULL,
  isHighDomOverpricedActive,
  isHighDomPendingLetterSignal,
  isHighDomSittingActive,
  nudgeRecommendedDownForHighDomActives,
} from '@/lib/pricing/active-dom-nudge'
import { storyAdjustment } from '@/lib/pricing/classes'

describe('high-DOM sitting active Recommended nudge', () => {
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

  it('contract: sitting-high-dom-active-pulls-even-inside-band', () => {
    expect(isHighDomSittingActive({ status: 'Active', listPrice: 679_000, daysOnMarket: 201 })).toBe(
      true,
    )
    expect(isHighDomSittingActive({ status: 'Active', listPrice: 679_000, daysOnMarket: 12 })).toBe(
      false,
    )
    const out = nudgeRecommendedDownForHighDomActives({
      recommended: 701_000,
      bandLow: 675_000,
      bandHigh: 705_000,
      actives: [{ status: 'Active', listPrice: 679_000, daysOnMarket: 201 }],
    })
    expect(out.nudged).toBe(true)
    expect(out.recommended).toBeLessThan(701_000)
    expect(out.recommended).toBeGreaterThanOrEqual(675_000)
  })

  it('contract: nudge-down-within-closed-band-only', () => {
    expect(HIGH_DOM_NUDGE_PULL).toBe(0.75)
    const out = nudgeRecommendedDownForHighDomActives({
      recommended: 701_000,
      bandLow: 675_000,
      bandHigh: 705_000,
      actives: [{ status: 'Active', listPrice: 729_000, daysOnMarket: 201 }],
    })
    expect(out.nudged).toBe(true)
    // 75% of the way from 701 toward 675 → ~681.5 → round 1000 → 682 or 681
    expect(out.recommended).toBe(roundExpect(701_000, 675_000, 0.75))
    expect(out.recommended).toBeGreaterThanOrEqual(675_000)
    expect(out.recommended).toBeLessThanOrEqual(705_000)
    expect(storyAdjustment('one', 'two', 701_000)).toBe(0)
  })

  it('contract: no-nudge-without-sitting-high-dom-active', () => {
    const out = nudgeRecommendedDownForHighDomActives({
      recommended: 701_000,
      bandLow: 675_000,
      bandHigh: 705_000,
      actives: [
        { status: 'Active', listPrice: 679_000, daysOnMarket: 12 },
        { status: 'Active', listPrice: 729_000, daysOnMarket: 45 },
      ],
    })
    expect(out.nudged).toBe(false)
    expect(out.recommended).toBe(701_000)
  })

  it('contract: pending-high-dom-letter-signal-never-sets-recommended', () => {
    const pending = { status: 'Pending', listPrice: 729_000, daysOnMarket: 201 }
    expect(isHighDomPendingLetterSignal(pending)).toBe(true)
    expect(
      isHighDomPendingLetterSignal({ status: 'Pending', listPrice: 729_000, daysOnMarket: 59 }),
    ).toBe(false)
    expect(
      isHighDomPendingLetterSignal({ status: 'Active', listPrice: 729_000, daysOnMarket: 201 }),
    ).toBe(false)

    const out = nudgeRecommendedDownForHighDomActives({
      recommended: 701_000,
      bandLow: 675_000,
      bandHigh: 705_000,
      actives: [pending],
    })
    expect(out.nudged).toBe(false)
    expect(out.recommended).toBe(701_000)
    expect(isHighDomOverpricedActive(pending, 705_000)).toBe(false)
  })
})

function roundExpect(rec: number, lo: number, pull: number): number {
  return Math.round((rec - pull * (rec - lo)) / 1000) * 1000
}
