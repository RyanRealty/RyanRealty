/**
 * AN ADU HOME PRICES FROM ADU SALES FIRST (Matt 2026-10-14).
 *
 * Until 2026-10-14 a home with an ADU, guest house or casita was a detached
 * home priced from sales with or without one (SKILL §0.3 rule 23), and the ADU
 * was a letter note, not dollars (rule 2). Asked beside the 429 Irving guard,
 * Matt chose the middle path: run the ladder on ADU sales first; when at least
 * five of them set the price, they are the set; when fewer do, the ordinary set
 * (sales with or without an ADU) prices the home and the letter says so. The
 * ADU still carries no dollar of its own. Only the company it is priced in
 * changes.
 *
 * The decision is one function over a run callback, so the facts walk (a pool
 * already in memory, filtered before the walk) and the listings ladder (a
 * second SQL pass with `aduSalesOnly`) take the same two-pass shape, and a
 * test can drive it with stub sets. The outcome travels on the selection's
 * diagnostics (`adu_preference`) to the letter.
 */
import { PRICING_MIN_COMPS } from '@/lib/pricing/ladder'

export { isAduSale, subjectHasAdu } from '@/lib/pricing/classes'

export type AduPreferenceOutcome = 'adu-sales' | 'fallback'

export type AduPreference = {
  outcome: AduPreferenceOutcome
  /**
   * Why the ordinary set prices the home: fewer than five ADU sales set the
   * price on the pass ('short'), or the ADU set lost a sale in the
   * comparability review with no ADU bench to refill it ('review'). Absent on
   * an ADU-sales outcome.
   */
  fallback_reason?: 'short' | 'review'
  /** Price-setting ADU sales the ADU-only pass held. */
  adu_sales_held: number
  /** The floor the pass had to reach (PRICING_MIN_COMPS). */
  minimum: number
  /** The sentence the letter prints beside the ADU note. */
  sentence: string
  /**
   * On a fallback: the ADU-only pass's own trace (which rungs ran, why it
   * stopped short), so the row still shows why each ADU sale was refused.
   * Capped at FIRST_PASS_TRACE_LINES lines.
   */
  first_pass_trace?: string[]
}

const FIRST_PASS_TRACE_LINES = 40

const SMALL_NUMBERS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']

/**
 * The letter's sentence for each outcome. Public copy: no em dashes, no rule
 * numbers, and no count. The review can swap a sale and the bench can top the
 * set up after this pass, so a number here could be refuted by the printed
 * set; the counts stay on the diagnostics and the trace.
 */
export function aduPreferenceSentence(outcome: AduPreferenceOutcome, minimum: number): string {
  if (outcome === 'adu-sales') {
    return 'This home has an accessory dwelling unit, so its price is read from closed sales that also have one. The unit carries no separate dollar figure; it is priced in the company of homes like it.'
  }
  const floor = SMALL_NUMBERS[minimum] ?? String(minimum)
  return `This home has an accessory dwelling unit. Fewer than ${floor} closed sales with one were found to set its price, so the price is read from comparable homes with and without an ADU. The unit carries no separate dollar figure.`
}

/**
 * Run the ADU-first pass. `run(true)` prices from ADU sales only; `run(false)`
 * is the ordinary selection. Without an ADU on the subject the ordinary run is
 * the only one and `aduPreference` is null.
 */
export async function aduFirst<T extends { comps: unknown[]; trace?: string[] }>(args: {
  subjectAdu: boolean
  run: (aduSalesOnly: boolean) => T | Promise<T>
  minimum?: number
}): Promise<{ result: T; aduPreference: AduPreference | null }> {
  if (!args.subjectAdu) return { result: await args.run(false), aduPreference: null }
  const minimum = args.minimum ?? PRICING_MIN_COMPS
  const first = await args.run(true)
  const held = first.comps.length
  if (held >= minimum) {
    return {
      result: first,
      aduPreference: { outcome: 'adu-sales', adu_sales_held: held, minimum, sentence: aduPreferenceSentence('adu-sales', minimum) },
    }
  }
  const full = await args.run(false)
  return {
    result: full,
    aduPreference: {
      outcome: 'fallback',
      fallback_reason: 'short',
      adu_sales_held: held,
      minimum,
      sentence: aduPreferenceSentence('fallback', minimum),
      ...(Array.isArray(first.trace) && first.trace.length > 0 ? { first_pass_trace: first.trace.slice(0, FIRST_PASS_TRACE_LINES) } : {}),
    },
  }
}

/**
 * THE FALLBACK AFTER THE REVIEW. The pass decides on the picker's count, and
 * the comparability review can still drop an ADU sale with no ADU bench to
 * refill it; five minus one is a comp shortage. The rule says under five the
 * ordinary set prices the home, before or after the review, so the build
 * re-enters once on the ordinary pass (CmaBuildInput.aduFallback,
 * BpoBuildInput.aduFallback) and the selection stamps this instead.
 */
export function reviewFallbackPreference(heldAfterReview: number, minimum: number = PRICING_MIN_COMPS): AduPreference {
  return {
    outcome: 'fallback',
    fallback_reason: 'review',
    adu_sales_held: heldAfterReview,
    minimum,
    sentence: aduPreferenceSentence('fallback', minimum),
  }
}

/** The trace line a ladder records for the pass it ran. */
export function aduPreferenceTrace(p: AduPreference, poolAduSales: number | null): string {
  const pool = poolAduSales == null ? '' : ` ${poolAduSales} sale(s) in the pool state an ADU.`
  if (p.fallback_reason === 'review') {
    return `ADU home: the ADU-first set held ${p.adu_sales_held} ADU sale(s) after the comparability review, under the ${p.minimum} the rule needs, so this build selects on the ordinary set (sales with or without an ADU) and the letter says so (Matt 2026-10-14).${pool}`
  }
  return p.outcome === 'adu-sales'
    ? `ADU home: priced from ADU sales first (Matt 2026-10-14). ${p.adu_sales_held} ADU sale(s) set the price, at or above the ${p.minimum} the rule needs, so they are the set.${pool}`
    : `ADU home: priced from ADU sales first (Matt 2026-10-14). Only ${p.adu_sales_held} ADU sale(s) could set the price, under the ${p.minimum} the rule needs, so the ordinary set (sales with or without an ADU) prices the home and the letter says so.${pool}`
}
