/**
 * Cover / immersive value block. Expected sale is the engine close.
 * The list range is conservative to high end. Old drafts without
 * predictedClose keep the recommended list as the lead number.
 */

import { dec, escapeHtml, usd } from '@/lib/cma/render-blocks'
import { whyThisListPrice } from '@/lib/cma/client-facing'
import { pricingRangeDisplay } from '@/lib/cma/pricing'
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

/** Close estimate sitting under the list low is a sale-to-list haircut, not a cheaper list. */
export function closeSitsUnderList(p: CmaPricing): boolean {
  return p.predictedClose != null && p.predictedClose > 0 && p.predictedClose < p.conservative
}

export function coverValueBlockHtml(a: CoverArgs): string {
  const p = a.pricing
  const sale = expectedSale(p)
  const hasClose = p.predictedClose != null && p.predictedClose > 0
  const closeUnder = closeSitsUnderList(p)
  const leadIsClose = hasClose && !closeUnder
  const closeLine = closeUnder
    ? ` Expected sale from that list is ${usd(p.predictedClose!)}. That is the typical close after sale-to-list, not a list below the sales.`
    : ''
  return `
    <div class="vb-top">
      <div>
        <div class="vb-label">${leadIsClose ? 'Expected sale' : 'Recommended list price'}</div>
        <p class="vb-price">${usd(leadIsClose ? sale : p.recommended)}</p>
      </div>
    </div>
    <div class="vb-range">List this home ${usd(p.conservative)} to ${usd(p.highEnd)}. Recommended list ${usd(p.recommended)}.${closeLine}</div>
`
}

export function immersiveAnswerHtml(a: CoverArgs): string {
  const p = a.pricing
  const range = pricingRangeDisplay(p)
  const sale = expectedSale(p)
  const hasClose = p.predictedClose != null && p.predictedClose > 0
  const closeUnder = closeSitsUnderList(p)
  const leadIsClose = hasClose && !closeUnder
  const evLo = p.conservative
  const evHi = p.highEnd
  const story = describeCompSearch({ subdivision: a.subject.subdivision, tiersUsed: a.tiersUsed ?? [] })
  const closeLine = closeUnder
    ? ` Expected sale from that list is ${usd(p.predictedClose!)}. That is the typical close after sale-to-list, not a list below the sales.`
    : ''
  return `
    <div class="ans-l r">${leadIsClose ? 'Expected sale' : 'Recommended list price'}</div>
    <div class="ans-n r" data-count>${usd(leadIsClose ? sale : p.recommended)}</div>
    <div class="range r">
      <div class="range-track"><div class="range-fill" style="--w:100%"></div></div>
      <div class="range-marks">
        <div class="rm"><div class="rm-v">${usd(p.conservative)}</div><div class="rm-l">List low</div></div>
        <div class="rm mid"><div class="rm-v">${usd(p.recommended)}</div><div class="rm-l">Recommended list</div></div>
        <div class="rm" style="text-align:right"><div class="rm-v">${usd(p.highEnd)}</div><div class="rm-l">List high</div></div>
      </div>
    </div>
    <p class="body r">${esc(whyThisListPrice(a).coverSentence)} List this home from ${usd(evLo)} to ${usd(evHi)}${range.outOfRange ? `. The comp-supported range is ${usd(p.valueLow)} to ${usd(p.valueHigh)}` : ''}${p.convergenceSpreadPct != null ? `. The pricing checks land within ${dec(p.convergenceSpreadPct, 1)}% of each other` : ''}.${range.note ? ` ${esc(range.note)}` : ''}${closeLine} ${esc(story.body)}</p>
`
}
