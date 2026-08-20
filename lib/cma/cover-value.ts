/**
 * Cover / immersive value block. Seller cover prints recommended list
 * and list range only. Expected sale stays off the cover.
 */

import { escapeHtml, usd } from '@/lib/cma/render-blocks'
import { listPriceLead } from '@/lib/cma/client-facing'
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

export function coverValueBlockHtml(a: CoverArgs): string {
  const p = a.pricing
  const range = pricingRangeDisplay(p)
  const story = describeCompSearch({ subdivision: a.subject.subdivision, tiersUsed: a.tiersUsed ?? [] })
  return `
    <div class="vb-top">
      <div>
        <div class="vb-label">Recommended list</div>
        <p class="vb-price">${usd(p.recommended)}</p>
      </div>
    </div>
    <div class="vb-range">${esc(listPriceLead(p, { includeExpectedClose: false }))}${
      range.outOfRange ? ` ${esc(range.label)} ${usd(p.valueLow)} to ${usd(p.valueHigh)}.` : ''
    }</div>
    ${range.note ? `<div class="vb-detail">${esc(range.note)}</div>` : ''}
    <div class="vb-detail">${a.comps.length} closed MLS sales, each adjusted for when it sold and how its size compares to yours. Automated estimates are not used.${a.market?.geoLabel ? ` The market read is ${esc(a.market.geoLabel)}.` : ''} ${esc(story.body)}</div>`
}

export function immersiveHeroNumberHtml(a: CoverArgs): string {
  const p = a.pricing
  return `
    <div class="hero-payoff">
      <div class="ans-l r">Recommended list</div>
      <div class="ans-n r">${usd(p.recommended)}</div>
      <div class="hero-list r">${esc(listPriceLead(p, { includeExpectedClose: false }))}</div>
    </div>`
}

export function immersiveAnswerHtml(a: CoverArgs): string {
  const p = a.pricing
  const range = pricingRangeDisplay(p)
  const story = describeCompSearch({ subdivision: a.subject.subdivision, tiersUsed: a.tiersUsed ?? [] })
  return `
    <div class="range r">
      <div class="range-track"><div class="range-fill" style="--w:100%"></div></div>
      <div class="range-marks">
        <div class="rm"><div class="rm-v">${usd(p.conservative)}</div><div class="rm-l">List low</div></div>
        <div class="rm mid"><div class="rm-v">${usd(p.recommended)}</div><div class="rm-l">Recommended list</div></div>
        <div class="rm" style="text-align:right"><div class="rm-v">${usd(p.highEnd)}</div><div class="rm-l">List high</div></div>
      </div>
    </div>
    <p class="body r">${esc(listPriceLead(p, { includeExpectedClose: false }))}${range.outOfRange ? ` The comp-supported range is ${usd(p.valueLow)} to ${usd(p.valueHigh)}.` : ''}${range.note ? ` ${esc(range.note)}` : ''} ${esc(story.body)}</p>`
}
