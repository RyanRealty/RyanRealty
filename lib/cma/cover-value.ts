/**
 * Cover / immersive value block. Seller cover prints recommended list
 * and list range only. Expected sale stays off the cover.
 */

import { countWord, escapeHtml, usd } from '@/lib/cma/render-blocks'
import { pricingRangeDisplay } from '@/lib/cma/pricing'
import { closedCompBand } from '@/lib/pricing/recommended-in-band'
import { printedAdjustedPrice } from '@/lib/pricing/seller-net'
import { setAsideCompIndexes } from '@/lib/cma/set-aside'
import { describeCompSearch } from '@/lib/pricing/search-story'
import type { CmaAdjustedComp, CmaMarketContext, CmaPricing, CmaSubject } from '@/lib/cma/types'
import type { CmaEquityPosition } from '@/lib/cma/equity'
import type { ExpiredAuditData } from '@/lib/cma/expired-audit'
import { subjectOnMarket } from '@/lib/cma/subject-on-market'
import { adjustmentsApplied, anySaleMovedForDate } from '@/lib/cma/adjustments-applied'
import { streetAnchorRead } from '@/lib/cma/street-anchor'

const esc = escapeHtml

/** Locked cover / hero headline (Matt 2026-09-12 Tip Ready craft). */
export const COVER_LIST_PRICE_HEADLINE = 'Our Recommended List Price for your home'
/**
 * The label over the number on a letter the build holds for Matt: because the
 * failed ask pulled the price under every sale that set it (SKILL.md rule 26,
 * Matt 2026-10-07), or because the last failed ask sits inside the sales range
 * (rule 22, 2382 Jackson, reader review 2026-10-08). That number is not a
 * recommendation anyone has approved; Matt approves it or sets his own.
 */
export const HELD_PRICE_HEADLINE = 'The price Matt is reviewing'

/** True on a letter held under rule 26 (pricing.hold kind 'ask-below-band'). */
export function heldUnderBand(p: Pick<CmaPricing, 'hold'> | null | undefined): boolean {
  return p?.hold?.kind === 'ask-below-band'
}

/**
 * True on any letter the build holds for Matt (rule 22 'ask-in-band' or rule
 * 26 'ask-below-band'). A held letter gives no list instruction and prints no
 * clamp sentence: its cover price is the one Matt is reviewing.
 */
export function heldForMatt(p: Pick<CmaPricing, 'hold'> | null | undefined): boolean {
  const kind = p?.hold?.kind
  return kind === 'ask-in-band' || kind === 'ask-below-band'
}

/**
 * The label over the number on a home that is on the market today
 * (lib/cma/subject-on-market.ts). 3062 NW Kelly Hill, listed with another
 * brokerage, opened on "Our Recommended List Price for your home": a list
 * price we recommend to an owner who already has a listing agreement. The
 * figure is the same; it is stated as what it is, an opinion of value.
 */
export const COVER_ON_MARKET_HEADLINE = 'Our opinion of value'

/**
 * The label over the cover number: the recommendation, on a held letter the
 * price under review, and on a home on the market our opinion of value.
 */
export function coverPriceHeadline(
  p: Pick<CmaPricing, 'hold'> | null | undefined,
  opts?: { onMarket?: boolean },
): string {
  if (heldForMatt(p)) return HELD_PRICE_HEADLINE
  return opts?.onMarket ? COVER_ON_MARKET_HEADLINE : COVER_LIST_PRICE_HEADLINE
}

type CoverArgs = {
  subject: CmaSubject
  comps: readonly CmaAdjustedComp[]
  market: CmaMarketContext | null
  pricing: CmaPricing
  equity?: CmaEquityPosition | null
  expiredAudit?: ExpiredAuditData | null
  tiersUsed?: string[]
  /** `render_args.subjectStatus`, read by `subjectOnMarket`. */
  subjectStatus?: unknown
}


/**
 * The sales the printed band is drawn from: the weighted rows of the grid,
 * less the rows `pricing.setAside` names (the band is always the trimmed
 * range, Matt 2026-10-07; a set-aside sale still carries its weight on the
 * grid, so it is read by name, as the pin in lib/pricing/estimate.ts does).
 */
export function tableBandSales(
  comps: readonly CmaAdjustedComp[],
  pricing?: CmaPricing | null,
): CmaAdjustedComp[] {
  const aside = pricing ? setAsideCompIndexes(pricing, comps) : new Set<number>()
  const rows = comps.filter((_, i) => !aside.has(i))
  const weighted = rows.filter((c) => typeof c.weight === 'number')
  return weighted.some((c) => c.weight > 0) ? weighted.filter((c) => c.weight > 0) : rows
}

export function tableAdjustedBand(
  comps: readonly CmaAdjustedComp[],
  pricing?: CmaPricing | null,
): { low: number; high: number } | null {
  const setters = tableBandSales(comps, pricing)
  const values = setters
    .map((c) => printedAdjustedPrice(c))
    .filter((n) => Number.isFinite(n) && n > 0)
  if (values.length === 0) return null
  return { low: Math.min(...values), high: Math.max(...values) }
}

/** One end accounts for at least half the span. That is not a range to list in. */
export function oneOutlierMakesTheSpan(values: readonly number[]): boolean {
  if (values.length < 3) return false
  const sorted = [...values].filter((n) => n > 0).sort((a, b) => a - b)
  if (sorted.length < 3) return false
  const span = sorted[sorted.length - 1]! - sorted[0]!
  if (!(span > 0)) return false
  const dropHigh = sorted[sorted.length - 2]! - sorted[0]!
  const dropLow = sorted[sorted.length - 1]! - sorted[1]!
  return Math.min(dropHigh, dropLow) <= span * 0.5
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
export function rangeSpreadCauseSentence(
  pricing: CmaPricing | null | undefined,
  opts?: {
    onMarket?: boolean
    /**
     * The printed grid. With it the sentence says only the adjustments its
     * sales carry ("moved to today" only when one moved for date) and names
     * the street sale a trim kept (reader review 2026-10-08).
     */
    comps?: readonly CmaAdjustedComp[] | null
  },
): string {
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
  const comps = opts?.comps && opts.comps.length > 0 ? opts.comps : null
  const bandSales = comps ? tableBandSales(comps, pricing) : null
  // "Moved to today" only when a sale behind the range moved for date (3037
  // Purcell moved none, reader review 2026-10-08).
  const moved = !bandSales
    ? ' once each is moved to today'
    : anySaleMovedForDate(bandSales)
      ? ' once each is moved to today'
      : adjustmentsApplied(bandSales).length > 0
        ? ' once each is adjusted to your home'
        : ''
  const spread = `That range is wide because the ${countWord(kept)} sales behind it still land ${usd(
    Math.round(hi - lo),
  )} apart${moved}`
  if (setAside <= 0) return `${spread}.`
  const ppsf = Math.max(0, num(rule.endpointPpsfAside) ?? 0)
  const light = Math.max(0, num(rule.endpointWeightAside) ?? 0)
  const trim = Math.max(0, setAside - ppsf - light)
  // THE STREET SALE THE TRIM KEPT (915 Saginaw, reader review 2026-10-08).
  // The trim sets aside the highest and the lowest sale, but never the sale on
  // the subject's street the price is held to (lib/pricing/estimate.ts
  // releaseStreetAnchorFromSetAside). Saginaw set aside only its high sale,
  // and "one sale at the end of the prices so a single sale cannot set the
  // range" was false at the low end, where 536 Saginaw alone sets it.
  const keptStreet = trim === 1 ? keptStreetEnd(pricing, comps) : null
  const parts: string[] = []
  if (ppsf === 1) parts.push('one sale whose price per square foot sat more than 25 percent off the others')
  else if (ppsf > 1) parts.push(`${countWord(ppsf)} sales whose price per square foot sat more than 25 percent off the others`)
  if (light === 1) parts.push('one sale that carried too little weight to set an end')
  else if (light > 1) parts.push(`${countWord(light)} sales that carried too little weight to set an end`)
  if (trim === 1 && keptStreet) parts.push(`one sale at the ${keptStreet.asideEnd} end of the prices`)
  else if (trim === 1) parts.push('one sale at the end of the prices so a single sale cannot set the range')
  // The range rule sets aside one sale at each end ('trimmed-one-each-end').
  // "The sales at each end of the prices so one sale cannot set the range"
  // read as a puzzle (reader review 2026-10-08); it is the highest and the
  // lowest sale.
  else if (trim === 2) parts.push('the highest and the lowest sale, so no single sale sets the range')
  else if (trim > 2) parts.push('the highest and lowest sales, so no single sale sets the range')
  if (parts.length === 0) {
    // Older rows stored the count and not the reason. Do not call it distance.
    parts.push(
      setAside === 1
        ? 'one sale that did not qualify to set an end'
        : `${countWord(setAside)} sales that did not qualify to set an end`,
    )
  }
  const joined = parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
  // A home on the market gets an opinion of value, not a recommended price;
  // on a letter held for Matt the number beside this sentence is the price
  // under his review (reader review 2026-10-08).
  const inPrice = opts?.onMarket ? 'in this value' : heldForMatt(pricing) ? 'in this price' : 'in the recommended price'
  const stillCarries =
    ppsf + light > 0 && trim === 0
      ? ppsf + light === 1
        ? ` That sale still carries weight ${inPrice}.`
        : ` Those sales still carry weight ${inPrice}.`
      : ''
  const street = keptStreet ? ` ${keptStreet.sentence}` : ''
  return `${spread}, and that is after setting aside ${joined}.${street}${stillCarries}`
}

/**
 * The street sale a one-sale trim kept at the other end of the range, and the
 * sentence that says so, or null. Read off the stored anchor and the printed
 * grid: the anchored sale must be the band's own low or high, and the sale
 * set aside must sit at the other end.
 */
function keptStreetEnd(
  pricing: CmaPricing,
  comps: readonly CmaAdjustedComp[] | null,
): { asideEnd: 'high' | 'low'; sentence: string } | null {
  if (!comps) return null
  const street = streetAnchorRead(pricing, comps)
  if (!street || street.sales.length !== 1) return null
  const band = tableAdjustedBand(comps, pricing)
  if (!band) return null
  const sale = street.sales[0]!
  const value = printedAdjustedPrice(sale)
  const keptEnd = value === band.low ? 'low' : value === band.high ? 'high' : null
  if (!keptEnd) return null
  const aside = [...setAsideCompIndexes(pricing, comps)].map((i) => comps[i]!).filter(Boolean)
  if (aside.length !== 1) return null
  const asideValue = printedAdjustedPrice(aside[0]!)
  const asideEnd = asideValue > band.high ? 'high' : asideValue < band.low ? 'low' : null
  if (!asideEnd || asideEnd === keptEnd) return null
  const why = street.holdsCover
    ? 'because the price on the cover is held to it'
    : 'because a sale on your street this close to your home in size is never set aside'
  return {
    asideEnd,
    sentence: `${sale.address}, on your street, is kept as the ${keptEnd} end ${why}.`,
  }
}


export function coverValueBlockHtml(a: CoverArgs): string {
  const p = a.pricing
  const range = pricingRangeDisplay(p)
  const story = describeCompSearch({ subdivision: a.subject.subdivision, tiersUsed: a.tiersUsed ?? [] })
  return `
    <div class="vb-top">
      <div>
        <div class="vb-label">${esc(coverPriceHeadline(p))}</div>
        <p class="vb-price">${usd(p.recommended)}</p>
      </div>
    </div>
    ${heldForMatt(p) ? '' : `<div class="vb-range">${esc((() => {
      // Matt 2026-09-18: same closed-comp band as hero trio — never a second
      // list-tier range beside Low/High (Canter dual-tier refuse).
      const band = closedCompBand(p)
      const lo = band?.low ?? p.conservative
      const hi = band?.high ?? p.highEnd
      return `List ${usd(lo)} to ${usd(hi)}.`
    })())}${
      range.outOfRange ? ` The sales support ${usd(p.valueLow)} to ${usd(p.valueHigh)}.` : ''
    }</div>`}
    ${currentAskLine(p) ? `<div class="vb-detail vb-ask">${esc(currentAskLine(p)!)}</div>` : ''}
    ${range.note ? `<div class="vb-detail">${esc(range.note)}</div>` : ''}
    <div class="vb-detail">${a.comps.length} closed MLS sales. Automated estimates are not used.${a.market?.geoLabel ? ` The market read is ${esc(a.market.geoLabel)}.` : ''} ${esc(story.body)}</div>`
}

/** The label over the low and high pair: a SOLD range, not a list range. */
export const HERO_SOLD_RANGE_LABEL = 'Where similar homes sold, adjusted to today'
/**
 * The same label when no sale behind the pair moved for date. 3037 Purcell
 * moved no sale for date (its own-ground local read held, Matt 2026-10-08,
 * "Down only if local fell"), and the cover still said "adjusted to today"
 * over two figures adjusted only for size and seller concessions (reader
 * review 2026-10-08). The pair is adjusted to the home, so it says that.
 */
export const HERO_SOLD_RANGE_LABEL_TO_HOME = 'Where similar homes sold, adjusted to your home'
/** The label when the sales behind the pair carry no adjustment at all. */
export const HERO_SOLD_RANGE_LABEL_PLAIN = 'Where similar homes sold'

/**
 * The sold pair's label, read off the sales the pair is drawn from: "adjusted
 * to today" only when one of them moved for date, "adjusted to your home"
 * when they moved for anything else, and no adjustment named when none did.
 * With no sales in hand the label is the one the pair always carried.
 */
export function heroSoldRangeLabel(sales: readonly CmaAdjustedComp[] | null | undefined): string {
  if (!sales || sales.length === 0) return HERO_SOLD_RANGE_LABEL
  if (anySaleMovedForDate(sales)) return HERO_SOLD_RANGE_LABEL
  return adjustmentsApplied(sales).length > 0 ? HERO_SOLD_RANGE_LABEL_TO_HOME : HERO_SOLD_RANGE_LABEL_PLAIN
}
/** The pair's label when no sold band exists and it falls back to the list tiers. */
export const HERO_LIST_RANGE_LABEL = 'List price range'

/**
 * The recommended list price, then where similar homes sold.
 *
 * Shared by immersive hero and letter cover so renderCmaHtml cannot skip it.
 * Matt 2026-09-17: Low/High from closed-comp band (valueLow/valueHigh).
 * Recommended must stay inside that band (Tip Ready refuse if outside).
 * Falls back to list tiers only when the closed band is missing.
 *
 * ORDER (Matt 2026-10-07). This used to print Low · High · Recommended under
 * "Our Recommended List Price for your home", so the first two figures under a
 * list-price label were the adjusted SOLD prices of the sales. The
 * recommended list is now the first and biggest thing under that label, and
 * the pair sits under its own label saying what it is. The markup reuses the
 * hero-trio classes both stylesheets already size (lib/cma/immersive-css.ts,
 * lib/cma/render-css.ts), so no stylesheet changes with it: the recommend is a
 * one-item trio, and the sold pair is a trio inside a labelled column. The one
 * inline margin is the gap between the two: the letter's trio rule sets 4px,
 * which sat the sold label on the big number.
 */
export function heroTrioHtml(
  p: CmaPricing,
  opts?: { singleClass?: string; comps?: readonly CmaAdjustedComp[] | null },
): string {
  // Same closedCompBand listRangeBounds / Tip Ready parity reads.
  // When the table is in hand, low and high are the adjusted sales still on it.
  const table = opts?.comps && opts.comps.length > 0 ? tableAdjustedBand(opts.comps, p) : null
  const band = table ?? closedCompBand(p)
  const soldLabel = heroSoldRangeLabel(table ? tableBandSales(opts!.comps!, p) : null)
  const loRaw = band?.low ?? (p.conservative ?? 0)
  const hiRaw = band?.high ?? (p.highEnd ?? 0)
  const low = Math.min(loRaw, hiRaw)
  const high = Math.max(loRaw, hiRaw)
  const rec = p.recommended
  if (low > 0 && high > 0 && rec > 0) {
    return `<div class="hero-trio" data-recommend-once="1">
      <div class="ht is-rec">
        <div class="ans-n r ht-v">${usd(rec)}</div>
      </div>
    </div>
    <div class="hero-trio hero-sold" style="margin-top:14px">
      <div class="ht">
        <div class="ht-l">${esc(band ? soldLabel : HERO_LIST_RANGE_LABEL)}</div>
        <div class="hero-trio">
          <div class="ht">
            <div class="ht-l">Low</div>
            <div class="ht-v">${usd(low)}</div>
          </div>
          <div class="ht">
            <div class="ht-l">High</div>
            <div class="ht-v">${usd(high)}</div>
          </div>
        </div>
      </div>
    </div>`
  }
  if (rec > 0) {
    const cls = opts?.singleClass ?? 'ans-n r'
    return `<div class="${cls}">${usd(rec)}</div>`
  }
  return ''
}

/**
 * Immersive hero payoff: locked headline + Low · High · Recommended once.
 */
export function immersiveHeroNumberHtml(a: CoverArgs): string {
  const p = a.pricing
  const onMarket = subjectOnMarket(a)
  const cause = rangeSpreadCauseSentence(p, { onMarket, comps: a.comps })
  return `
    <div class="hero-payoff">
      <div class="ans-l r">${esc(coverPriceHeadline(p, { onMarket }))}</div>
      ${heroTrioHtml(p, { comps: a.comps })}
      ${cause ? `<div class="hero-why r">${esc(cause)}</div>` : ''}
    </div>`
}

/**
 * Letter cover payoff (renderCmaHtml): same FLOW trio as immersive — never sole cover-price.
 */
export function letterCoverPayoffHtml(
  p: CmaPricing,
  comps?: readonly CmaAdjustedComp[] | null,
  opts?: { onMarket?: boolean },
): string {
  const onMarket = opts?.onMarket === true
  const cause = rangeSpreadCauseSentence(p, { onMarket, comps })
  const trio = heroTrioHtml(p, { comps })
  if (!trio && !cause) return ''
  return `<div class="cover-payoff">
      <div class="cover-headline">${esc(coverPriceHeadline(p, { onMarket }))}</div>
      ${trio}
      ${cause ? `<p class="cover-why">${esc(cause)}</p>` : ''}
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
    // A held letter (rule 26) states the band once, in chapter 3.
    range.outOfRange && !heldUnderBand(p) ? `The sales support ${usd(p.valueLow)} to ${usd(p.valueHigh)}.` : null,
    range.note,
    // A 28-to-33 percent spread on the opening screen with nothing saying why
    // (tasteReview round two, §3.E). One sentence, off `pricing.rangeRule`.
    rangeSpreadCauseSentence(p, { comps: a.comps }),
    story.body,
  ].filter((b): b is string => Boolean(b && String(b).trim()))
  if (bits.length === 0) return ''
  return `<p class="body r">${bits.map((b) => esc(b)).join(' ')}</p>`
}
