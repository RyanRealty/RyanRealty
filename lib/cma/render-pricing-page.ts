/**
 * Chapter 3. What your home is worth.
 *
 * docs/plans/CMA_REIMAGINED_2026-09-07.md: the number, the range under it, the
 * sales that set it as ONE table with linked addresses, the map, and the search
 * sentence. Nothing else. Every figure arrives from lib/pricing on
 * `render_args`; nothing here computes one.
 */

import { cleanText, countWord, escapeHtml, int, usd } from '@/lib/cma/render-blocks'
import { sanitizeLetterEmDash } from '@/lib/cma/voice-sanitize'
import { pricingRangeDisplay } from '@/lib/cma/pricing'
import { currentAskLine, heldForMatt, heldUnderBand } from '@/lib/cma/cover-value'
import { oneOutlierMakesTheSpan, tableAdjustedBand } from '@/lib/cma/cover-value'
import { describeCompSearch } from '@/lib/pricing/search-story'
import {
  CONCESSION_ADJUSTMENT_ROW_LABEL,
  CONCESSION_NOT_RECORDED_CELL,
  renderCompMatrixHtml,
  subjectDomDays,
  subjectListingFailed,
  subjectPrintableAsk,
  type SubjectAskContext,
} from '@/lib/cma/comp-matrix'
import {
  compWeightIndex,
  renderReconciliationHtml,
  renderRejectedSalesHtml,
} from '@/lib/cma/pricing-method'
import {
  adjustedRangeLine,
  expectedSaleFor,
  expectedSaleSentence,
  headingWithPriceSet,
  priceSettingComps,
} from '@/lib/cma/expected-sale'
import { adjustedCloseRange } from '@/lib/cma/market-area-chapters'
import { renderCompPinMapHtml } from '@/lib/cma/comp-pin-map'
import { clampSentence, keptCompCount, setAsideCompIndexes, setAsideRows } from '@/lib/cma/set-aside'
import { deRepeatRecommendDollars, isRecommendMark } from '@/lib/cma/recommend-once'
import { failedAskBelowRangeNote } from '@/lib/cma/expired-audit'
import { listCeiling } from '@/lib/cma/render-contract'
import { closedCompBand } from '@/lib/pricing/recommended-in-band'
import { concessionOnSale, printedAdjustedPrice } from '@/lib/pricing/seller-net'
import { compSearchSentence } from '@/lib/cma/render-comp-search'
import { newHomeRateParagraph } from '@/lib/cma/new-home-rate'
import { resaleNeverOwnedParagraph } from '@/lib/cma/resale-never-owned'
import { dateBasisCaption } from '@/lib/cma/sales-method-note'
import type { TrackedDocLinkCtx } from '@/lib/cma/doc-links'
import type { CmaAdjustedComp, CmaMarketContext, CmaPricing, CmaSubject } from '@/lib/cma/types'
import type { CmaPageDef } from '@/lib/cma/render-use-of-property'

const esc = escapeHtml

const ON_MARKET = /^(active|pending|coming)/i

/**
 * Tip Ready P0 (Matt 2026-09-12 / Cos Falcon smoke): the recommend lives ONCE
 * on the cover photo. Chapter 3 no longer titles itself "$389,000." — that was
 * the fold repeating the number.
 */
function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * The chapter title is the reason these sales were the ones, not a label.
 *
 * The first sentence of the search story. The rest of that story, when there
 * is a second sentence, stays in the method under the range.
 */
export function whatItsWorthHeading(input: {
  subdivision?: string | null
  comps?: readonly CmaAdjustedComp[]
  tiersUsed?: readonly string[]
  renderArgs?: unknown
  compTrace?: readonly string[] | null
}): string {
  const logic = compSearchSentence({
    subdivision: input.subdivision,
    args: input.renderArgs,
    compTrace: input.compTrace ?? input.tiersUsed ?? null,
    comps: input.comps ?? [],
    fallback: describeCompSearch({
      subdivision: input.subdivision,
      tiersUsed: input.tiersUsed ?? [],
    }).body,
  })
  return sanitizeLetterEmDash(sentencesOf(logic)[0] ?? 'What the sales say')
}

/** How the last listing came off, in the words a seller uses. */
function cameOffPhrase(status: string | null | undefined): string {
  const s = (status ?? '').trim().toLowerCase()
  if (s.startsWith('expired')) return 'expired'
  if (s.startsWith('withdrawn')) return 'was withdrawn'
  if (s.startsWith('cancel')) return 'was canceled'
  return 'came off the market unsold'
}

/**
 * RULE 26 (Matt 2026-10-07, "Hold, letter says both"). 915 Saginaw: every sale
 * that set the price adjusts above the $925,000 failed ask. 20676 Wild Rose:
 * withdrawn after 25 days at $599,900, under a band of $610,150 to $678,983.
 * The build holds the letter for Matt (lib/cma/gap-hold.ts
 * applyAskBelowBandHold), and the letter states both facts plainly and once,
 * in this order: the sales that set the price support the band, and buyers
 * passed at the last ask, how long it sat and how it came off. The number on
 * the cover is the failed-ask result under the ask, labeled as the price Matt
 * is reviewing (coverPriceHeadline); nothing here repeats it.
 *
 * Every dollar is the table's: the band is the adjusted sales still in the
 * grid (tableAdjustedBand, the Sale price today row), and the ask is the one
 * the subject column prints. Wild Rose printed "List in that range", "capped
 * below this range. See How we got the price" (not a section), "the
 * recommended list sits on the sales, not on that ask", and "The sales
 * support a value of $661,000" (printed nowhere else), beside a paragraph
 * saying the price was set under the ask. None of that prints on a held
 * letter.
 */
export function heldUnderBandLead(
  subject: CmaSubject,
  pricing: CmaPricing,
  askCtx?: SubjectAskContext,
  comps?: readonly CmaAdjustedComp[] | null,
  finalCycle?: import('@/lib/cma/expired-audit').ExpiredFinalCycle | null,
): string {
  const table = comps && comps.length > 0 ? tableAdjustedBand(comps, pricing) : null
  const low = table?.low ?? Math.min(pricing.valueLow, pricing.valueHigh)
  const high = table?.high ?? Math.max(pricing.valueLow, pricing.valueHigh)
  const n = comps && comps.length > 0 ? keptCompCount(pricing, comps) : 0
  const who = n > 0 ? `The ${countWord(n)} sales that set the price` : 'The sales that set the price'
  const first = `${who} support ${usd(low)} to ${usd(high)}.`
  const heldAsk = pricing.hold?.ask != null && pricing.hold.ask > 0 ? pricing.hold.ask : null
  const ask = failedSubjectAsk(subject, askCtx) ?? heldAsk ?? pricing.failedAsk ?? null
  if (ask == null || !(ask > 0)) return first
  const days = finalCycle?.days ?? subjectDomDays(subject)
  const how = cameOffPhrase(finalCycle?.status ?? subject.standardStatus)
  const sat = days != null && days > 0 ? `sat ${int(days)} ${days === 1 ? 'day' : 'days'} and ` : ''
  return `${first} Buyers passed at the last ask of ${usd(ask)}. The listing ${sat}${how}.`
}

/**
 * The line under the number.
 *
 * On a home that is on the market right now the seller already has an ask, and
 * the blueprint gives that case its own sentence: what it is listed at, and
 * what the sales support. The two numbers sit beside each other with the gap
 * visible; they are never blended (CmaPricing, SHOW BOTH, NEVER BLEND).
 */
export function whatItsWorthLead(
  subject: CmaSubject,
  pricing: CmaPricing,
  askCtx?: SubjectAskContext,
  comps?: readonly CmaAdjustedComp[] | null,
  finalCycle?: import('@/lib/cma/expired-audit').ExpiredFinalCycle | null,
): string {
  // A letter held under rule 26 says both facts and nothing that argues with
  // them: no "list in that range", no capped note, no below-band note.
  if (heldUnderBand(pricing)) {
    return [heldUnderBandLead(subject, pricing, askCtx, comps, finalCycle), currentAskLine(pricing)]
      .filter((b): b is string => Boolean(b && b.trim()))
      .join(' ')
  }
  // THE PRICE, EXPLAINED, FIRST (Matt 2026-10-07). Keats recommended listing
  // at $639,000 while its five sales weighed out to $622,128, and no sentence
  // joined the two. The expected sale is the first thing under the heading,
  // and the list stays "that price" (the cover owns those dollars).
  const expected = expectedSaleFor({ pricing, comps })
  const liveAsk = subjectPrintableAsk(subject, askCtx)
  const onMarket = ON_MARKET.test(subject.standardStatus ?? '') && liveAsk != null && liveAsk > 0
  // Name the sales behind the expected sale when the grid prints more than
  // set it, so "the three sales" points at three addresses on the page.
  const setters = priceSettingComps(pricing, comps)
  const named = setters.length > 1 && setters.length < (comps?.length ?? 0) ? setters.map((c) => c.address) : null
  const expectedLine = expected ? expectedSaleSentence(expected, { onMarket, setters: named }) : ''
  // THE VALUE RANGE, ONCE, HERE. tasteReview round two, §1 Words: chapter 3
  // stated it three times inside ten lines. With the grid in hand it is the
  // grid's own adjusted pair (the hero's pair), counted over the same sales
  // and named for the adjustments the grid made. Without a grid it is the
  // stored worth pair, rounded once.
  const worth = adjustedRangeLine(comps, { afterExpected: expected, pricing }) || worthRangeSentence(pricing, comps)
  // "List in that range." is the instruction when nothing else says where to
  // list. The expected-sale sentence already says it. A letter held for Matt
  // under rule 22 (the last failed ask inside the sales range, 2382 Jackson)
  // gives no list instruction either: the opening already says the ask was
  // inside the range and the days point away from the number, so the chapter
  // prints the one supported figure, the range, and stops (reader review
  // 2026-10-08; rule 26 already drops it for an ask under the range).
  const listRange =
    expectedLine || heldForMatt(pricing) ? '' : listRangeSentence(pricing, failedSubjectAsk(subject, askCtx), comps)
  // A home that is on the market already has an ask. The blueprint gives that
  // case ONE line: what it is listed at, and what the sales support. The ask
  // follows the expected sale, so "that price" can only mean the cover's.
  if (onMarket && liveAsk != null) {
    return (
      expectedLine
        ? [expectedLine, worth, `Listed at ${usd(liveAsk)}.`]
        : [`Listed at ${usd(liveAsk)}.`, worth, listRange]
    )
      .filter(Boolean)
      .join(' ')
  }
  // A subject whose ASK is on the pricing row rather than its MLS status —
  // an owner-supplied ask on an off-market home. The blueprint puts that line
  // in this chapter too, beside the evidence, never blended into it. It used
  // to sit on the cover, which the blueprint gives one sentence.
  const ask = currentAskLine(pricing)
  const display = pricingRangeDisplay(pricing)
  const failedAsk = failedSubjectAsk(subject, askCtx) ?? pricing.failedAsk ?? null
  const belowRangeNote =
    pricing.failedAskBelowRange && failedAsk != null && failedAsk > 0
      ? failedAskBelowRangeNote(failedAsk)
      : null
  return [expectedLine, worth, listRange, display.outOfRange ? display.note : null, belowRangeNote, ask]
    .filter((b): b is string => Boolean(b && b.trim()))
    .join(' ')
}

/**
 * The search story, split where the chapter splits it: the first sentence is
 * the price chapter's heading, the rest is method and prints in Basis and
 * limits (lib/cma/sales-method-note.ts). One function, so the heading and the
 * method paragraph can never read two different stories.
 */
export function whatItsWorthSearchStory(input: {
  subdivision?: string | null
  comps: readonly CmaAdjustedComp[]
  tiersUsed?: readonly string[]
  renderArgs?: unknown
  compTrace?: readonly string[] | null
}): { heading: string; tail: string } {
  const search = describeCompSearch({ subdivision: input.subdivision, tiersUsed: input.tiersUsed ?? [] })
  const story = compSearchSentence({
    subdivision: input.subdivision,
    args: input.renderArgs,
    compTrace: input.compTrace ?? input.tiersUsed ?? null,
    comps: input.comps,
    fallback: search.body,
  })
  const logic = sentencesOf(story)
  return {
    heading: sanitizeLetterEmDash(logic[0] ?? whatItsWorthHeading(input)),
    tail: logic.slice(1).join(' '),
  }
}

/** Nearest thousand. Never enough to move a narrative, always enough to match. */
function round1k(n: number): number {
  return Math.round(n / 1000) * 1000
}

/**
 * THE ASK THAT FAILED, once, for every mark and every ceiling in this chapter.
 *
 * The strip's dashed line, the list range's ceiling and the subject column's
 * head all mean the same event, so they resolve through one function: the
 * listing came off unsold AND the price is still this listing's price
 * (`subjectPrintableAsk`, class E). A twenty-two-year-old list price is not an
 * ask that failed; it is a record of a sale.
 */
export function failedSubjectAsk(
  subject: CmaSubject,
  askCtx?: SubjectAskContext,
): number | null {
  if (!subjectListingFailed(subject)) return null
  return subjectPrintableAsk(subject, askCtx)
}

/**
 * The pair the chapter states as worth, rounded once, here.
 *
 * Exported because chapter 5 reconciles its raw close prices to this pair in
 * the same breath (tasteReview round three, §3: "homes like yours sold for up
 * to $460,000" sat four screens from chapter 1's gap sentence with nothing
 * joining them), and the strip's axis labels are these two numbers. Three
 * places, one rounding.
 */
export function worthRangeRounded(
  pricing: CmaPricing,
  comps?: readonly CmaAdjustedComp[] | null,
): { low: number; high: number } {
  const table = comps && comps.length > 0 ? tableAdjustedBand(comps, pricing) : null
  if (table) return table
  return {
    low: round1k(Math.min(pricing.valueLow, pricing.valueHigh)),
    high: round1k(Math.max(pricing.valueLow, pricing.valueHigh)),
  }
}

/** "The sales support $372,000 to $399,000." — the ONE statement of the range. */
function worthRangeSentence(pricing: CmaPricing, comps?: readonly CmaAdjustedComp[] | null): string {
  const band = worthRangeRounded(pricing, comps)
  const lo = band.low
  const hi = band.high
  if (!(lo > 0) || !(hi > 0)) return ''
  return lo === hi
    ? `The sales support ${usd(lo)}.`
    : `The sales support ${usd(lo)} to ${usd(hi)}.`
}

/**
 * THE LIST RANGE THIS DOCUMENT IS ALLOWED TO PRINT, rounded once, here.
 *
 * Matt 2026-09-18 (Canter dual-tier lock): the list-range prose cites the SAME
 * closed-comp band the hero prints (`valueLow`/`valueHigh`) — one source of
 * truth via `closedCompBand`. Do not invent a second tier from
 * `conservative`/`highEnd` when those drifted (Canter live: list $686–716
 * beside hero $675–705). Tip Ready refuses when listRange ≠ hero band.
 *
 * Fallback only when the closed band is missing: legacy
 * `[conservative, min(highEnd, clamp.after)]` plus the failed-ask equality
 * guard (Concorde: never land ON the ask that already failed).
 *
 * Null when the row carries no usable pair. The chapter then states the worth
 * range alone rather than inventing a list.
 */
export function listRangeBounds(
  pricing: CmaPricing,
  failedAsk?: number | null,
  comps?: readonly CmaAdjustedComp[] | null,
): { low: number; high: number } | null {
  const table = comps && comps.length > 0 ? tableAdjustedBand(comps, pricing) : null
  if (table) return table
  const band = closedCompBand(pricing)
  if (band) {
    return { low: round1k(band.low), high: round1k(band.high) }
  }
  // Closed band missing — legacy list-tier path (rare / old rows).
  let top = listCeiling(pricing)
  if (top == null || !(top > 0)) return null
  // AND NEVER THE PRICE THAT ALREADY FAILED, EXACTLY. `applyFailedAskCap` caps
  // the high end AT the ask, so a row whose clamp headline is the high-end
  // tier prints the failed ask itself as the top of the list range — the
  // Concorde defect said in the document's own recommending voice. The test is
  // equality, not "above": a high end that merely sits above the old ask is a
  // reading the evidence may honestly support, and rewriting it would be the
  // renderer overruling lib/pricing. Landing ON it is the one case where the
  // number came from the ask rather than from the sales.
  if (failedAsk != null && failedAsk > 0 && top === failedAsk && pricing.recommended > 0) {
    top = Math.min(top, pricing.recommended)
  }
  const floor = pricing.conservative > 0 ? Math.min(pricing.conservative, top) : top
  if (!(floor > 0)) return null
  return { low: round1k(floor), high: round1k(top) }
}

/**
 * Tip Ready: list-range prose band must equal the hero closed-comp band.
 * Refuse dual-tier (Canter: $686–716 list vs $675–705 hero).
 */
/** The first "$X to $Y" in a range sentence, or null when the sentence names no pair. */
export function dollarsInRangeSentence(sentence: string | null | undefined): { low: number; high: number } | null {
  if (!sentence) return null
  const match = sentence.match(/\$([\d,]+)\s+to\s+\$([\d,]+)/)
  if (!match) return null
  const low = Number(match[1]!.replace(/,/g, ''))
  const high = Number(match[2]!.replace(/,/g, ''))
  if (!(low > 0) || !(high > 0)) return null
  return { low, high }
}

export function listRangeMatchesHeroBand(
  pricing: CmaPricing,
  failedAsk?: number | null,
): boolean {
  const hero = closedCompBand(pricing)
  const list = listRangeBounds(pricing, failedAsk)
  if (!hero || !list) return false
  if (list.low !== round1k(hero.low) || list.high !== round1k(hero.high)) return false
  // The method sentence is a second copy of the band. Slate printed
  // "$594,000 to $623,000" under a hero band of $620k-$623k.
  const said = dollarsInRangeSentence(
    (pricing as { rangeRule?: { sentence?: string | null } | null }).rangeRule?.sentence,
  )
  if (!said) return true
  return round1k(said.low) === round1k(hero.low) && round1k(said.high) === round1k(hero.high)
}

/**
 * ONE n FOR THE WHOLE DOCUMENT: how many sales the number is over.
 *
 * 19968 printed six, four and two for one set inside two chapters (class E).
 * The strip's caption, this chapter's lead, chapter 5's "sales behind your
 * price" and the set-aside list under the grid now all resolve here.
 *
 * WHICH COUNT WINS. The set-aside sales are NAMED under the grid, so a reader
 * can subtract them from the rows above and get a number. When the renderer
 * knows which sales those are, that arithmetic is the answer — a stored count
 * that disagreed with it would be a second answer to a question the page
 * already showed its working for. `rangeRule.kept` is used only when the row
 * says nothing about which sales were set aside, and it is clamped to the
 * printed rows so it can never name a sale the reader cannot find.
 */
export function keptSaleCount(
  pricing: CmaPricing,
  comps: readonly CmaAdjustedComp[],
): number {
  // The lead counts the rows in the printed grid. rangeRule.kept is how many
  // sales set the range ends. Using it here printed "three closed sales" over
  // a four-row grid, then called the extra row set aside when nothing in the
  // grid was. A real set-aside list still subtracts.
  return keptCompCount(pricing, comps)
}

/**
 * The list range beside it — dropped when it is the same two numbers again.
 *
 * listRangeBounds now reads the closed-comp (hero) band, so the usual case is
 * "List in that range." Dual-tier list dollars beside the hero are refused.
 */
function listRangeSentence(
  pricing: CmaPricing,
  failedAsk: number | null,
  comps?: readonly CmaAdjustedComp[] | null,
): string {
  const adjusted = (comps ?? [])
    .map((c) => printedAdjustedPrice(c))
    .filter((n) => Number.isFinite(n) && n > 0)
  if (oneOutlierMakesTheSpan(adjusted)) return ''
  const bounds = listRangeBounds(pricing, failedAsk, comps)
  if (!bounds) return ''
  const { low: lo, high: hi } = bounds
  const worth = worthRangeRounded(pricing, comps)
  if (lo === worth.low && hi === worth.high) {
    // Same two numbers. The instruction survives; the figures do not repeat.
    return 'List in that range.'
  }
  // Cover already printed the recommend. A bound that *is* the recommend
  // is an echo — keep the conservative floor, point at "that price".
  const rec = pricing.recommended
  if (lo === hi) {
    return isRecommendMark(lo, rec) ? 'List at that price.' : `List at ${usd(lo)}.`
  }
  const loBit = isRecommendMark(lo, rec) ? 'that price' : usd(lo)
  const hiBit = isRecommendMark(hi, rec) ? 'that price' : usd(hi)
  return `List between ${loBit} and ${hiBit}.`
}

/**
 * The map legend, written here rather than taken from `describeCompSearch`.
 *
 * `lib/pricing/search-story.ts` writes "The pins are the sales we kept", and
 * "kept" is banned seller copy (blueprint § Words). The pricing unit owns the
 * SEARCH, not the sentence a seller reads about it, so the legend is composed
 * from the same facts in the document's own voice.
 */
/**
 * THE CAPTION MAY ONLY NAME AN OUTLINE THE MAP ACTUALLY DREW (class F).
 *
 * 19968 captioned an outline that contained neither the subject nor any sale.
 * `boundaryShown` is decided in `buildCmaMapDataUri` by a point-in-polygon
 * test against the marks on the tile (`lib/cma/render-place-polygon.ts`); when
 * it says the outline was suppressed, this sentence goes with it.
 *
 * Three states, deliberately. `true` also drops the "when that boundary is on
 * file" hedge — that clause exists only because the caption used to be written
 * before anyone knew, and a sentence that hedges about something visible on
 * the page reads as the document not having looked.
 */
function mapLegend(boundaryShown?: boolean, parentShown?: boolean, pinsDrawn = true): string {
  // A tile with no overlay is a picture with no pins on it; the caption may
  // not promise them (2026-10-07: the stored html_content read "Every pin
  // below is a row" over a bare image).
  const pins = pinsDrawn
    ? 'Every pin below is a row in one of the three tables that follow.'
    : 'The three tables that follow list every home this map was drawn for.'
  if (boundaryShown !== true) return pins
  const lines = parentShown
    ? 'The lines are the subdivisions these homes sit in, and the neighborhood around them.'
    : 'The lines are the subdivisions these homes sit in.'
  return `${pins} ${lines}`
}

/**
 * The reading, above the table. A table needs a sentence before the reader
 * enters it.
 *
 * Both ends of the range print in the table's own Sale price today row, so
 * this introduces no figure the seller cannot check, and no figure is computed
 * here — the adjusted sales and the recommend both arrive from lib/pricing.
 */
const MOVE_MIN_DOLLARS = 1

/** How many of these sales actually moved, by adjustment. Not "each" unless each did. */
export function adjustmentMoveClause(comps: readonly CmaAdjustedComp[]): string {
  const total = comps.length
  if (total === 0) return ''
  const groups: Array<{ label: string; n: number }> = []
  const date = comps.filter((c) => Math.abs(c.timeAdjustment ?? 0) >= MOVE_MIN_DOLLARS).length
  const size = comps.filter((c) => Math.abs(c.sizeAdjustment ?? 0) >= MOVE_MIN_DOLLARS).length
  const story = comps.filter((c) => Math.abs(c.storyAdjustment ?? 0) >= MOVE_MIN_DOLLARS).length
  if (size > 0) groups.push({ label: 'size', n: size })
  if (date > 0) groups.push({ label: 'date', n: date })
  if (story > 0) groups.push({ label: 'style', n: story })
  if (groups.length === 0) return ''
  const one = (g: { label: string; n: number }) => {
    if (g.n === total) return `each moved for ${g.label}`
    if (g.n === 1) return `one moved for ${g.label}`
    return `${countWord(g.n)} of the ${countWord(total)} moved for ${g.label}`
  }
  if (groups.length === 1) return one(groups[0]!)
  if (groups.every((g) => g.n === total)) {
    const labels = groups.map((g) => g.label)
    const label = labels.length === 2 ? `${labels[0]} and ${labels[1]}` : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
    return `each moved for ${label}`
  }
  return groups.map(one).join(', and ')
}

function tableLead(input: { comps: CmaAdjustedComp[]; pricing: CmaPricing }): string {
  const adj = adjustedCloseRange(input.comps)
  if (!adj || !adj.adjustments || !(input.pricing.recommended > 0)) return ''
  // ONE n FOR THIS CHAPTER. The count is the printed grid, less a sale the
  // document actually sets aside. rangeRule.kept is not that count.
  const asideIdx = setAsideCompIndexes(input.pricing, input.comps)
  const kept = input.comps.filter((_, i) => !asideIdx.has(i))
  const n = kept.length
  const aside = input.comps.length - n
  const asideWord = countWord(aside)
  const shown =
    aside > 0
      ? ` ${asideWord.charAt(0).toUpperCase()}${asideWord.slice(1)} more ${
          aside === 1 ? 'is' : 'are'
        } shown below and set aside.`
      : ''
  const move = adjustmentMoveClause(kept.length > 0 ? kept : input.comps)
  const head = `The ${countWord(n)} closed ${n === 1 ? 'sale' : 'sales'} below set this number`
  const moved = !move
    ? `${head}.`
    : move.startsWith('each ')
      ? `${head}, ${move}.`
      : `${head}. ${move.charAt(0).toUpperCase()}${move.slice(1)}.`
  return `<p class="chart-read">${esc(`${moved}${shown}`)}</p>`
}

/**
 * What the concessions lines are.
 *
 * A recorded credit comes off that sale before date and size, the same number
 * the pricing walk uses, and the grid prints it as that move, signed, straight
 * under Sold for. The caption says where to find it, so a reader adding the
 * column up meets it (reader review, cma-2382-jackson: the footnote said the
 * credit came off "in the adjustments" and no adjustment line showed it). A
 * sale that reported none still prints the line. A sale with nothing on
 * record says so, the convention the status table states, and is named only
 * when the grid holds one.
 */
function concessionsCaption(comps: readonly CmaAdjustedComp[]): string {
  if (comps.length === 0) return ''
  const unrecorded = comps.some((c) => concessionOnSale(c) == null)
  return `<p class="small">${esc(
    [
      'Seller concessions are the amount the MLS recorded on each sale.',
      `In the adjustments, a recorded credit comes off the sale price first, on the ${CONCESSION_ADJUSTMENT_ROW_LABEL} line, before date and size.`,
      'A sale that reported none shows none.',
      unrecorded ? `A sale with nothing on record shows ${CONCESSION_NOT_RECORDED_CELL}, and nothing comes off it.` : '',
    ]
      .filter(Boolean)
      .join(' '),
  )}</p>`
}

/**
 * What the "Adjusted for date" row is, under the grid that prints it. The
 * date move is part of every "Sale price today", so the figure it follows is
 * named where the reader meets it (lib/cma/sales-method-note.ts).
 */
function dateBasisLine(input: { subject: CmaSubject; comps: readonly CmaAdjustedComp[]; pricing: CmaPricing }): string {
  const line = dateBasisCaption(input)
  return line ? `<p class="small">${esc(line)}</p>` : ''
}

/**
 * The per-square-foot check, as one line the seller can run against the table.
 *
 * It used to read "these sales carry a median of $564 per square foot" — but
 * the figure was `predictedClose / subject.sqft`, which is not a median of
 * anything. On 1617 NW 8th it printed $564 under a chapter that had just said
 * those same sales closed at $566 to $888 a foot: a median outside its own
 * stated range (CLAUDE.md §0).
 *
 * The rate is now taken over the number this chapter is titled with, and the
 * sentence names that basis. The expected sale prints in the price chapter
 * since 2026-10-07 (lib/cma/expected-sale.ts), but only where the weighted
 * sales produce it; this rate stays on the list price, the one figure every
 * document carries.
 */
function perSquareFootLine(input: { subject: CmaSubject; pricing: CmaPricing }): string {
  const sqft = input.subject.sqft
  const price = input.pricing.recommended
  if (sqft == null || !(sqft > 0) || price == null || !(price > 0)) return ''
  // Tip Ready P0: do not restate the recommend dollars — cover already has them.
  return `<p class="small">${esc(
    `Across ${int(sqft)} square feet, that is ${usd(Math.round(price / sqft))} per square foot.`,
  )}</p>`
}

/**
 * The weight index, with every set-aside sale removed.
 *
 * A sale the document says was set aside may not carry a share of the answer
 * in the row under it: on Concorde the two "set aside" sales carried 38.4
 * percent of the weight (tasteReview round three, §3). The pricing side is
 * dropping them from `reconciliation.weights`; this holds the same line in the
 * renderer, so the grid cannot print a weight the prose has disowned whichever
 * row it is given.
 */
function weightsWithoutSetAside(
  pricing: CmaPricing,
  comps: readonly CmaAdjustedComp[],
  aside: ReadonlySet<number>,
): ReadonlyMap<string, { weight: number | null; grossAdjustmentPct: number | null }> {
  const map = new Map(compWeightIndex(pricing))
  for (const i of aside) {
    const k = comps[i]?.listingKey
    if (k) map.delete(k)
  }
  return map
}

/**
 * The set-aside sales, as their own short list with the reason.
 *
 * "Set aside" appeared only as a hollow dot on the strip and a clause inside a
 * method sentence, and the same sales then read as ordinary evidence in the
 * grid. Named here, under the grid, beside "Considered and not used" — which
 * is the other list of sales this chapter shows and does not price off.
 */
function renderSetAsideHtml(pricing: CmaPricing, comps: readonly CmaAdjustedComp[]): string {
  const rows = setAsideRows(pricing, comps)
  if (rows.length === 0) return ''
  const items = rows
    .map(
      (r) =>
        `<li><span class="rj-addr">${esc(r.address)}</span><span class="rj-why">${esc(r.reason)}</span></li>`,
    )
    .join('')
  return `<h4 class="sale-paths-h">Set aside</h4>
  <p class="small">${esc(
    `${rows.length === 1 ? 'This sale is' : `These ${rows.length} sales are`} shown above and did not set the number.`,
  )}</p>
  <ul class="rejected-list">${items}</ul>`
}

export type PricingPageInput = {
  subject: CmaSubject
  comps: CmaAdjustedComp[]
  market: CmaMarketContext | null
  pricing: CmaPricing
  tiersUsed?: string[]
  mapDataUri?: string | null
  mapOverlay?: import('@/lib/cma/comp-pin-map').CompPinMapOverlay | null
  docLinks?: TrackedDocLinkCtx | null
  /** Immersive hero already printed the number and the range — skip the lead. */
  omitLeadPrices?: boolean
  /** `render_args.compSearch`, and the trace the selector walked. */
  renderArgs?: unknown
  compTrace?: readonly string[] | null
  /** Whether the subject's stored ask is still this listing's ask (class E). */
  askCtx?: SubjectAskContext
  /** The seller's own failed listing, for their column's price path. */
  finalCycle?: import('@/lib/cma/expired-audit').ExpiredFinalCycle | null
  /**
   * Closed / Pending / Active / Expired: List, Sold and $/sqft, Low·Avg·
   * Median·High under each status (FlexMLS style, Matt 2026-09-24). Same
   * selected homes as the matrices; no MoS. Built in salesThatSetItArgs so
   * letter and immersive cannot drift.
   */
  statusPriceBoard?: string
  /** When the letter was built. The new-home comparison reads the year from this. */
  asOfIso?: string | null
  /** Homes for sale in the same area, already on this letter. */
  rivals?: ReadonlyArray<{
    address: string
    yearBuilt?: number | null
    listPrice: number
    sqft?: number | null
  }>
  /** A sale under one percent of the weight, left out of the seller letter. */
  negligibleWeightNote?: string | null
}

/**
 * CHAPTER 3, AFTER DELTA 3: the number, the range, and the method. Nothing
 * else.
 *
 * The map left this chapter and became its own (`theMapPage`), and the sales
 * that prove the number became matrix 1 (`salesThatSetItPage`). Matt's order
 * is the number → the map → the three matrices, and a chapter that holds all
 * three is the "scrolling list" TASTE.md bans.
 */
export function pricingPage(input: PricingPageInput): CmaPageDef {
  const p = input.pricing
  const s = input.subject
  // WHY THESE SALES. Never a shortage claim the printed grid refutes (class E).
  // The first sentence is the chapter title. The rest of the story is method,
  // and method prints in Basis and limits now (Matt 2026-10-07: under the
  // headline it read like notes to ourselves).
  const story = whatItsWorthSearchStory({
    subdivision: s.subdivision,
    comps: input.comps,
    tiersUsed: input.tiersUsed,
    renderArgs: input.renderArgs,
    compTrace: input.compTrace,
  })
  // The heading counts the printed sales; when fewer set the price, it counts
  // those too, so "the three sales" under it cannot be read as the wrong three.
  const heading = headingWithPriceSet(story.heading, {
    subdivision: s.subdivision,
    comps: input.comps,
    pricing: p,
  })
  // THE CLAMP, UNDER THE NUMBER IT MOVED. When the failed-ask clamp binds, the
  // printed price is not the one the method above it produces — Concorde
  // stated a method yielding $1,973,000 and printed $1,473,000 with nothing
  // between them (tasteReview round three, §2 item 1). lib/pricing writes the
  // sentence; it prints where the reader meets the number, and nowhere else.
  // A held letter prints no clamp sentence. Under rule 26 its "sales support a
  // value of" figure is printed nowhere else, and the held lead says it once.
  // Under rule 22 (the ask inside the sales range, 2382 Jackson) the clamp's
  // reason, that the home did not sell because the ask was too high, does not
  // hold: the opening says the ask was inside the range and the days point at
  // something other than the number, and "we recommend the price on the cover,
  // which stays under that ask" told a second story beside it (reader review
  // 2026-10-08). One story, one supported figure, the range.
  const clamp = heldForMatt(p) ? '' : deRepeatRecommendDollars(clampSentence(p), p.recommended)
  const clampHtml = clamp ? `<p class="worth-lead-note">${esc(clamp)}</p>` : ''
  const lead = input.omitLeadPrices
    ? ''
    : `
  <h2 class="section is-answer">${esc(heading)}</h2>
  <p class="worth-lead">${esc(whatItsWorthLead(s, p, input.askCtx, input.comps, input.finalCycle))}</p>
  ${clampHtml}`
  // THE METHOD MOVED TO BASIS AND LIMITS (Matt 2026-10-07). Under the
  // headline the reader gets the expected sale and the range, and nothing
  // that reads like working notes. Which sales, how each was moved for date,
  // and the sale-to-ask share are composed in plain English from the stored
  // fields by lib/cma/sales-method-note.ts and print in the disclosure chapter
  // of both documents (`cmaDisclosureProseHtml`).
  const age = newHomeRateParagraph({
    subjectYear: s.yearBuilt ?? null,
    subjectSqft: s.sqft ?? null,
    asOfIso: input.asOfIso ?? '',
    rangeLow: p.valueLow,
    rangeHigh: p.valueHigh,
    comps: input.comps.map((c) => ({
      address: c.address,
      yearBuilt: c.yearBuilt ?? null,
      closePrice: c.closePrice,
      sqft: c.sqft,
    })),
    rivals: input.rivals?.map((r) => ({
      address: r.address,
      yearBuilt: r.yearBuilt ?? null,
      listPrice: r.listPrice,
      sqft: r.sqft ?? null,
    })),
  })
  const ageHtml = age ? `<p class="method-line">${esc(age)}</p>` : ''
  const neverOwned = resaleNeverOwnedParagraph({
    subjectYear: s.yearBuilt ?? null,
    subjectNewConstructionYn: s.newConstructionYn,
    propertySubType: s.propertySubType,
    asOfIso: input.asOfIso ?? null,
    comps: input.comps.map((c) => ({
      address: c.address,
      yearBuilt: c.yearBuilt ?? null,
      newConstructionYn: c.newConstructionYn,
    })),
  })
  const neverOwnedHtml = neverOwned ? `<p class="method-line">${esc(neverOwned)}</p>` : ''
  // Tip Ready P0: cover already carries recommend + range. The worth-strip's
  // "list $521K" mark was the fold repeating the number (~8× on Falcon).
  return {
    meta: `${esc(s.streetAddress)} · ${esc(heading)}`,
    toc: heading,
    body: `
  ${lead}
  ${input.omitLeadPrices ? `<p class="worth-lead">${esc(whatItsWorthLead(s, p, input.askCtx, input.comps, input.finalCycle))}</p>
  ${clampHtml}` : ''}
  ${ageHtml}
  ${neverOwnedHtml}
`,
  }
}

/**
 * MATRIX 1. The closed sales that set the price, with the adjustment grid.
 *
 * Delta 3: "we'll break out the matrices of comparables so that we start with
 * the closed comparables, the ones that set the price." Everything that reads
 * off those sales and off nothing else travels with them: the set-aside list,
 * the reconciliation, the per-foot check and the sales the selector rejected.
 */
export function salesThatSetItPage(input: PricingPageInput): CmaPageDef | null {
  const p = input.pricing
  const s = input.subject
  const aside = setAsideCompIndexes(p, input.comps)
  const matrix = renderCompMatrixHtml(
    s,
    input.comps,
    tableLead({ comps: input.comps, pricing: p }),
    input.docLinks,
    weightsWithoutSetAside(p, input.comps, aside),
    input.askCtx,
    {
      range: worthRangeRounded(p),
      finalCycle: input.finalCycle ?? null,
      // H2.section already names the chapter — skip duplicate H3.subhead.
      omitHeading: true,
      footer: `${concessionsCaption(input.comps)}
  ${dateBasisLine({ subject: s, comps: input.comps, pricing: p })}
  ${renderReconciliationHtml(p)}
  ${perSquareFootLine({ subject: s, pricing: p })}`,
    },
  )
  if (!matrix.trim()) return null
  return {
    meta: `${esc(s.streetAddress)} · The sales that set this price`,
    toc: 'The sales that set this price',
    body: `
  <h2 class="section">${esc(SALES_THAT_SET_IT_HEADING)}</h2>
  ${input.negligibleWeightNote ? `<p class="method-line">${esc(input.negligibleWeightNote)}</p>` : ''}
  ${input.statusPriceBoard ?? ''}
  ${matrix}
  ${renderSetAsideHtml(p, input.comps)}
  ${renderRejectedSalesHtml(p, input.comps)}
`,
  }
}

/** The chapter title, in one place so the letter and the scene cannot drift. */
export const SALES_THAT_SET_IT_HEADING = 'The sales that set this price.'

/**
 * THE ONE MAP (Delta 3).
 *
 * Matt: "One comprehensive map." It sits under the number and above the three
 * matrices, carries all three pin families, and is the only map in the
 * document — the competition map and the market map were removed at C9 and do
 * not come back.
 */
export function mapPage(input: {
  subject: CmaSubject
  facts: readonly import('@/lib/cma/comp-pin-map').CmaPinFact[]
  mapDataUri?: string | null
  mapOverlay?: import('@/lib/cma/comp-pin-map').CompPinMapOverlay | null
  /** `render_args.compArea.sentence`, when the row carries one. */
  areaSentence?: string | null
}): CmaPageDef | null {
  const body = mapBodyHtml(input)
  if (!body.trim()) return null
  return {
    meta: `${esc(input.subject.streetAddress)} · ${esc(MAP_HEADING)}`,
    toc: MAP_HEADING,
    body: `
  <h2 class="section">${esc(MAP_HEADING)}</h2>
  ${body}`,
  }
}

export const MAP_HEADING = 'Comparable homes near you'

/** Shared by the letter chapter and its immersive twin. */
export function mapBodyHtml(input: {
  subject: CmaSubject
  facts: readonly import('@/lib/cma/comp-pin-map').CmaPinFact[]
  mapDataUri?: string | null
  mapOverlay?: import('@/lib/cma/comp-pin-map').CompPinMapOverlay | null
  areaSentence?: string | null
}): string {
  const pinMap = renderCompPinMapHtml({
    subject: input.subject,
    facts: input.facts,
    mapDataUri: input.mapDataUri ?? null,
    alt: 'Map of the sales, the homes for sale and the listings that came off',
    overlay: input.mapOverlay ?? null,
  })
  if (!pinMap.trim()) return ''
  const area = cleanText(input.areaSentence ?? null)
  return `<div class="pin-map-wrap">${pinMap}</div>
  <p class="small">${esc(
    [
      area,
      mapLegend(
        input.mapOverlay?.boundaryShown,
        input.mapOverlay?.parentShown,
        // The SVG fallback draws its own pins; a tile draws them only with its overlay.
        !input.mapDataUri || Boolean(input.mapOverlay?.view),
      ),
    ]
      .filter(Boolean)
      .join(' '),
  )}</p>`
}
