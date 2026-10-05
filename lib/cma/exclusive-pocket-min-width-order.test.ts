/**
 * Minimum width opens the printed band. It is presentation. It does not move
 * the recommendation, and the high-DOM nudge does not chase the opened low
 * or cross the conservative tier. The tier stays. The nudge function can
 * still compute a pull under a list tier when it is called with only the
 * sale band. The build holds the tier so the accuracy contract can pass.
 *
 * Streets here are made up. The dollar shapes match builds that failed
 * range-consistency after the active nudge, plus a failed ask under the
 * sales and one inside them.
 */
import { describe, expect, it } from 'vitest'
import { finishRecommendedAfterActives } from '@/lib/cma/finish-recommended'
import { applyFailedAskCap } from '@/lib/cma/expired-audit'
import { nudgeRecommendedDownForHighDomActives } from '@/lib/pricing/active-dom-nudge'
import { ensureMinBandWidth, roundPriceDown, roundPriceUp, type PricingRangeRule } from '@/lib/pricing/estimate'
import { evaluateAccuracyContract } from '@/lib/cma/contract'
import type { CmaPricing } from '@/lib/cma/types'

const SITTING = [{ status: 'Active', listPrice: 700_000, daysOnMarket: 90 }]
const recentOff = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString()

function rule(saleLow: number, saleHigh: number, evidenceLow: number): PricingRangeRule {
  return {
    rule: 'min-max',
    n: 3,
    kept: 3,
    adjustedLow: saleLow,
    adjustedHigh: saleHigh,
    saleToAskRatio: null,
    saleToAskSource: 'none',
    ratiosExcluded: 0,
    saleLow,
    saleHigh,
    evidenceLow,
    sentence: 'The range is the spread of the sales.',
  }
}

describe('minimum-width band and the active nudge stay ordered', () => {
  it('measures the pull against the pre-open low and keeps the floor', () => {
    // Opened low $537k. Floor and pre-open low $554k. Chasing $537k landed
    // at $547k and sat under the floor. The pull toward $554k is $7,500.
    const finished = finishRecommendedAfterActives(
      {
        conservative: 554_000,
        recommended: 564_000,
        highEnd: 564_000,
        valueLow: 537_000,
        valueHigh: 566_000,
        notes: [],
        rangeRule: rule(545_000, 564_000, 554_000),
      },
      { actives: SITTING },
    )
    expect(finished.recommended).toBe(557_000)
    expect(finished.conservative).toBe(554_000)
    expect(finished.highEnd).toBe(564_000)
    expect(finished.valueLow).toBe(537_000)
    expect(finished.valueHigh).toBe(566_000)
    expect(finished.conservative).toBeLessThanOrEqual(finished.recommended)
    expect(finished.recommended).toBeLessThanOrEqual(finished.highEnd!)
    expect(finished.recommended).toBeGreaterThanOrEqual(finished.valueLow)
    expect(finished.recommended).toBeLessThanOrEqual(finished.valueHigh)
  })

  it('does not pull a one-hundred-dollar sale cluster under its floor', () => {
    // Floor $624,900. Minimum width opened the printed low to $609,000.
    // Chasing that low landed at $613,000. The pre-open low is the floor.
    const finished = finishRecommendedAfterActives(
      {
        conservative: 624_900,
        recommended: 625_000,
        highEnd: 625_000,
        valueLow: 609_000,
        valueHigh: 641_000,
        notes: [],
        rangeRule: rule(623_000, 625_000, 624_900),
      },
      { actives: SITTING },
    )
    expect(finished.recommended).toBe(625_000)
    expect(finished.conservative).toBe(625_000)
    expect(finished.highEnd).toBe(625_000)
    expect(finished.valueLow).toBe(609_000)
    expect(finished.valueHigh).toBe(641_000)
    expect(finished.conservative).toBeLessThanOrEqual(finished.recommended)
  })

  it('holds the conservative tier when the sale-band pull would cross it', () => {
    const actives = [{ status: 'Active', listPrice: 729_000, daysOnMarket: 201 }]
    const nudge = nudgeRecommendedDownForHighDomActives({
      recommended: 701_000,
      bandLow: 675_000,
      bandHigh: 705_000,
      actives,
    })
    expect(nudge.recommended).toBe(682_000)
    const finished = finishRecommendedAfterActives(
      {
        conservative: 686_000,
        recommended: 701_000,
        highEnd: 716_000,
        valueLow: 675_000,
        valueHigh: 705_000,
        notes: [],
        rangeRule: rule(675_000, 705_000, 675_000),
      },
      { actives },
    )
    expect(finished.recommended).toBe(686_000)
    expect(finished.conservative).toBe(686_000)
    expect(finished.valueLow).toBe(675_000)
    expect(finished.valueHigh).toBe(705_000)
  })
})

describe('floor, minimum width, failed-ask cap, and the nudge', () => {
  function presentThenCapThenNudge(args: {
    conservative: number
    recommended: number
    highEnd: number
    valueLow: number
    valueHigh: number
    saleLow: number
    ask: number
  }) {
    const evidenceLow = Math.min(args.valueLow, args.valueHigh)
    const widened = ensureMinBandWidth(args.valueLow, args.valueHigh, args.recommended)
    const pricing = {
      conservative: args.conservative,
      recommended: args.recommended,
      highEnd: args.highEnd,
      valueLow: roundPriceDown(widened.low),
      valueHigh: roundPriceUp(widened.high),
      needsReview: false,
      reviewReason: null,
      notes: [] as string[],
      clamp: null,
      priceOverride: null,
      failedAskBelowRange: false,
      rangeRule: rule(args.saleLow, args.valueHigh, evidenceLow),
    }
    applyFailedAskCap(pricing, { lastFailedListPrice: args.ask, offMarketDate: recentOff })
    const finished = finishRecommendedAfterActives(pricing, { actives: SITTING, ask: args.ask })
    return { pricing, finished }
  }

  it('keeps a failed ask above the sales from pulling the rec under the floor', () => {
    const { finished } = presentThenCapThenNudge({
      conservative: 554_000,
      recommended: 564_000,
      highEnd: 564_000,
      valueLow: 554_000,
      valueHigh: 564_000,
      saleLow: 554_000,
      ask: 599_000,
    })
    expect(finished.valueLow).toBeLessThan(554_000)
    // $564,000 is already under the $599,000 ask, so the sitting active does not cut it.
    expect(finished.recommended).toBe(564_000)
    expect(finished.conservative).toBe(554_000)
    expect(finished.recommended).toBeLessThanOrEqual(599_000)
    expect(finished.failedAskBelowRange).not.toBe(true)
  })

  it('an ask under the real sales still comes out under that ask, not pinned up to the sale', () => {
    // Five adjusted sales already span more than the minimum width.
    // The ask sits a few thousand under the lowest one. The comps are
    // above the ask, so the recommendation comes out under the ask.
    // It is not pinned up to the sale, and it is not a 1.8 percent haircut.
    const { finished } = presentThenCapThenNudge({
      conservative: 970_000,
      recommended: 970_000,
      highEnd: 1_045_000,
      valueLow: 889_000,
      valueHigh: 1_045_000,
      saleLow: 889_000,
      ask: 885_000,
    })
    expect(finished.valueLow).toBe(889_000)
    expect(finished.recommended).toBe(884_000)
    expect(finished.failedAskBelowRange).toBe(true)
    expect(finished.recommended).toBeLessThan(885_000)
    expect(finished.recommended).not.toBe(889_000)
    expect(finished.recommended).not.toBe(Math.round((885_000 * 0.982) / 1000) * 1000)
    expect(finished.conservative).toBeLessThanOrEqual(finished.recommended)
  })

  it('the million-dollar twin also comes out under the ask when the ask is under the lowest sale', () => {
    const { finished } = presentThenCapThenNudge({
      conservative: 1_930_000,
      recommended: 1_930_000,
      highEnd: 1_975_000,
      valueLow: 1_880_000,
      valueHigh: 1_975_000,
      saleLow: 1_880_000,
      ask: 1_849_000,
    })
    expect(finished.recommended).toBe(1_848_000)
    expect(finished.failedAskBelowRange).toBe(true)
    expect(finished.recommended).toBeLessThan(1_849_000)
    expect(finished.recommended).not.toBe(1_880_000)
    expect(finished.valueLow).toBe(1_880_000)
  })

  it('does not let an opened print turn an ask under the sales into a haircut', () => {
    const pricing = {
      conservative: 624_900,
      recommended: 625_000,
      highEnd: 625_000,
      valueLow: 609_000,
      valueHigh: 641_000,
      needsReview: false,
      reviewReason: null,
      notes: [] as string[],
      clamp: null,
      priceOverride: null,
      failedAskBelowRange: false,
      rangeRule: rule(623_000, 625_000, 624_900),
    }
    applyFailedAskCap(pricing, { lastFailedListPrice: 615_000, offMarketDate: recentOff })
    expect(pricing.failedAskBelowRange).toBe(true)
    expect(pricing.recommended).toBe(614_000)
    expect(pricing.recommended).toBeLessThan(615_000)
    expect(pricing.recommended).not.toBe(624_900)
    expect(pricing.recommended).not.toBe(609_000)
    const finished = finishRecommendedAfterActives(pricing, { actives: SITTING, ask: 615_000 })
    // The band clamp must not lift the list back onto the sale, which is
    // above the ask that failed.
    expect(finished.recommended).toBe(614_000)
    expect(finished.recommended).toBeLessThan(615_000)
    expect(finished.conservative).toBeLessThanOrEqual(finished.recommended)
    expect(finished.recommended).toBeGreaterThanOrEqual(finished.conservative)
    const contract = evaluateAccuracyContract({
      audit: null,
      comps: [],
      pricing: { ...finished, method1Mid: 1, method2: 1, method3: 1 } as unknown as CmaPricing,
      judgment: null,
      minComps: 0,
      marketContextPresent: true,
      failedAsk: 615_000,
    })
    const cap = contract.checks.find((c) => c.id === 'expired-list-cap')
    const range = contract.checks.find((c) => c.id === 'range-consistency')
    expect(cap?.pass).toBe(true)
    expect(range?.pass).toBe(true)
  })
})
