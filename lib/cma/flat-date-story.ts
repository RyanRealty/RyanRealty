/**
 * One date story. A local price per square foot that held flat and a large
 * city-index cut on the same letter are two stories. The letter keeps the
 * local one and does not move those sales for the month they closed.
 */

import { describeRangeSentence, printedAdjustmentPhrase } from '@/lib/pricing/estimate'
import { grossAdjustmentPct, weightedAdjustedPrice } from '@/lib/pricing/reconciliation'
import { reanchorSellerNet } from '@/lib/pricing/seller-net'
import type { CmaPricing } from '@/lib/cma/types'

const LARGE_DATE_CUT = 10_000

function rangeSentenceSuffix(sentence: string | null | undefined): string {
  if (!sentence) return ''
  const idx = sentence.search(/The range is (?:those|the) adjusted/)
  return idx >= 0 ? ` ${sentence.slice(idx)}` : ''
}

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

function usdWhole(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

/** Notes that describe a date move this pass just took off the sales. */
function noteDescribesStrippedDateMove(note: string): boolean {
  return (
    /Date adjustment was applied/i.test(note) ||
    /lowest meaningful same-subdivision adjusted sale/i.test(note) ||
    /moved [+-]?\d+(?:\.\d+)? percent, from \$/i.test(note)
  )
}

/**
 * The weight sentence was written before the date move came off.
 * A sale that no longer moves for the month it closed cannot still say it did.
 * A size or style move that is still on the card keeps its own name.
 */
function reasonWithoutStrippedDateMove(
  text: string,
  comp: {
    timeAdjustment?: number | null
    sizeAdjustment?: number | null
    storyAdjustment?: number | null
    closePrice?: number | null
  } | null,
): string {
  if (!comp || Math.abs(comp.timeAdjustment ?? 0) >= 1) return text
  const size = Math.abs(comp.sizeAdjustment ?? 0) >= 1
  const story = Math.abs(comp.storyAdjustment ?? 0) >= 1
  if (!size && !story) {
    return text
      .replace(
        /its price moved [\d.]+ percent when adjusted for date(?:, size| and size)?/g,
        'its price did not move',
      )
      .replace(/ when adjusted for date and size/g, '')
      .replace(/ when adjusted for date/g, '')
  }
  const named = [size ? 'size' : null, story ? 'style' : null].filter(Boolean).join(' and ')
  const pct = grossShare({
    closePrice: comp.closePrice,
    timeAdjustment: 0,
    sizeAdjustment: comp.sizeAdjustment,
    storyAdjustment: comp.storyAdjustment,
  })
  return text.replace(
    /its price moved [\d.]+ percent when adjusted for [^.,]*/,
    `its price moved ${pct} percent when adjusted for ${named}`,
  )
}

/** The printed sales, weighted, rounded to the thousand the sentence names. */
function supportedThousand(
  comps: readonly { adjustedPrice?: number | null; weight?: number | null }[],
): number | null {
  const sales: { adjustedPrice: number; weight: number }[] = []
  for (const c of comps) {
    const weight = Number(c.weight) || 0
    const price = Number(c.adjustedPrice) || 0
    if (weight > 0 && price > 0) sales.push({ adjustedPrice: price, weight })
  }
  if (sales.length === 0) return null
  const point = weightedAdjustedPrice(sales)
  if (point == null || !(point > 0)) return null
  return Math.round(point / 1000) * 1000
}

/** Date, size, and style only, as a percent of the sale. A concession stays on its own line. */
function grossShare(comp: {
  closePrice?: number | null
  timeAdjustment?: number | null
  sizeAdjustment?: number | null
  storyAdjustment?: number | null
}): number {
  return grossAdjustmentPct({
    closePrice: Number(comp.closePrice) || 0,
    timeAdjustment: Number(comp.timeAdjustment) || 0,
    sizeAdjustment: Number(comp.sizeAdjustment) || 0,
    storyAdjustment: Number(comp.storyAdjustment) || 0,
  })
}

/** " before adjusting for size", or nothing when the sales were not moved. */
export function beforeAdjustmentWords(
  comps: Parameters<typeof homesLikeYoursRangeLabel>[0],
): string {
  const phrase = printedAdjustmentPhrase(comps ?? [])
  if (phrase === 'none') return ''
  return ` before adjusting for ${phrase}`
}

/** The chart caption. It names only the adjustments still on the sales. */
export function homesLikeYoursRangeLabel(
  comps:
    | readonly {
        sizeAdjustment?: number | null
        storyAdjustment?: number | null
        timeAdjustment?: number | null
      }[]
    | null
    | undefined,
): string {
  const phrase = printedAdjustmentPhrase(comps ?? [])
  if (phrase === 'none') return 'where homes like yours sold'
  return `where homes like yours sold, adjusted for ${phrase}`
}

export function pricingWithoutCityDateMove<P extends CmaPricing>(
  pricing: P,
  comps: readonly {
    adjustedPrice: number
    weight?: number | null
    listingKey?: string | null
    closePrice?: number | null
    timeAdjustment?: number | null
    sizeAdjustment?: number | null
    storyAdjustment?: number | null
  }[],
): P {
  const time = pricing.timeAdjustment
  const nextTime = time
    ? {
        ...time,
        sentence: FLAT_LOCAL_DATE_SENTENCE,
        pctPerMonth: 0,
        pctOverWindow: 0,
        // The city or pocket index is not the story this sentence tells.
        measure: null,
      }
    : time
  const rule = pricing.rangeRule
  let rangeRule = rule
  let valueLow = pricing.valueLow
  let valueHigh = pricing.valueHigh
  if (rule?.rule === 'min-max') {
    const prices = comps.map((c) => c.adjustedPrice).filter((n) => n > 0)
    if (prices.length >= 2) {
      const saleLow = Math.min(...prices)
      const saleHigh = Math.max(...prices)
      // The date cut is gone. The cover, the lead, and this sentence are
      // that one pair. Keeping the old band names a second range.
      valueLow = saleLow
      valueHigh = saleHigh
      rangeRule = {
        ...rule,
        saleLow,
        saleHigh,
        adjustedLow: saleLow,
        adjustedHigh: saleHigh,
        sentence: describeRangeSentence({
          rule: 'min-max',
          n: prices.length,
          kept: prices.length,
          printedLow: saleLow,
          printedHigh: saleHigh,
          saleLow,
          saleHigh,
          adjustedFor: printedAdjustmentPhrase(comps),
          suffix: rangeSentenceSuffix(rule.sentence),
        }),
      }
    }
  } else if (rule?.sentence) {
    const phrase = printedAdjustmentPhrase(comps)
    const adjusted = phrase === 'none' ? '' : ` adjusted for ${phrase}`
    rangeRule = {
      ...rule,
      sentence: rule.sentence.replaceAll(' adjusted for date and size', adjusted),
    }
  }
  // The date cut is gone from the sales. The support sentence, the gross
  // on each card, and the review line still named the cut price.
  const supported = supportedThousand(comps)
  let reconciliation = pricing.reconciliation
  if (supported != null && reconciliation) {
    const byKey = new Map(
      comps.filter((c) => c.listingKey).map((c) => [c.listingKey as string, c]),
    )
    reconciliation = {
      ...reconciliation,
      weightedPrice: supported,
      weights: reconciliation.weights.map((row) => {
        const comp = byKey.get(row.listingKey)
        if (!comp) return row
        return {
          ...row,
          adjustedPrice: Math.round(comp.adjustedPrice),
          grossAdjustmentPct: grossShare(comp),
          reason: reasonWithoutStrippedDateMove(row.reason, comp),
        }
      }),
      sentence:
        reconciliation.sentence == null
          ? null
          : reasonWithoutStrippedDateMove(
              reconciliation.sentence,
              (reconciliation.mostWeighted ? byKey.get(reconciliation.mostWeighted) : null) ?? {
                timeAdjustment: 0,
                sizeAdjustment: 0,
                storyAdjustment: 0,
                closePrice: 0,
              },
            ),
    }
  }
  let clamp = pricing.clamp
  if (supported != null && clamp?.sentence) {
    clamp = {
      ...clamp,
      before: supported,
      sentence: clamp.sentence.replace(
        /The sales support a value of \$[\d,]+/,
        `The sales support a value of ${usdWhole(supported)}`,
      ),
    }
  }
  // The cover is the weighted price of the sales the letter now shows.
  // A failed-ask pull stays only when those sales sit on the ask or above it.
  // Sales that are already under the ask set the list. The old date-adjusted
  // number does not.
  let recommended = pricing.recommended
  if (supported != null && supported > 0) {
    const ask = pricing.failedAsk
    const keepPull =
      ask != null && ask > 0 && recommended > 0 && recommended < ask && supported >= ask
    if (!keepPull) recommended = supported
  }
  if (clamp && recommended !== pricing.recommended && clamp.appliedTo === 'recommended') {
    clamp = { ...clamp, after: recommended }
  }
  const reviewReason =
    supported != null && pricing.reviewReason
      ? pricing.reviewReason.replace(
          /Comp evidence supported \$[\d,]+/,
          `Comp evidence supported ${usdWhole(supported)}`,
        )
      : pricing.reviewReason
  const notes = (pricing.notes ?? []).filter((n) => !noteDescribesStrippedDateMove(n))
  const next = {
    ...pricing,
    recommended,
    valueLow,
    valueHigh,
    timeAdjustment: nextTime,
    rangeRule,
    reconciliation,
    clamp,
    reviewReason,
    notes,
  }
  if (recommended !== pricing.recommended && next.sellerNet) reanchorSellerNet(next)
  return next
}

/** Cover and chapters read one set. A later chapter must not strip the date again and leave the cover on the old band. */
export function applyFlatDateStory<
  T extends {
    comps: Parameters<typeof compsWithoutCityDateMove>[0]
    pricing: CmaPricing
    listingMarket?: { ppsfMove?: string | null } | null
  },
>(args: T): T {
  const flat = cityDateCutsFightFlatLocal({
    ppsfMove: args.listingMarket?.ppsfMove ?? null,
    comps: args.comps,
  })
  if (!flat) return args
  const comps = compsWithoutCityDateMove(args.comps)
  return { ...args, comps, pricing: pricingWithoutCityDateMove(args.pricing, comps) }
}
