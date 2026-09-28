/**
 * A sales-low pin can land on the raw adjusted sale. The cover prints the
 * thousand-dollar grid. Rounding up keeps the list on or above the
 * conservative floor and inside the printed band.
 */
import { describe, expect, it } from 'vitest'
import { finishRecommendedAfterActives } from '@/lib/cma/finish-recommended'
import { evaluateAccuracyContract } from '@/lib/cma/contract'
import { roundPrintedRecommendation } from '@/lib/pricing/estimate'
import type { CmaPricing } from '@/lib/cma/types'
import type { PricingRangeRule } from '@/lib/pricing/estimate'

function rule(evidenceLow: number): PricingRangeRule {
  return {
    rule: 'min-max',
    n: 3,
    kept: 3,
    adjustedLow: 849_000,
    adjustedHigh: 900_000,
    saleToAskRatio: null,
    saleToAskSource: 'none',
    ratiosExcluded: 0,
    saleLow: 849_000,
    evidenceLow,
    sentence: 'The range is the spread of the sales.',
  }
}

describe('printed recommendation rounding', () => {
  it('rounds to the nearest thousand and leaves an on-grid list alone', () => {
    expect(roundPrintedRecommendation(716_000, { low: 693_000, high: 735_000, floor: 693_000 })).toBe(716_000)
    expect(roundPrintedRecommendation(849_200, { low: 849_000, high: 900_000, floor: 800_000 })).toBe(849_000)
  })

  it('rounds up into the band when the nearest thousand is under the floor', () => {
    // The sale is $849,416. The printed band low is $849,000. The conservative
    // tier was copied from that same sale, so $849,000 would sit under the floor.
    expect(
      roundPrintedRecommendation(849_416, { low: 849_000, high: 900_000, floor: 849_416 }),
    ).toBe(850_000)
  })

  it('prints the Petrosa pin on the grid without leaving the band or the floor', () => {
    const finished = finishRecommendedAfterActives(
      {
        recommended: 849_416,
        conservative: 849_416,
        highEnd: 900_000,
        valueLow: 849_000,
        valueHigh: 900_000,
        notes: [],
        failedAskBelowRange: true,
        rangeRule: rule(849_416),
      },
      { actives: [] },
    )
    expect(finished.recommended).toBe(850_000)
    expect(finished.valueLow).toBe(849_000)
    expect(finished.valueHigh).toBe(900_000)
    expect(finished.recommended).toBeGreaterThanOrEqual(finished.conservative!)
    expect(finished.recommended).toBeGreaterThanOrEqual(finished.valueLow)
    expect(finished.recommended).toBeLessThanOrEqual(finished.valueHigh)
    const contract = evaluateAccuracyContract({
      audit: null,
      comps: [],
      pricing: { ...finished, method1Mid: 1, method2: 1, method3: 1 } as unknown as CmaPricing,
      judgment: null,
      minComps: 0,
      marketContextPresent: true,
      failedAsk: 774_900,
    })
    const cap = contract.checks.find((c) => c.id === 'expired-list-cap')
    const range = contract.checks.find((c) => c.id === 'range-consistency')
    expect(cap?.pass).toBe(true)
    expect(cap?.detail).toMatch(/Recommended \$850,000/)
    expect(range?.pass).toBe(true)
    expect(range?.detail).toMatch(/recommended \$850,000/)
  })
})
