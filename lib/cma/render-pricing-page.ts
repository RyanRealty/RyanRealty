/**
 * CMA pricing section. One list sentence, one list strip, then the
 * matcher rules and the sales brought to this house.
 */

import { cleanText, dec, escapeHtml, int, usd } from '@/lib/cma/render-blocks'
import { clientFacingNotes, listPriceLead } from '@/lib/cma/client-facing'
import { pricingRangeDisplay } from '@/lib/cma/pricing'
import { describeCompSearch } from '@/lib/pricing/search-story'
import { renderCompMatrixHtml } from '@/lib/cma/comp-matrix'
import { adjustedCloseRange } from '@/lib/cma/market-area-chapters'
import { renderCompPinMapHtml } from '@/lib/cma/comp-pin-map'
import type { CmaAdjustedComp, CmaMarketContext, CmaPricing, CmaSubject } from '@/lib/cma/types'
import type { CmaPageDef } from '@/lib/cma/render-use-of-property'

const esc = escapeHtml

function saleToListPct(ratio: number | null | undefined): string | null {
  if (ratio == null || !Number.isFinite(ratio) || ratio <= 0) return null
  const pct = ratio <= 2 ? ratio * 100 : ratio
  return dec(pct, 1)
}



function sellerNetBlock(p: CmaPricing): string {
  const n = p.sellerNet
  if (!n || n.knownCount === 0) return ''
  return `
  <h3 class="subhead">Close price and seller net</h3>
  <p class="small">${n.givenCount} of ${n.knownCount} sales that set this price reported a concession${n.medianWhenGiven != null ? `, median ${usd(n.medianWhenGiven)} when given` : ''}.</p>`
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
    ? `The pins are the sales below. The outline is ${name}, when that boundary is on file.`
    : 'The pins are the sales below.'
}

/**
 * The search story, as one sentence.
 *
 * P5, Matt 2026-09-07: this was a bulleted list whose other two items were
 * filler — "5 closed sales." restates a table the reader is about to look at,
 * and the sale-to-list percent is printed again two paragraphs down. One
 * statement each, once.
 */
function searchStory(searchBody: string | null): string {
  return searchBody ? `<p>${esc(searchBody)}</p>` : ''
}

/**
 * The reading, above the table (P8). A twenty-row matrix needs a sentence
 * before the reader enters it.
 *
 * Both ends of the range print in the matrix's own Adjusted close row, so this
 * introduces no figure the seller cannot check, and no figure is computed here
 * — the adjusted closes and the recommend both arrive from lib/pricing.
 */
function matrixLead(input: {
  comps: CmaAdjustedComp[]
  pricing: CmaPricing
}): string {
  const adj = adjustedCloseRange(input.comps)
  if (!adj || !adj.adjustments || !(input.pricing.recommended > 0)) return ''
  const n = input.comps.length
  return `<p class="chart-read">${esc(
    `The ${n} closed ${n === 1 ? 'sale' : 'sales'} below set this number. Adjusted for ${adj.adjustments}, they land at ${usd(adj.low)} to ${usd(adj.high)}. Recommended list ${usd(input.pricing.recommended)}.`,
  )}</p>`
}

/**
 * How the number was reached, as facts the seller can check against the table
 * above it.
 *
 * The predicted close used to print here as a dollar figure. The Sunstone
 * contract keeps expected sale / predicted close off the seller document — the
 * recommended list is the one price a seller reads — so the sentence carries
 * the rate and the market's sale-to-list instead, both of which the matrix and
 * the market chapter already stand behind.
 */
function howTheListWasSet(input: {
  subject: CmaSubject
  market: CmaMarketContext | null
  pricing: CmaPricing
}): string {
  const sqft = input.subject.sqft
  const close = input.pricing.predictedClose
  if (sqft == null || !(sqft > 0) || close == null || !(close > 0)) return ''
  const ppsf = usd(Math.round(close / sqft))
  const bits = [
    `Adjusted for date and size, these sales carry a median of ${ppsf} per square foot at ${int(sqft)} sq ft.`,
  ]
  const stl = saleToListPct(input.market?.saleToListRatio ?? null)
  if (stl && input.market) {
    bits.push(`Recent ${input.market.geoLabel} sales have been closing at ${stl} percent of list.`)
  }
  return `<p class="small">${bits.map((b) => esc(b)).join(' ')}</p>`
}

export function pricingPage(input: {
  subject: CmaSubject
  comps: CmaAdjustedComp[]
  market: CmaMarketContext | null
  pricing: CmaPricing
  tiersUsed?: string[]
  mapDataUri?: string | null
  /** Immersive hero already printed recommend + range — skip the lead + 3-stat strip. */
  omitLeadPrices?: boolean
}): CmaPageDef {
  const p = input.pricing
  const s = input.subject
  const range = pricingRangeDisplay(p)
  const sqft = s.sqft && s.sqft > 0 ? s.sqft : null
  const recPpsf = sqft ? usd(Math.round(p.recommended / sqft)) : null
  const notes = clientFacingNotes(p.notes, p)
  const search = describeCompSearch({ subdivision: s.subdivision, tiersUsed: input.tiersUsed ?? [] })
  const pinMap = renderCompPinMapHtml(s, input.comps, input.mapDataUri ?? null)
  const lead = input.omitLeadPrices
    ? ''
    : `
  <h2 class="section">How we got the price</h2>
  <p>${esc(listPriceLead(p, { perSqft: recPpsf }))}${
    range.outOfRange ? ` The sales support ${usd(p.valueLow)} to ${usd(p.valueHigh)}.` : ''
  }${range.note ? ` ${esc(range.note)}` : ''}</p>
  <div class="stat-strip is-3">
    <div class="stat"><div class="lbl">List low</div><div class="val">${usd(p.conservative)}</div></div>
    <div class="stat"><div class="lbl">Recommended list</div><div class="val">${usd(p.recommended)}</div></div>
    <div class="stat"><div class="lbl">List high</div><div class="val">${usd(p.highEnd)}</div></div>
  </div>`
  const outOfRangeNote =
    input.omitLeadPrices && range.outOfRange
      ? `<p>The sales support ${usd(p.valueLow)} to ${usd(p.valueHigh)}.${range.note ? ` ${esc(range.note)}` : ''}</p>`
      : input.omitLeadPrices && range.note
        ? `<p>${esc(range.note)}</p>`
        : ''
  return {
    meta: `${esc(s.streetAddress)} · How we got the price`,
    toc: 'How we got the price',
    body: `
  ${lead}
  ${outOfRangeNote}
  ${searchStory(search.body)}
  ${renderCompMatrixHtml(s, input.comps, matrixLead({ comps: input.comps, pricing: p }))}
  ${howTheListWasSet({ subject: s, market: input.market, pricing: p })}
  ${pinMap ? `<h3 class="subhead">Where those sales are</h3><div class="pin-map-wrap">${pinMap}</div><p>${esc(mapLegend(s.subdivision))}</p>` : ''}
  ${sellerNetBlock(p)}
  ${notes.length > 0 ? `<ul class="note-list">${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
`,
  }
}
