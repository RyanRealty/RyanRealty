/**
 * Contract checks and the seller net follow the final recommendation,
 * not the list from before the active nudge.
 *
 * c4f321487 (2026-09-28) moved the stored audit after the nudge, the band
 * clamp and rounding, so nothing rewrites a recommended dollar afterwards. The
 * rewrite helpers (lib/cma/final-rec-grade.ts) and their three cases went with
 * that; these two cases hold the live path.
 */
import { describe, expect, it } from 'vitest'
import { finishRecommendedAfterActives } from '@/lib/cma/finish-recommended'
import { evaluateAccuracyContract } from '@/lib/cma/contract'
import type { CmaPricing, CmaSellerNet } from '@/lib/cma/types'

describe('final recommendation is what the checks grade', () => {
  it('Foxborough and Locke shapes: the check names the nudged list, not the earlier one', () => {
    const fox = finishRecommendedAfterActives(
      {
        recommended: 564_000,
        conservative: 554_000,
        highEnd: 564_000,
        valueLow: 537_000,
        valueHigh: 566_000,
        notes: [],
        rangeRule: {
          rule: 'min-max',
          n: 3,
          kept: 3,
          adjustedLow: 545_000,
          adjustedHigh: 564_000,
          saleToAskRatio: null,
          saleToAskSource: 'none',
          ratiosExcluded: 0,
          saleLow: 545_000,
          evidenceLow: 554_000,
          sentence: 'The range is the spread of the sales.',
        },
      },
      { actives: [{ status: 'Active', listPrice: 700_000, daysOnMarket: 90 }] },
    )
    expect(fox.recommended).not.toBe(564_000)
    const foxContract = evaluateAccuracyContract({
      audit: null,
      comps: [],
      pricing: { ...fox, method1Mid: 1, method2: 1, method3: 1, converged: true, convergenceSpreadPct: 1, compPpsfCv: 0.1, confidence: 'High', needsReview: false, reviewReason: null } as unknown as CmaPricing,
      judgment: null,
      minComps: 0,
      marketContextPresent: true,
    })
    const foxRange = foxContract.checks.find((c) => c.id === 'recommendation-in-range')!
    expect(foxRange.detail).toContain(`$${fox.recommended.toLocaleString('en-US')}`)
    expect(foxRange.detail).not.toContain('$564,000')

    const locke = finishRecommendedAfterActives(
      {
        recommended: 664_000,
        conservative: 654_000,
        highEnd: 760_000,
        valueLow: 654_000,
        valueHigh: 760_000,
        notes: [],
        reviewReason: 'Recommended $685,000 was the list before the nudge.',
      },
      { actives: [] },
    )
    expect(locke.recommended).toBe(664_000)
    const lockeContract = evaluateAccuracyContract({
      audit: null,
      comps: [],
      pricing: { ...locke, method1Mid: 1, method2: 1, method3: 1, converged: true, convergenceSpreadPct: 1, compPpsfCv: 0.1, confidence: 'High', needsReview: false, reviewReason: null } as unknown as CmaPricing,
      judgment: null,
      minComps: 0,
      marketContextPresent: true,
    })
    const lockeRange = lockeContract.checks.find((c) => c.id === 'recommendation-in-range')!
    expect(lockeRange.detail).toContain('$664,000')
    expect(lockeRange.detail).not.toContain('$685,000')
  })

  it('Grand Targhee shape: net sheet list follows the nudged rec', () => {
    const sellerNet = {
      list: 543_000,
      net: 500_000,
      lines: [],
      unknowns: [],
      knownCount: 0,
      givenCount: 0,
      expectedConcessions: null,
      medianWhenGiven: null,
      rate: null,
      sentence: 'At $543,000 the estimate is a draft.',
    } as unknown as CmaSellerNet
    const pricing = {
      recommended: 543_000,
      conservative: 500_000,
      highEnd: 565_000,
      valueLow: 500_000,
      valueHigh: 565_000,
      notes: [],
      sellerNet,
      clamp: null,
    }
    const finished = finishRecommendedAfterActives(
      { ...pricing, recommended: 527_000 },
      { actives: [], pocketClosedSupport: null },
    )
    expect(finished.sellerNet?.list).toBe(527_000)
  })
})
