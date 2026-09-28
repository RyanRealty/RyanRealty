/**
 * A sales-low pin can land on the raw adjusted sale. The cover prints the
 * nearest thousand inside the printed band. The raw floor is not a step up.
 * A pin within one thousand of the last ask does not print above that ask.
 */
import { describe, expect, it } from 'vitest'
import { finishRecommendedAfterActives } from '@/lib/cma/finish-recommended'
import { evaluateAccuracyContract } from '@/lib/cma/contract'
import { roundPrintedRecommendation } from '@/lib/pricing/estimate'
import type { CmaPricing } from '@/lib/cma/types'
import type { PricingRangeRule } from '@/lib/pricing/estimate'

function rule(evidenceLow: number, saleLow = evidenceLow): PricingRangeRule {
  return {
    rule: 'min-max',
    n: 3,
    kept: 3,
    adjustedLow: 849_000,
    adjustedHigh: 900_000,
    saleToAskRatio: null,
    saleToAskSource: 'none',
    ratiosExcluded: 0,
    saleLow,
    evidenceLow,
    sentence: 'The range is the spread of the sales.',
  }
}

describe('printed recommendation rounding', () => {
  it('rounds to the nearest thousand and leaves an on-grid list alone', () => {
    expect(roundPrintedRecommendation(716_000, { low: 693_000, high: 735_000 })).toBe(716_000)
    expect(roundPrintedRecommendation(849_200, { low: 849_000, high: 900_000 })).toBe(849_000)
  })

  it('prints the off-grid pin on the printed band low, not one step above it', () => {
    // Raw sale $849,416. Printed band $849,000 to $900,000. Nearest thousand
    // is the band low. The raw floor is not a reason to print $850,000.
    expect(roundPrintedRecommendation(849_416, { low: 849_000, high: 900_000 })).toBe(849_000)
  })

  it('does not print above an ask the pin already sits within one step of', () => {
    expect(
      roundPrintedRecommendation(499_148, { low: 499_000, high: 537_000, ask: 499_000 }),
    ).toBe(499_000)
    // Nearest thousand would be $500,000, which is above the ask.
    expect(
      roundPrintedRecommendation(499_600, { low: 499_000, high: 537_000, ask: 499_000 }),
    ).toBe(499_000)
  })

  it('leaves a pin that is not near the ask on the printed band', () => {
    const finished = finishRecommendedAfterActives(
      {
        recommended: 849_416,
        conservative: 849_416,
        highEnd: 900_000,
        valueLow: 849_000,
        valueHigh: 900_000,
        notes: [],
        failedAsk: 774_900,
        failedAskBelowRange: true,
        rangeRule: rule(849_416),
      },
      { actives: [], ask: 774_900 },
    )
    expect(finished.recommended).toBe(849_000)
    expect(finished.conservative).toBe(849_000)
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
    expect(cap?.detail).toMatch(/Recommended \$849,000/)
    expect(cap?.detail).not.toMatch(/\$850,000/)
    expect(range?.pass).toBe(true)
    expect(range?.detail).toMatch(/recommended \$849,000/)
  })

  it('prints an in-band pin on the band low when the ask sits above it', () => {
    // Unrounded list $566,341. Printed band $566,000 to $590,000. Ask
    // $574,500 is inside the band and more than one thousand above the pin,
    // so the ask cap does not apply. Nearest thousand is the band low.
    expect(
      roundPrintedRecommendation(566_341, { low: 566_000, high: 590_000, ask: 574_500 }),
    ).toBe(566_000)
    const finished = finishRecommendedAfterActives(
      {
        recommended: 566_341,
        conservative: 566_341,
        highEnd: 590_000,
        valueLow: 566_000,
        valueHigh: 590_000,
        notes: [],
        failedAsk: 574_500,
      },
      { actives: [], ask: 574_500 },
    )
    expect(finished.recommended).toBe(566_000)
    expect(finished.conservative).toBe(566_000)
    expect(finished.valueLow).toBe(566_000)
    expect(finished.valueHigh).toBe(590_000)
    expect(finished.recommended).toBeLessThanOrEqual(574_500)
    expect(finished.recommended).toBeGreaterThanOrEqual(finished.valueLow)
    expect(finished.recommended).toBeLessThanOrEqual(finished.valueHigh)
  })

  it('prints an ask-level pin on the ask, and the contract uses that same thousand', () => {
    const finished = finishRecommendedAfterActives(
      {
        recommended: 499_148,
        conservative: 499_148,
        highEnd: 537_000,
        valueLow: 499_000,
        valueHigh: 537_000,
        notes: [],
        failedAsk: 499_000,
        failedAskBelowRange: true,
        rangeRule: rule(499_148, 499_148),
      },
      { actives: [], ask: 499_000 },
    )
    expect(finished.recommended).toBe(499_000)
    expect(finished.conservative).toBe(499_000)
    expect(finished.valueLow).toBe(499_000)
    expect(finished.valueHigh).toBe(537_000)
    const justUnder = finishRecommendedAfterActives(
      {
        recommended: 499_600,
        conservative: 499_600,
        highEnd: 537_000,
        valueLow: 499_000,
        valueHigh: 537_000,
        notes: [],
        failedAsk: 499_000,
        failedAskBelowRange: true,
        rangeRule: rule(499_600, 499_600),
      },
      { actives: [], ask: 499_000 },
    )
    expect(justUnder.recommended).toBe(499_000)
    expect(justUnder.conservative).toBe(499_000)
    const contract = evaluateAccuracyContract({
      audit: null,
      comps: [],
      pricing: { ...finished, method1Mid: 1, method2: 1, method3: 1 } as unknown as CmaPricing,
      judgment: null,
      minComps: 0,
      marketContextPresent: true,
      failedAsk: 499_000,
    })
    const cap = contract.checks.find((c) => c.id === 'expired-list-cap')
    expect(cap?.pass).toBe(true)
    expect(cap?.detail).toMatch(/Recommended \$499,000/)
    const over = evaluateAccuracyContract({
      audit: null,
      comps: [],
      pricing: {
        ...finished,
        recommended: 500_000,
        conservative: 499_000,
        method1Mid: 1,
        method2: 1,
        method3: 1,
      } as unknown as CmaPricing,
      judgment: null,
      minComps: 0,
      marketContextPresent: true,
      failedAsk: 499_000,
    })
    expect(over.checks.find((c) => c.id === 'expired-list-cap')?.pass).toBe(false)
  })
})
