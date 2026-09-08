/**
 * The /sell answer — its DATA SHAPE and the pure shaping the body renders.
 *
 * SITE-02 (Matt 2026-09-07): a visitor who types their address on /sell used to
 * advance straight to "where should we send it?" having been shown NOTHING. The
 * address step now answers first: the place's verdict, how fast homes here go
 * under contract, and how many comparable closes the CMA engine already found
 * for that address. No dollar figure — Matt's standing ruling for a typed
 * address on a public page. The figure lives in the written CMA the email step
 * delivers.
 *
 * WHY THIS FILE IS SEPARATE FROM THE COMPONENT. The node splits in two: this
 * lane wires the answer, and a following session (02b) replaces the BODY with a
 * drawing primitive. So the contract between them is a data type, not markup —
 * `SellAnswerData` is the DAL's answer plus its §0 trace and nothing else, and
 * `SellAnswer.tsx` is the only file that renders it. Swapping the drawing means
 * rewriting one component against an unchanged type.
 *
 * G68 (ci:market-formula): no surface rounds or reclassifies months of supply.
 * `monthsOfSupply` arrives here ALREADY FORMATTED by formatMonthsOfSupply and
 * `verdictLabel` already classified by marketVerdict, both on the server, from
 * the same raw value. Nothing in this file does arithmetic on that figure.
 */

import type { AnswerFigure } from '@/lib/site/answer-figures'

/** One reading in the answer: a plain sentence with its figure inside it. */
export type SellAnswerReading = {
  /** Stable key for React and for the tests. */
  key: 'cash'
  /** The short label a person scans. Never jargon. */
  label: string
  /** The figure, formatted upstream. */
  value: string
  /** The sentence a broker would say on the phone. */
  sentence: string
  /** The §0 detail a hover / tap reveals: window, population, definition. */
  detail: string
}

/**
 * Everything the answer body draws. Produced by the server action from
 * `getPlaceValueAnswer` + `countCompsForAddress`, so every field is either a
 * value one of those returned or a string formatted from one.
 */
export type SellAnswerData = {
  /** The address as the visitor typed (or picked from Places). */
  address: string
  /** Just the street line — "2732 NW Ordway Ave". */
  street: string
  /** The place the figures are about, as a person says it: "Bend". */
  placeLabel: string
  /** Which grain answered: the Bend neighborhood when the address fell in one. */
  grain: 'city' | 'neighborhood'
  /** Door to the full market report for this place, when one exists. */
  placeHref: string | null
  /** From marketVerdict(): "seller's market". Null when MOS cannot publish here. */
  verdictLabel: string | null
  /** From formatMonthsOfSupply(): "3.9". Never computed on this side. */
  monthsOfSupply: string | null
  /** Homes for sale right now, detached, in this place. */
  activeCount: number | null
  /** Homes that go off the market in a typical month — the MOS denominator. */
  salesPerMonth: number | null
  /** Median days from listed to under contract, trailing 90 days. */
  daysToPending: number | null
  /** Share of closes paid in cash over the trailing year, already ×100. */
  cashSharePct: number | null
  /** Comparable closes the CMA comp ladder kept for this address. */
  compCount: number | null
  /** False when neither MLS history nor the assessor could place the address. */
  subjectFound: boolean
  /** "4 bed, 3 bath, 2,410 sq ft, built 2006" when the subject carries facts. */
  subjectSummary: string | null
  /**
   * THE DRAWN ANSWER (site queue SITE-02b): supply as two bars, pace as one
   * mark on a rule, the comparable closes as a dot strip. Shaped on the server
   * by buildAnswerFigures, the same call the community ask makes, so both
   * surfaces draw one answer in one set of words. This replaced the hand-rolled
   * percentage bars, the cash meter and the scrolling comp ledger the /sell
   * evaluator logged as "no visual encoding — it is rows".
   */
  figures: AnswerFigure[]
  /** The day the market figures were computed, formatted. */
  asOfLabel: string | null
  /** One line per figure: what it is, where it came from, when (§0). */
  trace: string[]
}

/**
 * The claim the section makes, in one sentence, before any figure — the
 * claim-first habit TASTE.md demands of every data section.
 *
 * The verdict is the claim when we have one. When we do not, the claim is what
 * we DO know about this address, and it is still a sentence and still true:
 * saying "no verdict" is not a claim, it is an apology.
 */
export function sellAnswerClaim(d: SellAnswerData): string {
  if (d.verdictLabel && d.monthsOfSupply) {
    return `${d.placeLabel} is a ${d.verdictLabel} right now.`
  }
  if (d.compCount != null && d.compCount > 0) {
    return `We found ${d.compCount} recent ${d.placeLabel} ${d.compCount === 1 ? 'sale' : 'sales'} to price ${d.street} against.`
  }
  return `Here is what the record already says about ${d.street}.`
}

/**
 * The readings BESIDE the drawings — the figures that have no drawing of their
 * own.
 *
 * This used to carry three: pace, cash, and the comparable-sales count. Two of
 * them are now DRAWN (site queue SITE-02b) — pace as one mark on a 0-to-120-day
 * rule, the comps as a dot strip — and a figure said twice on one screen is the
 * repetition TASTE.md calls a wall of text. Cash share is a share of a whole
 * with nothing to plot it against, so it stays a sentence with its definition
 * behind it, which is the opposite of the KPI grid: a number no one explains.
 */
export function sellAnswerReadings(d: SellAnswerData): SellAnswerReading[] {
  const out: SellAnswerReading[] = []

  if (d.cashSharePct != null) {
    const cash = Math.round(d.cashSharePct)
    out.push({
      key: 'cash',
      label: 'Who is buying',
      value: `${cash}%`,
      sentence: `${cash}% of ${d.placeLabel} buyers paid cash over the last year.`,
      detail: 'Share of closed detached sales recorded as a cash purchase, trailing 12 months.',
    })
  }

  return out
}

/**
 * True when the answer has enough to be worth showing as an ANSWER rather than
 * as a holding line. One reading is enough; zero is not.
 */
export function sellAnswerHasSubstance(d: SellAnswerData): boolean {
  return (
    (d.verdictLabel != null && d.monthsOfSupply != null) ||
    d.daysToPending != null ||
    (d.subjectFound && (d.compCount ?? 0) > 0)
  )
}

/**
 * Split a Places-formatted address into the parts the comp ladder wants.
 * "2732 NW Ordway Ave, Bend, OR 97703, USA" → street / city / postal code.
 * Deliberately forgiving: a visitor who types the address by hand and stops at
 * the city still resolves, and a miss on the city only costs the finer grain.
 */
export function splitSellAddress(address: string): {
  street: string
  city: string | null
  postalCode: string | null
} {
  const parts = address
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && p.toUpperCase() !== 'USA')
  const street = parts[0] ?? address
  const city = parts[1] ?? null
  const stateZip = parts[2] ?? ''
  const postalCode = stateZip.match(/\b(\d{5})(?:-\d{4})?\b/)?.[1] ?? null
  return { street, city, postalCode }
}
