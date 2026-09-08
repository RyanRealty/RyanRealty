/**
 * Chapter 3. What your home is worth.
 *
 * docs/plans/CMA_REIMAGINED_2026-09-07.md: the number, the range under it, the
 * sales that set it as ONE table with linked addresses, the map, and the search
 * sentence. Nothing else. Every figure arrives from lib/pricing on
 * `render_args`; nothing here computes one.
 */

import { cleanText, escapeHtml, int, usd } from '@/lib/cma/render-blocks'
import { pricingRangeDisplay } from '@/lib/cma/pricing'
import { currentAskLine } from '@/lib/cma/cover-value'
import { describeCompSearch } from '@/lib/pricing/search-story'
import { renderCompMatrixHtml } from '@/lib/cma/comp-matrix'
import {
  compWeightIndex,
  renderPricingMethodHtml,
  renderRejectedSalesHtml,
} from '@/lib/cma/pricing-method'
import { adjustedCloseRange } from '@/lib/cma/market-area-chapters'
import { renderCompPinMapHtml } from '@/lib/cma/comp-pin-map'
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
  const range = `List between ${usd(pricing.conservative)} and ${usd(pricing.highEnd)}.`
  // A home that is on the market already has an ask. The blueprint gives that
  // case ONE line: what it is listed at, and what the sales support. The list
  // range is not repeated after it — on most live subjects it is the same two
  // numbers a second time.
  if (ON_MARKET.test(subject.standardStatus ?? '') && subject.lastListPrice != null && subject.lastListPrice > 0) {
    return `Listed at ${usd(subject.lastListPrice)}. The sales support ${usd(pricing.valueLow)} to ${usd(pricing.valueHigh)}.`
  }
  // A subject whose ASK is on the pricing row rather than its MLS status —
  // an owner-supplied ask on an off-market home. The blueprint puts that line
  // in this chapter too, beside the evidence, never blended into it. It used
  // to sit on the cover, which the blueprint gives one sentence.
  const ask = currentAskLine(pricing)
  const display = pricingRangeDisplay(pricing)
  const supported = display.outOfRange
    ? `${range} The sales support ${usd(pricing.valueLow)} to ${usd(pricing.valueHigh)}.${
        display.note ? ` ${display.note}` : ''
      }`
    : range
  return ask ? `${supported} ${ask}` : supported
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
  return `<p class="chart-read">${esc(
    `The ${n} closed ${n === 1 ? 'sale' : 'sales'} below set this number. Adjusted for ${adj.adjustments}, they land at ${usd(adj.low)} to ${usd(adj.high)}.`,
  )}</p>`
}

/** The per-square-foot check, as one line the seller can run against the table. */
function perSquareFootLine(input: { subject: CmaSubject; pricing: CmaPricing }): string {
  const sqft = input.subject.sqft
  const close = input.pricing.predictedClose
  if (sqft == null || !(sqft > 0) || close == null || !(close > 0)) return ''
  return `<p class="small">${esc(
    `Adjusted for date and size, these sales carry a median of ${usd(Math.round(close / sqft))} per square foot at ${int(sqft)} sq ft.`,
  )}</p>`
}

export function pricingPage(input: {
  subject: CmaSubject
  comps: CmaAdjustedComp[]
  market: CmaMarketContext | null
  pricing: CmaPricing
  tiersUsed?: string[]
  mapDataUri?: string | null
  docLinks?: TrackedDocLinkCtx | null
  /** Immersive hero already printed the number and the range — skip the lead. */
  omitLeadPrices?: boolean
}): CmaPageDef {
  const p = input.pricing
  const s = input.subject
  const search = describeCompSearch({ subdivision: s.subdivision, tiersUsed: input.tiersUsed ?? [] })
  const pinMap = renderCompPinMapHtml(s, input.comps, input.mapDataUri ?? null, 'Map of the sales that set this price')
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
  return {
    meta: `${esc(s.streetAddress)} · ${esc(heading)}`,
    toc: heading,
    body: `
  ${lead}
  ${input.omitLeadPrices ? `<p class="worth-lead">${esc(whatItsWorthLead(s, p))}</p>` : ''}
  ${method}
  ${renderCompMatrixHtml(
    s,
    input.comps,
    tableLead({ comps: input.comps, pricing: p }),
    input.docLinks,
    compWeightIndex(p),
  )}
  ${perSquareFootLine({ subject: s, pricing: p })}
  ${renderRejectedSalesHtml(p)}
  ${
    pinMap
      ? `<div class="pin-map-wrap">${pinMap}</div><p class="small">${esc(mapLegend(s.subdivision))}</p>`
      : ''
  }
`,
  }
}
