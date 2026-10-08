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
import { compPinMap } from '@/lib/cma/comp-pin-map'
import {
  clampSentence,
  keptCompCount,
  setAsideCompIndexes,
  setAsideRows,
  setAsideSalePredicate,
} from '@/lib/cma/set-aside'
import { COVER_PRICE_PHRASE, deRepeatRecommendDollars, isRecommendMark } from '@/lib/cma/recommend-once'
import { failedAskBelowRangeNote } from '@/lib/cma/expired-audit'
import { listCeiling } from '@/lib/cma/render-contract'
import { subjectOnMarket } from '@/lib/cma/subject-on-market'
import { cameOffStatus } from '@/lib/cma/listing-status'
import { closedCompBand } from '@/lib/pricing/recommended-in-band'
import { concessionOffClose, concessionOnSale, printedAdjustedPrice } from '@/lib/pricing/seller-net'
import { joinAnd, movesADollar } from '@/lib/cma/adjustments-applied'
import { compSearchSentence } from '@/lib/cma/render-comp-search'
import { newHomeRateParagraph } from '@/lib/cma/new-home-rate'
import { resaleNeverOwnedParagraph } from '@/lib/cma/resale-never-owned'
import { dateBasisCaption } from '@/lib/cma/sales-method-note'
import { salesSetOnlyTheRange, weightRowLabel } from '@/lib/cma/sales-role'
import { streetAnchorRead } from '@/lib/cma/street-anchor'
import type { TrackedDocLinkCtx } from '@/lib/cma/doc-links'
import type { CmaAdjustedComp, CmaMarketContext, CmaPricing, CmaSubject } from '@/lib/cma/types'
import type { CmaPageDef } from '@/lib/cma/render-use-of-property'

const esc = escapeHtml


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

/**
 * How the last listing came off, in the words a seller uses. A listing
 * withdrawn on one day whose listing expired on a later one "came off the
 * market" after its days; it did not expire after them (reader review
 * 2026-10-08, 3177 Coho).
 */
function cameOffHow(
  subject: CmaSubject,
  finalCycle: import('@/lib/cma/expired-audit').ExpiredFinalCycle | null | undefined,
): string {
  return cameOffPhrase(
    cameOffStatus(finalCycle?.status ?? subject.standardStatus, finalCycle?.leftActiveAs ?? subject.cameOffAs),
  )
}

function cameOffPhrase(status: string | null | undefined): string {
  const s = (status ?? '').trim().toLowerCase()
  if (s.startsWith('expired')) return 'expired'
  if (s.startsWith('withdrawn')) return 'was withdrawn'
  if (s.startsWith('cancel')) return 'was canceled'
  return 'came off the market unsold'
}

/**
 * The first of a held letter's two facts: the sales and the band, in the
 * table's dollars. "The three sales that set the price support $627,332 to
 * $724,442" sat under 20676 Wild Rose's $593,000 cover, which those sales did
 * not set: the failed-ask step put it under every one of them (rule 26). On a
 * letter whose cover the weights did not make (lib/cma/sales-role.ts) the
 * sales are the ones that set the range (reader review 2026-10-08).
 */
function heldBandSentence(pricing: CmaPricing, comps?: readonly CmaAdjustedComp[] | null): string {
  const table = comps && comps.length > 0 ? tableAdjustedBand(comps, pricing) : null
  const low = table?.low ?? Math.min(pricing.valueLow, pricing.valueHigh)
  const high = table?.high ?? Math.max(pricing.valueLow, pricing.valueHigh)
  const n = comps && comps.length > 0 ? keptCompCount(pricing, comps) : 0
  const set = salesSetOnlyTheRange(pricing, comps) ? 'set the range' : 'set the price'
  const who = n > 0 ? `The ${countWord(n)} sales that ${set}` : `The sales that ${set}`
  return `${who} support ${usd(low)} to ${usd(high)}.`
}

/**
 * RULE 26 (Matt 2026-10-07, "Hold, letter says both"). 915 Saginaw: every sale
 * that set the price adjusts above the $925,000 failed ask. 20676 Wild Rose:
 * withdrawn after 25 days at $599,900, under a band of $610,150 to $678,983.
 * The build holds the letter for Matt (lib/cma/gap-hold.ts
 * applyAskBelowBandHold), and the letter states both facts plainly and once,
 * in this order: the sales that set the price support the band, and the home
 * did not sell at its last ask, how long it sat and how it came off. The number on
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
  const first = heldBandSentence(pricing, comps)
  const heldAsk = pricing.hold?.ask != null && pricing.hold.ask > 0 ? pricing.hold.ask : null
  const ask = failedSubjectAsk(subject, askCtx) ?? heldAsk ?? pricing.failedAsk ?? null
  if (ask == null || !(ask > 0)) return first
  const days = finalCycle?.days ?? subjectDomDays(subject)
  const how = cameOffHow(subject, finalCycle)
  const sat = days != null && days > 0 ? `sat ${int(days)} ${days === 1 ? 'day' : 'days'} and ` : ''
  // The fact, never buyer intent (reader review 2026-10-08, 20676 Wild Rose:
  // the MLS shows Active then Withdrawn and nothing between). "Buyers passed"
  // claimed a judgment no record holds, and "did not go under contract" is not
  // known for every listing: the subject's status log is not on the row, and
  // one that fell out of contract and came back still failed at its ask.
  return `${first} Your home did not sell at its last ask of ${usd(ask)}. The listing ${sat}${how}.`
}

/** The days a stored step ran, when it is the ask named. */
function lastAskDays(
  ask: number,
  exposure: import('@/lib/cma/expired-audit').ExpiredAskExposure | null | undefined,
): number | null {
  const final = exposure?.final
  if (!final || final.ask !== ask) return null
  const d = Number(final.days)
  return Number.isFinite(d) && d > 0 ? Math.round(d) : null
}

function daysWord(n: number): string {
  return `${int(n)} ${n === 1 ? 'day' : 'days'}`
}

/**
 * RULE 22, THE SAME TWO FACTS (reader review 2026-10-08; SKILL.md rules 22
 * and 26). 2382 Jackson: the last ask of $639,000 sat inside the $598,620 to
 * $648,772 the sales support, for 79 of the listing's 227 days, and the
 * listing was canceled. The build holds that letter for Matt because the
 * clamp's reason, that the ask was too high, does not hold, so the letter
 * prints no clamp sentence. With nothing in its place the cover's $624,000
 * had no story, and the rest of the letter called it the list we recommend.
 *
 * The held letter now says what rule 26 has a held letter say, in the same
 * order and once: the sales that set the price support the band, named in
 * dollars; and the last ask, named, how long it sat inside that band, that it
 * did not sell, and how the listing came off. No "capped", no clamp, no "too
 * high", no list instruction. The cover's label ("The price Matt is
 * reviewing", HELD_PRICE_HEADLINE) carries the rest.
 *
 * Every dollar is the table's: the band is the adjusted sales still in the
 * grid (tableAdjustedBand), and the ask is the one the subject column prints.
 * The days are the stored final cycle (expiredAudit.finalCycle.days) and the
 * last step of the stored ask exposure, both printed in chapter 1. "Inside
 * that range" is said only when the ask is inside the printed band; the hold
 * reads a rounded band, and a sentence may not contradict the figures beside
 * it.
 */
export function heldInBandLead(
  subject: CmaSubject,
  pricing: CmaPricing,
  askCtx?: SubjectAskContext,
  comps?: readonly CmaAdjustedComp[] | null,
  finalCycle?: import('@/lib/cma/expired-audit').ExpiredFinalCycle | null,
  askExposure?: import('@/lib/cma/expired-audit').ExpiredAskExposure | null,
): string {
  const table = comps && comps.length > 0 ? tableAdjustedBand(comps, pricing) : null
  const low = table?.low ?? Math.min(pricing.valueLow, pricing.valueHigh)
  const high = table?.high ?? Math.max(pricing.valueLow, pricing.valueHigh)
  const first = heldBandSentence(pricing, comps)
  const heldAsk = pricing.hold?.ask != null && pricing.hold.ask > 0 ? pricing.hold.ask : null
  const ask = failedSubjectAsk(subject, askCtx) ?? heldAsk ?? pricing.failedAsk ?? null
  if (ask == null || !(ask > 0)) return first
  const total = finalCycle?.days ?? subjectDomDays(subject)
  const last = lastAskDays(ask, askExposure)
  const inside = low > 0 && high > 0 && ask >= low && ask <= high
  // The last ask's own days, when it was one step of several. When it was
  // the whole listing, the days are said once, on the listing.
  const sat = last != null && (total == null || last < total) ? ` sat ${daysWord(last)}` : ''
  const where = inside ? (sat ? ' inside that range' : ' was inside that range') : ''
  const second = `The last ask of ${usd(ask)}${sat}${where}${sat || where ? ' and' : ''} did not sell.`
  const how = cameOffHow(subject, finalCycle)
  const third = total != null && total > 0 ? `The listing ${how} after ${daysWord(total)}.` : `The listing ${how}.`
  return `${first} ${second} ${third}`
}

/**
 * Where a live ask sits against the range the sales support, as a fact.
 *
 * On a home listed with another brokerage the document may not tell the owner
 * to list at, price at, cut or raise anything (lib/cma/subject-on-market.ts).
 * It says what the home is listed at and whether that is inside, under or over
 * the range the chapter just printed, and stops.
 */
export function onMarketAskSentence(ask: number, band: { low: number; high: number } | null): string {
  const listed = `Your home is listed at ${usd(ask)}`
  if (!band || !(band.low > 0) || !(band.high > 0)) return `${listed}.`
  const low = Math.min(band.low, band.high)
  const high = Math.max(band.low, band.high)
  const where = ask < low ? 'below' : ask > high ? 'above' : 'inside'
  return `${listed}, ${where} the range the sales support.`
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
  askExposure?: import('@/lib/cma/expired-audit').ExpiredAskExposure | null,
): string {
  // A letter held under rule 26 says both facts and nothing that argues with
  // them: no "list in that range", no capped note, no below-band note. A
  // rule 22 hold says the same two facts in the same shape (heldInBandLead):
  // no expected-sale sentence asking to list at a price nobody approved.
  if (heldForMatt(pricing)) {
    const lead = heldUnderBand(pricing)
      ? heldUnderBandLead(subject, pricing, askCtx, comps, finalCycle)
      : heldInBandLead(subject, pricing, askCtx, comps, finalCycle, askExposure)
    return [lead, currentAskLine(pricing)]
      .filter((b): b is string => Boolean(b && b.trim()))
      .join(' ')
  }
  // THE PRICE, EXPLAINED, FIRST (Matt 2026-10-07). Keats recommended listing
  // at $639,000 while its five sales weighed out to $622,128, and no sentence
  // joined the two. The expected sale is the first thing under the heading,
  // and the list stays "that price" (the cover owns those dollars).
  const expected = expectedSaleFor({ pricing, comps })
  const liveAsk = subjectPrintableAsk(subject, askCtx)
  // ONE on-market decision for the document (lib/cma/subject-on-market.ts).
  const onMarket = subjectOnMarket({ subject })
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
  // list. The expected-sale sentence already says it. (A held letter returned
  // above with its two facts and no instruction.)
  const listRange = expectedLine ? '' : listRangeSentence(pricing, failedSubjectAsk(subject, askCtx), comps)
  // A home that is on the market already has an ask. The blueprint gives that
  // case ONE line: what the sales support, and where the ask sits against it,
  // stated and never steered (onMarketAskSentence). No list instruction of any
  // kind: 3062 NW Kelly Hill printed "List in that range." under another
  // brokerage's listing.
  if (onMarket) {
    const askLine =
      liveAsk != null && liveAsk > 0 ? onMarketAskSentence(liveAsk, worth ? worthRangeRounded(pricing, comps) : null) : ''
    return [expectedLine, worth, askLine].filter(Boolean).join(' ')
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
export function mapLegend(input: {
  boundaryShown?: boolean
  parentShown?: boolean
  /** The map carries its pins. False for a bare tile. */
  pinsShown: boolean
  /** How many of the tables that follow hold a row for a home on this map. */
  tables: number
  /** A place named beside street-held homes with no outline (rule 24). */
  streetPlace?: string | null
}): string {
  // A tile with no overlay is a picture with no pins on it; the caption may
  // not promise them (2026-10-07: the stored html_content read "Every pin
  // below is a row" over a bare image).
  //
  // THE COUNT AND THE DIRECTION ARE THE PAGE'S (2382 Jackson, reader review
  // 2026-10-08). The caption sits under the map, so the pins are above it,
  // and it counts the tables that hold a drawn pin: Jackson drew sales and
  // homes for sale and no listing that came off, and "one of the three
  // tables" sent the reader looking for a third.
  const n = input.tables
  const pins =
    n <= 0
      ? ''
      : input.pinsShown
        ? n === 1
          ? 'Every pin above is a row in the table that follows.'
          : `Every pin above is a row in one of the ${countWord(n)} tables that follow.`
        : n === 1
          ? 'The table that follows lists every home this map was drawn for.'
          : `The ${countWord(n)} tables that follow list every home this map was drawn for.`
  if (input.boundaryShown !== true) return pins
  const lines = input.parentShown
    ? 'The lines are the subdivisions these homes sit in, and the neighborhood around them.'
    : 'The lines are the subdivisions these homes sit in.'
  // The street-held homes sit in no line (rule 24 draws no outline round a
  // plat the area holds only on the subject's street). Their place is named on
  // the map, and the caption says why it has no line.
  const place = input.streetPlace?.trim()
  const street = place
    ? ` ${place} is named on the map but not outlined, because only its homes on your street are part of the area.`
    : ''
  return [pins, `${lines}${street}`].filter(Boolean).join(' ')
}

/**
 * How many tables hold the homes these pins name: the sales, the listings
 * that came off, and the competition's two tables, Active and Pending
 * (`splitActivePending`). One per kind present.
 */
export function tablesHoldingPins(
  pins: ReadonlyArray<Pick<import('@/lib/cma/comp-pin-map').CmaPinFact, 'family' | 'status'>>,
): number {
  const tables = new Set<string>()
  for (const p of pins) tables.add(p.family === 'active' ? (p.status === 'pending' ? 'pending' : 'active') : p.family)
  return tables.size
}

/**
 * The reading, above the table. A table needs a sentence before the reader
 * enters it.
 *
 * Both ends of the range print in the table's own Sale price today row, so
 * this introduces no figure the seller cannot check, and no figure is computed
 * here — the adjusted sales and the recommend both arrive from lib/pricing.
 * A move is one the grid prints as at least a dollar (movesADollar).
 */

/**
 * How many of these sales actually moved, by adjustment. Not "each" unless
 * each did. Every adjustment the grid prints is named, seller concessions
 * included: 3177 Coho's lead said "One moved for size, and each moved for
 * date." over two sales the grid took a recorded credit off (reader review
 * 2026-10-08). A move counts when its cell prints a dollar.
 */
export function adjustmentMoveClause(comps: readonly CmaAdjustedComp[]): string {
  const total = comps.length
  if (total === 0) return ''
  const groups: Array<{ label: string; n: number }> = []
  const date = comps.filter((c) => movesADollar(c.timeAdjustment)).length
  const size = comps.filter((c) => movesADollar(c.sizeAdjustment)).length
  const story = comps.filter((c) => movesADollar(c.storyAdjustment)).length
  const credit = comps.filter((c) => movesADollar(concessionOffClose(c))).length
  if (size > 0) groups.push({ label: 'size', n: size })
  if (date > 0) groups.push({ label: 'date', n: date })
  if (story > 0) groups.push({ label: 'style', n: story })
  if (credit > 0) groups.push({ label: 'seller concessions', n: credit })
  if (groups.length === 0) return ''
  const one = (g: { label: string; n: number }) => {
    if (g.n === 1) return `one moved for ${g.label}`
    return `${countWord(g.n)} of the ${countWord(total)} moved for ${g.label}`
  }
  const every = groups.filter((g) => g.n === total).map((g) => g.label)
  const parts = [
    ...(every.length > 0 ? [`each moved for ${joinAnd(every)}`] : []),
    ...groups.filter((g) => g.n !== total).map(one),
  ]
  if (parts.length <= 2) return parts.join(', and ')
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`
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
  // A held letter's number is under Matt's review: the sales are behind it,
  // they did not settle it (reader review 2026-10-08). On a cover the weights
  // did not make (a rule 26 hold, or a cover held to the sale on the
  // subject's street) they set the range and nothing about the cover.
  const verb = salesSetOnlyTheRange(input.pricing, input.comps)
    ? 'set the range'
    : heldForMatt(input.pricing)
      ? `${n === 1 ? 'is' : 'are'} behind this number`
      : 'set this number'
  const head = `The ${countWord(n)} closed ${n === 1 ? 'sale' : 'sales'} below ${verb}`
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
 * IT NAMES ITS SUBJECT (reader review 2026-10-08). It read "Across 2,016
 * square feet, that is $310 per square foot." under the weights paragraph,
 * where "that" pointed at nothing: on 2382 Jackson and 62475 Woodsman because
 * the clamp sentence it once followed is not printed on a held letter, and on
 * 3037 Purcell (unheld) because the chapter it sits in never printed the
 * price at all. The sentence now says which price it divides, without
 * reprinting the cover's dollars (recommend-once).
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
export function perSquareFootSentence(sqft: number, price: number): string {
  const cover = `${COVER_PRICE_PHRASE.charAt(0).toUpperCase()}${COVER_PRICE_PHRASE.slice(1)}`
  return `${cover} comes to ${usd(Math.round(price / sqft))} per square foot across your home's ${int(sqft)} square feet.`
}

function perSquareFootLine(input: { subject: CmaSubject; pricing: CmaPricing }): string {
  const sqft = input.subject.sqft
  const price = input.pricing.recommended
  if (sqft == null || !(sqft > 0) || price == null || !(price > 0)) return ''
  return `<p class="small">${esc(perSquareFootSentence(sqft, price))}</p>`
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
  const what = salesSetOnlyTheRange(pricing, comps) ? 'the range' : 'the number'
  return `<h4 class="sale-paths-h">Set aside</h4>
  <p class="small">${esc(
    `${rows.length === 1 ? 'This sale is' : `These ${rows.length} sales are`} shown above and did not set ${what}.`,
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
  /** How long each ask on that listing ran (a held letter names the last one's days). */
  askExposure?: import('@/lib/cma/expired-audit').ExpiredAskExposure | null
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

/** The price chapter's name: its running header on every sheet. */
export const WHAT_ITS_WORTH_CHAPTER = 'What the sales say'

/**
 * WHEN THE COVER IS HELD TO THE SALE ON THE SUBJECT'S STREET, THE CHAPTER SAYS
 * SO (reader review, 915 Saginaw, 2026-10-08).
 *
 * The pricer holds the recommendation to the street sale plus
 * SAME_STREET_PREMIUM_MAX, rounded to $5,000 (lib/cma/pricing.ts
 * applyStreetAnchor). Saginaw's cover is $800,000, 536 Saginaw's adjusted
 * $727,148 plus 10 percent, rounded, while the grid's weights blend to about
 * $960,000, and nothing on the page joined the two. One plain sentence, from
 * the stored anchor checked against the grid (lib/cma/street-anchor.ts): which
 * sale, its adjusted price as the grid prints it, and the limit. The cover's
 * own dollars are not repeated (recommend-once).
 *
 * Only when the cover IS that ceiling, and never on a rule 26 hold: its cover
 * is the failed-ask result, and it prints no clamp prose.
 */
export function streetHoldSentence(
  pricing: CmaPricing,
  comps?: readonly CmaAdjustedComp[] | null,
): string {
  if (heldUnderBand(pricing)) return ''
  const street = streetAnchorRead(pricing, comps)
  if (!street?.holdsCover) return ''
  const pct = Math.round(street.premium * 100)
  const limit = `the price on the cover is that figure plus ${pct} percent, rounded to the nearest $5,000`
  if (street.sales.length === 1) {
    const sale = street.sales[0]!
    return `The price on the cover is held to ${sale.address}, on your street and close to your home's size. Adjusted to your home, that sale is worth ${usd(
      street.anchor,
    )}, and ${limit}.`
  }
  const names = street.sales.map((c) => c.address)
  const list = names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return `The price on the cover is held to ${list}, on your street and close to your home's size. Adjusted to your home, the middle of their prices is ${usd(
    street.anchor,
  )}, and ${limit}.`
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
  // Its place is taken by the two facts the held lead states (heldInBandLead,
  // heldUnderBandLead), and the cover's label carries the rest.
  const clamp = heldForMatt(p) ? '' : deRepeatRecommendDollars(clampSentence(p), p.recommended)
  // THE STREET SALE THE COVER IS HELD TO (915 Saginaw, reader review
  // 2026-10-08), said once, under the number it set. Never on a rule 26 hold,
  // which prints no clamp prose.
  const street = streetHoldSentence(p, input.comps)
  const clampHtml = [clamp, street]
    .filter(Boolean)
    .map((line) => `<p class="worth-lead-note">${esc(line)}</p>`)
    .join('\n  ')
  const lead = input.omitLeadPrices
    ? ''
    : `
  <h2 class="section is-answer">${esc(heading)}</h2>
  <p class="worth-lead">${esc(whatItsWorthLead(s, p, input.askCtx, input.comps, input.finalCycle, input.askExposure))}</p>
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
    // The running header is the chapter's name, never its sentence heading:
    // 20676 Wild Rose's header repeated a 250-character heading on every
    // sheet of the chapter (reader review 2026-10-08).
    meta: `${esc(s.streetAddress)} · ${esc(WHAT_ITS_WORTH_CHAPTER)}`,
    toc: heading,
    body: `
  ${lead}
  ${input.omitLeadPrices ? `<p class="worth-lead">${esc(whatItsWorthLead(s, p, input.askCtx, input.comps, input.finalCycle, input.askExposure))}</p>
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
      // A matrix that runs onto a second page heads it "<chapter>, continued".
      heading: salesThatSetItHeading(p, input.comps).replace(/\.$/, ''),
      // The set-aside columns carry the map's own mark (reader review, 3177
      // Coho, 2026-10-08), by the decision the map and the list below read.
      isSetAside: setAsideSalePredicate(p, input.comps),
      weightLabel: weightRowLabel(p, input.comps),
      footer: `${concessionsCaption(input.comps)}
  ${dateBasisLine({ subject: s, comps: input.comps, pricing: p })}
  ${renderReconciliationHtml(p, input.comps)}
  ${perSquareFootLine({ subject: s, pricing: p })}`,
    },
  )
  if (!matrix.trim()) return null
  const heading = salesThatSetItHeading(p, input.comps)
  const label = heading.replace(/\.$/, '')
  return {
    meta: `${esc(s.streetAddress)} · ${esc(label)}`,
    toc: label,
    body: `
  <h2 class="section">${esc(heading)}</h2>
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
 * The same chapter on a letter held for Matt. Its number is the price under
 * his review (on 2382 Jackson the failed-ask step, not the sales, put it at
 * $624,000), so the sales are behind it rather than settling it (reader
 * review 2026-10-08).
 */
export const HELD_SALES_HEADING = 'The sales behind this price.'
/**
 * The same chapter when the sales set only the range (lib/cma/sales-role.ts):
 * a rule 26 hold, whose cover sits under every one of them (20676 Wild Rose,
 * $593,000 under $627,332 to $724,442), or a cover held to the sale on the
 * subject's street (915 Saginaw). "Behind this price" claimed the cover was
 * built from them (reader review 2026-10-08).
 */
export const RANGE_SALES_HEADING = 'The sales that set the range.'

export function salesThatSetItHeading(
  pricing: CmaPricing | null | undefined,
  comps?: readonly CmaAdjustedComp[] | null,
): string {
  if (salesSetOnlyTheRange(pricing, comps)) return RANGE_SALES_HEADING
  return heldForMatt(pricing) ? HELD_SALES_HEADING : SALES_THAT_SET_IT_HEADING
}

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
  closedLabel?: string | null
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

/**
 * The map as the second half of the price chapter's page, under its own
 * subhead. Empty when there is no map to draw.
 */
export function mapSubsectionHtml(input: Parameters<typeof mapBodyHtml>[0]): string {
  const body = mapBodyHtml(input)
  if (!body.trim()) return ''
  return `
  <h3 class="subhead">${esc(MAP_HEADING)}</h3>
  ${body}`
}

/**
 * A chapter that is its heading and one paragraph and nothing else.
 *
 * 2382 Jackson's price chapter printed "Four of the five sales are in
 * Holliday Park, and all three that set the price are." over one sentence
 * and nothing more: the held letter (rule 22) prints no list instruction and
 * no clamp, and the expected sale sat above the list, so the only thing left
 * was the range (reader review 2026-10-08). The heading says where the sales
 * are, which is what the map under it shows, so a chapter this short takes
 * the map onto its own page rather than standing as a near-empty sheet.
 */
export function chapterIsLeadOnly(body: string): boolean {
  const blocks = body.match(/<(?:p|ul|ol|table|div|svg|figure|section|details|h3|h4)\b/gi) ?? []
  return blocks.length <= 1
}

/** Shared by the letter chapter and its immersive twin. */
export function mapBodyHtml(input: {
  subject: CmaSubject
  facts: readonly import('@/lib/cma/comp-pin-map').CmaPinFact[]
  mapDataUri?: string | null
  mapOverlay?: import('@/lib/cma/comp-pin-map').CompPinMapOverlay | null
  areaSentence?: string | null
  /** The legend's closed-sales line when the sales set the range and not the cover (lib/cma/sales-role.ts). */
  closedLabel?: string | null
}): string {
  // The alt text, the legend and the caption all read the pins the map drew.
  const map = compPinMap({
    subject: input.subject,
    facts: input.facts,
    mapDataUri: input.mapDataUri ?? null,
    overlay: input.mapOverlay ?? null,
    closedLabel: input.closedLabel ?? null,
  })
  if (!map.html.trim()) return ''
  const area = cleanText(input.areaSentence ?? null)
  return `<div class="pin-map-wrap">${map.html}</div>
  <p class="small">${esc(
    [
      area,
      mapLegend({
        boundaryShown: input.mapOverlay?.boundaryShown,
        parentShown: input.mapOverlay?.parentShown,
        pinsShown: map.pinsShown,
        // A bare tile was drawn for every home offered; a pinned map counts what it pinned.
        tables: tablesHoldingPins(map.pinsShown ? map.drawn : input.facts),
        streetPlace: map.pinsShown ? input.mapOverlay?.streetPlaceShown : null,
      }),
    ]
      .filter(Boolean)
      .join(' '),
  )}</p>`
}
