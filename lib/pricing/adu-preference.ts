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
   * price on the pass ('short'), the ADU set lost a sale in the comparability
   * review with no ADU bench to refill it ('review'), or the ADU set's price
   * per square foot spread wider than the ordinary set's ('spread', Matt
   * 2026-10-14, second call). Absent on an ADU-sales outcome.
   */
  fallback_reason?: 'short' | 'review' | 'spread'
  /** Price-setting ADU sales the ADU-only pass held. */
  adu_sales_held: number
  /** Coefficient of variation of the ADU set's price per square foot, when both sets were measured. */
  adu_spread_cv?: number | null
  /** The same for the ordinary set. */
  ordinary_spread_cv?: number | null
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
export function aduPreferenceSentence(
  outcome: AduPreferenceOutcome,
  minimum: number,
  reason?: 'short' | 'review' | 'spread',
  /** The subject's ADU area is on record, so the ordinary set reads the unit on its own (lib/pricing/adu-value.ts). */
  unitRead = false,
): string {
  if (outcome === 'adu-sales') {
    return 'This home has an accessory dwelling unit, so its price is read from closed sales that also have one. The unit carries no separate dollar figure; it is priced in the company of homes like it.'
  }
  // On the ordinary set the unit is valued on its own from nearby sales of
  // homes with one (lib/pricing/adu-value.ts), and the letter has a chapter
  // for it, when the record states the unit's area; a unit the remarks alone
  // name has no area to price, and the sentence promises nothing.
  const own = unitRead ? ' What the unit adds is read on its own.' : ''
  if (reason === 'spread') {
    return `This home has an accessory dwelling unit. Closed sales with one were looked at first, but their prices spread wider than the ordinary set's, so the price is read from comparable homes with and without an ADU.${own}`
  }
  const floor = SMALL_NUMBERS[minimum] ?? String(minimum)
  return `This home has an accessory dwelling unit. Fewer than ${floor} closed sales with one were found to set its price, so the price is read from comparable homes with and without an ADU.${own}`
}

/** The subject's ADU area is on the MLS record (Accessory Dwelling Unit YN yes, ADU SqFt), so lib/pricing/adu-value.ts can read the unit on its own. */
export function subjectAduAreaOnRecord(subject: { units?: { aduYn?: boolean | null; aduSqft?: number | null } | null }): boolean {
  return subject.units?.aduYn === true && (subject.units.aduSqft ?? 0) > 0
}

/**
 * The spread of a set's price per square foot: the coefficient of variation
 * (standard deviation over the mean), the same measure the pricing confidence
 * reads. Null under two values or a zero mean.
 */
export function ppsfSpread(values: readonly (number | null | undefined)[]): number | null {
  const v = values.filter((x): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0)
  if (v.length < 2) return null
  const mean = v.reduce((a, b) => a + b, 0) / v.length
  if (mean <= 0) return null
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length)
  return +(sd / mean).toFixed(4)
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
  /**
   * THE TIGHTNESS RULE (Matt 2026-10-14, second call). Five ADU sales price the
   * home only when their price per square foot spreads no wider than the
   * ordinary set's; a looser ADU set hands the home to the ordinary set and the
   * unit is valued on its own. The ordinary pass runs for the comparison. Without
   * this callback the pass keeps the first rule: five ADU sales are the set.
   */
  spread?: (result: T) => number | null
  /**
   * The subject's ADU area is on record. Only then is the unit read on its
   * own, so only then does the tightness rule hand a looser ADU set to the
   * ordinary one: a unit the remarks alone name would lose every dollar that
   * way (review 2026-10-15).
   */
  unitRead?: boolean
}): Promise<{ result: T; aduPreference: AduPreference | null }> {
  if (!args.subjectAdu) return { result: await args.run(false), aduPreference: null }
  const minimum = args.minimum ?? PRICING_MIN_COMPS
  const unitRead = args.unitRead === true
  const first = await args.run(true)
  const held = first.comps.length
  if (held >= minimum) {
    if (!args.spread || !unitRead) {
      return {
        result: first,
        aduPreference: { outcome: 'adu-sales', adu_sales_held: held, minimum, sentence: aduPreferenceSentence('adu-sales', minimum) },
      }
    }
    const ordinary = await args.run(false)
    const aduCv = args.spread(first)
    const ordinaryCv = ordinary.comps.length >= minimum ? args.spread(ordinary) : null
    const looser = aduCv != null && ordinaryCv != null && aduCv > ordinaryCv
    if (!looser) {
      return {
        result: first,
        aduPreference: { outcome: 'adu-sales', adu_sales_held: held, minimum, adu_spread_cv: aduCv, ordinary_spread_cv: ordinaryCv, sentence: aduPreferenceSentence('adu-sales', minimum) },
      }
    }
    return {
      result: ordinary,
      aduPreference: {
        outcome: 'fallback',
        fallback_reason: 'spread',
        adu_sales_held: held,
        minimum,
        adu_spread_cv: aduCv,
        ordinary_spread_cv: ordinaryCv,
        sentence: aduPreferenceSentence('fallback', minimum, 'spread', unitRead),
        ...(Array.isArray(first.trace) && first.trace.length > 0 ? { first_pass_trace: first.trace.slice(0, FIRST_PASS_TRACE_LINES) } : {}),
      },
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
      sentence: aduPreferenceSentence('fallback', minimum, 'short', unitRead),
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
export function reviewFallbackPreference(heldAfterReview: number, minimum: number = PRICING_MIN_COMPS, unitRead = false): AduPreference {
  return {
    outcome: 'fallback',
    fallback_reason: 'review',
    adu_sales_held: heldAfterReview,
    minimum,
    sentence: aduPreferenceSentence('fallback', minimum, 'review', unitRead),
  }
}

/** The trace line a ladder records for the pass it ran. */
export function aduPreferenceTrace(p: AduPreference, poolAduSales: number | null): string {
  const pool = poolAduSales == null ? '' : ` ${poolAduSales} sale(s) in the pool state an ADU.`
  if (p.fallback_reason === 'review') {
    return `ADU home: the ADU-first set held ${p.adu_sales_held} ADU sale(s) after the comparability review, under the ${p.minimum} the rule needs, so this build selects on the ordinary set (sales with or without an ADU) and the letter says so (Matt 2026-10-14).${pool}`
  }
  if (p.fallback_reason === 'spread') {
    return `ADU home: priced from ADU sales first (Matt 2026-10-14). ${p.adu_sales_held} ADU sale(s) set the price, but their price per square foot spreads wider than the ordinary set's (CV ${p.adu_spread_cv ?? '?'} against ${p.ordinary_spread_cv ?? '?'}), so the ordinary set (sales with or without an ADU) prices the home and the unit is valued on its own (the tightness rule, Matt 2026-10-14).${pool}`
  }
  const tight = p.adu_spread_cv != null && p.ordinary_spread_cv != null ? ` Their price per square foot spreads no wider than the ordinary set's (CV ${p.adu_spread_cv} against ${p.ordinary_spread_cv}).` : ''
  return p.outcome === 'adu-sales'
    ? `ADU home: priced from ADU sales first (Matt 2026-10-14). ${p.adu_sales_held} ADU sale(s) set the price, at or above the ${p.minimum} the rule needs, so they are the set.${tight}${pool}`
    : `ADU home: priced from ADU sales first (Matt 2026-10-14). Only ${p.adu_sales_held} ADU sale(s) could set the price, under the ${p.minimum} the rule needs, so the ordinary set (sales with or without an ADU) prices the home and the letter says so.${pool}`
}
