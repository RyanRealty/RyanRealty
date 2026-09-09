/**
 * The seller document's chapters, in print form. The cover stays in render.ts,
 * the immersive twin of every chapter here is in opinion-scenes.ts, and the
 * order both walk is OPINION_CHAPTER_ORDER at the bottom of this file.
 *
 * Chapters 0 to 7 of docs/plans/CMA_REIMAGINED_2026-09-07.md. A chapter omits
 * rather than printing an empty frame.
 */

import {
  competitionHeading,
  competitionSentence,
  competitionSourceLine,
  competitorCutLine,
  type BandRivalsInput,
} from '@/lib/cma/band-rivals'
import { formatClientMlsField } from '@/lib/cma/client-facing'
import { trackedDocLink } from '@/lib/cma/doc-links'
import { daysOnMarketFrom } from '@/lib/cma/listing-history-line'
import { UNADDRESSED_DOC_LINKS, cleanText, countWord, dateLong, dottedPhone, escapeHtml, int, phoneHref, propertyDescription, usd } from '@/lib/cma/render-blocks'
import { clientSourceLine } from '@/lib/cma/client-facing'
import {
  chapter2bSourceLine,
  readOfferTiming,
  renderAskOutcomeHtml,
  renderAskRealizationHtml,
  renderInventoryBoardHtml,
  renderDaysToOfferHtml,
  renderOfferTimingHtml,
} from '@/lib/cma/market-area-chapters'
import {
  DID_NOT_SELL_HEADING,
  askAgainstSoldSentence,
  didNotSellLeadSentence,
  soldPpsfRange,
  type DidNotSellArgs,
} from '@/lib/cma/did-not-sell'
import { FAILED_ASK_BACKTEST, resolveListingTimeline } from '@/lib/cma/expired-audit'
import { listingTimelinePhoneSvg, listingTimelineSvg } from '@/lib/cma/market-charts'
import { subjectDomDays, type SubjectAskContext } from '@/lib/cma/comp-matrix'
import {
  MAP_HEADING,
  SALES_THAT_SET_IT_HEADING,
  failedSubjectAsk,
  keptSaleCount,
  listRangeBounds,
  mapPage,
  pricingPage,
  salesThatSetItPage,
  worthRangeRounded,
  type PricingPageInput,
} from '@/lib/cma/render-pricing-page'
import { activeRivalsFor, unsoldPeersFor } from '@/lib/cma/matrix-sets'
import {
  activeEntries,
  closedEntries,
  pinFactsFor,
  subjectEntry,
  unsoldEntries,
  type MatrixEntry,
} from '@/lib/cma/matrix-entry'
import { renderMatrixHtml, subjectListingFailed, subjectPrintableAsk } from '@/lib/cma/comp-matrix'
import { compAreaSentence } from '@/lib/cma/matrix-sets'
import { setAsideCompIndexes } from '@/lib/cma/set-aside'
import type { CmaBroker, CmaClient } from '@/lib/cma/types'
import type { DevelopmentOpportunities } from '@/lib/cma/development'
import type { CmaExtras } from '@/lib/cma/extras'
import type { CmaSiteData } from '@/lib/cma/county'
import type { SubdivisionStory } from '@/lib/cma/subdivision-story'
import type { CmaAdjustedComp, CmaMarketContext, CmaPricing, CmaSubject } from '@/lib/cma/types'
import type { CmaPageDef } from '@/lib/cma/render-use-of-property'
import type { CmaEquityPosition } from '@/lib/cma/equity'
import type { ExpiredAuditData } from '@/lib/cma/expired-audit'
import type { CmaParcelSet } from '@/lib/cma/parcel-shapes'
import type { TrackedDocLinkCtx } from '@/lib/cma/doc-links'
import {
  PRICED_RIGHT_HEADING_OVERPRICED,
  askExposureSentence,
  askGapClass,
  askStoryReading,
  neutralAskReading,
  pricedRightHeadingFor,
  type AskGapClass,
} from '@/lib/cma/ask-story'
import {
  readAskExposure,
  readSellerNetSheet,
  readSellerNetUnknowns,
  readSubjectStatus,
  type AskExposure,
  type CmaSubjectStatus,
  type SellerNetSheet,
} from '@/lib/cma/render-contract'

const esc = escapeHtml

export type OpinionPageArgs = {
  subject: CmaSubject
  comps: CmaAdjustedComp[]
  market: CmaMarketContext | null
  pricing: CmaPricing
  extras?: CmaExtras | null
  subdivisionStory?: SubdivisionStory | null
  mapDataUri: string | null
  /** Centre, zoom and pin coordinates for the map's own DOM pins. */
  mapOverlay?: import('@/lib/cma/comp-pin-map').CompPinMapOverlay | null
  /** Deprecated for letter render (C9). Ignored — comps map is the single map. */
  subjectMapDataUri?: string | null
  tiersUsed?: string[]
  /** The rungs the selector actually walked. Chapter 3's "why these sales". */
  compTrace?: readonly string[] | null
  /**
   * `render_args.compSearch` — the pricing side's own account of the search,
   * including how many kept sales each rung supplied. Absent on every row
   * built before it landed; the renderer then derives the sentence from
   * `compTrace` and the printed sales (class E).
   */
  compSearch?: unknown
  generatedAtIso: string
  /** Carried on render_args; nothing on the seller document prints it. */
  excludedOutliers?: Array<{ address: string; closePrice: number; ppsf: number; reason: string }>
  equity?: CmaEquityPosition | null
  expiredAudit?: ExpiredAuditData | null
  /**
   * Whose listing this is TODAY. Written at build by lib/pricing; absent on
   * every row built before that landed, and `readSubjectStatus` returns null
   * for those. The closing chapter reads it, and what it reads decides whether
   * this document is allowed to ask for the listing at all (class D).
   */
  subjectStatus?: CmaSubjectStatus | null
  site?: CmaSiteData | null
  /** Recorded lot polygons for the subject and its comps. Null when unavailable. */
  parcels?: CmaParcelSet | null
  /**
   * Closing chapters moved onto the shared spine (P10), so the assembler needs
   * what they print. Optional so existing callers that only build the middle
   * chapters keep compiling.
   */
  broker?: CmaBroker | null
  client?: CmaClient | null
  development?: DevelopmentOpportunities | null
  /**
   * Who this document went to. Every address and CTA links back into the site
   * carrying it, so a tap shows on the person's timeline. Resolved at SERVE
   * (lib/cma/print-html.ts, lib/cma/serve-document.ts), not at build: identity
   * belongs to the delivery, not to the stored figures.
   */
  docLinks?: TrackedDocLinkCtx | null
}











/**
 * WHETHER THE SUBJECT'S STORED ASK IS STILL THIS LISTING'S ASK.
 *
 * One resolution for the whole document (class E): the subject column's head,
 * its phone card, the strip's dashed failed-ask line and the list range's
 * ceiling all mean the same event. `finalCycle` being null is the build saying
 * it found no listing cycle to reason about, and a price with no cycle behind
 * it is a record, not an ask — 19968 Terrace printed $140,000 from a November
 * 2004 cycle, undated, three times, beside a $461,000 recommendation.
 *
 * `hasFinalCycle` stays undefined when the row carries no expired audit at
 * all: that is a document about a home nobody claims failed, and only the date
 * gate applies.
 */
export function subjectAskContext(a: OpinionPageArgs): SubjectAskContext {
  return {
    asOfIso: a.generatedAtIso,
    hasFinalCycle: a.expiredAudit ? a.expiredAudit.finalCycle != null : undefined,
  }
}

/**
 * THE THREE SETS, KEYED ONCE, FOR THE WHOLE DOCUMENT (Delta 3).
 *
 * The map's pins and the three matrices' columns are the same objects to a
 * reader — a tap on pin `iii` lights row `iii` — so which homes are in each
 * set, and in what order, is decided here and nowhere else.
 */
export function matrixEntriesFor(a: OpinionPageArgs): {
  subject: MatrixEntry
  closed: MatrixEntry[]
  unsold: MatrixEntry[]
  active: MatrixEntry[]
} {
  const askCtx = subjectAskContext(a)
  return {
    subject: subjectEntry({
      subject: a.subject,
      finalCycle: a.expiredAudit?.finalCycle ?? null,
      domDays: subjectDomDays(a.subject),
      printableAsk: subjectPrintableAsk(a.subject, askCtx),
    }),
    closed: closedEntries(a.comps, a.docLinks ?? null),
    unsold: unsoldEntries(
      unsoldPeersFor({ subject: a.subject, peers: a.extras?.marketArea?.expiredPeers }),
      a.docLinks ?? null,
      a.subject.city,
    ),
    active: activeEntries(
      activeRivalsFor(a.extras?.band?.rivals),
      a.docLinks ?? null,
      a.subject.city,
    ),
  }
}

/** The worth range, shaded on every price path in every matrix. */
export function pathRangeFor(a: OpinionPageArgs): { low: number; high: number } | null {
  const worth = worthRangeRounded(a.pricing)
  return worth.low > 0 && worth.high > 0 ? worth : null
}

/** Chapter 3b. The one map, under the number. Both documents. */
export function theMapPage(a: OpinionPageArgs): CmaPageDef | null {
  return mapPage(mapArgs(a))
}

export function mapArgs(a: OpinionPageArgs) {
  const sets = matrixEntriesFor(a)
  return {
    subject: a.subject,
    facts: pinFactsFor([...sets.closed, ...sets.active, ...sets.unsold]),
    mapDataUri: a.mapDataUri,
    mapOverlay: a.mapOverlay,
    areaSentence: compAreaSentence(a),
  }
}

/** Chapter 3a. Matrix 1, and the working under it. */
export function salesThatSetItArgs(a: OpinionPageArgs): PricingPageInput {
  return {
    subject: a.subject,
    comps: a.comps,
    market: a.market,
    pricing: a.pricing,
    tiersUsed: a.tiersUsed,
    docLinks: a.docLinks,
    renderArgs: a,
    compTrace: a.compTrace,
    askCtx: subjectAskContext(a),
    finalCycle: a.expiredAudit?.finalCycle ?? null,
  }
}

/**
 * MATRIX 2. The listings in the same area that came off unsold.
 *
 * Delta 3's sentence over it — "These asked and never came down to the range."
 * — is a CLAIM about every row under it, so it only prints when every row
 * carries it. When some of them did come into the range, the sentence says how
 * many did not, which is the same argument told truthfully (CLAUDE.md §0).
 */
export function unsoldMatrixLead(
  entries: readonly MatrixEntry[],
  range: { low: number; high: number } | null,
): string {
  if (entries.length === 0) return ''
  if (!range) return ''
  const above = entries.filter((e) => e.lastAsk != null && e.lastAsk > range.high)
  if (above.length === entries.length) {
    return `<p class="chart-read">${esc('These asked and never came down to the range.')}</p>`
  }
  if (above.length === 0) return ''
  return `<p class="chart-read">${esc(
    `${int(above.length)} of ${
      entries.length === 1 ? 'the one listing' : `these ${int(entries.length)} listings`
    } never came down to the range.`,
  )}</p>`
}

/**
 * MATRIX 3. The homes asking in this range now.
 *
 * "These are asking in this range now. Asking is not selling." — true only
 * while every home printed is inside the range the chapter names. When one
 * sits outside it the sentence says "near", because a reader can check.
 */
export function activeMatrixLead(
  entries: readonly MatrixEntry[],
  band: { lo: number; hi: number } | null,
): string {
  if (entries.length === 0) return ''
  const inside =
    band != null &&
    entries.every((e) => e.lastAsk != null && e.lastAsk >= band.lo && e.lastAsk <= band.hi)
  return `<p class="chart-read">${esc(
    inside
      ? 'These are asking in this range now. Asking is not selling.'
      : 'These are asking near this range now. Asking is not selling.',
  )}</p>`
}

/**
 * "commission, title, escrow, or your loan payoff" — an OR list, because each
 * one of them alone makes the figure above it wrong.
 */
function orList(items: readonly string[]): string {
  const list = items.map((s) => s.trim()).filter(Boolean)
  if (list.length === 0) return ''
  if (list.length === 1) return list[0]!
  if (list.length === 2) return `${list[0]} or ${list[1]}`
  return `${list.slice(0, -1).join(', ')}, or ${list[list.length - 1]}`
}

/**
 * What a net at list would need, when the row cannot produce one.
 *
 * The four figures are the ones a licensed broker fills in on an Oregon net
 * sheet and none of them is in the MLS record, so the report cannot hold them
 * and does not pretend to.
 */
const NET_AT_LIST_REQUIRES = [
  'what you still owe on the home',
  'the commission written into your listing agreement',
  'title and escrow',
  "the county's recording fees and the property-tax proration",
]

/**
 * WHAT YOU KEEP IS A CLAIM ABOUT EVERY DEDUCTION, and the chapter may only
 * make it when it holds every deduction (round-four class A).
 *
 * What was here: three figures headed "At $475,000 / $467,000", computed as
 * the list minus the median seller concession off the price chapter's own
 * sales, under an immersive eyebrow reading "What you keep". Commission,
 * title, escrow and the seller's loan payoff — every large number on a real
 * net sheet — were in a caption as words, not in the arithmetic. On a $475,000
 * list that figure overstates what the seller walks away with by roughly the
 * price of a car, and it is the one number in the document a seller will
 * quote back.
 *
 * So the chapter either ITEMISES — list, every cost line with the source it
 * came from, the net, and one sentence naming what is still not in it — or it
 * prints no figure at all and says what a net would need. `lib/pricing` owns
 * the sheet; `readSellerNetSheet` refuses anything whose column does not add
 * up, and refuses a net above the list outright.
 */
export function sellerNetSheetForDoc(a: OpinionPageArgs): SellerNetSheet | null {
  const sheet = readSellerNetSheet(a.pricing)
  if (!sheet) return null
  // ONE LIST CEILING PER DOCUMENT (class E). This chapter's whole column hangs
  // off one list price, printed twice — the head row and the net row — so a
  // sheet priced above the ceiling chapter 3 states would be the document's
  // highest number, in the chapter a seller reads for what they walk away
  // with. A sheet at the ask that already failed is the same defect wearing
  // the failed price. Neither is repaired here: the arithmetic belongs to
  // lib/pricing, so the chapter prints no figure and says what a net needs.
  const bounds = listRangeBounds(a.pricing, failedSubjectAsk(a.subject, subjectAskContext(a)))
  if (bounds && sheet.list > bounds.high) return null
  const failed = failedSubjectAsk(a.subject, subjectAskContext(a))
  if (failed != null && failed > 0 && sheet.list >= failed) return null
  return sheet
}

/** True only when every deduction is on the sheet. Gates the phrase itself. */
export function netIsEverything(sheet: SellerNetSheet | null): boolean {
  return sheet != null && sheet.unknowns.length === 0
}

/** The eyebrow over the immersive twin. Never "What you keep" on a partial net. */
export function sellerNetKick(a: OpinionPageArgs): string {
  return netIsEverything(sellerNetSheetForDoc(a)) ? 'What you keep' : 'Net at list'
}

export function sellerNetBodyHtml(a: OpinionPageArgs): string {
  const sheet = sellerNetSheetForDoc(a)
  if (!sheet) {
    const named = readSellerNetUnknowns(a.pricing)
    const needs = named.length > 0 ? named : NET_AT_LIST_REQUIRES
    return `<p>${esc(
      `A net at ${usd(a.pricing.recommended)} needs ${orList(
        needs,
      )}. None of those is in the record this report reads. We put them in writing, against a real list price, before anything is signed.`,
    )}</p>`
  }
  const everything = netIsEverything(sheet)
  const rows = sheet.lines
    .map(
      (l) =>
        `<tr><th>${esc(l.label)}<span class="ln-src">${esc(l.source)}</span></th><td class="v">${esc(
          `${l.amount < 0 ? '+' : '−'}${usd(Math.abs(l.amount))}`,
        )}</td></tr>`,
    )
    .join('\n    ')
  return `${sheet.sentence ? `<p>${esc(sheet.sentence)}</p>` : ''}
  <table class="kv netsheet">
    <tbody>
    <tr><th>List price</th><td class="v">${usd(sheet.list)}</td></tr>
    ${rows}
    <tr class="is-net"><th>${esc(
      everything ? `What you keep at ${usd(sheet.list)}` : `Net at ${usd(sheet.list)}`,
    )}</th><td class="v">${usd(sheet.net)}</td></tr>
    </tbody>
  </table>
  ${sheet.basis ? `<p class="small">${esc(sheet.basis)}</p>` : ''}
  ${
    everything
      ? ''
      : `<p>${esc(`This does not include ${orList(sheet.unknowns)}.`)}</p>`
  }`
}

export function sellerNetPage(a: OpinionPageArgs): CmaPageDef | null {
  // No sheet on the row at all: the build never priced a net, so there is no
  // chapter. The "what a net would need" sentence is for a sheet that exists
  // and cannot be added up, not for a row that never carried one.
  if (a.pricing.sellerNet == null) return null
  return {
    meta: `${esc(a.subject.streetAddress)} · Net at list`,
    toc: 'Net at list',
    body: `
  <h2 class="section">Net at list</h2>
  ${sellerNetBodyHtml(a)}`,
  }
}





/**
 * Chapter 1. What happened.
 *
 * Blueprint: "It asked $460,000 and did not sell." THEIR listing as a timeline
 * — a shaded zone at the value range, their ask stepping down across it and
 * never entering it — then one sentence of fact, then the relist figures.
 *
 * It is the first thing a homeowner whose listing failed wants answered, so it
 * sits before the number. Returns null on an asked origin: there is no failed
 * listing to draw.
 */
export function whatHappenedPage(a: OpinionPageArgs): CmaPageDef | null {
  const ea = a.expiredAudit
  if (!ea || ea.findings.length === 0) return null
  const heading = whatHappenedHeading(a)
  return {
    meta: `${esc(a.subject.streetAddress)} · What happened`,
    toc: heading,
    body: `
  <h2 class="section">${esc(heading)}</h2>
  ${whatHappenedGraphicHtml(a)}
  ${failedAskBacktestHtml(a, 'letter')}`,
  }
}

/**
 * The three regional relist figures — and the one case they may not print.
 *
 * "94.2 percent of the ask that failed is what the median one sold for" is a
 * statement about listings that FAILED. On a home that is on the market with
 * another brokerage today it is not a fact about this seller at all, it is a
 * pitch about somebody else's live listing; and on an ask that sat below the
 * bottom of the range it argues a case the numbers contradict. Both are the
 * neutral chapter, which states the ask, the range and the days and stops
 * (round-four class B).
 */
export function failedAskBacktestHtml(a: OpinionPageArgs, doc: 'letter' | 'immersive'): string {
  if (storyClassFor(a) === 'neutral') return ''
  const b = FAILED_ASK_BACKTEST
  const strip = doc === 'letter' ? 'stat-strip is-3' : 'stat3 r'
  const cell = doc === 'letter' ? 'stat' : 'st'
  const val = doc === 'letter' ? 'val' : 'st-n'
  const lbl = doc === 'letter' ? 'lbl' : 'st-l'
  const small = doc === 'letter' ? 'small' : 'small r'
  return `<div class="${strip}">
    <div class="${cell}"><div class="${val}">${int(b.pairs)}</div><div class="${lbl}">Central Oregon homes came off unsold and then sold, 2023 to 2026</div></div>
    <div class="${cell}"><div class="${val}">${(b.closeMedianRatio * 100).toFixed(1)}%</div><div class="${lbl}">of the ask that failed is what the median one sold for</div></div>
    <div class="${cell}"><div class="${val}">${b.shareClosedAboveAskPct}%</div><div class="${lbl}">sold for more than that ask</div></div>
  </div>
  <p class="${small}">${esc(FAILED_ASK_BACKTEST_SOURCE)}</p>`
}

/**
 * The §0 trace for the three relist figures.
 *
 * They are REGIONAL — every listing in the Central Oregon MLS that came off
 * unsold and later closed — and they sat on the screen with no source line at
 * all, one scroll under a chapter of Redmond figures. A reader had no way to
 * know which geography they were being handed.
 */
export const FAILED_ASK_BACKTEST_SOURCE = `These three figures are regional, not this city alone: ${int(
  FAILED_ASK_BACKTEST.pairs,
)} matched pairs, every Central Oregon listing that came off the market unsold and later closed between 2023 and 2026, from the Oregon Data Share MLS. Measured ${FAILED_ASK_BACKTEST.runstamp}.`

/**
 * The timeline and its sentence, or the fallback sentence.
 *
 * Shared by the letter and the immersive so the two cannot draw a different
 * listing. Two layouts of one graphic ship and exactly one is ever visible:
 * the wide one on paper and at reading width, the drawn-to-fit one below
 * 700px. This chart's reading is the gap between a line and a zone, and a
 * cropped right edge deletes the day it came off, which is the point.
 */
export function whatHappenedGraphicHtml(a: OpinionPageArgs): string {
  const timeline = resolveListingTimeline({
    subject: a.subject,
    expiredAudit: a.expiredAudit,
    rangeLow: a.pricing.valueLow,
    rangeHigh: a.pricing.valueHigh,
    // ONE meaning for "homes like yours" in this document, and it is the
    // ADJUSTED range (tasteReview round two, §3.B: chapter 1 shaded
    // $372K–$399K under that phrase while chapter 5 printed $410K–$460K under
    // the same phrase, and chapter 2 a third figure a foot). The label says
    // which of the two it is, on the mark, where the reader meets it.
    rangeLabel: 'where homes like yours sold, adjusted for date and size',
    domDays: subjectDomDays(a.subject),
  })
  // The row carries no list date and no ask, so there is no period to draw.
  // State what IS known and stop (CLAUDE.md §0) — and on a home that is on the
  // market with another brokerage, "came off the market without selling" is
  // not one of the things known (class D).
  const noChart = `<p class="chart-read">${esc(
    storyClassFor(a) === 'neutral'
      ? neutralAskReading({
          ask: failedAskForStory(a) ?? a.subject.lastListPrice ?? null,
          rangeLow: a.pricing.valueLow,
          rangeHigh: a.pricing.valueHigh,
          days: subjectDomDays(a.subject),
        })
      : `Your home came off the market without selling. Homes like yours sold for ${usd(a.pricing.valueLow)} to ${usd(a.pricing.valueHigh)}.`,
  )}</p>`
  if (!timeline) return noChart
  const wide = listingTimelineSvg(timeline)
  const phone = listingTimelinePhoneSvg(timeline)
  if (!wide) return noChart
  const reading = askStoryReading({
    // THE ASK THAT RAN THE CLOCK, not the one the listing came off at
    // (round-four class B). `failedAskForStory` resolves the dominant ask when
    // the row carries the exposure and falls back to the last cut when it does
    // not — and in that second case `exposureKnown` is false, so nothing
    // causal is said about it.
    ask: failedAskForStory(a) ?? timeline.steps[timeline.steps.length - 1]?.ask ?? null,
    rangeLow: timeline.rangeLow,
    rangeHigh: timeline.rangeHigh,
    days: timeline.days,
    city: a.subject.city,
    // The SAME median chapter 2 draws, when the row carries it. Two figures
    // for "days to an accepted offer in Redmond" — 21 off `market_stats_cache`
    // and 26 off the 12-month single-family read — printed one screen apart is
    // a §0 failure whichever is right, and only the offer-timing block ships
    // with a source trace beside it.
    marketMedianDom: readOfferTiming(a.market)?.medianDays ?? a.market?.medianDom ?? null,
    neutral: storyClassFor(a) === 'neutral',
    exposureKnown: askExposureKnown(a),
  })
  return `<div class="szn timeline-wide">${wide}</div>
  ${phone ? `<div class="szn timeline-phone">${phone}</div>` : ''}
  ${reading ? `<p class="chart-read">${esc(reading)}</p>` : ''}`
}

/**
 * Whether this row says which ask held the market.
 *
 * Both halves are required. `askExposure` is the segmentation; `finalCycle` is
 * the listing period it segments. With either missing there is no basis for
 * saying a particular price cost this seller anything, and chapter 1 prints
 * the days and the city's median and stops (round-four class B).
 */
export function askExposureKnown(a: OpinionPageArgs): boolean {
  return askExposureFor(a) != null && a.expiredAudit?.finalCycle != null
}

export function askExposureFor(a: OpinionPageArgs): AskExposure | null {
  return readAskExposure(a.expiredAudit)
}

/**
 * Chapter 1's title.
 *
 * "It asked $460,000 and did not sell." was the blueprint's line and it is
 * still right whenever one price held the whole listing. When the ask stepped,
 * the title names EVERY ask and how long each ran, because the reader's next
 * question — which price actually sat there — was answerable from the row all
 * along and the document was answering it with the wrong number.
 *
 * A home listed with another brokerage today did not fail at anything, so its
 * title says where it stands and nothing more (class D).
 */
export function whatHappenedHeading(a: OpinionPageArgs): string {
  const status = readSubjectStatus(a)
  const exposure = askExposureFor(a)
  if (status?.isActiveWithOtherBrokerage) {
    const ask = exposure?.final ?? a.subject.lastListPrice ?? null
    return ask != null && ask > 0 ? `It is listed at ${usd(ask)}.` : 'Where this listing stands.'
  }
  if (exposure && exposure.segments.length > 1) {
    const sentence = askExposureSentence(exposure.segments)
    if (sentence) return sentence
  }
  const ask = exposure?.segments[0]?.ask ?? a.subject.lastListPrice
  return ask != null && ask > 0
    ? `It asked ${usd(ask)} and did not sell.`
    : 'It came off the market without selling.'
}

/**
 * Chapter 2b. What overpricing costs.
 *
 * The one thing this document has to land, in the blueprint's own words: "we
 * need to illustrate that if homes are priced too high they sit and expire,
 * period", and Delta 1's "we also need to explain the dangers of overpricing
 * clearly when we provide our numbers." Local numbers, never a slogan — the
 * folklore this chapter could have reached for (the pricing pyramid, "the
 * first 30 days", showings-to-offer ratios) has no dataset behind it and is
 * banned outright in lib/cma/seller-text.ts.
 *
 * Three exhibits, in the order the argument runs: the cumulative offer-timing
 * curve with the seller's own days marked far past its shoulder; the three-bar
 * first-price outcome with their group marked and what each sold group
 * realized against its first ask; and the centrepiece, what the first asking
 * price actually realized by weeks on market, with their own weeks marked.
 */
export function pricedRightPage(a: OpinionPageArgs): CmaPageDef | null {
  const body = pricedRightBodyHtml(a)
  if (!body.trim()) return null
  const heading = pricedRightHeading(a)
  return {
    meta: `${esc(a.subject.streetAddress)} · ${esc(heading.replace(/\.$/, ''))}`,
    toc: heading,
    body: `
  <h2 class="section">${esc(heading)}</h2>
  ${body}`,
  }
}

/**
 * THE ASK THAT FAILED, resolved the way chapter 1's drawing resolves it — the
 * last step of the final listing period, which is the cut the seller came off
 * the market at, not the price they opened on.
 *
 * Null when there is no failed listing: on an asked origin there is no chapter
 * 1 and no ask of the seller's own for anything to be measured against.
 */
export function failedAskForStory(a: OpinionPageArgs): number | null {
  if ((a.expiredAudit?.findings.length ?? 0) === 0) return null
  // THE DOMINANT ASK FIRST. The last cut is where the story used to start and
  // it is the ask the market saw least (round-four class B): on the exemplar
  // 152 of 187 days ran at a price $15,000 above the one this used to measure.
  const dominant = askExposureFor(a)?.dominant ?? null
  if (dominant != null && dominant > 0) return dominant
  const cycle = a.expiredAudit?.finalCycle ?? null
  const lastCut = [...(cycle?.cuts ?? [])].reverse().find((c) => c.ask > 0)?.ask ?? null
  const ask = lastCut ?? cycle?.initialAsk ?? a.subject.lastListPrice ?? null
  return ask != null && ask > 0 ? ask : null
}

/**
 * Which chapter-1 story this document is in — and whether it gets one at all.
 *
 * Three gates, and the first two are not measurements:
 *
 *  1. `neutral` when the home is on the market with another brokerage, or when
 *     the ask sat BELOW the bottom of the range. Neither can carry an
 *     overpricing argument: the first is somebody else's listing (class D),
 *     the second is a price the sales say was low.
 *  2. `null` when the row does not say which ask ran the clock. Measuring the
 *     gap of the final cut is measuring the wrong ask (class B), so nothing
 *     causal is claimed and chapter 2b takes its descriptive title.
 *  3. otherwise the measured gap, off the DOMINANT ask.
 */
export function storyClassFor(a: OpinionPageArgs): AskGapClass | null {
  const measured = askGapClass(failedAskForStory(a), a.pricing.valueLow, a.pricing.valueHigh)
  if (readSubjectStatus(a)?.isActiveWithOtherBrokerage) return 'neutral'
  if (measured === 'below') return 'neutral'
  if (!askExposureKnown(a)) return null
  return measured
}

/**
 * Chapter 2b's title.
 *
 * "What overpricing costs" is a claim about THIS listing, and the document may
 * only make it when the gap carries it (tasteReview round three, §5.1). When
 * the ask sat near or inside the range the same exhibits are still the right
 * evidence — they measure the city, not this seller — so the chapter keeps
 * every graphic and takes a title that describes what it draws.
 */
export function pricedRightHeading(a: OpinionPageArgs): string {
  return pricedRightHeadingFor(storyClassFor(a), cleanText(a.market?.geoLabel) ?? a.subject.city ?? '')
}

/**
 * Chapter 2's body, shared by both documents.
 *
 * WHEN THE BUILD CONTRACT IS ABSENT. `market.offerTiming` and
 * `market.askOutcome` are written at build by lib/pricing through the DAL; a
 * row built before that landed carries neither. The chapter does not narrate
 * the absence — a §0 deliverable states fewer figures, it never says which
 * query missed. Instead it argues the same claim from what the row DOES carry:
 * the days each printed sale waited for an offer, the city's own median on the
 * same axis, and the seller's own listing beside them. That is one exhibit
 * instead of two, sourced the same way, and it makes the same point.
 */
export function pricedRightBodyHtml(a: OpinionPageArgs): string {
  const timing = renderOfferTimingHtml({ market: a.market, subject: a.subject, bare: true })
  const outcome = renderAskOutcomeHtml({ market: a.market, subject: a.subject, bare: true })
  // The days strip stands in for 2a when the 12-month curve is not on the row.
  const daysStrip = timing
    ? ''
    : renderDaysToOfferHtml({ subject: a.subject, comps: a.comps, market: a.market })
  const realization = renderAskRealizationHtml({ market: a.market, subject: a.subject, bare: true })
  // With no curve, no bars and no realization table there is nothing local to
  // argue from, so the chapter omits rather than printing a slogan.
  if (!timing && !outcome && !daysStrip && !realization) return ''
  // ONE COMPOSED SPREAD, not three stacked sections.
  //
  // tasteReview 2026-09-07: "chapters 1, 2, 2b, 3 and 5 all run eyebrow →
  // Amboqia heading → figure → sentence → source, and chapter 2b repeats that
  // shape three times inside itself. That is the stacked-section page the file
  // names as a tell." The two graphics that answer the same question — when
  // does a buyer arrive, and what does the first price do to that — sit side
  // by side on a screen and stack on a phone; the realization table, which is
  // the chapter's conclusion, runs full width under them; and the whole
  // chapter carries ONE source line, because all three read the same city over
  // the same window from the same MLS.
  const left = timing || (daysStrip ? `<h3 class="subhead">How fast homes like yours went</h3>${daysStrip}` : '')
  const spread =
    left && outcome
      ? `<div class="spread">
    <div class="spread-col">${left}</div>
    <div class="spread-col">${outcome}</div>
  </div>`
      : [left, outcome].filter(Boolean).join('\n  ')
  const source = chapter2bSourceLine({ market: a.market })
  return [spread, realization, source ? `<p class="small">${esc(source)}</p>` : '']
    .filter(Boolean)
    .join('\n  ')
}

/**
 * Chapter 2. The listings near you that did not sell.
 *
 * The unsold listings left chapter 2b as six linked rows and came back as
 * STORIES (blueprint, Delta 1): each one a card with its photo, its whole
 * price path drawn, and one sentence putting its final ask against what homes
 * like it actually closed at. The seller's own listing leads the set.
 */
export function didNotSellArgs(a: OpinionPageArgs): DidNotSellArgs {
  return {
    subject: a.subject,
    comps: a.comps,
    market: a.market,
    peers: a.extras?.marketArea?.expiredPeers,
    finalCycle: a.expiredAudit?.finalCycle ?? null,
    docLinks: a.docLinks ?? null,
    rangeLow: a.pricing.valueLow,
    rangeHigh: a.pricing.valueHigh,
    // The SAME gate whatHappenedPage / whatHappenedScene render on.
    askVerdictInChapterOne: (a.expiredAudit?.findings.length ?? 0) > 0,
  }
}

/**
 * MATRIX 2, and the peer stories under it.
 *
 * Delta 3 turned the five story CARDS into a matrix — same column set as the
 * closed sales, subject column first — because the comparison Matt makes at
 * the table is across the same twelve facts, and five cards of prose cannot be
 * read across. The one thing the cards carried that a column cannot is the
 * dollars-a-foot sentence, so it survives as a short keyed list under the
 * matrix: one line per peer, badged with the pin that names it on the map.
 */
export function didNotSellBodyMatrixHtml(a: OpinionPageArgs): string {
  const sets = matrixEntriesFor(a)
  const lead0 = didNotSellLeadSentence({ market: a.market, city: a.subject.city })
  if (sets.unsold.length === 0) {
    // NO PEERS ON THE ROW, AND THE SELLER'S OWN LISTING IS STILL ONE OF THEM.
    // A one-column matrix is not a comparison, so the chapter degrades to the
    // city's own count and the reader's own outcome rather than vanishing and
    // taking the ask that failed with it.
    if (!subjectListingFailed(a.subject) || !sets.subject.outcome) return ''
    const ask = sets.subject.lastAsk
    const own = `Your own listing ${
      ask != null && ask > 0 ? `asked ${usd(ask)} and ` : ''
    }${sets.subject.outcome.charAt(0).toLowerCase()}${sets.subject.outcome.slice(1)}.`
    return `${lead0 ? `<p class="chart-read">${esc(lead0)}</p>` : ''}
  <p>${esc(own)}</p>`
  }
  const range = pathRangeFor(a)
  const matrix = renderMatrixHtml({
    id: 'did-not-sell',
    family: 'unsold',
    heading: 'The listings in this area that came off unsold',
    lead: unsoldMatrixLead(sets.unsold, range),
    entries: [sets.subject, ...sets.unsold],
    range,
  })
  if (!matrix.trim()) return ''
  const lead = lead0
  return `${lead ? `<p class="chart-read">${esc(lead)}</p>` : ''}
  ${matrix}
  ${peerStoriesHtml(a, sets.unsold)}`
}

/**
 * Each peer's story line: what it asked a foot against what homes like it
 * actually closed at. The same sentence the cards printed, off the same
 * function, keyed to the pin so a reader can find the row and the pin.
 */
function peerStoriesHtml(a: OpinionPageArgs, peers: readonly MatrixEntry[]): string {
  const range = soldPpsfRange(a.comps)
  if (!range) return ''
  const items = peers
    .map((p) => {
      const sentence = askAgainstSoldSentence({ ask: p.lastAsk, sqft: p.sqft, range })
      if (!sentence) return ''
      return `<li data-comp="${esc(p.key)}" data-pin="${esc(p.key)}"><span class="pin-badge is-unsold" aria-hidden="true">${esc(
        p.key,
      )}</span><span class="ps-a">${esc(p.address)}</span><span class="ps-r">${esc(sentence)}</span></li>`
    })
    .filter(Boolean)
    .join('')
  if (!items) return ''
  return `<ul class="peer-stories">${items}</ul>
  <p class="small">${esc(
    `The dollars a foot come from the ${int(range.n)} closed sales in this report, at their own sale price over their own living area.`,
  )}</p>`
}

export function didNotSellPage(a: OpinionPageArgs): CmaPageDef | null {
  const body = didNotSellBodyMatrixHtml(a)
  if (!body.trim()) return null
  return {
    meta: `${esc(a.subject.streetAddress)} · Did not sell`,
    toc: DID_NOT_SELL_HEADING,
    body: `
  <h2 class="section">${esc(DID_NOT_SELL_HEADING)}</h2>
  ${body}`,
  }
}

/**
 * Chapter 2b's title when the gap says overpricing. Delta 1 names it "What
 * overpricing costs" — the earlier "Priced right sells. Priced high sits." was
 * the claim asserted as a slogan, and this chapter's job is to show what it
 * costs in days and in dollars. `pricedRightHeading(a)` picks between this and
 * the descriptive title; nothing else should read this constant.
 */
export const PRICED_RIGHT_HEADING = PRICED_RIGHT_HEADING_OVERPRICED

/**
 * Chapter 5. The city right now.
 *
 * Four figures in one row, the median-close line, and one sentence about the
 * street with its four most recent sales as tracked links. Nothing else: the
 * 90-day bed-count board and the ten-year subdivision table are cut.
 */
export function thisMarketPage(a: OpinionPageArgs): CmaPageDef | null {
  const body = thisMarketBodyHtml(a, 'h3')
  if (!body.trim()) return null
  const heading = thisMarketHeading(a)
  return {
    meta: `${esc(a.subject.streetAddress)} · ${esc(heading)}`,
    toc: heading,
    body: `
  <h2 class="section">${esc(heading)}</h2>
  ${body}`,
  }
}

/** "Redmond right now". */
export function thisMarketHeading(a: Pick<OpinionPageArgs, 'subject' | 'market'>): string {
  const place = cleanText(a.market?.geoLabel) ?? cleanText(a.subject.city) ?? 'This market'
  return `${place} right now`
}

/** Shared by the letter chapter and its immersive twin. */
export function thisMarketBodyHtml(a: OpinionPageArgs, headingTag: 'h3' | 'sub'): string {
  const reconcile = cityMedianReconciliationHtml(a)
  // The month line is drawn from a pooled city read at every size; the number
  // this document recommends is not. When the whole line sits above it, the
  // board says so in one sentence (tasteReview round three, §3).
  const board = renderInventoryBoardHtml(a.market, {
    recommended: a.pricing.recommended,
    subject: a.subject,
  })
  const street = subdivisionLineHtml(a, headingTag)
  return [reconcile, board, street].filter(Boolean).join('\n  ')
}

/**
 * What the sales behind the price actually sold for, before any adjustment,
 * in one sentence — so a reader who meets a $500K city market three screens
 * after a $395,000 recommendation knows which set each figure is over.
 *
 * WHAT CAME OUT OF IT, AND WHY (tasteReview round two, §3.D). The sentence
 * used to open on the pooled city median: "$532,311 is every Redmond home, all
 * sizes." Three hundred pixels below it the month line drew twelve medians
 * running $461K to $530K over the same year and the same city. A pooled median
 * over the same homes cannot sit above every month it is pooled from, and the
 * row carries no window, table or fetch stamp beside that figure that would
 * explain the two as different sets. §0: a figure that cannot be reconciled to
 * what is drawn under it does not ship. The sentence keeps the half every
 * reader can check — the five close prices printed in chapter 3's own grid —
 * and labels them RAW, which is the other half of giving "homes like yours"
 * one meaning (§3.B): chapter 1's shaded zone is the adjusted range, this is
 * the unadjusted one, and each says which it is.
 */
export function cityMedianReconciliationHtml(a: OpinionPageArgs): string {
  // THE KEPT SET, AND THE SAME n THE PRICE CHAPTER PRINTS (round-four class E).
  // This said "The six sales behind your price sold for $370,000 to $479,000"
  // while chapter 3 two screens earlier said four sales set the number and
  // named the other two as set aside — and $479,000, the top of this raw
  // range, WAS one of the two. A range whose top is a sale the document
  // disowned is not the range behind the price.
  const aside = setAsideCompIndexes(a.pricing, a.comps)
  const kept = a.comps.filter((_, i) => !aside.has(i))
  const closes = kept
    .map((c) => c.closePrice)
    .filter((n): n is number => n != null && Number.isFinite(n) && n > 0)
  if (closes.length < 2) return ''
  // RECONCILED IN THE SAME BREATH. The raw top of this sentence IS the ask
  // chapter 1 says failed — 1737 7th closed at exactly $460,000 — and the two
  // sat four screens apart with nothing joining them, which is the most
  // quotable pair in the document (tasteReview round three, §3). The adjusted
  // pair is the one the chapter of the answer states, rounded the same way, so
  // a reader meets both halves of "homes like yours" in one line.
  const worth = worthRangeRounded(a.pricing)
  const adjusted =
    worth.low > 0 && worth.high > 0
      ? worth.low === worth.high
        ? `; adjusted, they support ${usd(worth.low)}`
        : `; adjusted, they support ${usd(worth.low)} to ${usd(worth.high)}`
      : ''
  return `<p class="chart-read">${esc(
    `The ${countWord(keptSaleCount(a.pricing, a.comps))} sales behind your price sold for ${usd(
      Math.min(...closes),
    )} to ${usd(Math.max(...closes))} before adjusting for date and size${adjusted}.`,
  )}</p>`
}

/**
 * The street, in one sentence: how many have sold here and the four most
 * recent, each a tracked link. It is what survives of the ten-year subdivision
 * table the blueprint cut.
 */
function subdivisionLineHtml(a: OpinionPageArgs, headingTag: 'h3' | 'sub'): string {
  const f = a.subdivisionStory?.facts
  const name = cleanText(f?.name ?? null)
  if (!f || !name || !(f.totalSales > 0)) return ''
  const recent = [...(a.subdivisionStory?.notableSales ?? [])]
    .filter((n) => n.address.trim())
    .slice(0, 4)
  const links = recent
    .map((n) => {
      // THE SALE'S OWN LISTING PAGE. `trackedDocLink('listing', …)` falls back
      // to a place-scoped search when the target carries no id, and this call
      // passed none — so four addresses presented as links to four specific
      // homes all landed on /homes-for-sale/redmond (tasteReview round two,
      // §2.4). The notable sale carries `listNumber`, which is the MLS number
      // `listingTileHref` builds the canonical URL from.
      const href = trackedDocLink(
        'listing',
        {
          mlsNumber: n.listNumber ?? null,
          streetNumber: /^\s*(\d+[A-Za-z]?)\s/.exec(n.address)?.[1] ?? null,
          streetName: n.address.replace(/^\s*\d+[A-Za-z]?\s+/, '').trim() || null,
          city: a.subject.city,
          subdivision: name,
        },
        a.docLinks ?? UNADDRESSED_DOC_LINKS,
      )
      // 21px tall inline links were the last sub-44px targets on the phone
      // (tasteReview round two, item 3). The address and its price travel as
      // ONE tappable chip, which is also how they read.
      return `<a class="street-sale" href="${esc(href)}" data-rr-track="cma-street-sale">${esc(
        n.address,
      )} <span class="n">${usd(n.closePrice)}</span></a>`
    })
    .join('')
  const sub = (text: string) =>
    headingTag === 'h3' ? `<h3 class="subhead">${esc(text)}</h3>` : `<h3 class="sub r">${esc(text)}</h3>`
  // §0: the count is over a WINDOW, and the window was nowhere on the screen.
  // The years the facts were aggregated over are on the row, so the line says
  // them rather than implying "145 homes have sold" means all time.
  const years = f.years.map((y) => y.year).filter((y) => Number.isFinite(y))
  const span =
    years.length > 0
      ? ` between ${Math.min(...years)} and ${Math.max(...years)}`
      : ''
  return `${sub(name)}
  <p>${int(f.totalSales)} homes have sold in ${esc(name)}${esc(span)}.${
    links ? ` The most recent ${recent.length === 1 ? 'one' : countWord(recent.length)}:` : ''
  }</p>
  ${links ? `<p class="street-sales">${links}</p>` : ''}
  <p class="small">${esc(
    `Closed single-family sales recorded in ${name}${span}, from the Oregon Data Share MLS.`,
  )}</p>`
}

/**
 * Basis and limits, then the ORS 696 / OAR 863-015-0190 disclosure and the
 * signature. Both documents (P10).
 */
export function disclosurePage(a: OpinionPageArgs): CmaPageDef | null {
  const b = a.broker
  if (!b) return null
  return {
    meta: `${esc(a.subject.streetAddress)} · Basis and limits · ${esc(b.displayName)}`,
    toc: BASIS_AND_LIMITS_HEADING,
    body: `
  <h2 class="section">${esc(BASIS_AND_LIMITS_HEADING)}</h2>
  ${cmaDisclosureProseHtml(a)}`,
  }
}

/** The chapter title, in one place so the letter and the scene cannot drift. */
export const BASIS_AND_LIMITS_HEADING = 'Basis and limits'

/**
 * The disclosure paragraphs alone, so the immersive scene prints the same words.
 *
 * Research item 9: an appraisal states its effective date, what it is and is
 * not, what was and was not inspected, and where it did not adjust. Ours stated
 * the legal minimum and nothing a reader could use. The three paragraphs that
 * open this block are the ones the brief named, and the last of them is the
 * gap `CMA_STATE_OF_THE_WORLD.md` calls the widest in the category: the grid
 * adjusts for date, size and style, and for nothing else, because the record
 * carries nothing else.
 */
/**
 * Exactly the adjustments the grid PRINTS, named the same way twice.
 *
 * tasteReview round two, §2.1: the limitations block said the grid moves each
 * sale "for when it sold, for size, and for style" while the grid printed no
 * style row — `foldIdenticalRows` drops an all-$0 row — and two paragraphs
 * later the same chapter said the value rests on sales "adjusted for market
 * conditions and size". A limitations block that names an adjustment nobody
 * made, and then contradicts itself about which were made, is the worst
 * sentence in the document to get wrong. Both paragraphs now read the same
 * function, and that function reads the sales.
 */
export function adjustmentsMade(comps: readonly CmaAdjustedComp[]): string[] {
  const any = (pick: (c: CmaAdjustedComp) => number | null | undefined): boolean =>
    comps.some((c) => {
      const v = pick(c)
      return v != null && Number.isFinite(v) && v !== 0
    })
  const made: string[] = []
  if (any((c) => c.timeAdjustment)) made.push('date')
  if (any((c) => c.sizeAdjustment)) made.push('size')
  if (any((c) => c.storyAdjustment)) made.push('style')
  return made
}

/** "for when it sold and for size" — the limitations paragraph's phrasing. */
function adjustmentsMadeClause(comps: readonly CmaAdjustedComp[]): string {
  const made = adjustmentsMade(comps)
  const words = made.map((m) => (m === 'date' ? 'for when it sold' : `for ${m}`))
  if (words.length === 0) return 'for nothing at all'
  if (words.length === 1) return words[0]!
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

/** "adjusted for date and size" — the basis paragraph's phrasing. */
function adjustedForClause(comps: readonly CmaAdjustedComp[]): string {
  const made = adjustmentsMade(comps)
  if (made.length === 0) return 'unadjusted'
  if (made.length === 1) return `adjusted for ${made[0]}`
  return `adjusted for ${made.slice(0, -1).join(', ')} and ${made[made.length - 1]}`
}

export function cmaDisclosureProseHtml(a: OpinionPageArgs): string {
  const b = a.broker
  const name = b?.displayName ?? 'the preparing broker'
  // Named only where it was actually read. A recorded lot or an assessor
  // record is on the row for some homes and not for others (§0).
  const record =
    a.parcels || a.site
      ? ', together with the county assessor record and the recorded lot'
      : ''
  return `
  <p><strong>Effective date.</strong> This opinion is effective ${esc(
    dateLong(a.generatedAtIso),
  )}. Every figure in it was pulled that day and reads the market as it stood then.</p>
  <p><strong>What was looked at.</strong> This opinion reads the Oregon Data Share MLS record for your home and for every sale, listing and failed listing named in it — the recorded facts, the price history and the listing photographs${record}. Nobody walked through the inside of your home, or the inside of any home it is measured against. Facts you told us, where they are used, are labelled as yours and should be confirmed independently.</p>
  <p><strong>Condition was not adjusted for.</strong> The grid in the price chapter moves each sale ${esc(
    adjustmentsMadeClause(a.comps),
  )}. It moves none of them for condition, because the MLS record carries no condition rating. Where a sale was in better or worse shape than your home, that difference sits inside its sale price and is not broken out.</p>
  <p><strong>Basis for the value.</strong> The value range rests on ${a.comps.length} closed comparable sales from the Oregon Data Share MLS, ${esc(
    adjustedForClause(a.comps),
  )}, and on verified market statistics for ${esc(a.market?.geoLabel ?? a.subject.city)}. The term value as used in this analysis means the estimated worth of or price for the property. It does not mean or imply a value arrived at by any method of appraisal.</p>
  <div class="comp-fold" data-fold-label="The rest of the disclosure">
  <p><strong>Purpose and intent.</strong> This document is a competitive market analysis prepared by a licensed Oregon real estate broker to assist the owner of ${esc(a.subject.streetAddress)}, ${esc(a.subject.city)}, Oregon in evaluating a potential listing price. It is provided in accordance with ORS chapter 696 and OAR 863-015-0190.</p>
  <p><strong>Property description.</strong> ${propertyDescription(a.subject)}${
    formatClientMlsField(a.subject.viewDescription)
      ? ` View: ${esc(formatClientMlsField(a.subject.viewDescription)!)}.`
      : ''
  }</p>
  ${a.development ? '<p><strong>Land use, rental, and code statements.</strong> Zoning, buildability, rental, and covenant statements in this report are preliminary reads of published code and recorded documents as of the verification dates shown beside them. They are not land-use decisions, permits, or legal opinions, and they should be confirmed with the agencies listed at the back of this report before anyone relies on them.</p>' : ''}
  <p><strong>Licensee interest.</strong> Neither ${esc(name)} nor Ryan Realty holds any existing or contemplated interest in this property. Any such interest, should one arise, will be disclosed in writing.</p>
  <p><strong>Not an appraisal.</strong> This competitive market analysis is not intended as an appraisal. If an appraisal is desired, the services of a competent professional licensed appraiser should be obtained. Unless the preparing licensee is also licensed by the Oregon Appraiser Certification and Licensure Board, this report is not intended to meet the requirements set out in the Uniform Standards of Professional Appraisal Practice. Equal Housing Opportunity.</p>
  </div>`
}

/** What we would like them to do next. We, never I (VOICE.md). */
export function nextStepPage(a: OpinionPageArgs): CmaPageDef | null {
  const br = a.broker
  if (!br) return null
  return {
    closing: true,
    meta: `${esc(a.subject.streetAddress)} · Your next step`,
    toc: 'Your next step',
    body: `
  <h2 class="section">${esc(nextStepHeading(a))}</h2>
  <div class="cta-actions">${nextStepButtonsHtml(a)}</div>
  ${nextStepNoteHtml(a)}
  ${nextStepSignatureHtml(a)}`,
  }
}

/** "Sorry this listing did not sell." */
export function nextStepHeading(a: OpinionPageArgs): string {
  // A home on the market with another brokerage did not fail at anything, and
  // saying sorry about it is the opening line of a solicitation (class D).
  if (readSubjectStatus(a)?.isActiveWithOtherBrokerage) return 'What this report is.'
  return a.expiredAudit ? 'Sorry this listing did not sell.' : 'What happens next.'
}

/**
 * ORS 696 AND THE REALTOR CODE, ARTICLE 16, IN ONE SENTENCE EACH.
 *
 * Round-four class D. The closing chapter asked for the listing on every
 * document it rendered — "Talk with Matt" over "we will walk the house, price
 * it against these same sales" — including on a home that is listed with
 * another brokerage right now, and on one that came off the market
 * WITHDRAWN rather than expired, where the listing agreement is very likely
 * still running. A licensed principal broker does not send that, and a
 * renderer that cannot tell the two apart will send it every time.
 *
 * So the two statuses each get their own sentence, and the active one gets a
 * single neutral action instead of the two asks.
 */
export const NON_SOLICITATION_SENTENCE =
  'This report is not a solicitation. If your home is listed with another broker, we are not asking you to break that agreement, and we are not asking for the listing.'

export const WITHDRAWN_AGREEMENT_SENTENCE =
  'Your listing came off the market rather than expiring, so your agreement with your broker may still be running. This report is not an offer to interfere with it.'

/** True when this document may not ask for the listing at all. */
export function closingIsNonSoliciting(a: OpinionPageArgs): boolean {
  return readSubjectStatus(a)?.isActiveWithOtherBrokerage === true
}

/** The compliance sentence this closing carries, or ''. */
export function closingComplianceSentence(a: OpinionPageArgs): string {
  const status = readSubjectStatus(a)
  if (!status) return ''
  if (status.isActiveWithOtherBrokerage) return NON_SOLICITATION_SENTENCE
  if (status.isWithdrawnNotExpired) return WITHDRAWN_AGREEMENT_SENTENCE
  return ''
}

export function closingComplianceHtml(a: OpinionPageArgs): string {
  const sentence = closingComplianceSentence(a)
  return sentence ? `<p class="next-note is-compliance">${esc(sentence)}</p>` : ''
}

/**
 * TWO buttons, both tracked and both carrying identity: talk with the broker,
 * and see what is for sale near them. The four-way call / text / email / book
 * row asked a homeowner on a phone to make a choice before they had made the
 * decision.
 */
export function nextStepButtonsHtml(a: OpinionPageArgs): string {
  const first = a.broker?.displayName.split(/\s+/)[0] ?? 'us'
  const book = trackedDocLink('book', '', a.docLinks ?? UNADDRESSED_DOC_LINKS)
  const search = trackedDocLink('search', a.subject.city, a.docLinks ?? UNADDRESSED_DOC_LINKS)
  // BUTTONS, not two 22px underlined text links (tasteReview item 3). Both
  // carry `_pid`, `agent` and `utm_campaign` through trackedDocLink, so the
  // one click that matters is attributable to the person and to this document.
  // ONE neutral action when the home is listed with another brokerage. Two
  // asks, one of them "talk with the broker who wrote this", is a solicitation
  // whatever the button says (class D).
  if (closingIsNonSoliciting(a)) {
    return `<a class="btn sec ghost" href="${esc(search)}" data-rr-track="cma-search">See homes for sale near you</a>`
  }
  return `<a class="btn pri" href="${esc(book)}" data-rr-track="cma-book">Talk with ${esc(first)}</a>
    <a class="btn sec ghost" href="${esc(search)}" data-rr-track="cma-search">See homes for sale near you</a>`
}

/**
 * The two lines beside the buttons. What happens if they tap, in plain words —
 * the closing chapter was 300px of content floated into 1,400px of navy, and
 * the only place the document asks for anything said nothing about what it was
 * asking for.
 */
export function nextStepNoteHtml(a: OpinionPageArgs): string {
  const place = cleanText(a.subject.city) ?? 'your area'
  // "We", not the signing broker's first name: a re-brand replaces the
  // signature block and must leave every figure and every sentence identical
  // (W10.3), and VOICE.md says we outside the signed closing anyway.
  if (closingIsNonSoliciting(a)) {
    return `<p class="next-note">${esc(
      `This is what the sales say your home is worth today. The link opens every home for sale in ${place} on our site.`,
    )}</p>
  ${closingComplianceHtml(a)}`
  }
  return `<p class="next-note">${esc(
    'Bring this report. We will walk the house, price it against these same sales, and tell you what would have to change to sell it. There is nothing to sign for that.',
  )}</p>
  <p class="next-note">${esc(
    `If you would rather look first, the second link opens every home for sale in ${place} on our site.`,
  )}</p>
  ${closingComplianceHtml(a)}`
}

/** The signature, the licence, the date, and the one disclosure sentence. */
export function nextStepSignatureHtml(a: OpinionPageArgs): string {
  const b = a.broker
  if (!b) return ''
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
  const headshot = b.photoUrl
    ? b.photoUrl.startsWith('http')
      ? b.photoUrl
      : `${site}${b.photoUrl}`
    : null
  const client = cleanText(a.client?.name ?? null)
  return `<div class="signature-page">
    ${headshot ? `<img class="portrait" src="${esc(headshot)}" alt="${esc(b.displayName)}" />` : '<div></div>'}
    <div class="sig-content">
      <div class="sig-name">${esc(b.displayName)}</div>
      <div class="sig-printed">${esc(b.displayName)}</div>
      <div class="sig-title">${esc(b.title)} · Ryan Realty</div>
      <div class="sig-contact">
        ${b.phone ? `<strong>${phoneHref(b.phone) ? `<a href="tel:${phoneHref(b.phone)}">${esc(dottedPhone(b.phone) ?? b.phone)}</a>` : esc(dottedPhone(b.phone) ?? b.phone)}</strong><br/>` : ''}
        ${b.email ? `<a href="mailto:${esc(b.email)}">${esc(b.email)}</a><br/>` : ''}
        ryan-realty.com · Bend · Oregon
      </div>
      ${b.licenseNumber ? `<div class="sig-license">Oregon Real Estate License # ${esc(b.licenseNumber)}</div>` : ''}
    </div>
  </div>
  <p class="fine">${esc(
    `Prepared ${dateLong(a.generatedAtIso)}${client ? ` for ${client}` : ''}. This is a pricing report. It is not an appraisal.`,
  )}</p>`
}

/**
 * MATRIX 3. Who you would compete with at the recommended list.
 *
 * Delta 3: "This is who your competition is right now in the same area at the
 * recommended price point: these people are here at this price, it doesn't
 * mean they're going to sell at this price." The four-up card grid became the
 * same matrix the other two chapters use — the counts, the cut line and the
 * source trace still open the chapter, because they are what a reader checks
 * the table against.
 */
export function competitionBodyMatrixHtml(a: OpinionPageArgs): string {
  const b = a.extras?.band
  if (!b) return ''
  const sets = matrixEntriesFor(a)
  const args = competitionArgs(a)
  const range = pathRangeFor(a)
  // THE COUNTS SURVIVE AN EMPTY MATRIX. How many homes are for sale in this
  // range, and how many are under contract, is the chapter's own figure — it
  // comes off `extras.band`, not off the named rivals — so a document whose
  // row carries no named competitor still tells a seller what they are up
  // against, and simply prints no table.
  const matrix =
    sets.active.length > 0
      ? renderMatrixHtml({
          id: 'competition',
          family: 'active',
          heading: 'Asking in this range now',
          lead: activeMatrixLead(sets.active, { lo: b.lo, hi: b.hi }),
          entries: [sets.subject, ...sets.active],
          range,
        })
      : ''
  const sentence = competitionSentence({
    lo: b.lo,
    hi: b.hi,
    activeCount: b.activeCount,
    pendingCount: b.pendingCount,
    shown: sets.active.length,
  })
  const cut = competitorCutLine(args.rivals)
  return `<p>${esc(sentence)}</p>
  ${cut ? `<p>${esc(cut)}</p>` : ''}
  <p class="small">${esc(competitionSourceLine(args))}</p>
  ${matrix}`
}

export function competitionPage(a: OpinionPageArgs): CmaPageDef | null {
  const body = competitionBodyMatrixHtml(a)
  if (!body.trim()) return null
  return {
    meta: `${esc(a.subject.streetAddress)} · At this price`,
    toc: competitionHeading(a.pricing.recommended),
    body: `
  <h2 class="section">${esc(competitionHeading(a.pricing.recommended))}</h2>
  ${body}`,
  }
}

/** Shared by the letter chapter and its immersive twin. */
export function competitionArgs(a: OpinionPageArgs): BandRivalsInput {
  const b = a.extras!.band!
  return {
    city: a.subject.city,
    lo: b.lo,
    hi: b.hi,
    activeCount: b.activeCount,
    pendingCount: b.pendingCount,
    rivals: b.rivals ?? [],
    docLinks: a.docLinks ?? null,
    recommendedList: a.pricing.recommended,
    asOfIso: a.generatedAtIso,
    subject: {
      beds: a.subject.beds,
      baths: a.subject.baths,
      sqft: a.subject.sqft,
      yearBuilt: a.subject.yearBuilt,
      lotAcres: a.subject.lotAcres,
      recommendedList: a.pricing.recommended,
      latitude: a.subject.latitude,
      longitude: a.subject.longitude,
      photoUrl: a.subject.photoUrl,
      listingHistoryLine: a.subject.listingHistoryLine,
      daysOnMarket: daysOnMarketFrom({ onMarketDate: a.subject.lastListDate }),
    },
  }
}



/**
 * ONE chapter order, walked by both documents.
 *
 * THE BLUEPRINT SUPERSEDES THE SPINE HERE (docs/plans/CMA_REIMAGINED_2026-09-07.md,
 * Matt 2026-09-07: "it does not flow and looks awful. reimagine it"). The old
 * thirteen-chapter order answered every question the engine could answer. This
 * one answers the three a homeowner opening a failed listing on a phone
 * actually has, in the order they ask them:
 *
 *   1. what happened to my listing, in one picture
 *   2. in this market, priced right sells and priced high sits
 *   3. what is it worth, what proves it, what do I do next
 *
 * Cut, deliberately, because they serve none of the three: the property-facts
 * table (Home location), the drawn lot outlines (The land), the subdivision
 * year table (Your street) and the permit list. The subdivision survives as
 * ONE line inside chapter 5, which is all of it a seller reads.
 *
 * `disclosure` is not a blueprint chapter and stays anyway: this document is
 * prepared by a licensed Oregon principal broker under ORS 696 and
 * OAR 863-015-0190, and the statutory paragraphs are not a chapter we get to
 * cut for flow. It sits immediately before the closing, which carries the
 * signature, the licence and the not-an-appraisal sentence the blueprint
 * names.
 *
 * An asked origin (someone who requested a value) has no failed listing, so
 * chapter 1 returns null and the order closes over it.
 */
/**
 * DELTA 3'S ORDER, 2026-09-08. The answer, where it is, and then the three
 * sets of evidence in the order Matt tells them at the table:
 *
 *   cover → what happened → the number → the map → the closed sales that set
 *   it → the listings that came off unsold → who is asking now → what price
 *   and time look like here → the market → net → basis → next step
 *
 * What moved and why: the number now arrives BEFORE its evidence rather than
 * after two chapters of argument, the one map sits under it so every set that
 * follows has a place, and the three matrices run closed → unsold → active
 * because that is the order the argument needs — this is what sold, this is
 * what did not, this is who you are up against.
 */
export const OPINION_CHAPTER_ORDER = [
  'what-happened',
  'what-its-worth',
  'the-map',
  'sales-that-set-it',
  'did-not-sell',
  'competition',
  'priced-right',
  'this-market',
  'net-at-list',
  'disclosure',
  'next-step',
] as const

export type OpinionChapterId = (typeof OPINION_CHAPTER_ORDER)[number]


export function assembleOpinionPages(a: OpinionPageArgs): CmaPageDef[] {
  const build: Record<OpinionChapterId, () => CmaPageDef | null> = {
    'what-happened': () => whatHappenedPage(a),
    'did-not-sell': () => didNotSellPage(a),
    'priced-right': () => pricedRightPage(a),
    'what-its-worth': () => pricingPage(salesThatSetItArgs(a)),
    'the-map': () => theMapPage(a),
    'sales-that-set-it': () => salesThatSetItPage(salesThatSetItArgs(a)),
    competition: () => competitionPage(a),
    'this-market': () => thisMarketPage(a),
    'net-at-list': () => sellerNetPage(a),
    disclosure: () => disclosurePage(a),
    'next-step': () => nextStepPage(a),
  }
  const pages: CmaPageDef[] = []
  for (const id of OPINION_CHAPTER_ORDER) {
    const page = build[id]()
    if (page) pages.push(page)
  }
  return pages
}

export { clientSourceLine }
