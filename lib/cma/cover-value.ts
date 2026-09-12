/**
 * Cover / immersive value block. Seller cover prints recommended list
 * and list range only. Expected sale stays off the cover.
 */

import { countWord, escapeHtml, usd } from '@/lib/cma/render-blocks'
import { pricingRangeDisplay } from '@/lib/cma/pricing'
import { describeCompSearch } from '@/lib/pricing/search-story'
import type { CmaAdjustedComp, CmaMarketContext, CmaPricing, CmaSubject } from '@/lib/cma/types'
import type { CmaEquityPosition } from '@/lib/cma/equity'
import type { ExpiredAuditData } from '@/lib/cma/expired-audit'

const esc = escapeHtml

/** Locked cover / hero headline (Matt 2026-09-12 Tip Ready craft). */
export const COVER_LIST_PRICE_HEADLINE = 'Our Recommended List Price for your home'

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

/**
 * The one line the cover carries (blueprint chapter 0):
 * "Your home is worth $372,000 to $399,000 today. We recommend listing at
 * $394,000."
 *
 * `valueLow`/`valueHigh` are what the sales say the home is WORTH; `recommended`
 * is the ask that reaches it. The cover had neither sentence — it printed
 * "List $380,000 to $407,000. Recommended list $394,000." beside a
 * $394,000 already set in 72px type, which is one number twice and the word
 * "worth" nowhere.
 *
 * A figure that is not on the row is not written around: a row with no worth
 * range prints the recommend alone, and one with neither prints nothing.
 */
export function coverWorthSentence(p: CmaPricing, opts?: { omitAsk?: boolean }): string {
  const lo = Math.min(p.valueLow ?? 0, p.valueHigh ?? 0)
  const hi = Math.max(p.valueLow ?? 0, p.valueHigh ?? 0)
  // The failed-ask cap can sit the number BELOW the range the sales support
  // (65365 Concorde: $1,473,000 under $1,550,000 to $3,255,000). "Worth" then
  // reads as a contradiction beside the number; say what happened instead.
  const capped = p.clamp != null && p.recommended > 0 && lo > 0 && p.recommended < lo
  const worth =
    lo > 0 && hi > 0
      ? capped
        ? `The sales support ${usd(lo)} to ${usd(hi)}. The list price is capped below that by the price that already failed to sell.`
        : lo === hi
          ? `Your home is worth ${usd(lo)} today.`
          : `Your home is worth ${usd(lo)} to ${usd(hi)} today.`
      : ''
  const ask =
    opts?.omitAsk !== true && p.recommended > 0 ? `We recommend listing at ${usd(p.recommended)}.` : ''
  return [worth, ask].filter(Boolean).join(' ')
}

/**
 * Why a value range is a quarter of the price wide, when it is.
 *
 * tasteReview round two, §3.E: three of the four documents open on a 28 to 33
 * percent spread with nothing saying why — a $1.47M opinion carrying a
 * $490,000 spread reads as a shrug. Every figure in the sentence is on
 * `pricing.rangeRule`, which lib/pricing wrote: how many sales it had, how far
 * apart the adjusted sales landed, and how many it set aside at each end.
 * Nothing here computes a valuation.
 */
export const WIDE_RANGE_THRESHOLD = 0.15
export function rangeSpreadCauseSentence(pricing: CmaPricing | null | undefined): string {
  if (!pricing) return ''
  const lo = Math.min(pricing.valueLow, pricing.valueHigh)
  const hi = Math.max(pricing.valueLow, pricing.valueHigh)
  if (!(lo > 0) || !(hi > 0) || hi / lo - 1 <= WIDE_RANGE_THRESHOLD) return ''
  const rule = (pricing as unknown as { rangeRule?: Record<string, unknown> | null }).rangeRule
  if (!rule || typeof rule !== 'object') return ''
  const num = (v: unknown): number | null => {
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) ? n : null
  }
  const n = num(rule.n)
  const kept = num(rule.kept)
  if (n == null || kept == null || !(kept > 0)) return ''
  const setAside = Math.max(n - kept, 0)
  const spread = `That range is wide because the ${countWord(kept)} sales behind it still land ${usd(
    Math.round(hi - lo),
  )} apart once each is moved to today`
  return setAside > 0
    ? `${spread}, and that is after setting aside the ${
        setAside === 1 ? 'furthest one' : `${countWord(setAside)} furthest`
      }.`
    : `${spread}.`
}


export function coverValueBlockHtml(a: CoverArgs): string {
  const p = a.pricing
  const range = pricingRangeDisplay(p)
  const story = describeCompSearch({ subdivision: a.subject.subdivision, tiersUsed: a.tiersUsed ?? [] })
  return `
    <div class="vb-top">
      <div>
        <div class="vb-label">${esc(COVER_LIST_PRICE_HEADLINE)}</div>
        <p class="vb-price">${usd(p.recommended)}</p>
      </div>
    </div>
    <div class="vb-range">${esc(
      `List ${usd(p.conservative)} to ${usd(p.highEnd)}.`,
    )}${
      range.outOfRange ? ` The sales support ${usd(p.valueLow)} to ${usd(p.valueHigh)}.` : ''
    }</div>
    ${currentAskLine(p) ? `<div class="vb-detail vb-ask">${esc(currentAskLine(p)!)}</div>` : ''}
    ${range.note ? `<div class="vb-detail">${esc(range.note)}</div>` : ''}
    <div class="vb-detail">${a.comps.length} closed MLS sales. Automated estimates are not used.${a.market?.geoLabel ? ` The market read is ${esc(a.market.geoLabel)}.` : ''} ${esc(story.body)}</div>`
}

export function immersiveHeroNumberHtml(a: CoverArgs): string {
  const p = a.pricing
  // The recommend is set in type right above, so the sentence under it says
  // what the home is WORTH and stops — never the same figure a second time.
  const worth = coverWorthSentence(p, { omitAsk: true })
  // A quarter-of-the-price range meets the reader here first (§3.E).
  const cause = rangeSpreadCauseSentence(p)
  return `
    <div class="hero-payoff">
      <div class="ans-l r">${esc(COVER_LIST_PRICE_HEADLINE)}</div>
      <div class="ans-n r">${usd(p.recommended)}</div>
      ${worth ? `<div class="hero-list r">${esc(worth)}</div>` : ''}
      ${cause ? `<div class="hero-why r">${esc(cause)}</div>` : ''}
    </div>`
}

export function immersiveAnswerHtml(a: CoverArgs): string {
  // Price + range live once on the hero photo. This beat only carries the
  // search story / ask note — never the sparse three-number bar or a second
  // "List $X to $Y. Recommended list $Z" block.
  const p = a.pricing
  const range = pricingRangeDisplay(p)
  const story = describeCompSearch({ subdivision: a.subject.subdivision, tiersUsed: a.tiersUsed ?? [] })
  const bits = [
    currentAskLine(p),
    range.outOfRange ? `The sales support ${usd(p.valueLow)} to ${usd(p.valueHigh)}.` : null,
    range.note,
    // A 28-to-33 percent spread on the opening screen with nothing saying why
    // (tasteReview round two, §3.E). One sentence, off `pricing.rangeRule`.
    rangeSpreadCauseSentence(p),
    story.body,
  ].filter((b): b is string => Boolean(b && String(b).trim()))
  if (bits.length === 0) return ''
  return `<p class="body r">${bits.map((b) => esc(b)).join(' ')}</p>`
}
