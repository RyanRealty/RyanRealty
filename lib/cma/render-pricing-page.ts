/**
 * Chapter 3. What your home is worth.
 *
 * docs/plans/CMA_REIMAGINED_2026-09-07.md: the number, the range under it, the
 * sales that set it as ONE table with linked addresses, the map, and the search
 * sentence. Nothing else. Every figure arrives from lib/pricing on
 * `render_args`; nothing here computes one.
 */

import { cleanText, countWord, escapeHtml, int, usd } from '@/lib/cma/render-blocks'
import { pricingRangeDisplay } from '@/lib/cma/pricing'
import { currentAskLine } from '@/lib/cma/cover-value'
import { describeCompSearch } from '@/lib/pricing/search-story'
import {
  renderCompMatrixHtml,
  subjectListingFailed,
  subjectPrintableAsk,
  type SubjectAskContext,
} from '@/lib/cma/comp-matrix'
import {
  compWeightIndex,
  renderPricingMethodHtml,
  renderReconciliationHtml,
  renderRejectedSalesHtml,
} from '@/lib/cma/pricing-method'
import { adjustedCloseRange } from '@/lib/cma/market-area-chapters'
import { renderCompPinMapHtml } from '@/lib/cma/comp-pin-map'
import { worthStripHtml } from '@/lib/cma/worth-strip'
import { clampSentence, keptCompCount, setAsideCompIndexes, setAsideRows } from '@/lib/cma/set-aside'
import { listCeiling, readMeasure, readRangeRuleKept } from '@/lib/cma/render-contract'
import { compSearchSentence } from '@/lib/cma/render-comp-search'
import type { TrackedDocLinkCtx } from '@/lib/cma/doc-links'
import type { CmaAdjustedComp, CmaMarketContext, CmaPricing, CmaSubject } from '@/lib/cma/types'
import type { CmaPageDef } from '@/lib/cma/render-use-of-property'

const esc = escapeHtml

const ON_MARKET = /^(active|pending|coming)/i

/** The chapter title IS the number. "$389,000." */
export function whatItsWorthHeading(pricing: CmaPricing): string {
  return `${usd(pricing.recommended)}.`
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
): string {
  // THE VALUE RANGE, ONCE, HERE. tasteReview round two, §1 Words: chapter 3
  // stated it three times inside ten lines — the strip's reading to the
  // dollar, the method sentence rounded, and the table's lead to the dollar
  // again — and on the FSBO and land documents the cover's pair and the
  // chapter's pair were two different pairs (§3.F). This sentence is now the
  // only place the chapter states it, it reads `valueLow`/`valueHigh` (which
  // is what the cover reads), and it is rounded to the nearest thousand so the
  // two cannot print to different precisions.
  const worth = worthRangeSentence(pricing)
  const listRange = listRangeSentence(pricing, failedSubjectAsk(subject, askCtx))
  // A home that is on the market already has an ask. The blueprint gives that
  // case ONE line: what it is listed at, and what the sales support.
  const liveAsk = subjectPrintableAsk(subject, askCtx)
  if (ON_MARKET.test(subject.standardStatus ?? '') && liveAsk != null && liveAsk > 0) {
    return [`Listed at ${usd(liveAsk)}.`, worth, listRange].filter(Boolean).join(' ')
  }
  // A subject whose ASK is on the pricing row rather than its MLS status —
  // an owner-supplied ask on an off-market home. The blueprint puts that line
  // in this chapter too, beside the evidence, never blended into it. It used
  // to sit on the cover, which the blueprint gives one sentence.
  const ask = currentAskLine(pricing)
  const display = pricingRangeDisplay(pricing)
  return [worth, listRange, display.outOfRange ? display.note : null, ask]
    .filter((b): b is string => Boolean(b && b.trim()))
    .join(' ')
}

/**
 * THE INDEX CLAUSE NAMES WHAT THE INDEX MEASURES (round-four class E).
 *
 * Chapter 3's method sentence says the market "rose to a peak in April";
 * chapter 5's month line, four screens later, draws April as the LOW month.
 * Both are true — one is a price-a-square-foot index, the other is the median
 * close price of every home in the city — and a reader who cannot see that
 * reads one document contradicting itself. `timeAdjustment.measure` is the
 * pricing side's own short phrase for what its index is an index OF; when the
 * row carries it, it prints in the same breath as the month.
 *
 * Nothing is invented when the field is absent: the sentence prints exactly as
 * lib/pricing wrote it.
 */
function pricingWithMeasure(pricing: CmaPricing): CmaPricing {
  const ta = (pricing as unknown as { timeAdjustment?: Record<string, unknown> | null })
    .timeAdjustment
  const measure = readMeasure(ta)
  const sentence = typeof ta?.sentence === 'string' ? ta.sentence.trim() : ''
  if (!measure || !sentence) return pricing
  if (sentence.toLowerCase().includes(measure.toLowerCase())) return pricing
  return {
    ...pricing,
    timeAdjustment: { ...ta, sentence: `${sentence} That index is ${measure}.` },
  } as unknown as CmaPricing
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
export function worthRangeRounded(pricing: CmaPricing): { low: number; high: number } {
  return {
    low: round1k(Math.min(pricing.valueLow, pricing.valueHigh)),
    high: round1k(Math.max(pricing.valueLow, pricing.valueHigh)),
  }
}

/** "The sales support $372,000 to $399,000." — the ONE statement of the range. */
function worthRangeSentence(pricing: CmaPricing): string {
  const lo = round1k(Math.min(pricing.valueLow, pricing.valueHigh))
  const hi = round1k(Math.max(pricing.valueLow, pricing.valueHigh))
  if (!(lo > 0) || !(hi > 0)) return ''
  return lo === hi
    ? `The sales support ${usd(lo)}.`
    : `The sales support ${usd(lo)} to ${usd(hi)}.`
}

/**
 * THE LIST RANGE THIS DOCUMENT IS ALLOWED TO PRINT, rounded once, here.
 *
 * `[conservative, min(highEnd, clamp.after)]`. Round-four class E: Concorde
 * carried three list ceilings across two screens — the cover's raw `highEnd`,
 * this chapter's raw `highEnd`, and the clamped recommendation between them —
 * and the highest of the three was $1,500,000, the ask that had just failed to
 * sell. `listCeiling` is the one resolution; the cover reads this same
 * function, so the two screens cannot disagree and neither can round
 * differently.
 *
 * Null when the row carries no usable pair. The chapter then states the worth
 * range alone rather than inventing a list.
 */
export function listRangeBounds(
  pricing: CmaPricing,
  failedAsk?: number | null,
): { low: number; high: number } | null {
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
  if (setAsideCompIndexes(pricing, comps).size > 0) return keptCompCount(pricing, comps)
  const stated = readRangeRuleKept(pricing)
  if (stated != null && stated > 0) return Math.min(stated, comps.length)
  return keptCompCount(pricing, comps)
}

/**
 * The list range beside it — dropped when it is the same two numbers again.
 *
 * On 1617 NW 8th `conservative`/`highEnd` are `valueLow`/`valueHigh`, so the
 * old lead printed one pair twice in one sentence.
 */
function listRangeSentence(pricing: CmaPricing, failedAsk: number | null): string {
  const bounds = listRangeBounds(pricing, failedAsk)
  if (!bounds) return ''
  const { low: lo, high: hi } = bounds
  if (lo === round1k(Math.min(pricing.valueLow, pricing.valueHigh)) && hi === round1k(Math.max(pricing.valueLow, pricing.valueHigh))) {
    // Same two numbers. The instruction survives; the figures do not repeat.
    return 'List in that range.'
  }
  return lo === hi ? `List at ${usd(lo)}.` : `List between ${usd(lo)} and ${usd(hi)}.`
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
function mapLegend(
  subdivision: string | null | undefined,
  boundaryShown?: boolean,
): string {
  const name = cleanText(subdivision)
  const pins = 'Every pin below is a row in one of the three tables that follow.'
  if (!name || boundaryShown === false) return pins
  return boundaryShown === true
    ? `${pins} The outline is ${name}.`
    : `${pins} The outline is ${name}, when that boundary is on file.`
}

/**
 * The reading, above the table. A table needs a sentence before the reader
 * enters it.
 *
 * Both ends of the range print in the table's own Sale price today row, so
 * this introduces no figure the seller cannot check, and no figure is computed
 * here — the adjusted sales and the recommend both arrive from lib/pricing.
 */
function tableLead(input: { comps: CmaAdjustedComp[]; pricing: CmaPricing }): string {
  const adj = adjustedCloseRange(input.comps)
  if (!adj || !adj.adjustments || !(input.pricing.recommended > 0)) return ''
  // ONE n FOR THIS CHAPTER. The strip's caption, this lead and the range
  // sentence lib/pricing writes were 7, 7 and 5 on 19968 and 4, 6 and 4 on
  // Concorde — three counts of one set inside one chapter (tasteReview round
  // three, §2 item 2). The number that means something is the count of sales
  // the price is over; the rest are shown, and said to be set aside.
  const n = keptSaleCount(input.pricing, input.comps)
  const aside = input.comps.length - n
  // NO SECOND RANGE HERE. This line used to print the span of every adjusted
  // sale to the dollar — the UNTRIMMED pair on a document whose cover, method
  // sentence and strip were all printing the trimmed one (tasteReview round
  // two, §3.F). The trimmed pair is the answer and it is stated once, in the
  // lead above; the untrimmed span belongs to the method sentence lib/pricing
  // writes, which says in its own words which sales it set aside.
  const asideWord = countWord(aside)
  const shown =
    aside > 0
      ? ` ${asideWord.charAt(0).toUpperCase()}${asideWord.slice(1)} more ${
          aside === 1 ? 'is' : 'are'
        } shown below and set aside.`
      : ''
  return `<p class="chart-read">${esc(
    `The ${countWord(n)} closed ${n === 1 ? 'sale' : 'sales'} below set this number, each moved for ${adj.adjustments}.${shown}`,
  )}</p>`
}

/**
 * What the concessions row is, and is not.
 *
 * tasteReview round two, §3.H: the row sits inside the adjustment grid,
 * between "Price history" and "Adjusted for date", and enters none of the
 * arithmetic below it — while chapter 6 takes the same figures off the
 * seller's net. A reader adding the column up has to know that.
 */
function concessionsCaption(comps: readonly CmaAdjustedComp[]): string {
  const any = comps.some((c) => {
    const v = c.concessions ?? c.concessionsAmount ?? null
    return v != null && Number.isFinite(v)
  })
  if (!any) return ''
  return `<p class="small">${esc(
    'Seller concessions are reported to the MLS. They are not part of the adjustments; they are used in Net at list.',
  )}</p>`
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
 * sentence names that basis. Predicted close stays off the seller document
 * (the Sunstone contract, `client-facing.ts` `includeExpectedClose`), so a rate
 * computed over it would be one the reader cannot reconcile to anything
 * printed — the same defect in a quieter form.
 */
function perSquareFootLine(input: { subject: CmaSubject; pricing: CmaPricing }): string {
  const sqft = input.subject.sqft
  const price = input.pricing.recommended
  if (sqft == null || !(sqft > 0) || price == null || !(price > 0)) return ''
  return `<p class="small">${esc(
    `At ${usd(price)} across ${int(sqft)} square feet, that is ${usd(Math.round(price / sqft))} per square foot.`,
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
  const search = describeCompSearch({ subdivision: s.subdivision, tiersUsed: input.tiersUsed ?? [] })
  // WHY THESE SALES. Never a shortage claim the printed grid refutes (class E).
  const whichSales = compSearchSentence({
    subdivision: s.subdivision,
    args: input.renderArgs,
    compTrace: input.compTrace ?? input.tiersUsed ?? null,
    comps: input.comps,
    fallback: search.body,
  })
  const heading = whatItsWorthHeading(p)
  // THE CLAMP, UNDER THE NUMBER IT MOVED. When the failed-ask clamp binds, the
  // printed price is not the one the method above it produces — Concorde
  // stated a method yielding $1,973,000 and printed $1,473,000 with nothing
  // between them (tasteReview round three, §2 item 1). lib/pricing writes the
  // sentence; it prints where the reader meets the number, and nowhere else.
  const clamp = clampSentence(p)
  const clampHtml = clamp ? `<p class="worth-lead-note">${esc(clamp)}</p>` : ''
  const lead = input.omitLeadPrices
    ? ''
    : `
  <h2 class="section is-answer">${esc(heading)}</h2>
  <p class="worth-lead">${esc(whatItsWorthLead(s, p, input.askCtx))}</p>
  ${clampHtml}`
  // The method comes BEFORE the evidence for it (Delta 1): which sales, how
  // each was adjusted, and how the range and the recommended list follow.
  // Every one of those sentences is written by lib/pricing and stored on the
  // row; nothing here composes one.
  const method = renderPricingMethodHtml({ pricing: pricingWithMeasure(p), whichSales })
  // The chapter's own conclusion, drawn, BEFORE the method that reached it and
  // the grid that proves it (tasteReview item 2). One glance lands where five
  // real sales put this house and where we would list it.
  const aside = setAsideCompIndexes(p, input.comps)
  const strip = worthStripHtml({
    sales: input.comps.map((c, i) => ({
      n: i + 1,
      address: c.address,
      adjustedPrice: c.adjustedPrice,
      setAside: aside.has(i),
    })),
    rangeLow: p.valueLow,
    rangeHigh: p.valueHigh,
    recommended: p.recommended,
    // ONLY AN ASK THAT FAILED. `lastListPrice` on a sold or a live subject is
    // not the mark this drawing makes: on 19968 it was a 2004 list price of
    // $140,000 drawn as "asked $140K" beside sales clustered $296K to $441K,
    // which stretched the axis by 40 percent and stated something untrue about
    // the home (tasteReview round two, §3.G).
    lastAsk: failedSubjectAsk(s, input.askCtx),
    keptCount: keptSaleCount(p, input.comps),
  })
  return {
    meta: `${esc(s.streetAddress)} · ${esc(heading)}`,
    toc: heading,
    body: `
  ${lead}
  ${input.omitLeadPrices ? `<p class="worth-lead">${esc(whatItsWorthLead(s, p, input.askCtx))}</p>
  ${clampHtml}` : ''}
  ${strip}
  ${method}
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
      footer: `${concessionsCaption(input.comps)}
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

export const MAP_HEADING = 'Where all of this is.'

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
    [area, mapLegend(input.subject.subdivision, input.mapOverlay?.boundaryShown)]
      .filter(Boolean)
      .join(' '),
  )}</p>`
}
