/**
 * The seller document's chapters, in print form. The cover stays in render.ts,
 * the immersive twin of every chapter here is in opinion-scenes.ts, and the
 * order both walk is OPINION_CHAPTER_ORDER at the bottom of this file.
 *
 * Chapters 0 to 7 of docs/plans/CMA_REIMAGINED_2026-09-07.md. A chapter omits
 * rather than printing an empty frame.
 */

import { siteOrigin } from '@/lib/site-origin'
import {
  COMPETITION_SHOWN_CAP,
  competitionAreaSourceLine,
  competitionHeading,
  competitionSentence,
  competitionSourceLine,
  competitorCutLine,
  nearestOpening,
  type BandRivalsInput,
} from '@/lib/cma/band-rivals'
import { noPeerInAreaSentence } from '@/lib/cma/market-status'
import { formatClientMlsField } from '@/lib/cma/client-facing'
import { trackedDocLink } from '@/lib/cma/doc-links'
import { daysOnMarketFrom } from '@/lib/cma/listing-history-line'
import { normalizeAgentSlug } from '@/lib/agent-attribution'
import { BRAND } from '@/lib/brand/contact'
import { TESTIMONIALS } from '@/lib/testimonials'
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
import { placePricingStoryHtml } from '@/lib/cma/place-pricing-story'
import type { PlacePricingStory } from '@/lib/cma/place-pricing-types'
import {
  cityDateCutsFightFlatLocal,
  compsWithoutCityDateMove,
  pricingWithoutCityDateMove,
} from '@/lib/cma/flat-date-story'
import { withoutNegligibleWeight } from '@/lib/cma/seller-letter-copy'
import { compWeightIndex } from '@/lib/cma/pricing-method'
import { preparedClosingLine } from '@/lib/cma/letter-privacy'
import { listingTimelinePhoneSvg, listingTimelineSvg, listingMarketSlopesPhoneSvg, listingMarketSlopesSvg } from '@/lib/cma/market-charts'
import {
  listingMarketSentence,
  listingMarketSlopes,
  listingMarketSource,
  type ListingMarketMove,
} from '@/lib/cma/listing-window-market'
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
  whatItsWorthSearchStory,
  worthRangeRounded,
  type PricingPageInput,
} from '@/lib/cma/render-pricing-page'
import { activeRivalsFor, unsoldPeersFor } from '@/lib/cma/matrix-sets'
import { letterProductMatch, productClass } from '@/lib/cma/market-area'
import { realSubdivisionName } from '@/lib/pricing/classes'
import { namedSalesPlace, salesAreaIsBounded } from '@/lib/pricing/comp-area'
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
import { statusPriceBoardHtml, statusPriceSummaries, splitActivePending } from '@/lib/cma/status-price-summary'
import type { LikeHomeCredit } from '@/lib/cma/like-home-credits'
import { sellerCostLines } from '@/lib/pricing/seller-net'
import { deRepeatRecommendDollars, isRecommendMark } from '@/lib/cma/recommend-once'
import { netAtExpectedSale, netCreditsSentence, type NetTwoColumns } from '@/lib/cma/expected-sale'
import { SALES_METHOD_LABEL, salesMethodSentences } from '@/lib/cma/sales-method-note'
import type { CmaBroker, CmaClient, CmaSellerNetLine } from '@/lib/cma/types'
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
import { askStepped, resolveAskPosition } from '@/lib/cma/ask-position'
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
  compArea?: import('@/lib/pricing/comp-area').CompArea | null
  expiredPeers?: import('@/lib/cma/market-status').CmaExpiredPeerSet | null
  bandRivals?: import('@/lib/cma/band-rivals').CmaBandRivalSet | null
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
  /**
   * What sale prices did while this home was listed, in the same place and
   * the same subtype as the sales. Absent when that place cannot say, and
   * never a parent polygon, the city, or N/A.
   */
  listingMarket?: ListingMarketMove | null
  /**
   * Twelve-month pricing in the parent neighborhood or community.
   * Absent, or a place with no listings, prints nothing on what happened.
   * Never the regional relist tiles.
   */
  placePricing?: PlacePricingStory | null
  /** Row status at serve. A draft replaces an automatic concession net. */
  documentStatus?: string | null
  /** Credits homes like this one actually gave. Drafts only. */
  likeHomeCredits?: Pick<LikeHomeCredit, 'sentence' | 'source'> | null
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
      exposure: askExposureFor(a),
    }),
    closed: closedEntries(
      a.comps.filter(
        (c) =>
          Boolean(c.address?.trim()) && letterProductMatch(a.subject.propertySubType, c.propertySubType),
      ),
      a.docLinks ?? null,
      a.subject,
    ),
    unsold: unsoldEntries(
      unsoldPeersFor({
        subject: a.subject,
        peers: a.expiredPeers?.peers ?? a.extras?.marketArea?.expiredPeers,
        area: a.compArea,
      }),
      a.docLinks ?? null,
      a.subject.city,
      a.subject,
    ),
    active: activeEntries(
      activeRivalsFor(
        a.bandRivals?.rivals ?? a.extras?.band?.rivals,
        a.subject,
        a.compArea ?? a.bandRivals?.area,
      ),
      a.docLinks ?? null,
      a.subject.city,
      a.subject,
    ),
  }
}

/** The worth range, shaded on every price path in every matrix. */
export function pathRangeFor(a: OpinionPageArgs): { low: number; high: number } | null {
  const worth = worthRangeRounded(a.pricing, a.comps)
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

/**
 * The sales and the pricing the grid prints, after the flat-date story.
 *
 * One resolution, so the price chapter, the net and the method paragraph in
 * Basis and limits read the same rows the reader can count.
 */
export function gridSales(a: OpinionPageArgs): {
  comps: CmaAdjustedComp[]
  pricing: CmaPricing
  negligibleWeightNote: string | null
} {
  const comps = a.comps ?? []
  const flat = cityDateCutsFightFlatLocal({
    ppsfMove: a.listingMarket?.ppsfMove ?? null,
    comps,
  })
  const datedComps = flat ? compsWithoutCityDateMove(comps) : comps
  const pricing = flat ? pricingWithoutCityDateMove(a.pricing, datedComps) : a.pricing
  const weighed = withoutNegligibleWeight(datedComps, compWeightIndex(pricing))
  return { comps: weighed.comps, pricing, negligibleWeightNote: weighed.note }
}

/** Chapter 3a. Matrix 1, and the working under it. */
export function salesThatSetItArgs(a: OpinionPageArgs): PricingPageInput {
  const sets = matrixEntriesFor(a)
  const weighed = gridSales(a)
  const pricing = weighed.pricing
  return {
    subject: a.subject,
    comps: weighed.comps,
    negligibleWeightNote: weighed.negligibleWeightNote,
    market: a.market,
    pricing,
    tiersUsed: a.tiersUsed,
    docLinks: a.docLinks,
    renderArgs: a,
    compTrace: a.compTrace,
    askCtx: subjectAskContext(a),
    finalCycle: a.expiredAudit?.finalCycle ?? null,
    asOfIso: a.generatedAtIso,
    rivals: activeRivalsFor(
      a.bandRivals?.rivals ?? a.extras?.band?.rivals,
      a.subject,
      a.bandRivals?.area ?? a.compArea,
    ).map((r) => ({
      address: r.address,
      yearBuilt: r.yearBuilt ?? null,
      listPrice: r.listPrice,
      sqft: r.sqft ?? null,
    })),
    statusPriceBoard: statusPriceBoardHtml(
      statusPriceSummaries({
        closed: closedEntries(weighed.comps, a.docLinks ?? null, a.subject),
        active: sets.active,
        unsold: sets.unsold,
      }),
    ),
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

/**
 * "What you keep" is only true when the loan payoff is on the sheet and
 * nothing else is still named as missing. Fees and title alone are not that.
 */
export function netIsEverything(sheet: SellerNetSheet | null): boolean {
  if (!sheet || sheet.unknowns.length > 0) return false
  return sheet.lines.some((l) => /payoff/i.test(l.label))
}

const ENGINE_NET_LINE = /^(Our fee|Buyer's agent|Title insurance|Seller concession)$/

/** A draft's automatic sheet. A hand-itemised sheet, with its own sources, stays. */
function replaceEngineNet(status: string | null | undefined, sheet: SellerNetSheet): boolean {
  const live = (status ?? '').toLowerCase()
  if (live !== 'draft' && live !== 'needs_review') return false
  return sheet.lines.length > 0 && sheet.lines.every((l) => ENGINE_NET_LINE.test(l.label))
}

/** The automatic sheet a draft prints, at the list on the stored sheet. */
function engineSheet(list: number): { list: number; lines: CmaSellerNetLine[]; net: number } {
  const lines = sellerCostLines(list)
  const net = Math.max(0, Math.round(list) - lines.reduce((sum, l) => sum + l.amount, 0))
  return { list: Math.round(list), lines, net }
}

/**
 * THE LIST COLUMN'S HEAD. The cover owns the recommended dollars
 * (lib/cma/recommend-once.ts), so a sheet at the recommend says "At the list
 * price" and prints no dollar figure for it. A cell reading "that price" in
 * the money column looked like a bug on screen (Matt 2026-10-07). A sheet at
 * any other price names it.
 */
function netListHeader(list: number, rec: number): string {
  return isRecommendMark(list, rec) ? 'At the list price' : `At ${usd(list)}`
}

/**
 * Right-aligned over the money it heads, in both stylesheets. `width:auto`
 * because both stylesheets give every netsheet `th` 62 percent, and Chrome
 * reads a first-row cell width beside the colgroup's: two heads at 62 percent
 * squeezed the label column to 28 percent and wrapped "Buyer's agent" at 375.
 * The left padding keeps two wrapped heads from reading as one line at 375.
 */
const NET_HEAD_STYLE =
  'width:auto;text-align:right;padding-right:0;padding-left:12px;vertical-align:bottom;white-space:normal'

function netHead(columns: readonly string[]): string {
  return `<thead><tr><th scope="col" style="width:auto"></th>${columns
    .map((c) => `<th scope="col" style="${NET_HEAD_STYLE}">${esc(c)}</th>`)
    .join('')}</tr></thead>`
}

function netCost(amount: number): string {
  return esc(`${amount < 0 ? '+' : '−'}${usd(Math.abs(amount))}`)
}

const NET_BEFORE_ESCROW = "Before the escrow company's fee and what you still owe on the home."

/**
 * TWO COLUMNS: the list, and the sale the evidence expects (Matt 2026-10-07).
 *
 * "Net at list" alone assumed a full-price sale, while the same report says
 * homes are closing under their first ask. The second column recomputes every
 * line at the expected sale with the same formula the list column was written
 * with (`sellerCostLines`, the same fee percentages and the same Oregon
 * owner's-policy rate). Its credits line explains why no concession is
 * subtracted a second time (lib/cma/expected-sale.ts `netAtExpectedSale`).
 */
function netTwoColumnsHtml(t: NetTwoColumns, rec: number): string {
  const rows = t.lines
    .map(
      (l) =>
        `<tr><th scope="row">${esc(l.label)}<span class="ln-src">${esc(l.source)}</span></th><td class="v">${netCost(
          l.atList,
        )}</td><td class="v">${netCost(l.atExpected)}</td></tr>`,
    )
    .join('\n    ')
  const credits = netCreditsSentence(t)
  return `<table class="kv netsheet net-two" style="table-layout:fixed;max-width:760px">
    <colgroup><col style="width:40%"><col style="width:30%"><col style="width:30%"></colgroup>
    ${netHead([netListHeader(t.list, rec), `If it sells near ${usd(t.expected.price)}`])}
    <tbody>
    ${rows}
    <tr class="is-net"><th scope="row">Left from the sale</th><td class="v">${usd(t.netAtList)}</td><td class="v">${usd(
      t.netAtExpected,
    )}</td></tr>
    </tbody>
  </table>
  ${credits ? `<p class="small">${esc(credits)}</p>` : ''}
  <p class="small">${esc(`Both columns are ${NET_BEFORE_ESCROW.charAt(0).toLowerCase()}${NET_BEFORE_ESCROW.slice(1)}`)}</p>`
}

/**
 * The net at the list and at the expected sale, when both can be added up
 * from the row. Null means the chapter prints its one list column.
 */
export function sellerNetColumns(a: OpinionPageArgs): NetTwoColumns | null {
  const sheet = sellerNetSheetForDoc(a)
  if (!sheet) return null
  const grid = gridSales(a)
  const base = replaceEngineNet(a.documentStatus, sheet) ? engineSheet(sheet.list) : sheet
  return netAtExpectedSale({ pricing: grid.pricing, comps: grid.comps, sheet: base })
}

/** The chapter title. A list-only sheet is a net at list; two columns are not. */
export function sellerNetHeading(a: OpinionPageArgs): string {
  return sellerNetColumns(a) ? 'Net from the sale' : 'Net at list'
}

/** The eyebrow over the immersive twin. Never "What you keep" on a partial net. */
export function sellerNetKick(a: OpinionPageArgs): string {
  return netIsEverything(sellerNetSheetForDoc(a)) ? 'What you keep' : sellerNetHeading(a)
}

/** One list column, the stored sheet or a draft's automatic one. */
function netOneColumnHtml(
  sheet: Pick<SellerNetSheet, 'list' | 'lines' | 'net'> & Partial<Pick<SellerNetSheet, 'sentence' | 'basis' | 'unknowns'>>,
  rec: number,
  opts: { engine: boolean },
): string {
  const everything = !opts.engine && netIsEverything(sheet as SellerNetSheet)
  const sentence = sheet.sentence ? deRepeatRecommendDollars(sheet.sentence, rec) : ''
  // A stored source names the price it was worked at ("3% of $639,000"); the
  // header already says which price, and the cover owns those dollars.
  const rows = sheet.lines
    .map(
      (l) =>
        `<tr><th scope="row">${esc(l.label)}<span class="ln-src">${esc(
          deRepeatRecommendDollars(l.source, rec, 'the list price'),
        )}</span></th><td class="v">${netCost(l.amount)}</td></tr>`,
    )
    .join('\n    ')
  const unknowns = (sheet.unknowns ?? []).filter((u) => u.trim())
  const tail = opts.engine
    ? `<p>${esc(NET_BEFORE_ESCROW)}</p>`
    : `${sheet.basis && sheet.basis !== 'list' ? `<p class="small">${esc(sheet.basis)}</p>` : ''}
  ${everything || unknowns.length === 0 ? '' : `<p>${esc(`This does not include ${orList(unknowns)}.`)}</p>`}`
  return `${sentence ? `<p>${esc(sentence)}</p>` : ''}
  <table class="kv netsheet">
    ${netHead([netListHeader(sheet.list, rec)])}
    <tbody>
    ${rows}
    <tr class="is-net"><th scope="row">${esc(everything ? 'What you keep' : 'Left from the sale')}</th><td class="v">${usd(
      sheet.net,
    )}</td></tr>
    </tbody>
  </table>
  ${tail}`
}

export function sellerNetBodyHtml(a: OpinionPageArgs): string {
  const rec = a.pricing.recommended
  const sheet = sellerNetSheetForDoc(a)
  if (!sheet) {
    const named = readSellerNetUnknowns(a.pricing)
    const needs = named.length > 0 ? named : NET_AT_LIST_REQUIRES
    return `<p>${esc(
      `A net at that price needs ${orList(
        needs,
      )}. None of those is in the record this report reads. We put them in writing, against a real list price, before anything is signed.`,
    )}</p>`
  }
  const engine = replaceEngineNet(a.documentStatus, sheet)
  const credits = engine && a.likeHomeCredits?.sentence
    ? `<p>${esc(a.likeHomeCredits.sentence)}</p>${
        a.likeHomeCredits.source ? `<p class="small">${esc(a.likeHomeCredits.source)}</p>` : ''
      }`
    : ''
  const two = sellerNetColumns(a)
  if (two) {
    const sentence = !engine && sheet.sentence ? deRepeatRecommendDollars(sheet.sentence, rec) : ''
    const unknowns = engine ? [] : sheet.unknowns.filter((u) => u.trim())
    return `${sentence ? `<p>${esc(sentence)}</p>` : ''}
  ${netTwoColumnsHtml(two, rec)}
  ${unknowns.length > 0 ? `<p>${esc(`This does not include ${orList(unknowns)}.`)}</p>` : ''}
  ${credits}`
  }
  return `${netOneColumnHtml(engine ? engineSheet(sheet.list) : sheet, rec, { engine })}
  ${credits}`
}

export function sellerNetPage(a: OpinionPageArgs): CmaPageDef | null {
  // No sheet on the row at all: the build never priced a net, so there is no
  // chapter. The "what a net would need" sentence is for a sheet that exists
  // and cannot be added up, not for a row that never carried one.
  if (a.pricing.sellerNet == null) return null
  const heading = sellerNetHeading(a)
  return {
    meta: `${esc(a.subject.streetAddress)} · ${esc(heading)}`,
    toc: heading,
    body: `
  <h2 class="section">${esc(heading)}</h2>
  ${sellerNetBodyHtml(a)}`,
  }
}





/**
 * Chapter 1. What happened.
 *
 * Blueprint: "You asked $460,000 and did not sell." THEIR listing as a timeline
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
 * What happened in the parent place, under the ask chart.
 *
 * A neutral chapter states the ask, the range and the days and stops. That
 * includes a home on the market with another brokerage, and an ask that sat
 * below the range (round-four class B). Either one returns nothing here.
 *
 * When the row carries a parent place with listings, print that story. When
 * it does not, print nothing. Do not fall back to the regional relist tiles.
 */
export function failedAskBacktestHtml(a: OpinionPageArgs, doc: 'letter' | 'immersive'): string {
  if (storyClassFor(a) === 'neutral') return ''
  return placePricingStoryHtml(a.placePricing, doc)
}

/**
 * The §0 trace for the regional relist pairs.
 *
 * The what-happened page does not print this. A city that is too thin still
 * names the same pairs, as regional, in the did-not-sell chapter.
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
    rangeLabel: `where homes like yours sold, ${adjustedForClause(a.comps)}`,
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
  ${listingMarketHtml(a.listingMarket)}
  ${reading ? `<p class="chart-read">${esc(reading)}</p>` : ''}`
}

/**
 * The market during the listing, under the ask line.
 *
 * The picture is two slopes in one comparison — the sale price, then the
 * price per square foot — because those are two units. The dates and the
 * median size are said once. The sentence states both moves, and the size
 * when that is what makes them disagree. The parent-place story, when the
 * row has one, is the block under this chart.
 */
function listingMarketHtml(move: ListingMarketMove | null | undefined): string {
  if (!move) return ''
  if (!realSubdivisionName(move.place)) return ''
  const sentence = listingMarketSentence(move)
  const drawn = { ...listingMarketSlopes(move), caption: sentence }
  const wide = listingMarketSlopesSvg(drawn)
  const phone = listingMarketSlopesPhoneSvg(drawn)
  if (!wide) return ''
  return `<div class="szn timeline-wide">${wide}</div>
  ${phone ? `<div class="szn timeline-phone">${phone}</div>` : ''}
  <p class="chart-read">${esc(sentence)}</p>
  <p class="small">${esc(listingMarketSource(move))}</p>`
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
 * "You asked $460,000 and did not sell." is the blueprint's line, in the
 * second person VOICE.md asks for, and it is
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
  const position = resolveAskPosition({
    lastListPrice: a.subject.lastListPrice,
    originalListPrice: a.subject.originalListPrice,
    exposure,
  })
  if (status?.isActiveWithOtherBrokerage) {
    const ask = position.lastAsk
    return ask != null && ask > 0 ? `Your home is listed at ${usd(ask)}.` : 'Where your listing stands.'
  }
  const lastSegmentAsk = exposure?.segments.length ? exposure.segments[exposure.segments.length - 1]?.ask : null
  const exposureAgrees = position.lastAsk == null || lastSegmentAsk === position.lastAsk
  if (exposure && exposure.segments.length > 1 && exposureAgrees) {
    const sentence = askExposureSentence(exposure.segments)
    if (sentence) {
      const original = position.originalAsk
      const dollars = original != null && original > 0 ? usd(original) : null
      if (dollars && !sentence.includes(dollars)) return `You first asked ${dollars}. ${sentence}`
      return sentence
    }
  }
  if (askStepped(position)) {
    return `You first asked ${usd(position.originalAsk!)}. The last listing asked ${usd(position.lastAsk!)} and did not sell.`
  }
  const ask = position.lastAsk ?? position.originalAsk
  return ask != null && ask > 0
    ? `You asked ${usd(ask)} and did not sell.`
    : 'Your home came off the market without selling.'
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
 * The ask the gap sentence is measured against: the last ask, the price the
 * listing came off at. The exposure heading still names every ask and how
 * long it ran. Measuring the percent-above line off the original list (the
 * price that ran the most days) disagreed with the email and the tables,
 * which use the last ask.
 *
 * Null when there is no failed listing.
 */
export function failedAskForStory(a: OpinionPageArgs): number | null {
  if ((a.expiredAudit?.findings.length ?? 0) === 0) return null
  const exposure = askExposureFor(a)
  const position = resolveAskPosition({
    lastListPrice: a.subject.lastListPrice,
    exposure: exposure ? { segments: exposure.segments, final: exposure.final } : null,
  })
  if (position.lastAsk != null && position.lastAsk > 0) return position.lastAsk
  const cycle = a.expiredAudit?.finalCycle ?? null
  const lastCut = [...(cycle?.cuts ?? [])].reverse().find((c) => c.ask > 0)?.ask ?? null
  const ask = lastCut ?? cycle?.finalAsk ?? cycle?.initialAsk ?? null
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
  // The sales already sit in a subdivision or a recorded plat. The citywide
  // bars, including the count of homes that failed somewhere in the city,
  // are a different place. The days on this letter's own sales can stay.
  const named = namedSalesPlace(a.compArea)
  const timing = named ? '' : renderOfferTimingHtml({ market: a.market, subject: a.subject, bare: true })
  const outcome = named ? '' : renderAskOutcomeHtml({ market: a.market, subject: a.subject, bare: true })
  // The days strip stands in for 2a when the 12-month curve is not on the row.
  const daysStrip = timing
    ? ''
    : renderDaysToOfferHtml({ subject: a.subject, comps: a.comps, market: a.market })
  const realization = named ? '' : renderAskRealizationHtml({ market: a.market, subject: a.subject, bare: true })
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
  const source = named ? '' : chapter2bSourceLine({ market: a.market })
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
    peers: a.expiredPeers?.peers ?? a.extras?.marketArea?.expiredPeers,
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
  const lead0 = didNotSellLeadSentence({
    market: a.market,
    city: a.subject.city,
    compArea: a.compArea,
  })
  if (sets.unsold.length === 0) {
    // NO PEERS ON THE ROW, AND THE SELLER'S OWN LISTING IS STILL ONE OF THEM.
    // A one-column matrix is not a comparison, so the chapter degrades to the
    // city's own count and the reader's own outcome rather than vanishing and
    // taking the ask that failed with it.
    //
    // The stored sentence prints only when it counts what is shown, and here
    // nothing is: a stored count of zero (rule 17). A row whose peers all
    // fell to the sales-area re-test above (an old row read over a wider
    // ring) would otherwise say "Three homes like yours in High Pointe, Owls
    // and Oakview came off..." over no table and no pins. Delivered letters
    // re-render from stored render_args at serve, so the check lives here.
    // That row gets the build's zero sentence naming no place, or nothing
    // when the subject itself came off, as the build does.
    const ownFailed = subjectListingFailed(a.subject) && Boolean(sets.subject.outcome)
    const storedSentence = a.expiredPeers?.sentence?.trim() ?? ''
    const storedCount = a.expiredPeers ? (a.expiredPeers.count ?? a.expiredPeers.peers?.length ?? 0) : 0
    const said = !a.expiredPeers
      ? ''
      : storedCount === 0
        ? storedSentence
        : ownFailed
          ? ''
          : noPeerInAreaSentence(a.expiredPeers.windowMonths)
    const saidHtml = said ? `<p>${esc(said)}</p>` : ''
    if (!ownFailed) {
      // The search ran and found nothing. Say so. A letter with no peer set
      // at all still omits the chapter.
      return saidHtml
    }
    const ask = sets.subject.lastAsk
    const own = `Your own listing ${
      ask != null && ask > 0 ? `asked ${usd(ask)} and ` : ''
    }${sets.subject.outcome.charAt(0).toLowerCase()}${sets.subject.outcome.slice(1)}.`
    // The owner's own failed listing is not a substitute for an empty search.
    return `${lead0 ? `<p class="chart-read">${esc(lead0)}</p>` : ''}
  <p>${esc(own)}</p>
  ${saidHtml}`
  }
  const range = pathRangeFor(a)
  const matrix = renderMatrixHtml({
    id: 'did-not-sell',
    family: 'unsold',
    heading: 'The listings in this area that came off unsold',
    // The area set's own sentence first (how many came off inside the comp
    // area, over which window, and whether it fell short), then the matrix lead.
    lead: [
      (() => {
        // The peer sentence is the count, the places, and whether these homes
        // passed the sales rules. It prints only when the table is the set it
        // counted (rule 17): an old row whose stored sentence counted peers
        // outside the sales area prints the count it shows instead.
        const story = a.expiredPeers?.sentence?.trim() ?? ''
        if (story && sets.unsold.length === (a.expiredPeers?.count ?? 0)) return `<p>${esc(story)}</p>`
        const n = sets.unsold.length
        const line = `${countWord(n)} ${n === 1 ? 'listing' : 'listings'} came off without selling.`
        return `<p>${esc(line.charAt(0).toUpperCase() + line.slice(1))}</p>`
      })(),
      unsoldMatrixLead(sets.unsold, range),
    ]
      .filter(Boolean)
      .join('\n'),
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
  const board = renderInventoryBoardHtml(
    a.market,
    {
      recommended: a.pricing.recommended,
      subject: a.subject,
    },
    // The month line is the city's single-family median. A letter whose sales
    // sit in a named place does not substitute that line for its own chart.
    { drawCityTrend: !namedSalesPlace(a.compArea) },
  )
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
  const worth = worthRangeRounded(a.pricing, a.comps)
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
  // The street count is closed single-family sales. A townhouse or condo
  // letter does not print that line and call it this home.
  if (productClass(a.subject.propertySubType) === 'attached') return ''
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
export function adjustmentsMade(comps: readonly CmaAdjustedComp[] | null | undefined): string[] {
  const rows = comps ?? []
  const any = (pick: (c: CmaAdjustedComp) => number | null | undefined): boolean =>
    rows.some((c) => {
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

/**
 * HOW THE SALES WERE CHOSEN AND ADJUSTED (Matt 2026-10-07).
 *
 * The method that used to sit under the price chapter's headline, in plain
 * English, composed from the stored fields and the grid the reader sees
 * (lib/cma/sales-method-note.ts). It reads the same rows the price chapter
 * does (`gridSales`) and the same search story its heading came from
 * (`whatItsWorthSearchStory`), so the two chapters cannot tell different
 * stories about one set of sales.
 */
export function salesMethodHtml(a: OpinionPageArgs): string {
  if (!a.pricing || !a.subject) return ''
  const grid = gridSales(a)
  const { tail } = whatItsWorthSearchStory({
    subdivision: a.subject.subdivision,
    comps: grid.comps,
    tiersUsed: a.tiersUsed,
    renderArgs: a,
    compTrace: a.compTrace,
  })
  const sentences = salesMethodSentences({
    subject: a.subject,
    comps: grid.comps,
    pricing: grid.pricing,
    searchTail: tail,
  })
  if (sentences.length === 0) return ''
  return `<p><strong>${esc(SALES_METHOD_LABEL)}</strong> ${esc(sentences.join(' '))}</p>`
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
  <p><strong>What was looked at.</strong> This opinion reads the Oregon Data Share MLS record for your home and for every sale, listing and failed listing named in it: the recorded facts, the price history and the listing photographs${record}. Nobody walked through the inside of your home, or the inside of any home it is measured against. Facts you told us, where they are used, are labelled as yours and should be confirmed independently.</p>
  ${salesMethodHtml(a)}
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
  ${nextStepActionsHtml(a)}
  ${nextStepNoteHtml(a)}
  ${nextStepSignatureHtml(a)}`,
  }
}

/**
 * The failed-listing close. Matt 2026-10-05: sorry this go-around, the chance
 * to earn the business, a sit-down and the marketing plan. Do not assume they
 * will list with us. The short "glad to help" line is not this close.
 */
export const CLOSE_SORRY_HEADING = "We're sorry your home didn't sell this go-around."

/**
 * THE CLOSE IS TWO SHORT PARAGRAPHS (Matt 2026-10-07). The 10-05 close said
 * "would love the opportunity" twice and "earn" twice, and explained the
 * report the reader had just scrolled through. What stays is what Matt asked
 * for: the chance to earn the business, said once, a sit-down with the
 * marketing plan, and no assumption that they list with us. The action is the
 * button row under the heading, not a sentence.
 */
export const CLOSE_EARN_YOUR_BUSINESS =
  'If you decide to list again, we would love the opportunity to earn your business.'

export const CLOSE_SIT_DOWN =
  "We'd like to sit down with you, go through the house, and show you the detailed marketing plan we use."

export const CLOSE_NO_OBLIGATION =
  "There is nothing to sign and no obligation. Who you list with is your decision, and we're here for any questions about this report."

/**
 * Four review cards. Each line is a verbatim fragment of that Google review.
 * A fragment that is not in the published quote is dropped, not rewritten.
 * Audra Hedberg stays off the letter because her quote contains an em dash.
 * The card keeps class close-quote so the seller-text stripper still removes
 * the reviewer's words, including the name, from the plain-text surface.
 */
const CLOSE_REVIEWS_HEADING = "Here's what our clients have to say"

const CLOSE_REVIEWS_LINK = 'Read the rest of the Google reviews'

const CLOSE_REVIEW_CARDS: ReadonlyArray<{ author: string; lead: string; line: string }> = [
  {
    author: 'E Oster',
    lead: 'You will not be disappointed ....',
    line: "I'd highly recommend Matt Ryan as his attention to detail and art of the negotiations with data on both buyers/sellers is impressive.",
  },
  {
    author: 'Douglas Grant',
    lead: 'Matt is the best!!',
    line: 'Matt is the most professional, communicative, and honest Real Estate Broker I have ever worked with.',
  },
  {
    author: 'Gary Timms',
    lead: "We would not hesitate to recommend or use Matt's services again.",
    line: 'Matt did a great job helping us sell our home.',
  },
  {
    author: 'Doug Millard',
    lead: 'I highly recommend Ryan Realty for both buying and selling!',
    line: 'From the start of our journey to the end, Matt was right at every turn.',
  },
]

/** Decorative Google mark. Four paths, no external image. Not a gold accent. */
const GOOGLE_G_MARK = `<svg class="google-g" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77a6.6 6.6 0 0 1-3.71 1.06 6.6 6.6 0 0 1-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84A6.6 6.6 0 0 1 12 5.38z"/></svg>`

export function closeReviewsHtml(a: OpinionPageArgs): string {
  const picks = CLOSE_REVIEW_CARDS.flatMap((card) => {
    const found = TESTIMONIALS.find((t) => t.author === card.author && t.source === 'Google')
    if (!found || !found.quote.includes(card.lead) || !found.quote.includes(card.line)) return []
    return [{ author: found.author, lead: card.lead, line: card.line }]
  })
  if (picks.length === 0) return ''
  const href = trackedDocLink('site', 'https://ryan-realty.com/reviews', a.docLinks ?? UNADDRESSED_DOC_LINKS)
  const cards = picks
    .map(
      (t) =>
        `<blockquote class="close-quote"><p class="close-stars" aria-hidden="true">&#9733;&#9733;&#9733;&#9733;&#9733;</p><span class="close-sr">5 star Google review</span><p class="close-lead">${esc(t.lead)}</p><p class="close-line">${esc(t.line)}</p><cite>${esc(t.author)} · Verified Google review</cite></blockquote>`,
    )
    .join('')
  return `<div class="close-reviews"><p class="close-reviews-head">${esc(CLOSE_REVIEWS_HEADING)}</p><div class="close-review-row">${cards}</div><p class="close-reviews-more"><a href="${esc(href)}" data-rr-track="cma-reviews">${GOOGLE_G_MARK}${esc(CLOSE_REVIEWS_LINK)}</a></p></div>`
}

/** The failed-listing heading, or the neutral one when this document may not say the home failed. */
export function nextStepHeading(a: OpinionPageArgs): string {
  // A home on the market with another brokerage did not fail at anything, and
  // saying sorry about it is the opening line of a solicitation (class D).
  if (readSubjectStatus(a)?.isActiveWithOtherBrokerage) return 'What this report is.'
  return a.expiredAudit ? CLOSE_SORRY_HEADING : 'What happens next.'
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
 * The active listing still gets the non-solicitation sentence and one neutral
 * action. WITHDRAWN_AGREEMENT_SENTENCE stays exported so a letter can be
 * checked for its absence.
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
  // Matt 2026-10-06 dropped that sentence from the close.
  if (status.isWithdrawnNotExpired) return ''
  return ''
}

export function closingComplianceHtml(a: OpinionPageArgs): string {
  const sentence = closingComplianceSentence(a)
  return sentence ? `<p class="next-note is-compliance">${esc(sentence)}</p>` : ''
}

/**
 * The broker's own calendar, built once for every place the close links it.
 * The tracked `book` link carries the document's identity (`_pid`, `utm_*`),
 * and the calendar is keyed on the short slug: a CMA stores the web slug
 * (paul-stevenson), and leaving that on ?agent= opened Matt's book.
 */
function brokerBookHref(a: OpinionPageArgs): string | null {
  const b = a.broker
  if (!b) return null
  const bookUrl = new URL(trackedDocLink('book', '', a.docLinks ?? UNADDRESSED_DOC_LINKS))
  const agent = normalizeAgentSlug(b.slug)
  if (agent) bookUrl.searchParams.set('agent', agent)
  return bookUrl.toString()
}

function brokerFirstName(b: CmaBroker): string {
  return b.displayName.trim().split(/\s+/)[0] || 'us'
}

/**
 * THE ONE NEXT STEP (Matt 2026-10-07). The close used to end on a seven-row
 * contact table with no primary action, and its calendar link measured 82x42
 * on a phone. Now the heading is followed by one primary button, a time on the
 * signing broker's calendar, with Call and Text beside it on the same
 * published line the contact card prints. VOICE.md: a Call or Text control
 * says Call or Text.
 *
 * Every button carries `next-btn`, which both stylesheets hold to a 44px tap
 * target. The non-soliciting close keeps its single neutral action and never
 * asks for a meeting.
 */
export function nextStepButtonsHtml(a: OpinionPageArgs): string {
  if (closingIsNonSoliciting(a)) {
    const search = trackedDocLink('search', a.subject.city, a.docLinks ?? UNADDRESSED_DOC_LINKS)
    return `<a class="btn sec ghost next-btn" href="${esc(search)}" data-rr-track="cma-search">See homes for sale near you</a>`
  }
  const b = a.broker
  const book = brokerBookHref(a)
  if (!b || !book) return ''
  const buttons = [
    `<a class="btn pri next-btn" href="${esc(book)}" data-rr-track="cma-book">Pick a time with ${esc(brokerFirstName(b))}</a>`,
  ]
  const tel = phoneHref(b.phone)
  if (tel) {
    buttons.push(`<a class="btn sec ghost next-btn" href="tel:${tel}" data-rr-track="cma-call">Call</a>`)
    buttons.push(`<a class="btn sec ghost next-btn" href="sms:${tel}" data-rr-track="cma-text">Text</a>`)
  }
  return buttons.join('')
}

export function nextStepActionsHtml(a: OpinionPageArgs): string {
  const buttons = nextStepButtonsHtml(a)
  return buttons ? `<div class="cta-actions next-cta">${buttons}</div>` : ''
}

function reachRow(label: string, valueHtml: string): string {
  return `<div class="reach-row"><dt>${esc(label)}</dt><dd>${valueHtml}</dd></div>`
}

/**
 * The broker's contact card under the reviews. The calendar, Call and Text are
 * the buttons under the heading, so the card does not repeat them as three
 * rows: it prints the number once (a paper copy still has to show it), then
 * email, the office, the site and the listings. The number is the published
 * line, never a personal cell. Omitted entirely when the document may not ask
 * for the listing.
 */
export function nextStepReachHtml(a: OpinionPageArgs): string {
  if (closingIsNonSoliciting(a)) return ''
  const b = a.broker
  if (!b) return ''
  const ctx = a.docLinks ?? UNADDRESSED_DOC_LINKS
  const search = trackedDocLink('search', a.subject.city, ctx)
  const site = trackedDocLink('site', BRAND.url, ctx)
  const tel = phoneHref(b.phone)
  const shown = dottedPhone(b.phone)
  const rows: string[] = []
  if (shown) rows.push(reachRow('Phone', tel ? `<a href="tel:${tel}">${esc(shown)}</a>` : esc(shown)))
  if (b.email) rows.push(reachRow('Email', `<a href="mailto:${esc(b.email)}">${esc(b.email)}</a>`))
  rows.push(
    reachRow(
      'Office',
      `<a href="${esc(BRAND.social.googleBusinessProfile)}">${esc(BRAND.mailingAddress)}</a>`,
    ),
  )
  rows.push(reachRow('Website', `<a href="${esc(site)}">ryan-realty.com</a>`))
  rows.push(
    reachRow(
      'Listings',
      `<a href="${esc(search)}" data-rr-track="cma-search">See homes for sale near you</a>`,
    ),
  )
  const origin = siteOrigin()
  const photo = b.photoUrl
    ? `<img class="reach-photo" src="${esc(b.photoUrl.startsWith('http') ? b.photoUrl : `${origin}${b.photoUrl}`)}" alt="${esc(b.displayName)}" />`
    : ''
  return `<div class="reach-block">${photo}<dl class="reach">${rows.join('')}</dl></div>`
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
  if (a.expiredAudit) {
    return `<p class="next-note">${esc(`${CLOSE_EARN_YOUR_BUSINESS} ${CLOSE_SIT_DOWN}`)}</p>
  <p class="next-note">${esc(CLOSE_NO_OBLIGATION)}</p>
  ${closeReviewsHtml(a)}
  ${nextStepReachHtml(a)}
  ${closingComplianceHtml(a)}`
  }
  return `<p class="next-note">${esc(
    "If you decide to list again, we're glad to help. We're here for any questions you have.",
  )}</p>
  <p class="next-note">${esc(
    "Bring this report. We'll walk the house with you and talk through the price. There is nothing to sign for that.",
  )}</p>
  ${nextStepReachHtml(a)}
  ${closingComplianceHtml(a)}`
}

/** The signature, the licence, the date, and the one disclosure sentence. */
export function nextStepSignatureHtml(a: OpinionPageArgs): string {
  const b = a.broker
  if (!b) return ''
  return `<div class="keep-close">
  <div class="signature-page">
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
    preparedClosingLine({
      generatedAt: dateLong(a.generatedAtIso),
      streetAddress: a.subject.streetAddress,
    }),
  )}</p>
  </div>`
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
  // The area-scoped set (R2h) wins; the city-wide band is the fallback for
  // rows built before it landed.
  const b = a.bandRivals ?? a.extras?.band
  if (!b) return ''
  const sets = matrixEntriesFor(a)
  const args = competitionArgs(a)
  const range = pathRangeFor(a)
  // THE COUNTS SURVIVE AN EMPTY MATRIX. How many homes are for sale in this
  // range, and how many are under contract, is the chapter's own figure — it
  // comes off `extras.band`, not off the named rivals — so a document whose
  // row carries no named competitor still tells a seller what they are up
  // against, and simply prints no table.
  // FlexMLS flow: separate Active and Pending grids (same matrix craft).
  const { active: activeOnly, pending: pendingOnly } = splitActivePending(sets.active)
  const activeMatrix =
    activeOnly.length > 0
      ? renderMatrixHtml({
          id: 'competition-active',
          family: 'active',
          heading: 'Active: asking in this range now',
          lead: activeMatrixLead(activeOnly, { lo: b.lo, hi: b.hi }),
          entries: [sets.subject, ...activeOnly],
          range,
        })
      : ''
  const pendingClaimed = false
  const pendingLead =
    '<p class="chart-read">Under contract is not closed. These are still competing until they close.</p>'
  const pendingMatrix =
    pendingOnly.length > 0
      ? renderMatrixHtml({
          id: 'competition-pending',
          family: 'active',
          heading: 'Pending: under contract in this range',
          lead: pendingLead,
          entries: [sets.subject, ...pendingOnly],
          range,
        })
      : pendingClaimed
        ? `<h3 class="subhead">Pending: under contract in this range</h3>
  ${pendingLead}`
        : ''
  const matrix = [activeMatrix, pendingMatrix].filter(Boolean).join('\n  ')
  const drawnActive = activeOnly.length
  const drawnPending = pendingOnly.length
  const shown = drawnActive + drawnPending
  // The stored sentence names the area and counts the homes in the band that
  // passed the sales rules. It prints only when its counts are the table's
  // (rule 17):
  //   - the homes drawn for sale and under contract are the stored rivals,
  //   - the stored under-contract count is the number drawn,
  //   - an empty table goes with stored counts of zero for both,
  //   - "the nearest N" stands only when the area held more for sale than
  //     the cap let the table draw, and N is the number drawn for sale.
  // Anything else (an old mile-ring sentence over homes the render dropped,
  // a count the draw lost) gets the no-area sentence over the counts the
  // table shows. Delivered letters re-render here from stored render_args,
  // after the build's letter-consistency gate has run, so this is the check.
  const stored = a.bandRivals?.sentence?.trim() ?? ''
  const storedActive = (b.rivals ?? []).filter((r) => r.status === 'Active').length
  const storedPending = (b.rivals ?? []).filter((r) => r.status === 'Pending').length
  const sameRows =
    drawnActive === storedActive && drawnPending === storedPending && b.pendingCount === drawnPending
  const forSaleAgrees =
    shown === 0
      ? b.activeCount === 0 && b.pendingCount === 0
      : b.activeCount === drawnActive ||
        (drawnActive >= COMPETITION_SHOWN_CAP &&
          b.activeCount > drawnActive &&
          stored.startsWith(`${nearestOpening(drawnActive)} `))
  const useStored = stored.length > 0 && sameRows && forSaleAgrees
  const sentence = useStored
    ? stored
    : competitionSentence({
        lo: b.lo,
        hi: b.hi,
        activeCount: drawnActive,
        pendingCount: drawnPending,
        shown,
      })
  // The trace names what the sentence counted. A stored sentence keeps its
  // stored trace. The counts drawn instead are the homes inside the sales
  // area, so the trace names that area, never the wider ring an old row read.
  const sourceLine =
    !useStored && a.compArea && salesAreaIsBounded(a.compArea)
      ? competitionAreaSourceLine({ area: a.compArea, lo: b.lo, hi: b.hi, asOfIso: a.generatedAtIso })
      : (a.bandRivals?.source ?? competitionSourceLine(args))
  const cut = competitorCutLine(args.rivals)
  const edge = competitionEdge({
    subjectSqft: a.subject.sqft,
    recommended: a.pricing.recommended,
    competitors: [...activeOnly, ...pendingOnly],
    nonSoliciting: closingIsNonSoliciting(a),
  })
  return `<p>${esc(sentence)}</p>
  ${cut ? `<p>${esc(cut)}</p>` : ''}
  ${edge ? `<p class="compete-edge">${esc(edge.sentence)}</p>` : ''}
  <p class="small">${esc(sourceLine)}</p>
  ${matrix}`
}

/**
 * THE SELLING POINT THE CHAPTER WAS NOT SAYING (Matt 2026-10-07).
 *
 * On 2566 Keats, at the recommended list the home is bigger than every home in
 * the competition chapter and asks the least per square foot, and the chapter
 * printed both facts only as two rows of a table nobody adds up. This states
 * them in one sentence, and only the parts that are true:
 *
 *   - larger than every home drawn below, strictly, when every one of them
 *     has a living area on record
 *   - priced lower per square foot than every one of them, at the
 *     recommended list over the home's own living area, when every one has a
 *     list price too. The figures are rounded exactly as the matrix's List
 *     $/sqft row rounds them, and the claim needs the rounded figure to be
 *     lower, so the sentence can never print "$313, against $313".
 *
 * Either part alone prints alone. Neither, or any home below missing the
 * figure the claim needs, prints nothing: a comparison we cannot make against
 * every home shown is not made (CLAUDE.md §0). The recommended list is the
 * cover's figure and is not reprinted here (recommend-once); the derived
 * $/sqft is.
 *
 * `competitors` are the matrix entries the chapter draws, active and pending,
 * so the range quoted is the range a reader finds in the List $/sqft row.
 */
export type CompetitionEdge = {
  sentence: string
  largest: boolean
  lowestPpsf: boolean
  subjectPpsf: number | null
  competitorPpsf: { lo: number; hi: number } | null
}

export function competitionEdge(input: {
  subjectSqft: number | null | undefined
  recommended: number | null | undefined
  competitors: ReadonlyArray<Pick<MatrixEntry, 'sqft' | 'listPrice'>>
  /** A home listed with another brokerage: no "we recommend" in the sentence. */
  nonSoliciting?: boolean
}): CompetitionEdge | null {
  const sqft = input.subjectSqft
  const n = input.competitors.length
  if (n === 0 || sqft == null || !Number.isFinite(sqft) || !(sqft > 0)) return null
  const sized = input.competitors.every((c) => c.sqft != null && Number.isFinite(c.sqft) && c.sqft > 0)
  if (!sized) return null
  const largest = input.competitors.every((c) => sqft > (c.sqft as number))
  const rec = input.recommended
  const priced =
    rec != null &&
    Number.isFinite(rec) &&
    rec > 0 &&
    input.competitors.every((c) => c.listPrice != null && Number.isFinite(c.listPrice) && c.listPrice > 0)
  const subjectPpsf = priced ? Math.round((rec as number) / sqft) : null
  const theirs = priced
    ? input.competitors.map((c) => Math.round((c.listPrice as number) / (c.sqft as number)))
    : []
  const competitorPpsf = theirs.length > 0 ? { lo: Math.min(...theirs), hi: Math.max(...theirs) } : null
  const lowestPpsf = subjectPpsf != null && competitorPpsf != null && subjectPpsf < competitorPpsf.lo
  if (!largest && !lowestPpsf) return null

  const allBelow = n === 1 ? 'the one home below' : n === 2 ? 'both homes below' : `all ${int(n)} homes below`
  const anyOfThem = n === 1 ? 'that home' : n === 2 ? 'either of them' : 'any of them'
  const anyBelow =
    n === 1 ? 'the one home below' : n === 2 ? 'either of the 2 homes below' : `any of the ${int(n)} homes below`
  const atPrice = input.nonSoliciting ? 'at this price' : 'at the list price we recommend'
  const range =
    competitorPpsf == null
      ? ''
      : competitorPpsf.lo === competitorPpsf.hi
        ? usd(competitorPpsf.lo)
        : `${usd(competitorPpsf.lo)} to ${usd(competitorPpsf.hi)}`
  const size = `At ${int(sqft)} square feet, your home is larger than ${allBelow}`
  const sentence =
    largest && lowestPpsf
      ? `${size}, and ${atPrice} it is priced lower per square foot than ${anyOfThem}: ${usd(subjectPpsf!)}, against ${range}.`
      : largest
        ? `${size}.`
        : `${atPrice.charAt(0).toUpperCase()}${atPrice.slice(1)}, your home is priced lower per square foot than ${anyBelow}: ${usd(subjectPpsf!)}, against ${range}.`
  return { sentence, largest, lowestPpsf, subjectPpsf, competitorPpsf }
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
  const b = a.bandRivals ?? a.extras!.band!
  return {
    city: a.subject.city,
    lo: b.lo,
    hi: b.hi,
    activeCount: b.activeCount,
    pendingCount: b.pendingCount,
    rivals: activeRivalsFor(b.rivals, a.subject, a.compArea ?? a.bandRivals?.area),
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
/**
 * THREE ACTS first (Matt 2026-09-12): number → sales that prove it → next step.
 * priced-right / this-market stay AFTER the sales proof so charts do not bury
 * the number; Cos Falcon smoke did not require cutting them from the order.
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
