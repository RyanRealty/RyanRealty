/**
 * The pure half of V3PlaceAffordability: sentences and drawn figures, no state,
 * no fetch, no DOM. The client island owns the two-way solve and the events;
 * everything a reader actually reads is shaped here, where it can be tested.
 *
 * WHY THE DRAWINGS ARE ALL `pair`. Three reasons, and the third is the one that
 * decided it.
 *
 *  1. Every figure this section draws is a COMPARISON — your number against the
 *     middle of this market, what you bring against what you borrow, how the
 *     last year's buyers actually paid. Two named counts on one shared scale is
 *     the form DATA_GRAPHICS.md keeps asking for, and it is the form that makes
 *     the reader do the division themselves.
 *  2. A `strip` or a `rule` needs a price axis, and a place's asking prices are
 *     violently right-skewed (Bend, read 2026-09-08: 761 active single-family
 *     asks from $350,000 to $11,900,000, median $899,000). On a min-to-max axis
 *     the middle of the market sits at 5% of the track and the drawing says
 *     nothing true.
 *  3. `V3Drawing`'s strip marks are 24x24 buttons. `/cities/bend` is on the
 *     `ci:tap-targets` route list, its baseline is shrink-only, and a 24px
 *     control there is a new red signature. The `pair` bar row is
 *     `min-height: var(--v3-tap)`. A form that fails an accessibility floor is
 *     not a form we get to pick.
 *
 * WHAT IS NOT DRAWN HERE, AND WHY (CLAUDE.md section 0). No count of homes
 * under the ceiling. The only per-listing active price set this page can reach
 * is the Atlas population off `listing_tile_mv`, and it is a MATERIALLY
 * different population from the `median_list_active` the page already
 * publishes: Bend reads 761 active single-family asks at a $899,000 median
 * there against the page's published 664 detached at $947,000 (both read
 * 2026-09-08). A count drawn from the first, sitting under the second, is two
 * answers to one question — the reconciliation failure this route's own
 * contract already records once. The count belongs to the search, and the
 * search is one tap away.
 */
import { formatPriceExact } from '@/lib/format/money'
import { formatMonthlyPayment } from '@/lib/mortgage'
import type { AffordabilitySolution } from '@/lib/finance/affordability'
import type { V3DrawingFigure } from './V3Drawing.client'

export type AffordabilityMode = 'financed' | 'cash'

/** One published slice of the local financing mix. Shares arrive as fractions. */
export type AffordabilityMixSlice = {
  key: string
  /** Plain-language name, already resolved by the caller. */
  name: string
  /** 0 to 1. */
  share: number
  /** The share as the caller formatted it ("27.8%"). */
  label: string
}

export type AffordabilityViewInput = {
  placeName: string
  mode: AffordabilityMode
  /** The visitor's own answer, already solved. */
  solved: AffordabilitySolution
  /** The place's published median asking price. Null withholds the comparison. */
  medianListPrice: number | null
  /** The published payment at that median under the visitor's own terms. */
  medianMonthly: number | null
  /** The section-0 trace behind the median. */
  medianSource: string
  /** The section-0 trace behind the terms the visitor is running. */
  termsSource: string
  /** The local financing mix, biggest share first. Empty withholds the figure. */
  mix: readonly AffordabilityMixSlice[]
  mixSource: string
}

/** The one sentence the section opens on, before any figure. */
export function affordabilityClaim(input: {
  placeName: string
  medianListPrice: number | null
  medianMonthly: number | null
  mode: AffordabilityMode
}): string {
  const { placeName, medianListPrice, medianMonthly, mode } = input
  if (medianListPrice == null) {
    return `Put in what you can spend on a house in ${placeName}, or what you can pay each month, and this works out the other one.`
  }
  // NO PAYMENT IN THIS SENTENCE, on purpose. It used to end "which is about
  // $4,894 a month", and on first paint that put the SAME payment figure on
  // screen four times — here, in the answer headline, and on both bars of the
  // lead drawing. Four printings of one number read as clutter, not as
  // emphasis. The payment belongs to the answer; the claim anchors the market.
  const price = formatPriceExact(medianListPrice)
  const tail =
    mode === 'cash'
      ? 'Set what you can put down in cash and the search at the end follows it.'
      : 'Move either number below and the other one follows.'
  return `The middle single-family home for sale in ${placeName} asks ${price}. ${tail}`
}

/** The live headline over the answer: what the visitor's number reaches. */
export function affordabilityAnswerLine(input: {
  placeName: string
  mode: AffordabilityMode
  solved: AffordabilitySolution
}): string {
  const { placeName, mode, solved } = input
  const ceiling = formatPriceExact(solved.ceiling)
  if (mode === 'cash') {
    return `${ceiling} in cash is what you can put on a house in ${placeName}.`
  }
  return `${formatMonthlyPayment(solved.ceilingMonthly)} a month reaches ${ceiling} in ${placeName}.`
}

/** The label on the one action that ends this section. */
export function affordabilitySearchLabel(placeName: string, ceiling: number): string {
  return `See homes under ${formatPriceExact(ceiling)} in ${placeName}`
}

/**
 * The drawn figures, in reading order. Every one carries its own trace, because
 * `V3Drawing` throws on a figure without one and because a drawn number with no
 * source is the thing section 0 exists to stop.
 */
export function affordabilityFigures(input: AffordabilityViewInput): V3DrawingFigure[] {
  const { placeName, mode, solved, medianListPrice, medianMonthly, medianSource, termsSource, mix, mixSource } = input
  const figures: V3DrawingFigure[] = []

  // 1. What you bring against what you borrow. The LEAD, because it is the
  //    one comparison that is never equal and never empty on first paint.
  if (mode === 'financed' && solved.loanAmount > 0) {
    figures.push({
      key: 'bring-and-borrow',
      draw: 'pair',
      claim: `At ${formatPriceExact(solved.ceiling)}, here is what you bring and what you borrow.`,
      caption: 'cash in and loan',
      source: `Arithmetic on the price you set, not a figure we measured: ${termsSource} The two add up to ${formatPriceExact(solved.ceiling)} exactly — closing costs are not in either bar.`,
      bars: [
        {
          name: 'You bring',
          value: solved.downPayment,
          label: formatPriceExact(solved.downPayment),
          note: `${formatPriceExact(solved.downPayment)} down on ${formatPriceExact(solved.ceiling)}.`,
        },
        {
          name: 'You borrow',
          value: solved.loanAmount,
          label: formatPriceExact(solved.loanAmount),
          note: `${formatPriceExact(solved.loanAmount)} borrowed, repaid over the term you set.`,
        },
      ],
      emptyReason: 'Set a down payment under 100% and this draws.',
    })
  }

  // 2. The visitor's number against the middle of this market.
  //    NOT the lead drawing: the calculator OPENS at the median, so on first
  //    paint both bars are the same length and the comparison says nothing.
  //    It earns its place the moment the visitor moves a dial, which is
  //    exactly where the split above has already given them something to read.
  if (mode === 'financed' && medianListPrice != null && medianMonthly != null && medianMonthly > 0) {
    figures.push({
      key: 'against-the-middle',
      draw: 'pair',
      claim: `Your monthly number against the middle of ${placeName}.`,
      caption: 'monthly payment',
      source: `${medianSource} The two payments are principal and interest only, on the terms you set: ${termsSource} Taxes, insurance and any HOA sit on top.`,
      bars: [
        {
          name: 'Yours',
          value: solved.ceilingMonthly,
          label: formatMonthlyPayment(solved.ceilingMonthly),
          note: `${formatMonthlyPayment(solved.ceilingMonthly)} a month is principal and interest on ${formatPriceExact(solved.ceiling)}.`,
        },
        {
          name: `The middle home in ${placeName}`,
          value: medianMonthly,
          label: formatMonthlyPayment(medianMonthly),
          note: `${formatMonthlyPayment(medianMonthly)} a month is principal and interest on the ${formatPriceExact(medianListPrice)} median asking price.`,
        },
      ],
      verdict:
        solved.ceilingMonthly >= medianMonthly
          ? `Your number reaches the middle of this market.`
          : `The middle of this market is above your number. The homes under your ceiling are the ones to look at.`,
      emptyReason: 'Set a payment or a price and this draws.',
    })
  }

  // 3. How the last year's buyers here actually paid. A fact about closed
  //    sales, never a suggestion about this visitor's down payment.
  const drawableMix = mix.filter((m) => Number.isFinite(m.share) && m.share > 0)
  if (drawableMix.length >= 2) {
    figures.push({
      key: 'how-people-paid',
      draw: 'pair',
      claim: `How people actually paid for a house in ${placeName}.`,
      caption: 'financing mix',
      source: mixSource,
      bars: drawableMix.map((slice) => ({
        name: slice.name,
        value: slice.share,
        label: slice.label,
        note: `${slice.label} of closed single-family sales in ${placeName} were ${slice.name.toLowerCase()}.`,
      })),
      emptyReason: `We have not published a financing mix for ${placeName}.`,
    })
  }

  return figures
}
