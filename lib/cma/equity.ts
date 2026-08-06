/**
 * CMA equity-position section (Matt 2026-08-06) — the opening emotional beat
 * of the document, answering "what have you actually made on this house?"
 * told entirely in facts: what the subject's owner paid, and what today's
 * opinion of value says they've made since. Purchase price to today's
 * recommended price, nothing more. No mortgage assumptions, no net-proceeds
 * math, no "you could walk away with." A block whose prior sale cannot be
 * verified returns null and the section simply does not render (§0: cut,
 * don't guess).
 */

import type { CmaPriorSaleRow } from '@/lib/data/cma/builderReads'

export interface CmaEquityPosition {
  purchasePrice: number
  /** ISO date, as stored on the prior sale's CloseDate. */
  purchaseDate: string
  /** 1 decimal. */
  yearsHeld: number
  gainDollars: number
  /** 1 decimal. */
  gainPct: number
  /** CAGR, 1 decimal. Null unless the true (unrounded) hold is at least a full year. */
  annualizedPct: number | null
  source: string
}

const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000
const MIN_YEARS_HELD = 0.5
const MIN_YEARS_FOR_CAGR = 1

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Purchase price vs. today's recommended list-price opinion of value.
 * Never estimates: returns null when there is no prior sale, the purchase
 * price is not positive, the sale postdates the current listing cycle (its
 * CloseDate is after `asOf`), or the true hold is under six months.
 */
export function computeEquityPosition(args: {
  priorSale: CmaPriorSaleRow | null
  recommendedPrice: number
  asOf: Date
}): CmaEquityPosition | null {
  const { priorSale, recommendedPrice, asOf } = args
  if (!priorSale) return null

  const purchasePrice = Number(priorSale.ClosePrice)
  if (!Number.isFinite(purchasePrice) || purchasePrice <= 0) return null
  if (!Number.isFinite(recommendedPrice) || recommendedPrice <= 0) return null

  const purchaseDate = new Date(priorSale.CloseDate)
  if (Number.isNaN(purchaseDate.getTime())) return null
  // The "prior" sale isn't prior at all — it landed after (or at) the date
  // this CMA is being built for, i.e. it's the current cycle's own close.
  if (purchaseDate.getTime() > asOf.getTime()) return null

  const yearsHeldRaw = (asOf.getTime() - purchaseDate.getTime()) / MS_PER_YEAR
  if (yearsHeldRaw < MIN_YEARS_HELD) return null

  const gainDollars = recommendedPrice - purchasePrice
  const gainPct = round1((gainDollars / purchasePrice) * 100)
  const annualizedPct =
    yearsHeldRaw >= MIN_YEARS_FOR_CAGR
      ? round1((Math.pow(recommendedPrice / purchasePrice, 1 / yearsHeldRaw) - 1) * 100)
      : null

  return {
    purchasePrice,
    purchaseDate: priorSale.CloseDate,
    yearsHeld: round1(yearsHeldRaw),
    gainDollars,
    gainPct,
    annualizedPct,
    source: `Supabase listings, StandardStatus='Closed', subject's own prior sale at this address: 1 row (ClosePrice=${purchasePrice}, CloseDate=${priorSale.CloseDate})`,
  }
}
