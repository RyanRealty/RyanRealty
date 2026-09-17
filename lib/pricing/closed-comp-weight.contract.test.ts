/**
 * Matt 2026-09-17: Recommended weighted toward more recent/similar closeds.
 * Market cool: heavy recent half-life (~3 mo). Tip Ready:
 * node scripts/lib/taste-receipt.mjs --ship lib/pricing/closed-comp-weight.parity.json
 */
import { describe, expect, it } from 'vitest'
import {
  CLOSED_COMP_RECENCY_HALF_LIFE_MONTHS,
  closedCompWeight,
} from '@/lib/pricing/closed-comp-weight'
import { weightedAdjustedPrice } from '@/lib/pricing/reconciliation'
import { clampRecommendedToClosedBand } from '@/lib/pricing/recommended-in-band'

describe('closed-comp Recommended weighting', () => {
  it('contract: more-recent-closed-weighs-more', () => {
    expect(CLOSED_COMP_RECENCY_HALF_LIFE_MONTHS).toBe(3)
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
    // Heavy cool: 6-month sale is ~¼ fresh recency (half-life 3).
    const sixMo = closedCompWeight({ subjectSqft: 1883, saleSqft: 1883, monthsSinceClose: 6 })
    const fresh = closedCompWeight({ subjectSqft: 1883, saleSqft: 1883, monthsSinceClose: 0 })
    expect(sixMo / fresh).toBeLessThan(0.3)
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

    const clamped = clampRecommendedToClosedBand({
      valueLow: 675_000,
      valueHigh: 705_000,
      recommended: Math.min(point!, 650_000),
    })
    expect(clamped.recommended).toBeGreaterThanOrEqual(675_000)
    expect(clamped.recommended).toBeLessThanOrEqual(705_000)
  })
})
