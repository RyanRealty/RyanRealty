/**
 * One date story. A local price per square foot that held flat and a large
 * city-index cut on the same letter are two stories. The letter keeps the
 * local one and does not move those sales for the month they closed.
 */

import { describeRangeSentence } from '@/lib/pricing/estimate'
import type { CmaPricing } from '@/lib/cma/types'

const LARGE_DATE_CUT = 10_000

export const FLAT_LOCAL_DATE_SENTENCE =
  'The price per square foot held flat while your home was listed, so no sale is moved for the month it closed.'

export function cityDateCutsFightFlatLocal(args: {
  ppsfMove: string | null | undefined
  comps: readonly { timeAdjustment?: number | null }[]
}): boolean {
  if (args.ppsfMove !== 'held flat') return false
  return args.comps.some((c) => Math.abs(c.timeAdjustment ?? 0) >= LARGE_DATE_CUT)
}

export function compsWithoutCityDateMove<
  T extends { timeAdjustment: number; timeAdjustedPrice: number; adjustedPrice: number },
>(comps: readonly T[]): T[] {
  return comps.map((c) => {
    if (!c.timeAdjustment) return c
    return {
      ...c,
      timeAdjustedPrice: c.timeAdjustedPrice - c.timeAdjustment,
      adjustedPrice: c.adjustedPrice - c.timeAdjustment,
      timeAdjustment: 0,
    }
  })
}

export function pricingWithoutCityDateMove<P extends CmaPricing>(
  pricing: P,
  comps: readonly { adjustedPrice: number }[],
): P {
  const time = pricing.timeAdjustment
  const nextTime = time
    ? { ...time, sentence: FLAT_LOCAL_DATE_SENTENCE, pctPerMonth: 0, pctOverWindow: 0 }
    : time
  const rule = pricing.rangeRule
  let rangeRule = rule
  if (rule?.rule === 'min-max') {
    const prices = comps.map((c) => c.adjustedPrice).filter((n) => n > 0)
    if (prices.length >= 2) {
      const saleLow = Math.min(...prices)
      const saleHigh = Math.max(...prices)
      const printedLow = Math.min(pricing.valueLow, pricing.valueHigh)
      const printedHigh = Math.max(pricing.valueLow, pricing.valueHigh)
      rangeRule = {
        ...rule,
        saleLow,
        saleHigh,
        sentence: describeRangeSentence({
          rule: 'min-max',
          n: rule.n,
          kept: rule.kept,
          printedLow,
          printedHigh,
          saleLow,
          saleHigh,
        }),
      }
    }
  } else if (rule?.sentence) {
    rangeRule = {
      ...rule,
      sentence: rule.sentence.replaceAll('adjusted for date and size', 'adjusted for size'),
    }
  }
  return { ...pricing, timeAdjustment: nextTime, rangeRule }
}
