/**
 * THE THREE DRAWINGS AN ADDRESS ANSWER MAKES — shaped once, for every surface.
 *
 * Site queue SITE-02b. The community ask (`/communities/[slug]`) and the /sell
 * answer used to each shape their own answer body, and they came out as two
 * different label-and-value ledgers. This file is the single shaping: the same
 * three figures, the same words, the same geometry, wherever a visitor types an
 * address. `V3Drawing` draws what this returns.
 *
 *   supply — two named counts on one scale: homes for sale against homes that go
 *            under contract in a typical month. That IS months of supply, and
 *            the drawing does the division the reader would otherwise be asked
 *            to do (DATA_GRAPHICS.md: never a tile that says 3.9). The verdict
 *            is the figure's caption.
 *   pace   — one mark on a 0-to-120-day rule with the city median as the
 *            context mark.
 *   comps  — a dot strip of the comparable closes by close month, address-free
 *            and price-free, one reading per dot.
 *
 * SECTION 0. Every figure carries a `source` the CALLER supplies, because only
 * the caller knows which geo key and which window produced its number. This
 * file writes no source of its own and invents no figure: a null input means
 * the figure is not returned at all.
 *
 * G68. Months of supply arrives here ALREADY FORMATTED (`monthsOfSupply`) and
 * ALREADY CLASSIFIED (`verdictLabel`), both from the server, from one raw
 * value. Nothing in this file does arithmetic on that figure or decides what
 * kind of market it is.
 *
 * NO PRICE, ANYWHERE. Matt's standing ruling for a typed address on a public
 * page. There is no money formatter in this file and no comp price on the type
 * it reads.
 */

import { formatMonthYear } from '@/lib/format/date'
import type { PlaceCompMark } from '@/lib/cma/place-comps'

/**
 * One drawn figure. Structurally the barrel's `V3DrawingFigure` — kept as its
 * own declaration so that `lib/` never imports a component, and so a drift
 * between the two fails at the one place the figures are handed over.
 */
export type AnswerFigure = {
  key: string
  draw: 'pair' | 'strip' | 'rule'
  claim: string
  caption: string
  source: string
  bars?: { name: string; value: number; label: string; note?: string }[]
  verdict?: string
  points?: { id: string; at: number; tick: string; label: string }[]
  axis?: { min?: number; max?: number; ticks?: { at: number; label: string }[] }
  context?: { value: number; label: string }
  sampleKey?: string
  exception?: boolean
  emptyReason?: string
}

export type AnswerFiguresInput = {
  /** The place the market figures are about, as a person says it: "Bend". */
  placeLabel: string
  /** The street line the comps were matched to. Never rendered as a comp label. */
  street: string
  /** From formatMonthsOfSupply(), on the server. Never computed here. */
  monthsOfSupply: string | null
  /** From marketVerdict(), on the server. Never decided here. */
  verdictLabel: string | null
  activeCount: number | null
  /** Homes that go under contract in a typical month — the MOS denominator. */
  salesPerMonth: number | null
  daysToPending: number | null
  /** The city's own median, for the pace rule's context mark. */
  cityDaysToPending: number | null
  /** How the city reads: "Bend". Null when the answer IS the city. */
  cityLabel: string | null
  /** Every comparable close the ladder kept, address-free and price-free. */
  compMarks: readonly PlaceCompMark[]
  compCount: number | null
  subjectFound: boolean
  /** "4 bed, 3 bath, 2,410 sq ft, built 2006" when the record carries it. */
  subjectSummary: string | null
  /** The day the market figures were computed, formatted. */
  asOfLabel: string | null
  /** One section-0 line per figure. A figure with no source is not returned. */
  sources: { supply?: string | null; pace?: string | null; comps?: string | null }
  /** The sentence to show when the address matched no sales record. */
  unmatchedSentence: string
}

const one = (value: number) => Math.round(value).toLocaleString('en-US')

/**
 * The strip's x axis: the close month as a monotonic index (year * 12 + month).
 *
 * Months, not milliseconds, because the axis IS the close month — two sales
 * three days apart in the same month should land on the same tick, and the
 * reader is being asked "how recent are these", not "which Tuesday". Null on a
 * date the record could not parse, and a comp with no readable close date is
 * simply not drawn rather than being placed at an invented time.
 */
function closeMonthIndex(iso: string): number | null {
  const at = new Date(iso)
  const ms = at.getTime()
  if (!Number.isFinite(ms)) return null
  return at.getUTCFullYear() * 12 + at.getUTCMonth()
}

/**
 * The rule's ceiling. 120 days is the rule, because a rule whose ends move with
 * the subject is not a rule — but a home that took longer than 120 days is not
 * drawn AT 120 either, which would be a false position. The axis grows in
 * 30-day steps until the mark fits on it honestly.
 */
function ruleCeiling(days: number, contextDays: number | null): number {
  const most = Math.max(days, contextDays ?? 0)
  if (most <= 120) return 120
  return Math.ceil(most / 30) * 30
}

function ruleTicks(max: number): { at: number; label: string }[] {
  const out: { at: number; label: string }[] = []
  for (let at = 0; at <= max; at += 30) {
    out.push({ at, label: at === max ? `${at} days` : String(at) })
  }
  return out
}

/** "2,388 sq ft · 4 bed · 3 bath · 0.4 miles NW · closed July 2026". */
function markReading(mark: PlaceCompMark): string {
  return [
    `${one(mark.sqft)} sq ft`,
    mark.beds != null ? `${mark.beds} bed` : null,
    mark.baths != null ? `${mark.baths} bath` : null,
    mark.proximity,
    `closed ${formatMonthYear(mark.closeDate)}`,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' · ')
}

export function buildAnswerFigures(input: AnswerFiguresInput): AnswerFigure[] {
  const out: AnswerFigure[] = []

  /* SUPPLY — the two bars. Both counts or neither: a one-bar version of this
     drawing says nothing, because the drawing IS the comparison. */
  if (
    input.sources.supply &&
    input.activeCount != null &&
    input.salesPerMonth != null &&
    input.monthsOfSupply
  ) {
    const sold = Math.round(input.salesPerMonth)
    out.push({
      key: 'supply',
      draw: 'pair',
      caption: 'homes for sale against a month of sales',
      claim: `${one(input.activeCount)} detached homes are for sale in ${input.placeLabel}, and about ${one(sold)} of them go under contract in a typical month.`,
      bars: [
        {
          name: 'For sale right now',
          value: input.activeCount,
          label: one(input.activeCount),
          note: `${one(input.activeCount)} detached homes are listed and unsold in ${input.placeLabel} right now${input.asOfLabel ? `, counted ${input.asOfLabel}` : ''}. Attached homes, land and new-construction spec inventory are counted separately and are not in this figure.`,
        },
        {
          name: 'Under contract in a month',
          value: sold,
          label: one(sold),
          note: `About ${one(sold)} homes a month, which is the six-month close pace the months-of-supply formula divides by: homes for sale divided by months of supply recovers it exactly. Not a forecast — it is what the last six months did.`,
        },
      ],
      ...(input.verdictLabel
        ? {
            verdict: `That is ${input.monthsOfSupply} months of homes on the market, which is a ${input.verdictLabel}.`,
          }
        : {}),
      source: input.sources.supply,
    })
  }

  /* PACE — one mark on the rule, the city median beside it as context. */
  if (input.sources.pace && input.daysToPending != null) {
    const days = Math.round(input.daysToPending)
    const cityDays =
      input.cityDaysToPending != null && input.cityLabel
        ? Math.round(input.cityDaysToPending)
        : null
    const max = ruleCeiling(days, cityDays)
    out.push({
      key: 'pace',
      draw: 'rule',
      caption: 'days from listed to under contract',
      claim: `Half the homes that sold in ${input.placeLabel} were under contract inside ${days} ${days === 1 ? 'day' : 'days'} of being listed.`,
      points: [
        {
          id: 'subject',
          at: days,
          tick: `${days} days`,
          label: `Median days from the listing date to a signed contract, detached homes in ${input.placeLabel}, trailing 90 days. Not days on market, which keeps counting until closing.`,
        },
      ],
      axis: { min: 0, max, ticks: ruleTicks(max) },
      // Only when the city is a DIFFERENT place from the one being answered.
      // A city median drawn against itself is not context, it is the same mark
      // twice.
      ...(cityDays != null && input.cityLabel
        ? { context: { value: cityDays, label: `${input.cityLabel} ${cityDays}` } }
        : {}),
      source: input.sources.pace,
    })
  }

  /* COMPS — the strip. It draws when the ladder kept enough closes to be honest
     about; below that the figure still renders and says why (DATA_GRAPHICS.md
     small-n rule, and an answer that silently drops a question is not one). */
  if (input.sources.comps) {
    const marks = input.compMarks
      .map((mark) => ({ mark, at: closeMonthIndex(mark.closeDate) }))
      .filter((row): row is { mark: PlaceCompMark; at: number } => row.at != null)
      .sort((a, b) => a.at - b.at)
    const n = input.compCount ?? marks.length
    // ONE VOICE ACROSS THE THREE CLAIMS. The supply and pace claims state a
    // fact about the place; this one used to start "We already found…", and the
    // separate evaluator called the shift jarring on both surfaces (2026-09-08).
    // Every claim now speaks the same way — the drawing is an instrument
    // reading, not the brokerage talking about itself.
    const claim =
      input.subjectFound && n > 0
        ? `${n} recent ${input.placeLabel} ${n === 1 ? 'sale is' : 'sales are'} close enough to ${input.street} to price it${input.subjectSummary ? `, which the record reads as ${input.subjectSummary}` : ''}.`
        : input.unmatchedSentence
    out.push({
      key: 'comps',
      draw: 'strip',
      caption: 'comparable sales by close month',
      claim,
      // Oldest close on the left, most recent on the right — the axis a person
      // already reads without being taught it.
      points: marks.map(({ mark, at }) => ({
        id: mark.id,
        at,
        tick: formatMonthYear(mark.closeDate),
        label: markReading(mark),
      })),
      sampleKey: 'comparable closes for this address',
      // The claim already said WHAT happened; the quiet line says what happens
      // next. Repeating the sentence under itself is what the first browser
      // pass showed on an unmatched address (2026-09-08).
      emptyReason:
        input.subjectFound && n > 0
          ? `${n} comparable ${n === 1 ? 'close' : 'closes'} so far — too few to chart honestly. The written valuation lists every one of them with what it sold for.`
          : 'A broker matches it by hand for the written valuation, which carries every comparable close and what it sold for.',
      source: input.sources.comps,
    })
  }

  return out
}

/**
 * Homes that go under contract in a typical month — the denominator months of
 * supply divides by, recovered from the two figures Market Truth published.
 *
 * MOS = active / (closed in six months / 6), so active / MOS IS that monthly
 * pace, exactly, not a second estimate of it. Recovering it is what lets a
 * surface DRAW months of supply as two bars instead of printing the ratio and
 * making the reader do the division.
 */
export function salesPerMonthFrom(activeCount: number | null, mos: number | null): number | null {
  if (activeCount == null || mos == null || !Number.isFinite(mos) || mos <= 0) return null
  const pace = activeCount / mos
  return Number.isFinite(pace) ? pace : null
}
