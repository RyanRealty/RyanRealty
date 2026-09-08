/**
 * The adapter between `getProofBlock()` and `<V3ProofBlock />`.
 *
 * The primitive takes placed marks and finished strings — it does no
 * arithmetic and no formatting, so the number on screen is the number the
 * caller's trace covers (ci:public-v3 rule 3). This module is where the
 * placing and the wording happen, in one pure function with no fetch, so both
 * are testable without a database and without a browser.
 *
 * Geometry is `lib/charts/plot.ts` (`buildRangePlot`), not a second kit: it
 * owns the domain, the padding, and the reference-rule placement the strips
 * need, and it drops a reference that falls outside the domain rather than
 * drawing it at the edge.
 *
 * ─── WHY THE RATIO STRIP IS DRAWN AS DISTANCE FROM THE FIRST ASK ────────────
 *
 * Sale-to-original-list clusters between about 0.80 and 1.02. On a zero floor
 * every mark lands in the right tenth of the track and the strip says nothing
 * — the `dataviz` skill's standing objection to a theoretical floor ("prices
 * do not grow from $0"; "crop to the data"). Drawing `(ratio - 1) x 100`
 * instead puts the marks on a scale whose zero is a real, meaningful place:
 * the price the seller first asked. A reader with no training reads "this one
 * closed ten percent under what it first asked" off the position alone. The
 * ratio itself stays on every reading, so nothing is hidden by the transform.
 */
import { buildRangePlot } from '@/lib/charts/plot'
import { formatMonthYear } from '@/lib/format/date'
import { formatPrice } from '@/lib/format/money'
import type { ProofBlock } from '@/lib/data/proof/getProofBlock'
import type {
  V3ProofBlockAttribution,
  V3ProofBlockProps,
  V3ProofMark,
  V3ProofReach,
  V3ProofStrip,
} from './V3ProofBlock.client'

/** How close two marks may sit (percent of the track) before one steps to a new lane. */
const LANE_GAP_PCT = 4.5
/** Lanes available before a mark stops stepping out and shares the last one. */
const MAX_LANES = 4

/**
 * Stack marks that would overlap. Returns a lane index per input position, in
 * the input's order. Pure, deterministic, and the reason a seven-mark strip
 * does not read as four marks.
 */
export function packLanes(pcts: readonly (number | null)[], gap = LANE_GAP_PCT): number[] {
  const order = pcts
    .map((pct, index) => ({ pct, index }))
    .filter((p): p is { pct: number; index: number } => p.pct != null)
    .sort((a, b) => a.pct - b.pct)

  const lanes: number[] = pcts.map(() => 0)
  /** The rightmost position already taken in each lane. */
  const lastInLane: number[] = []

  for (const { pct, index } of order) {
    let lane = 0
    while (lane < MAX_LANES) {
      const last = lastInLane[lane]
      if (last == null || pct - last >= gap) break
      lane += 1
    }
    if (lane >= MAX_LANES) lane = MAX_LANES - 1
    lanes[index] = lane
    lastInLane[lane] = pct
  }

  return lanes
}

function pctOfRatio(ratio: number): number {
  return (ratio - 1) * 100
}

/**
 * Where a value that is not itself a row would sit on a built track.
 *
 * `buildRangePlot` owns the domain and does not publish it, so this recovers
 * the mapping from two rows it already placed and reads the target off that
 * line. Two placed points define the scale exactly (it is linear), so this is
 * a recovery of the plot's own geometry, never a second scale. Null when the
 * track holds fewer than two distinct values or the target falls outside it.
 */
export function trackPctOf(
  placed: readonly { value: number; pct: number }[],
  target: number,
): number | null {
  const a = placed[0]
  const b = placed.find((p) => p.value !== a?.value)
  if (!a || !b) return null
  const pct = a.pct + ((target - a.value) / (b.value - a.value)) * (b.pct - a.pct)
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return null
  return pct
}

/** "10.0% under the first ask" / "1.5% over" / "at the first ask". */
export function askDistanceLabel(ratio: number): string {
  const delta = Math.round(pctOfRatio(ratio) * 10) / 10
  if (delta === 0) return 'at the first ask'
  const size = Math.abs(delta).toFixed(1)
  return delta < 0 ? `${size}% under the first ask` : `${size}% over the first ask`
}

/** "93.7%" — the bare figure, for a mark label with no room for a sentence. */
export function ratioShort(ratio: number): string {
  return `${(Math.round(ratio * 1000) / 10).toFixed(1)}%`
}

/** "93.7% of the first ask". The figure the CMA and the market cells publish. */
export function ratioLabel(ratio: number): string {
  return `${ratioShort(ratio)} of the first ask`
}

function daysLabel(days: number): string {
  return days === 1 ? '1 day' : `${Math.round(days)} days`
}

/**
 * The disclosure text: one line per figure the section actually PUBLISHES.
 *
 * `showOutcomes` is a publishing decision, so it has to reach the trace too.
 * With the strips off, the entries scoped to them source nothing on screen —
 * and two of them are the market's own median days-to-contract and
 * sale-to-first-ask, the exact figures our held comparison was drawn against.
 * Publishing their provenance under a section that draws neither restates the
 * comparison in prose. So the trace covers what is drawn, and nothing else.
 */
function traceText(block: ProofBlock, showOutcomes: boolean): string {
  return block.trace
    .filter((t) => t.scope === 'always' || showOutcomes)
    .map(
      (t) =>
        `${t.figure} — ${t.source}; ${t.table}; ${t.filter}; ${t.window}; ${t.rows} rows; pulled ${t.fetchedAt}; ${t.query}`,
    )
    .join(' · ')
}

export type ProofBlockViewInput = {
  block: ProofBlock
  id?: string
  headingLevel?: 1 | 2
  attribution: V3ProofBlockAttribution
  reach?: readonly V3ProofReach[]
  /**
   * Draw the two outcome strips (days to contract, sale against the first ask).
   *
   * Default true — the block was built to draw them and every existing caller
   * keeps that behaviour. /sell passes FALSE because Matt has not ruled on
   * publishing them: on 2026-09-08 our closings read slower and lower than
   * Bend's own median (52 days to contract against 29; 93.7% of the first ask
   * against 97.0%, n=7), and Matt's ruling that day was "hold those, we only
   * want positive". So the strips do not publish, and the DEFAULT is off: a
   * caller has to ask for them, rather than get them by forgetting a prop.
   *
   * This is a publishing decision, not a data one. Nothing here is softened or
   * re-cut to look better — the figures stay exactly as `getProofBlock` reads
   * them, the strips simply do not go on a seller-facing page. With them off
   * the block ships the record, the reviews and the reach, and its heading and
   * claim say only what it shows, so nothing is implied by omission.
   * Recorded in docs/plans/PUBLIC_PRODUCT/decisions.md.
   */
  showOutcomes?: boolean
}

/**
 * Turn a pulled `ProofBlock` into the primitive's props. Returns null when the
 * block carries nothing worth a section (no reviews, no record, no closings) —
 * the caller renders nothing rather than an empty frame.
 */
export function proofBlockView(input: ProofBlockViewInput): V3ProofBlockProps | null {
  const { block } = input
  const id = input.id ?? 'proof'
  const o = block.outcomes

  if (!block.reviews && !block.record && o.closings === 0) return null

  /* ---- the two strips ---------------------------------------------------- */

  // Default OFF (Matt 2026-09-08, decisions.md): an unflattering comparison
  // does not reach a seller-facing page by a caller's omission.
  const showOutcomes = input.showOutcomes ?? false
  const drawable = o.publishable && showOutcomes ? o.rows : []

  const dayRows = drawable.map((r) => ({
    tick: r.id,
    value: r.daysToContract ?? Number.NaN,
    label: r.daysToContract == null ? '—' : daysLabel(r.daysToContract),
  }))
  const ratioRows = drawable.map((r) => ({
    tick: r.id,
    value: r.saleToOriginal == null ? Number.NaN : pctOfRatio(r.saleToOriginal),
    label: r.saleToOriginal == null ? '—' : ratioLabel(r.saleToOriginal),
  }))

  const dayPlot = buildRangePlot(dayRows, {
    refValue: block.context?.medianDaysToContract ?? undefined,
    refLabel: block.context ? `${block.context.label} median` : undefined,
  })
  const ratioPlot = buildRangePlot(ratioRows, {
    refValue:
      block.context?.medianSaleToOriginal == null
        ? undefined
        : pctOfRatio(block.context.medianSaleToOriginal),
    refLabel: block.context ? `${block.context.label} median` : undefined,
  })

  // buildRangePlot drops rows whose value is not finite, so a row that lost a
  // figure is absent from the plot rather than placed at zero. Map back by id.
  const dayPctById = new Map(dayPlot?.rows.map((r) => [r.tick, r.xPct]) ?? [])
  const ratioPctById = new Map(ratioPlot?.rows.map((r) => [r.tick, r.xPct]) ?? [])

  // Where "sold at exactly the first asking price" sits on the ratio track.
  const ratioPlaced = ratioRows
    .map((row) => ({ value: row.value, pct: ratioPctById.get(row.tick) }))
    .filter((p): p is { value: number; pct: number } => p.pct != null && Number.isFinite(p.value))
  const zeroPct = trackPctOf(ratioPlaced, 0)

  const dayLanes = packLanes(drawable.map((r) => dayPctById.get(r.id) ?? null))
  const ratioLanes = packLanes(drawable.map((r) => ratioPctById.get(r.id) ?? null))

  const marks: V3ProofMark[] = drawable.map((r, i) => ({
    id: r.id,
    when: `${formatMonthYear(r.closeDate)}${r.city ? ` · ${r.city}` : ''}`,
    daysLabel: r.daysToContract == null ? null : daysLabel(r.daysToContract),
    daysPct: dayPctById.get(r.id) ?? null,
    daysLane: dayLanes[i] ?? 0,
    ratioLabel: r.saleToOriginal == null ? null : ratioLabel(r.saleToOriginal),
    ratioShort: r.saleToOriginal == null ? null : ratioShort(r.saleToOriginal),
    ratioAside: r.saleToOriginal == null ? null : askDistanceLabel(r.saleToOriginal),
    ratioPct: ratioPctById.get(r.id) ?? null,
    ratioLane: ratioLanes[i] ?? 0,
  }))

  const ourDays = o.medianDaysToContract
  const theirDays = block.context?.medianDaysToContract ?? null
  const ourRatio = o.medianSaleToOriginal
  const theirRatio = block.context?.medianSaleToOriginal ?? null
  const place = block.context?.label ?? null

  const strips: V3ProofStrip[] = []

  if (dayPlot && ourDays != null) {
    strips.push({
      key: 'days',
      label: 'Days from listed to under contract',
      claim:
        theirDays != null && place
          ? `Half of them went under contract inside ${daysLabel(ourDays)}. Across every detached home sold in ${place} over the same year, half went inside ${daysLabel(theirDays)}.`
          : `Half of them went under contract inside ${daysLabel(ourDays)}.`,
      minLabel: dayPlot.xMinLabel,
      maxLabel: dayPlot.xMaxLabel,
      // The tick is a mark, not a sentence: short name, short figure. The
      // full reading ("Bend detached median, 29 days") is in the claim above.
      context:
        dayPlot.ref && theirDays != null && place
          ? { pct: dayPlot.ref.xPct, label: daysLabel(theirDays), name: `${place} median` }
          : null,
      anchor: null,
      note:
        o.daysExcludedN > 0
          ? `${o.daysToContractN} of ${o.closings} carry a day count. ${o.daysExcludedN === 1 ? 'One was' : `${o.daysExcludedN} were`} entered into the MLS after the contract was already signed, so the market's own definition leaves ${o.daysExcludedN === 1 ? 'it' : 'them'} out.`
          : null,
    })
  }

  if (ratioPlot && ourRatio != null) {
    strips.push({
      key: 'ratio',
      label: 'Sale price against the first asking price',
      claim:
        theirRatio != null && place
          ? `Half closed at ${ratioLabel(ourRatio)} or better. Across ${place}, half closed at ${ratioLabel(theirRatio)} or better.`
          : `Half closed at ${ratioLabel(ourRatio)} or better.`,
      minLabel: ratioPlot.xMinLabel,
      maxLabel: ratioPlot.xMaxLabel,
      context:
        ratioPlot.ref && place && theirRatio != null
          ? {
              pct: ratioPlot.ref.xPct,
              label: ratioShort(theirRatio),
              name: `${place} median`,
            }
          : null,
      // Zero on this scale is a real place: the price the seller first asked.
      anchor: zeroPct == null ? null : { pct: zeroPct, label: 'sold at the first ask' },
      note: null,
    })
  }

  /* ---- the rail ---------------------------------------------------------- */

  const record = block.record
    ? {
        value: String(block.record.homesSold),
        label: 'homes closed, listed by Ryan Realty',
        aside: `All time · ${formatPrice(block.record.totalVolume)} in closed volume`,
      }
    : null

  const reviews = block.reviews
    ? {
        score: block.reviews.averageRating.toFixed(1),
        rating: block.reviews.averageRating,
        line: `${block.reviews.averageRating.toFixed(1)} from ${block.reviews.count} verified Google review${block.reviews.count === 1 ? '' : 's'}`,
        quotes: block.reviews.quotes.map((q) => ({
          id: q.id,
          text: q.text,
          author: q.author,
          attribution: q.date ? `Google review, ${formatMonthYear(q.date)}` : 'Google review',
          rating: q.rating,
        })),
      }
    : null

  // "7 closings" sits beside a record tile reading "17 homes closed" with
  // nothing saying the two count different windows, so the numbers read as a
  // contradiction (evaluator, 2026-09-08). In the QUIET form — where the tile
  // is the loudest thing on screen and there is no drawing between them — the
  // line names the relationship instead: 7 OF THE 17, in the last twelve
  // months. Callers that draw the strips keep the wording they already ship.
  const windowLine =
    o.closings > 0 && block.window.start && block.window.end
      ? showOutcomes
        ? `${o.closings} closing${o.closings === 1 ? '' : 's'}, ${formatMonthYear(block.window.start)} to ${formatMonthYear(block.window.end)}${o.cities.length ? `, in ${o.cities.join(' and ')}` : ''}.`
        : `${o.closings} of them closed in the last ${block.window.months} months, ${formatMonthYear(block.window.start)} to ${formatMonthYear(block.window.end)}${o.cities.length ? `, in ${o.cities.join(' and ')}` : ''}.`
      : ''

  return {
    id,
    // The eyebrow and heading say what is actually on screen. With the strips
    // off there is no per-home drawing, so "Every home we listed and closed"
    // promised a ledger the section does not show (evaluator, 2026-09-08).
    eyebrow: showOutcomes ? `The record · last ${block.window.months} months` : 'The record',
    heading: showOutcomes
      ? 'Every home we listed and closed'
      : 'What we have sold, and what the sellers said',
    headingLevel: input.headingLevel ?? 2,
    // The claim names what is actually drawn. With the strips off it must not
    // promise "what each one did against the market" — that is the sentence
    // for the version that draws them.
    claim: showOutcomes
      ? 'Not a selection. Every home Ryan Realty listed and closed in the last twelve months, with what each one did, against what the whole market did in the same year.'
      // The quiet form's claim is about the WHOLE record, because the figure
      // beside it is the all-time count and the line under it is "7 of them
      // closed in the last 12 months". A claim scoped to twelve months made
      // that "them" circular.
      : 'Not a selection. Every home Ryan Realty has listed and closed, and the people who worked with us on them.',
    marks,
    strips,
    // Round three named first-read clarity as the weakest thing: nothing said
    // the two tracks hold the SAME homes. This names the mark once, above both.
    marksLegend:
      marks.length > 0 ? `Each mark is one of these ${marks.length} closings, on both scales.` : null,
    countLine: windowLine,
    record,
    reviews,
    reach: input.reach ?? [],
    attribution: input.attribution,
    trace: traceText(block, showOutcomes),
    quiet: o.publishable ? null : o.quietReason,
  }
}
