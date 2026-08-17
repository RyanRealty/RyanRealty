/**
 * Cover / immersive value block. Expected sale is the engine close.
 * The list range is conservative to high end. Old drafts without
 * predictedClose keep the recommended list as the lead number.
 */

import { dec, escapeHtml, usd } from '@/lib/cma/render-blocks'
import { whyThisListPrice } from '@/lib/cma/client-facing'
import { displayConfidence, pricingRangeDisplay } from '@/lib/cma/pricing'
import { describeCompSearch } from '@/lib/pricing/search-story'
import type { CmaAdjustedComp, CmaMarketContext, CmaPricing, CmaSubject } from '@/lib/cma/types'
import type { CmaEquityPosition } from '@/lib/cma/equity'
import type { ExpiredAuditData } from '@/lib/cma/expired-audit'

const esc = escapeHtml

type CoverArgs = {
  subject: CmaSubject
  comps: readonly CmaAdjustedComp[]
  market: CmaMarketContext | null
  pricing: CmaPricing
  equity?: CmaEquityPosition | null
  expiredAudit?: ExpiredAuditData | null
  tiersUsed?: string[]
}

export function expectedSale(p: CmaPricing): number {
  return p.predictedClose != null && p.predictedClose > 0 ? p.predictedClose : p.recommended
}

export function coverValueBlockHtml(a: CoverArgs): string {
  const p = a.pricing
  const conf = displayConfidence(p)
  const range = pricingRangeDisplay(p)
  const sale = expectedSale(p)
  const hasClose = p.predictedClose != null && p.predictedClose > 0
  const story = describeCompSearch({ subdivision: a.subject.subdivision, tiersUsed: a.tiersUsed ?? [] })
  return `
    <div class="vb-top">
      <div>
        <div class="vb-label">${hasClose ? 'Expected sale' : 'Recommended list price'}</div>
        <p class="vb-price">${usd(sale)}</p>
      </div>
      <div class="vb-pill">${esc(conf)} confidence</div>
    </div>
    <div class="vb-range">List this home ${usd(p.conservative)} to ${usd(p.highEnd)}. Recommended list ${usd(p.recommended)}.</div>
    ${range.note ? `<div class="vb-detail">${esc(range.note)}</div>` : ''}
    <div class="vb-detail">${esc(whyThisListPrice(a).coverSentence)} ${a.comps.length} closed MLS sales, each adjusted for when it sold and how its size compares to yours. Automated estimates are not used.${a.market?.geoLabel ? ` The market read is ${esc(a.market.geoLabel)}, not the ZIP.` : ''} ${esc(story.body)}</div>`
}

export function immersiveAnswerHtml(a: CoverArgs): string {
  const p = a.pricing
  const conf = displayConfidence(p)
  const range = pricingRangeDisplay(p)
  const sale = expectedSale(p)
  const hasClose = p.predictedClose != null && p.predictedClose > 0
  const evLo = p.conservative
  const evHi = p.highEnd
  const story = describeCompSearch({ subdivision: a.subject.subdivision, tiersUsed: a.tiersUsed ?? [] })
  return `
    <div class="ans-l r">${hasClose ? 'Expected sale' : 'Recommended list price'}</div>
    <div class="ans-n r" data-count>${usd(sale)}</div>
    <div class="r"><span class="conf">Confidence: ${esc(conf)}</span></div>
    <div class="range r">
      <div class="range-track"><div class="range-fill" style="--w:100%"></div></div>
      <div class="range-marks">
        <div class="rm"><div class="rm-v">${usd(p.conservative)}</div><div class="rm-l">List low</div></div>
        <div class="rm mid"><div class="rm-v">${usd(p.recommended)}</div><div class="rm-l">Recommended list</div></div>
        <div class="rm" style="text-align:right"><div class="rm-v">${usd(p.highEnd)}</div><div class="rm-l">List high</div></div>
      </div>
    </div>
    <p class="body r">${esc(whyThisListPrice(a).coverSentence)} List this home from ${usd(evLo)} to ${usd(evHi)}${range.outOfRange ? `. The comp-supported range is ${usd(p.valueLow)} to ${usd(p.valueHigh)}` : ''}${p.convergenceSpreadPct != null ? `. The pricing checks land within ${dec(p.convergenceSpreadPct, 1)}% of each other` : ''}.${range.note ? ` ${esc(range.note)}` : ''} ${esc(story.body)}</p>`
}
