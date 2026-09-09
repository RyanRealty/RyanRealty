/**
 * Affordability, solved BOTH ways.
 *
 * `lib/mortgage.ts` answers "price in, payment out" — the half every listing
 * site ships. This module answers the other half, which is the one a buyer
 * actually asks out loud: "I can pay $4,000 a month. What does that buy?"
 *
 * WHY THE INVERSE IS NOT JUST ALGEBRA HERE. The forward figure the site
 * publishes is `estimatedMonthlyPayment`, which runs the price through
 * `publishFinancingSplit` first — down payment is WHOLE dollars of the price
 * and the loan is the remainder, so the two always foot (that module's founding
 * case: $130,000 down on one widget and $129,800 on another, for one house).
 * The closed-form inverse ignores that rounding, so it can hand back a price
 * whose forward payment is a dollar or two OVER what the visitor typed. A
 * ceiling that is above the ceiling that was solved is a promise we then break
 * on the search results, so the closed form is only the seed here: the answer
 * is snapped to the largest whole-dollar price whose PUBLISHED payment is at
 * or under the target. Solve-then-verify against the same function the page
 * prints, never a second formula.
 *
 * Nothing in this file reads a rate. The rate is an input, and whether it is a
 * sourced figure or the visitor's own assumption is the caller's problem to
 * label (CLAUDE.md section 0).
 */

import { estimatedMonthlyPayment } from '@/lib/mortgage'
import { publishFinancingSplit } from '@/lib/finance/publish-down-payment'

/**
 * The ceiling that reaches a search URL is rounded to this step, DOWNWARD.
 * Down and not to-nearest because the button states a promise ("homes under
 * $X") that the search then has to keep: rounding up would put homes above the
 * solved ceiling on the other side of the click.
 */
export const AFFORDABILITY_CEILING_STEP = 1_000

/** Price floor and ceiling the solver will search between. */
export const AFFORDABILITY_MIN_PRICE = 25_000
export const AFFORDABILITY_MAX_PRICE = 25_000_000

/** The snap search never runs away: the published payment moves by well under a
 *  dollar per dollar of price, so a handful of steps always lands it. */
const SNAP_STEPS = 64
/** Float slop. Two payments within a tenth of a cent are the same payment. */
const EPSILON = 1e-4

export type AffordabilityTerms = {
  /** Percent, e.g. 6.71. */
  interestRatePercent: number
  /** Percent of the price, e.g. 20. */
  downPaymentPct: number
  loanTermYears: number
}

function finite(n: number | null | undefined): n is number {
  return n != null && Number.isFinite(n)
}

function clampPrice(price: number): number {
  return Math.min(AFFORDABILITY_MAX_PRICE, Math.max(AFFORDABILITY_MIN_PRICE, Math.round(price)))
}

/** Round a price DOWN to the published step. Never up — see the constant. */
export function roundCeilingDown(price: number, step: number = AFFORDABILITY_CEILING_STEP): number {
  if (!finite(price) || !finite(step) || step <= 0) return 0
  return Math.floor(price / step) * step
}

/**
 * The published monthly principal and interest at a price — the same figure
 * `lib/mortgage.ts` prints, re-exported through this module's own signature so
 * the two directions cannot drift onto two formulas.
 */
export function monthlyAtPrice(price: number, terms: AffordabilityTerms): number | null {
  if (!finite(price) || price <= 0) return null
  if (!finite(terms.interestRatePercent) || terms.interestRatePercent < 0) return null
  if (!finite(terms.downPaymentPct) || terms.downPaymentPct < 0 || terms.downPaymentPct >= 100) return null
  if (!finite(terms.loanTermYears) || terms.loanTermYears <= 0) return null
  const monthly = estimatedMonthlyPayment(
    price,
    terms.downPaymentPct,
    terms.interestRatePercent,
    terms.loanTermYears,
  )
  return Number.isFinite(monthly) ? monthly : null
}

/**
 * The largest whole-dollar price whose PUBLISHED monthly payment is at or under
 * `monthly`. Null when the terms cannot produce a payment at all.
 */
export function solvePriceForMonthlyPayment(
  monthly: number,
  terms: AffordabilityTerms,
): number | null {
  if (!finite(monthly) || monthly <= 0) return null
  const { interestRatePercent: ratePct, downPaymentPct: downPct, loanTermYears: years } = terms
  if (!finite(ratePct) || ratePct < 0) return null
  if (!finite(downPct) || downPct < 0 || downPct >= 100) return null
  if (!finite(years) || years <= 0) return null

  // The closed form, as the SEED only.
  const i = ratePct / 100 / 12
  const n = years * 12
  const loan = i > 0 ? (monthly * (Math.pow(1 + i, n) - 1)) / (i * Math.pow(1 + i, n)) : monthly * n
  if (!Number.isFinite(loan) || loan <= 0) return null
  let price = clampPrice(loan / (1 - downPct / 100))

  const over = (p: number) => {
    const m = monthlyAtPrice(p, terms)
    return m == null || m > monthly + EPSILON
  }

  // Snap DOWN off the seed while the published payment overshoots.
  for (let step = 0; step < SNAP_STEPS && price > AFFORDABILITY_MIN_PRICE && over(price); step += 1) {
    price -= 1
  }
  if (over(price)) return null
  // Then climb while the next dollar still fits, so the answer is the LARGEST
  // price that honours the payment rather than merely a price that does.
  for (let step = 0; step < SNAP_STEPS && price < AFFORDABILITY_MAX_PRICE && !over(price + 1); step += 1) {
    price += 1
  }
  return price
}

export type AffordabilitySolution = {
  /** The exact solved price, whole dollars. */
  price: number
  /** The published payment at that price. */
  monthly: number
  /** The price the search link and the button carry: `price` rounded DOWN. */
  ceiling: number
  /** The published payment at the CEILING — never above `monthly`. */
  ceilingMonthly: number
  downPayment: number
  loanAmount: number
}

/** Everything a financed answer publishes, from a price. */
export function solveFromPrice(price: number, terms: AffordabilityTerms): AffordabilitySolution | null {
  const monthly = monthlyAtPrice(price, terms)
  if (monthly == null) return null
  const ceiling = Math.max(AFFORDABILITY_CEILING_STEP, roundCeilingDown(price))
  const ceilingMonthly = monthlyAtPrice(ceiling, terms) ?? monthly
  const split = publishFinancingSplit({ price: ceiling, downPaymentPct: terms.downPaymentPct })
  if (!split) return null
  return {
    price: Math.round(price),
    monthly,
    ceiling,
    ceilingMonthly,
    downPayment: split.downPayment,
    loanAmount: split.loanAmount,
  }
}

/** Everything a financed answer publishes, from a monthly payment. */
export function solveFromMonthly(monthly: number, terms: AffordabilityTerms): AffordabilitySolution | null {
  const price = solvePriceForMonthlyPayment(monthly, terms)
  if (price == null) return null
  return solveFromPrice(price, terms)
}

/**
 * The cash answer. No loan, so the ceiling IS the money — and the whole point
 * of the mode is that nothing here invents a down payment from a cash SHARE.
 * "27.8% of sales closed cash" is a fact about other people's sales; it is
 * never this visitor's down payment (CLAUDE.md section 0).
 */
export function solveCash(cash: number): AffordabilitySolution | null {
  if (!finite(cash) || cash <= 0) return null
  const ceiling = Math.max(AFFORDABILITY_CEILING_STEP, roundCeilingDown(cash))
  return {
    price: Math.round(cash),
    monthly: 0,
    ceiling,
    ceilingMonthly: 0,
    downPayment: ceiling,
    loanAmount: 0,
  }
}

/**
 * Cash is the OPENING mode only when most closed sales in the window were cash.
 * Below that the calculator opens financed, because opening on cash in a market
 * where three sales in four carry a loan would make the display say something
 * the data does not.
 */
export const CASH_OPENING_THRESHOLD = 0.5

export function opensOnCash(cashShare: number | null | undefined): boolean {
  return finite(cashShare) && cashShare >= CASH_OPENING_THRESHOLD
}

/**
 * Append a price ceiling to a browse path the caller already owns. The param is
 * `maxPrice`, which is what `lib/search-filters.ts` normalises and what
 * `PlaceSplitView` reads — this function does not invent a URL grammar, it only
 * carries the ceiling onto one.
 */
export function withMaxPrice(browseHref: string, ceiling: number): string {
  if (!browseHref.trim()) return browseHref
  if (!finite(ceiling) || ceiling <= 0) return browseHref
  const [path, existing = ''] = browseHref.split('?')
  const params = new URLSearchParams(existing)
  params.set('maxPrice', String(Math.round(ceiling)))
  return `${path}?${params.toString()}`
}
