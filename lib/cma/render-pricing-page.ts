/**
 * CMA pricing section. One list sentence, one list strip, then the
 * matcher rules and the sales brought to this house.
 */

import { PRICING_TARGET_COMPS, PRICING_MAX_COMPS } from '@/lib/pricing/ladder'
import { TARGET_COMPS, MAX_COMPS } from '@/lib/cma/comps'
import { dec, escapeHtml, usd } from '@/lib/cma/render-blocks'
import { clientFacingNotes, listPriceLead } from '@/lib/cma/client-facing'
import { pricingRangeDisplay } from '@/lib/cma/pricing'
import { describeCompSearch } from '@/lib/pricing/search-story'
import { renderCompMatrixHtml } from '@/lib/cma/comp-matrix'
import { renderCompMapKeyHtml } from '@/lib/cma/comp-strip'
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
  <p class="small">${n.givenCount} of ${n.knownCount} comparable sales reported a concession${n.medianWhenGiven != null ? `, median ${usd(n.medianWhenGiven)} when given` : ''}.</p>`
}

function howWePriced(n: number, market: CmaMarketContext | null, searchBody: string | null): string {
  const bits = [
    ...(searchBody ? [searchBody] : []),
    `${n} closed ${n === 1 ? 'sale' : 'sales'}.`,
    'Closed MLS sales only. Automated estimates are not used.',
    // Derived from the ladders' own constants, not prose: the facts ladder
    // targets 8, the listings fallback targets 5, and hardcoding "eight" put a
    // claim on three documents their own build record contradicted (adversarial
    // verify 2026-08-27). The floor-of-both phrasing is true on every path.
    `At least ${Math.min(PRICING_TARGET_COMPS, TARGET_COMPS)} closed sales when the pool allows. Cap is ${Math.max(PRICING_MAX_COMPS, MAX_COMPS)}.`,
    'A subdivision more than 15 percent off the subject dollar per foot is dropped. Across the city that cut is 30 percent.',
  ]
  if (market?.geoLabel) {
    bits.push(`The market read is ${market.geoLabel}.`)
  }
  const stl = saleToListPct(market?.saleToListRatio ?? null)
  if (stl && market) {
    bits.push(`Recent ${market.geoLabel} sales have been closing at ${stl} percent of list.`)
  }
  return `<ul class="note-list">${bits.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`
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
  <h3 class="subhead">How we priced this</h3>
  ${howWePriced(input.comps.length, input.market, search.body)}
  ${renderCompMatrixHtml(s, input.comps)}
  ${pinMap ? `<h3 class="subhead">Where those sales are</h3><div class="pin-map-wrap">${pinMap}</div>${search.legend ? `<p>${esc(search.legend)}</p>` : ''}<h3 class="subhead">Marker key</h3>${renderCompMapKeyHtml(s, input.comps)}` : ''}
  ${sellerNetBlock(p)}
  ${notes.length > 0 ? `<ul class="note-list">${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
`,
  }
}
