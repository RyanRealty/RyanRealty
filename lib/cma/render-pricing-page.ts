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
import { renderCompMatrixHtml, subjectListingFailed } from '@/lib/cma/comp-matrix'
import {
  compWeightIndex,
  renderPricingMethodHtml,
  renderReconciliationHtml,
  renderRejectedSalesHtml,
} from '@/lib/cma/pricing-method'
import { adjustedCloseRange } from '@/lib/cma/market-area-chapters'
import { renderCompPinMapHtml } from '@/lib/cma/comp-pin-map'
import { worthStripHtml } from '@/lib/cma/worth-strip'
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
export function whatItsWorthLead(subject: CmaSubject, pricing: CmaPricing): string {
  // THE VALUE RANGE, ONCE, HERE. tasteReview round two, §1 Words: chapter 3
  // stated it three times inside ten lines — the strip's reading to the
  // dollar, the method sentence rounded, and the table's lead to the dollar
  // again — and on the FSBO and land documents the cover's pair and the
  // chapter's pair were two different pairs (§3.F). This sentence is now the
  // only place the chapter states it, it reads `valueLow`/`valueHigh` (which
  // is what the cover reads), and it is rounded to the nearest thousand so the
  // two cannot print to different precisions.
  const worth = worthRangeSentence(pricing)
  const listRange = listRangeSentence(pricing)
  // A home that is on the market already has an ask. The blueprint gives that
  // case ONE line: what it is listed at, and what the sales support.
  if (ON_MARKET.test(subject.standardStatus ?? '') && subject.lastListPrice != null && subject.lastListPrice > 0) {
    return [`Listed at ${usd(subject.lastListPrice)}.`, worth, listRange].filter(Boolean).join(' ')
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

/** Nearest thousand. Never enough to move a narrative, always enough to match. */
function round1k(n: number): number {
  return Math.round(n / 1000) * 1000
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
 * The list range beside it — dropped when it is the same two numbers again.
 *
 * On 1617 NW 8th `conservative`/`highEnd` are `valueLow`/`valueHigh`, so the
 * old lead printed one pair twice in one sentence.
 */
function listRangeSentence(pricing: CmaPricing): string {
  const lo = round1k(Math.min(pricing.conservative, pricing.highEnd))
  const hi = round1k(Math.max(pricing.conservative, pricing.highEnd))
  if (!(lo > 0) || !(hi > 0)) return ''
  if (lo === round1k(Math.min(pricing.valueLow, pricing.valueHigh)) && hi === round1k(Math.max(pricing.valueLow, pricing.valueHigh))) {
    // Same two numbers. The instruction survives; the figures do not repeat.
    return 'List in that range.'
  }
  return lo === hi ? `List at ${usd(lo)}.` : `List between ${usd(lo)} and ${usd(hi)}.`
}

/**
 * WHICH SALES THE RANGE WAS NOT THE SPREAD OF, by their index in the grid.
 *
 * `pricing.rangeRule.rule` is the pricing unit's own record of what it did:
 * `trimmed-one-each-end` means the highest and the lowest adjusted sale were
 * set aside, which is the sentence it prints in the method block. Nothing is
 * decided here — the rule is read, and the two extremes it names are found in
 * the sales the grid already prints.
 */
function setAsideKeys(pricing: CmaPricing, comps: readonly CmaAdjustedComp[]): Set<number> {
  const out = new Set<number>()
  const rule = (pricing as unknown as { rangeRule?: { rule?: unknown } | null }).rangeRule
  if (!rule || typeof rule !== 'object' || rule.rule !== 'trimmed-one-each-end') return out
  const ranked = comps
    .map((c, i) => ({ i, v: c.adjustedPrice }))
    .filter((r) => r.v != null && Number.isFinite(r.v) && r.v > 0)
    .sort((a, b) => a.v - b.v)
  if (ranked.length < 4) return out
  out.add(ranked[0]!.i)
  out.add(ranked[ranked.length - 1]!.i)
  return out
}

/**
 * The map legend, written here rather than taken from `describeCompSearch`.
 *
 * `lib/pricing/search-story.ts` writes "The pins are the sales we kept", and
 * "kept" is banned seller copy (blueprint § Words). The pricing unit owns the
 * SEARCH, not the sentence a seller reads about it, so the legend is composed
 * from the same facts in the document's own voice.
 */
function mapLegend(subdivision: string | null | undefined): string {
  const name = cleanText(subdivision)
  return name
    ? `The pins are the sales above. The outline is ${name}, when that boundary is on file.`
    : 'The pins are the sales above.'
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
  const n = input.comps.length
  // NO SECOND RANGE HERE. This line used to print the span of every adjusted
  // sale to the dollar — the UNTRIMMED pair on a document whose cover, method
  // sentence and strip were all printing the trimmed one (tasteReview round
  // two, §3.F). The trimmed pair is the answer and it is stated once, in the
  // lead above; the untrimmed span belongs to the method sentence lib/pricing
  // writes, which says in its own words which sales it set aside.
  return `<p class="chart-read">${esc(
    `The ${countWord(n)} closed ${n === 1 ? 'sale' : 'sales'} below set this number, each moved for ${adj.adjustments}.`,
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

export function pricingPage(input: {
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
}): CmaPageDef {
  const p = input.pricing
  const s = input.subject
  const search = describeCompSearch({ subdivision: s.subdivision, tiersUsed: input.tiersUsed ?? [] })
  const pinMap = renderCompPinMapHtml(
    s,
    input.comps,
    input.mapDataUri ?? null,
    'Map of the sales that set this price',
    input.mapOverlay ?? null,
  )
  const heading = whatItsWorthHeading(p)
  const lead = input.omitLeadPrices
    ? ''
    : `
  <h2 class="section is-answer">${esc(heading)}</h2>
  <p class="worth-lead">${esc(whatItsWorthLead(s, p))}</p>`
  // The method comes BEFORE the evidence for it (Delta 1): which sales, how
  // each was adjusted, and how the range and the recommended list follow.
  // Every one of those sentences is written by lib/pricing and stored on the
  // row; nothing here composes one.
  const method = renderPricingMethodHtml({ pricing: p, whichSales: search.body })
  // The chapter's own conclusion, drawn, BEFORE the method that reached it and
  // the grid that proves it (tasteReview item 2). One glance lands where five
  // real sales put this house and where we would list it.
  const aside = setAsideKeys(p, input.comps)
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
    lastAsk:
      subjectListingFailed(s) && s.lastListPrice != null && s.lastListPrice > 0
        ? s.lastListPrice
        : null,
  })
  return {
    meta: `${esc(s.streetAddress)} · ${esc(heading)}`,
    toc: heading,
    body: `
  ${lead}
  ${input.omitLeadPrices ? `<p class="worth-lead">${esc(whatItsWorthLead(s, p))}</p>` : ''}
  ${strip}
  ${method}
  ${renderCompMatrixHtml(
    s,
    input.comps,
    tableLead({ comps: input.comps, pricing: p }),
    input.docLinks,
    compWeightIndex(p),
  )}
  ${concessionsCaption(input.comps)}
  ${renderReconciliationHtml(p)}
  ${perSquareFootLine({ subject: s, pricing: p })}
  ${renderRejectedSalesHtml(p, input.comps)}
  ${
    pinMap
      ? `<div class="pin-map-wrap">${pinMap}</div><p class="small">${esc(mapLegend(s.subdivision))}</p>`
      : ''
  }
`,
  }
}
