/**
 * The two-line direct answer under the /sell H1 (SEO & AEO Desk brief
 * 2026-10-08, AIV #2). Engines quote visible server HTML, so the answer to
 * "what is the Bend market like for a seller, and what do you charge" sits as
 * plain sentences right under the H1.
 *
 * Every figure is bound to a live read the page makes (getPublicDetachedPace
 * and getSellBendMarket for Bend, detached). A null figure drops its clause;
 * nothing is estimated and nothing prints "null" or "0". The fee is the
 * published LISTING_FEE_PERCENT, and the worked example is that rate times the
 * live median, rounded.
 */
import { formatDate } from '@/lib/format/date'
import { formatPriceExact } from '@/lib/format/money'
import { formatPaceShare } from '@/lib/data/market-truth/public-pace'
import type { MarketKind } from '@/lib/market/classify'
import { LISTING_FEE_PERCENT } from './sell-constants'

export const LISTING_FEE_RATE = 0.03

export type SellDirectAnswerInput = {
  city: string
  medianClose: number | null
  daysToContract: number | null
  saleToOriginal: number | null
  monthsOfSupply: number | null
  verdictKind: MarketKind | null
  verdictLabel: string | null
}

function positive(n: number | null | undefined): n is number {
  return n != null && Number.isFinite(n) && n > 0
}

function joinClauses(parts: string[]): string {
  if (parts.length <= 1) return parts.join('')
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`
}

/** Line 1: the Bend market for a seller. Null when no figure publishes. */
export function sellMarketLine(i: SellDirectAnswerInput): string | null {
  const clauses: string[] = []
  const window = () => (clauses.length === 0 ? ' over the last 12 months' : '')
  if (positive(i.medianClose)) {
    clauses.push(`sold for a median ${formatPriceExact(i.medianClose)}${window()}`)
  }
  if (positive(i.daysToContract)) {
    clauses.push(`went under contract in a median ${Math.round(i.daysToContract)} days${window()}`)
  }
  if (positive(i.saleToOriginal)) {
    clauses.push(
      `closed at a median ${formatPaceShare(i.saleToOriginal)} of their first asking price${window()}`,
    )
  }
  const mos = i.monthsOfSupply
  const verdictKnown =
    positive(mos) && i.verdictKind != null && i.verdictKind !== 'unknown' && !!i.verdictLabel
  const state = verdictKnown
    ? i.verdictKind === 'sellers'
      ? "still a seller's market"
      : `a ${i.verdictLabel}`
    : null

  if (clauses.length === 0) {
    return state ? `With ${mos!.toFixed(1)} months of supply, ${i.city} is ${state}.` : null
  }
  const body = `${i.city} homes ${joinClauses(clauses)}`
  return state ? `${body}, and with ${mos!.toFixed(1)} months of supply ${i.city} is ${state}.` : `${body}.`
}

/** Line 2: what we charge, with the worked figure when the median publishes. */
export function sellFeeLine(i: Pick<SellDirectAnswerInput, 'medianClose'>): string {
  const worked = positive(i.medianClose)
    ? `, which is ${formatPriceExact(Math.round(i.medianClose * LISTING_FEE_RATE))} on a ${formatPriceExact(i.medianClose)} home`
    : ''
  return `We list your home for ${LISTING_FEE_PERCENT} of the sale price with no add-on fees${worked}, and anything paid to the buyer's agent is a separate number you negotiate offer by offer.`
}

/** "Oct 8, 2026", in Pacific time. */
export function sellAsOfLabel(now: Date = new Date()): string {
  return formatDate(now)
}
