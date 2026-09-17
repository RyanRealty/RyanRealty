/**
 * Matt 2026-09-17: Low/High from closed-comp band; Recommended inside that band.
 * Tip Ready: node scripts/lib/taste-receipt.mjs --ship lib/pricing/recommended-in-band.parity.json
 * Tip Ready refuse when Rec is outside Low/High.
 */
import { describe, expect, it } from 'vitest'
import {
  clampRecommendedToClosedBand,
  closedCompBand,
  recommendedInsideClosedBand,
} from '@/lib/pricing/recommended-in-band'
import parity from '@/lib/pricing/recommended-in-band.parity.json'

describe('recommended inside closed-comp band', () => {
  it('contract: low-high-from-closed-comp-band', () => {
    expect(closedCompBand({ valueLow: 705_000, valueHigh: 675_000 })).toEqual({
      low: 675_000,
      high: 705_000,
    })
    expect(closedCompBand({ valueLow: 0, valueHigh: 100 })).toBeNull()
  })

  it('contract: recommended-must-stay-inside-low-high', () => {
    expect(
      recommendedInsideClosedBand({
        recommended: 701_000,
        valueLow: 675_000,
        valueHigh: 705_000,
      }),
    ).toBe(true)
    expect(
      clampRecommendedToClosedBand({
        recommended: 720_000,
        valueLow: 675_000,
        valueHigh: 705_000,
      }).recommended,
    ).toBe(705_000)
    expect(
      clampRecommendedToClosedBand({
        recommended: 650_000,
        valueLow: 675_000,
        valueHigh: 705_000,
      }).recommended,
    ).toBe(675_000)
    expect(
      clampRecommendedToClosedBand({
        recommended: 690_000,
        valueLow: 675_000,
        valueHigh: 705_000,
      }).recommended,
    ).toBe(690_000)
  })

  it('contract: tip-ready-refuse-when-rec-outside-band', () => {
    expect(
      recommendedInsideClosedBand({
        recommended: 710_000,
        valueLow: 675_000,
        valueHigh: 705_000,
      }),
    ).toBe(false)
    expect(
      recommendedInsideClosedBand({
        recommended: 650_000,
        valueLow: 675_000,
        valueHigh: 705_000,
      }),
    ).toBe(false)

    for (const row of parity.cases ?? []) {
      const inside = recommendedInsideClosedBand({
        recommended: row.recommended,
        valueLow: row.valueLow,
        valueHigh: row.valueHigh,
      })
      expect(inside, row.id).toBe(row.expectInside)
      if (!row.expectInside) {
        const clamped = clampRecommendedToClosedBand({
          recommended: row.recommended,
          valueLow: row.valueLow,
          valueHigh: row.valueHigh,
        })
        expect(recommendedInsideClosedBand(clamped), `${row.id} after clamp`).toBe(true)
      }
    }
  })
})
