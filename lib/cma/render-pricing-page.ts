/**
 * CMA pricing section. Plain-language lead in the 3480 baseline style, then
 * the matcher rules we can actually defend, then the three list tiers.
 */

import { dec, escapeHtml, int, usd, usdSigned } from '@/lib/cma/render-blocks'
import { displayConfidence, pricingRangeDisplay } from '@/lib/cma/pricing'
import type { CmaAdjustedComp, CmaMarketContext, CmaPricing, CmaSubject } from '@/lib/cma/types'
import type { CmaPageDef } from '@/lib/cma/render-use-of-property'

const esc = escapeHtml

function saleToListPct(ratio: number | null | undefined): string | null {
  if (ratio == null || !Number.isFinite(ratio) || ratio <= 0) return null
  const pct = ratio <= 2 ? ratio * 100 : ratio
  return dec(pct, 1)
}

function adjustmentRows(comps: CmaAdjustedComp[]): string {
  if (comps.length === 0) return ''
  const rows = comps
    .map((c) => {
      const close = c.closePrice != null ? usd(c.closePrice) : 'n/a'
      return `<tr>
      <td>${esc(c.address)}</td>
      <td class="num">${close}</td>
      <td class="num">${usdSigned(c.timeAdjustment)}</td>
      <td class="num">${usdSigned(c.sizeAdjustment)}</td>
      <td class="num">${usd(c.adjustedPrice)}</td>
    </tr>`
    })
    .join('')
  return `
  <h3 class="subhead">What each sale becomes on your house</h3>
  <p>Close $ is the contract price. Time brings the sale to today. Size brings it to your living area. Adjusted $ is that sale as if it were your house.</p>
  <table class="kv is-wide comps-adjust">
    <thead><tr><th>Sale</th><th class="v">Close $</th><th class="v">Time</th><th class="v">Size</th><th class="v">Adjusted $</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

function sellerNetBlock(p: CmaPricing): string {
  const n = p.sellerNet
  if (!n || n.knownCount === 0) return ''
  return `
  <h3 class="subhead">Close price and seller net</h3>
  <p>The list tiers above are contract prices. Seller concessions come off the close before commission and closing costs.</p>
  <div class="stat-strip is-3">
    <div class="stat"><div class="lbl">Close / list estimate</div><div class="val">${usd(p.recommended)}</div></div>
    <div class="stat"><div class="lbl">Expected concessions</div><div class="val">${n.expectedConcessions != null ? usd(n.expectedConcessions) : 'n/a'}</div></div>
    <div class="stat"><div class="lbl">Seller net from price</div><div class="val">${n.predictedSellerNet != null ? usd(n.predictedSellerNet) : 'n/a'}</div></div>
  </div>
  <p class="small">${n.givenCount} of ${n.knownCount} comparable sales reported a concession${n.medianWhenGiven != null ? `, median ${usd(n.medianWhenGiven)} when given` : ''}.</p>`
}

function howWePriced(n: number, market: CmaMarketContext | null): string {
  const bits = [
    `${n} closed ${n === 1 ? 'sale' : 'sales'}, each brought to today and to your living area.`,
    'The close is the contract price. Concessions come off after that.',
    'A wide size match on the same street does not stop the search. A tight size match or a sale inside one mile does.',
    'In the same neighborhood we drop a subdivision whose typical dollar per foot is more than 15 percent off yours. Across the city that cut is 30 percent.',
  ]
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
}): CmaPageDef {
  const p = input.pricing
  const s = input.subject
  const range = pricingRangeDisplay(p)
  const sqft = s.sqft && s.sqft > 0 ? s.sqft : null
  const recPpsf = sqft ? usd(Math.round(p.recommended / sqft)) : null
  return {
    meta: `${esc(s.streetAddress)} · How this home is priced`,
    toc: 'How this home is priced',
    body: `
  <h2 class="section">How this home is priced</h2>
  <p>${esc(range.label)} ${usd(p.valueLow)} to ${usd(p.valueHigh)}. Recommended list ${usd(p.recommended)}${recPpsf ? ` (${recPpsf} per square foot)` : ''}.</p>
  <div class="stat-strip is-3">
    <div class="stat"><div class="lbl">Conservative</div><div class="val">${usd(p.conservative)}</div></div>
    <div class="stat"><div class="lbl">Recommended list</div><div class="val">${usd(p.recommended)}</div></div>
    <div class="stat"><div class="lbl">High end</div><div class="val">${usd(p.highEnd)}</div></div>
  </div>
  <h3 class="subhead">How we priced this</h3>
  ${howWePriced(input.comps.length, input.market)}
  ${adjustmentRows(input.comps)}
  <div class="tier-grid">
    <div class="tier">
      <div class="t-lbl">Conservative</div>
      <div class="t-val">${usd(p.conservative)}</div>
      <div class="t-note">Quick-sale entry. Use when a fast, certain close is the priority.</div>
    </div>
    <div class="tier featured">
      <div class="t-lbl">Recommended list</div>
      <div class="t-val">${usd(p.recommended)}</div>
      <div class="t-note">${p.priceOverride != null ? 'Broker-adjusted on review, anchored to the data-supported reconciliation.' : 'The reconciled value of the adjusted sales. Leaves room to negotiate inside the supported range.'}</div>
    </div>
    <div class="tier">
      <div class="t-lbl">High end</div>
      <div class="t-val">${usd(p.highEnd)}</div>
      <div class="t-note">Ceiling of the supportable range with presentation and condition fully resolved.</div>
    </div>
  </div>
  ${sellerNetBlock(p)}
  <h3 class="subhead">The three checks</h3>
  <p>Dollar per square foot on the time-adjusted sales brackets ${usd(p.method1Low)} to ${usd(p.method1High)}, median ${usd(p.method1Mid)}${sqft ? ` on ${int(sqft)} square feet` : ''}.</p>
  ${
    p.method2 != null
      ? `<p>The three closest homes in living area${p.improvementsValueAdd ? `, plus ${usd(p.improvementsValueAdd)} of credited improvement value` : ''}, land at ${usd(p.method2)}.</p>`
      : ''
  }
  <p>The similarity-weighted average of every fully adjusted sale lands at ${usd(p.method3)}. That check carries the market-conditions correction, so it anchors the recommendation.</p>
  ${p.notes.length > 0 ? `<ul class="note-list">${p.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
  <p class="small">Confidence: <strong>${esc(displayConfidence(p))}</strong>. ${esc(p.confidenceReason)}</p>`,
  }
}
