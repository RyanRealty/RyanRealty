/**
 * A MULTI-UNIT HOME PRICES FROM SALES OF THE SAME KIND (Matt 2026-10-14).
 *
 * Until 2026-10-14 a duplex, triplex or fourplex subject was refused before a
 * comp was read: the facts pool holds single-family closes only, and rule 23
 * never lets a multi-unit home price from single-family sales (429 Irving, a
 * duplex by its listing history, had been priced on five of them). Asked how
 * to handle the duplex, Matt chose the ladder: price a duplex subject from
 * closed duplex sales, the same five-sale floor, the same letter flow.
 *
 * The ladder runs on the listings table over PropertyType C closes
 * (lib/cma/comps.ts, segment C), in two passes of the same shape as the
 * ADU-first pass (lib/pricing/adu-preference.ts): sales with the subject's own
 * unit count first (a duplex from duplexes); when at least five of them set
 * the price, they are the set; when fewer do, the whole two- to four-unit
 * class prices the home (the one class conventional financing treats them as,
 * Matt 2026-08-26) and the letter says so in one sentence. A subject whose
 * records state no count skips the first pass. The outcome travels on the
 * selection's diagnostics (`multi_unit`) to the letter.
 */
import { PRICING_MIN_COMPS } from '@/lib/pricing/ladder'
import { multiUnitNoun, productNounPlural, type MultiUnitNoun } from '@/lib/cma/market-area'

export type MultiUnitOutcome = 'same-units' | 'class'

export type MultiUnitPreference = {
  outcome: MultiUnitOutcome
  /**
   * Why the whole 2-4 unit class prices the home: fewer than five same-count
   * sales set the price on the pass ('short'), the same-count set lost a sale
   * in the comparability review with no same-count bench to refill it
   * ('review'), or no record states the subject's unit count ('no-count').
   * Absent on a same-units outcome.
   */
  fallback_reason?: 'short' | 'review' | 'no-count'
  /** The subject's unit count, or null when no record states one. */
  units: number | null
  /** What the letter calls the home. */
  noun: MultiUnitNoun
  /** Price-setting same-count sales the first pass held. */
  same_unit_sales_held: number
  minimum: number
  /** The sentence the letter prints after the search story. */
  sentence: string
  /** The first pass's own trace when it fell short, so a reviewer can see what it held. */
  first_pass_trace?: string[]
}

const FIRST_PASS_TRACE_LINES = 40

const SMALL_NUMBERS: Record<number, string> = { 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven' }

/**
 * The one sentence the letter prints. It names the pass and nothing counted:
 * the set the review keeps is set up after this pass, so a number here could
 * be refuted by the printed set; the counts stay on the diagnostics.
 */
export function multiUnitSentence(args: { outcome: MultiUnitOutcome; noun: MultiUnitNoun; minimum: number; fallback_reason?: 'short' | 'review' | 'no-count' }): string {
  const noun = args.noun
  const plural = productNounPlural(noun)
  if (args.outcome === 'same-units') {
    return `This home is a ${noun}, so its price is read from closed ${noun} sales only. No single-family sale sets it.`
  }
  if (args.fallback_reason === 'no-count') {
    return `This home is a multi-unit building, so its price is read from closed sales of two- to four-unit buildings only. No single-family sale sets it.`
  }
  const floor = SMALL_NUMBERS[args.minimum] ?? String(args.minimum)
  return `This home is a ${noun}. Fewer than ${floor} closed ${plural} were found to set its price, so the price is read from closed sales of two- to four-unit buildings. No single-family sale sets it.`
}

/**
 * Run the same-units pass first. `run(true)` prices from sales with the
 * subject's own unit count only; `run(false)` admits the whole 2-4 unit
 * class. Without a unit count on the subject the class run is the only one.
 */
export async function unitsFirst<T extends { comps: unknown[]; trace?: string[] }>(args: {
  /** The subject's 2-4 unit sub type (Duplex, Triplex, Quadruplex, Multi Family). */
  propertySubType: string | null | undefined
  /** The subject's unit count, or null when no record states one. */
  units: number | null
  run: (sameUnitsOnly: boolean) => T | Promise<T>
  minimum?: number
}): Promise<{ result: T; preference: MultiUnitPreference }> {
  const minimum = args.minimum ?? PRICING_MIN_COMPS
  const noun = multiUnitNoun(args.propertySubType) ?? 'multi-unit home'
  if (args.units == null) {
    const result = await args.run(false)
    return {
      result,
      preference: {
        outcome: 'class',
        fallback_reason: 'no-count',
        units: null,
        noun,
        same_unit_sales_held: 0,
        minimum,
        sentence: multiUnitSentence({ outcome: 'class', noun, minimum, fallback_reason: 'no-count' }),
      },
    }
  }
  const first = await args.run(true)
  const held = first.comps.length
  if (held >= minimum) {
    return {
      result: first,
      preference: {
        outcome: 'same-units',
        units: args.units,
        noun,
        same_unit_sales_held: held,
        minimum,
        sentence: multiUnitSentence({ outcome: 'same-units', noun, minimum }),
      },
    }
  }
  const full = await args.run(false)
  return {
    result: full,
    preference: {
      outcome: 'class',
      fallback_reason: 'short',
      units: args.units,
      noun,
      same_unit_sales_held: held,
      minimum,
      sentence: multiUnitSentence({ outcome: 'class', noun, minimum, fallback_reason: 'short' }),
      ...(Array.isArray(first.trace) && first.trace.length > 0 ? { first_pass_trace: first.trace.slice(0, FIRST_PASS_TRACE_LINES) } : {}),
    },
  }
}

/**
 * THE FALLBACK AFTER THE REVIEW. The pass decides on the picker's count, and
 * the comparability review can still drop a same-count sale with no bench to
 * refill it; five minus one is a comp shortage. Under five the whole class
 * prices the home, before or after the review, so the build re-enters once on
 * the class pass (CmaBuildInput.unitsFallback, BpoBuildInput.unitsFallback)
 * and the selection stamps this instead.
 */
export function reviewFallbackMultiUnit(args: {
  propertySubType: string | null | undefined
  units: number | null
  heldAfterReview: number
  minimum?: number
}): MultiUnitPreference {
  const minimum = args.minimum ?? PRICING_MIN_COMPS
  const noun = multiUnitNoun(args.propertySubType) ?? 'multi-unit home'
  return {
    outcome: 'class',
    fallback_reason: 'review',
    units: args.units,
    noun,
    same_unit_sales_held: args.heldAfterReview,
    minimum,
    sentence: multiUnitSentence({ outcome: 'class', noun, minimum, fallback_reason: 'review' }),
  }
}

/** The trace line the ladder records for the pass it ran. */
export function multiUnitTrace(p: MultiUnitPreference): string {
  const plural = productNounPlural(p.noun)
  const lead = `Multi-unit home (${p.noun}${p.units != null ? `, ${p.units} units` : ''}): priced on the multi-unit ladder over PropertyType C closes, never from single-family sales (rule 23, Matt 2026-10-14).`
  if (p.fallback_reason === 'no-count') {
    return `${lead} No record states its unit count, so every two- to four-unit sale is admitted and the letter says so.`
  }
  if (p.fallback_reason === 'review') {
    return `${lead} The same-unit-count set held ${p.same_unit_sales_held} ${plural} after the comparability review, under the ${p.minimum} the rule needs, so this build selects from every two- to four-unit sale and the letter says so.`
  }
  return p.outcome === 'same-units'
    ? `${lead} ${p.same_unit_sales_held} closed ${plural} set the price, at or above the ${p.minimum} the rule needs, so they are the set.`
    : `${lead} Only ${p.same_unit_sales_held} closed ${plural} could set the price, under the ${p.minimum} the rule needs, so every two- to four-unit sale prices the home and the letter says so.`
}
