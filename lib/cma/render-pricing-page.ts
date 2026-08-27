/**
 * CMA pricing section. One list sentence, one list strip, then the
 * matcher rules and the sales brought to this house.
 */

import { dateLong, dec, escapeHtml, usd, usdSigned } from '@/lib/cma/render-blocks'
import { clientFacingNotes, listPriceLead } from '@/lib/cma/client-facing'
import { pricingRangeDisplay } from '@/lib/cma/pricing'
import { describeCompSearch } from '@/lib/pricing/search-story'
import type { CmaAdjustedComp, CmaMarketContext, CmaPricing, CmaSubject } from '@/lib/cma/types'
import type { CmaPageDef } from '@/lib/cma/render-use-of-property'
import { subjectNoun, subjectPossessive } from '@/lib/cma/land-pricing'

const esc = escapeHtml

function saleToListPct(ratio: number | null | undefined): string | null {
  if (ratio == null || !Number.isFinite(ratio) || ratio <= 0) return null
  const pct = ratio <= 2 ? ratio * 100 : ratio
  return dec(pct, 1)
}

function adjustmentRows(comps: CmaAdjustedComp[], noun: string, sizeNoun: string): string {
  if (comps.length === 0) return ''
  const rows = comps
    .map((c) => {
      const close = c.closePrice != null ? usd(c.closePrice) : ''
      return `<tr>
      <td>${esc(c.address)}</td>
      <td>${esc(c.closeDate ? dateLong(c.closeDate) : '-')}</td>
      <td class="num">${close}</td>
      <td class="num">${usdSigned(c.timeAdjustment)}</td>
      <td class="num">${usdSigned(c.sizeAdjustment)}</td>
      <td class="num">${usd(c.adjustedPrice)}</td>
    </tr>`
    })
    .join('')
  return `
  <h3 class="subhead">What each sale becomes on your house</h3>
  <p>Close $ is the contract price. Time brings the sale to today. Size brings it to your ${sizeNoun}. As your ${noun} is that sale as if it were your ${noun}. It is not a second list price.</p>
  <table class="kv is-wide comps-adjust">
    <thead><tr><th>Sale</th><th class="v">Sold</th><th class="v">Close $</th><th class="v">Time</th><th class="v">Size</th><th class="v">As your ${noun}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

function sellerNetBlock(p: CmaPricing): string {
  const n = p.sellerNet
  if (!n || n.knownCount === 0) return ''
  return `
  <h3 class="subhead">Close price and seller net</h3>
  <p>Typical seller concessions in this set come off list before commission and closing costs. Net at list is on the seller-net chapter.</p>
  <p class="small">${n.givenCount} of ${n.knownCount} comparable sales reported a concession${n.medianWhenGiven != null ? `, median ${usd(n.medianWhenGiven)} when given` : ''}.</p>`
}

function howWePriced(n: number, market: CmaMarketContext | null, searchBody: string | null, sizeNoun: string): string {
  const bits = [
    ...(searchBody ? [searchBody] : []),
    `${n} closed ${n === 1 ? 'sale' : 'sales'}, each brought to today and to your ${sizeNoun}.`,
    'Closed MLS sales only. Automated estimates are not used.',
    'The close is the contract price. Concessions come off after that.',
    'The search keeps going until eight closed sales when the pool allows, and never prices on more than ten.',
    'In the same neighborhood we drop a subdivision whose typical dollar per foot is more than 15 percent off yours. Across the city that cut is 30 percent.',
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
}): CmaPageDef {
  const p = input.pricing
  const s = input.subject
  const range = pricingRangeDisplay(p)
  const sqft = s.sqft && s.sqft > 0 ? s.sqft : null
  const recPpsf = sqft ? usd(Math.round(p.recommended / sqft)) : null
  const notes = clientFacingNotes(p.notes, p)
  const search = describeCompSearch({ subdivision: s.subdivision, tiersUsed: input.tiersUsed ?? [] })
  const noun = subjectNoun(s)
  // Two different words: the TITLE reads "How this home is priced", the
  // possessive reads "as your house". subjectNoun gives 'home', never 'house'.
  const possessive = subjectPossessive(s)
  // Land is adjusted to ACREAGE, not to living area. Telling the owner of a
  // vacant parcel that comps were brought "to your living area" describes an
  // adjustment the engine did not make.
  const sizeNoun = noun === 'home' ? 'living area' : 'acreage'
  const pricedTitle = `How this ${noun} is priced`
  return {
    meta: `${esc(s.streetAddress)} · ${pricedTitle}`,
    toc: pricedTitle,
    body: `
  <h2 class="section">${pricedTitle}</h2>
  <p>${esc(listPriceLead(p, { perSqft: recPpsf }))}${
    range.outOfRange ? ` ${esc(range.label)} ${usd(p.valueLow)} to ${usd(p.valueHigh)}.` : ''
  }${range.note ? ` ${esc(range.note)}` : ''}</p>
  <div class="stat-strip is-3">
    <div class="stat"><div class="lbl">List low</div><div class="val">${usd(p.conservative)}</div></div>
    <div class="stat"><div class="lbl">Recommended list</div><div class="val">${usd(p.recommended)}</div></div>
    <div class="stat"><div class="lbl">List high</div><div class="val">${usd(p.highEnd)}</div></div>
  </div>
  <h3 class="subhead">How we priced this</h3>
  ${howWePriced(input.comps.length, input.market, search.body, sizeNoun)}
  ${adjustmentRows(input.comps, possessive, sizeNoun)}
  ${sellerNetBlock(p)}
  ${notes.length > 0 ? `<ul class="note-list">${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
`,
  }
}
