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

/**
 * The show-both line for a live-listed subject (Matt 2026-08-27): the current
 * ask beside the comp-supported evidence, gap stated plainly, never averaged.
 * Returns null off-market so the cover carries nothing extra.
 */
export function currentAskLine(p: CmaPricing): string | null {
  const ask = p.currentAsk
  if (ask == null || !(ask > 0)) return null
  const low = Math.min(p.valueLow, p.valueHigh)
  const high = Math.max(p.valueLow, p.valueHigh)
  if (ask > high) {
    const pct = Math.round(((ask - high) / high) * 100)
    return `On the market today at ${usd(ask)}, ${pct}% above the top of the supported range.`
  }
  if (ask < low) {
    const pct = Math.round(((low - ask) / low) * 100)
    return `On the market today at ${usd(ask)}, ${pct}% below the bottom of the supported range.`
  }
  return `On the market today at ${usd(ask)}, inside the supported range.`
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
    ${currentAskLine(p) ? `<div class="vb-detail vb-ask">${esc(currentAskLine(p)!)}</div>` : ''}
    ${range.note ? `<div class="vb-detail">${esc(range.note)}</div>` : ''}
    <div class="vb-detail">${a.comps.length} closed MLS sales. Automated estimates are not used.${a.market?.geoLabel ? ` The market read is ${esc(a.market.geoLabel)}.` : ''} ${esc(story.body)}</div>`
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
    <p class="body r">${esc(listPriceLead(p, { includeExpectedClose: false }))}${currentAskLine(p) ? ` ${esc(currentAskLine(p)!)}` : ''}${range.outOfRange ? ` The comp-supported range is ${usd(p.valueLow)} to ${usd(p.valueHigh)}.` : ''}${range.note ? ` ${esc(range.note)}` : ''} ${esc(story.body)}</p>`
}
