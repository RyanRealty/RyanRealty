/**
 * Matt 2026-09-17: Recommended weighted toward more recent/similar closeds.
 * Tip Ready: node scripts/lib/taste-receipt.mjs --ship lib/pricing/closed-comp-weight.parity.json
 * Still inside Low/High; DOM nudge may pull down within band after.
 */
import { describe, expect, it } from 'vitest'
import { closedCompWeight } from '@/lib/pricing/closed-comp-weight'
import { weightedAdjustedPrice } from '@/lib/pricing/reconciliation'
import { clampRecommendedToClosedBand } from '@/lib/pricing/recommended-in-band'

describe('closed-comp Recommended weighting', () => {
  it('contract: more-recent-closed-weighs-more', () => {
    const recent = closedCompWeight({
      subjectSqft: 1883,
      saleSqft: 1800,
      monthsSinceClose: 1,
    })
    const older = closedCompWeight({
      subjectSqft: 1883,
      saleSqft: 1800,
      monthsSinceClose: 12,
    })
    expect(recent).toBeGreaterThan(older)
  })

  it('contract: more-similar-size-weighs-more', () => {
    const similar = closedCompWeight({
      subjectSqft: 1883,
      saleSqft: 1850,
      monthsSinceClose: 3,
    })
    const far = closedCompWeight({
      subjectSqft: 1883,
      saleSqft: 2400,
      monthsSinceClose: 3,
    })
    expect(similar).toBeGreaterThan(far)
  })

  it('contract: weighted-point-pulls-toward-recent-similar-then-in-band', () => {
    // Older cheap sale vs recent similar sale near subject — weight must pull up.
    const cheapOld = {
      adjustedPrice: 650_000,
      weight: closedCompWeight({ subjectSqft: 1883, saleSqft: 2400, monthsSinceClose: 18 }),
    }
    const recentSimilar = {
      adjustedPrice: 690_000,
      weight: closedCompWeight({ subjectSqft: 1883, saleSqft: 1850, monthsSinceClose: 2 }),
    }
    const point = weightedAdjustedPrice([cheapOld, recentSimilar])
    expect(point).not.toBeNull()
    expect(point!).toBeGreaterThan(670_000)
    expect(point!).toBeLessThan(690_000)

    const band = { valueLow: 675_000, valueHigh: 705_000, recommended: point! }
    // If the raw point drifts below Low, Tip Ready clamp keeps Rec inside.
    const clamped = clampRecommendedToClosedBand({
      ...band,
      recommended: Math.min(point!, 650_000),
    })
    expect(clamped.recommended).toBeGreaterThanOrEqual(675_000)
    expect(clamped.recommended).toBeLessThanOrEqual(705_000)
  })
})
