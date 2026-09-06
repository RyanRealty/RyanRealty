/**
 * CMA pricing section. One list sentence, one list strip, then the
 * matcher rules and the sales brought to this house.
 */

import { dec, escapeHtml, int, usd } from '@/lib/cma/render-blocks'
import { clientFacingNotes, listPriceLead } from '@/lib/cma/client-facing'
import { pricingRangeDisplay } from '@/lib/cma/pricing'
import { describeCompSearch } from '@/lib/pricing/search-story'
import { renderCompMatrixHtml } from '@/lib/cma/comp-matrix'
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
  <p class="small">${n.givenCount} of ${n.knownCount} sales that set this list reported a concession${n.medianWhenGiven != null ? `, median ${usd(n.medianWhenGiven)} when given` : ''}.</p>`
}

function howWePriced(n: number, market: CmaMarketContext | null, searchBody: string | null): string {
  const bits = [
    ...(searchBody ? [searchBody] : []),
    `${n} closed ${n === 1 ? 'sale' : 'sales'}.`,
  ]
  const stl = saleToListPct(market?.saleToListRatio ?? null)
  if (stl && market) {
    bits.push(`Recent ${market.geoLabel} sales have been closing at ${stl} percent of list.`)
  }
  return `<ul class="note-list">${bits.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`
}

function howTheListWasSet(input: {
  subject: CmaSubject
  market: CmaMarketContext | null
  pricing: CmaPricing
}): string {
  const sqft = input.subject.sqft
  const close = input.pricing.predictedClose
  const rec = input.pricing.recommended
  if (sqft == null || !(sqft > 0) || close == null || !(close > 0) || !(rec > 0)) return ''
  const ppsf = usd(Math.round(close / sqft))
  const bits = [
    `Median time-adjusted dollar per foot of these sales, at ${int(sqft)} sq ft, is ${usd(close)} (${ppsf} per square foot).`,
  ]
  const stl = saleToListPct(input.market?.saleToListRatio ?? null)
  if (stl) bits.push(`At ${stl} percent of list that is ${usd(rec)}.`)
  return `<p>${bits.map((b) => esc(b)).join(' ')}</p>`
}

export function pricingPage(input: {
  subject: CmaSubject
  comps: CmaAdjustedComp[]
  market: CmaMarketContext | null
  pricing: CmaPricing
  tiersUsed?: string[]
  mapDataUri?: string | null
}): CmaPageDef {
  const p = input.pricing
  const s = input.subject
  const range = pricingRangeDisplay(p)
  const sqft = s.sqft && s.sqft > 0 ? s.sqft : null
  const recPpsf = sqft ? usd(Math.round(p.recommended / sqft)) : null
  const notes = clientFacingNotes(p.notes, p)
  const search = describeCompSearch({ subdivision: s.subdivision, tiersUsed: input.tiersUsed ?? [] })
  const pinMap = renderCompPinMapHtml(s, input.comps, input.mapDataUri ?? null)
  return {
    meta: `${esc(s.streetAddress)} · How we got the price`,
    toc: 'How we got the price',
    body: `
  <h2 class="section">How we got the price</h2>
  <p>${esc(listPriceLead(p, { perSqft: recPpsf }))}${
    range.outOfRange ? ` ${esc(range.label)} ${usd(p.valueLow)} to ${usd(p.valueHigh)}.` : ''
  }${range.note ? ` ${esc(range.note)}` : ''}</p>
  <div class="stat-strip is-3">
    <div class="stat"><div class="lbl">List low</div><div class="val">${usd(p.conservative)}</div></div>
    <div class="stat"><div class="lbl">Recommended list</div><div class="val">${usd(p.recommended)}</div></div>
    <div class="stat"><div class="lbl">List high</div><div class="val">${usd(p.highEnd)}</div></div>
  </div>
  <h3 class="subhead">What we searched</h3>
  ${howWePriced(input.comps.length, input.market, search.body)}
  ${renderCompMatrixHtml(s, input.comps)}
  ${howTheListWasSet({ subject: s, market: input.market, pricing: p })}
  ${pinMap ? `<h3 class="subhead">Where those sales are</h3><div class="pin-map-wrap">${pinMap}</div>${search.legend ? `<p>${esc(search.legend)}</p>` : ''}` : ''}
  ${sellerNetBlock(p)}
  ${notes.length > 0 ? `<ul class="note-list">${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
`,
  }
}
