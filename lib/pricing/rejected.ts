/**
 * Considered and not used.
 *
 * An appraisal names the sales it looked at and set aside, with the reason
 * (research brief 2026-09-07, item 10). Our document asserted a search radius
 * and showed nothing that failed it, so a reader had no way to see that the
 * bigger house down the street was looked at and rejected rather than missed.
 *
 * Two things reject a sale after the ladder has already run:
 *
 *  · the per-sale comparability review, which drops sales from a different
 *    segment before any math; and
 *  · the price-per-square-foot outlier trim, which drops a sale sitting far
 *    outside the rest of the set.
 *
 * THE REASON IS OURS, NOT THE REVIEW'S. The comparability review is an LLM and
 * its prose is not word-sanitized, so it never reaches a seller's page. Every
 * reason below is composed here from the sale's own recorded facts against the
 * reader's home, in the order that matters to a reader — a different kind of
 * home, then size, then age, then how long ago it sold, then distance — and
 * the first true one is the reason printed. A sale whose facts show nothing
 * material gets an honest generic line rather than an invented specific.
 */

import { productTypeCompatible } from '@/lib/cma/market-area'

const MAX_REJECTED = 8

/** Size gap at or above this share of the reader's home is worth stating. */
const SIZE_GAP = 0.2
/** Years apart at or above this is worth stating. */
const AGE_GAP = 20
/** A sale older than this is stated as old rather than as anything else. */
const STALE_MONTHS = 12

const MS_PER_MONTH = 30.44 * 86_400_000

export interface RejectedCandidate {
  listingKey: string
  address: string
  sqft?: number | null
  yearBuilt?: number | null
  propertySubType?: string | null
  closeDate?: string | null
  proximity?: string | null
}

export interface RejectedSale {
  /** Null on an outlier trim, which records the address and not the key. */
  listingKey: string | null
  address: string
  reason: string
}

/**
 * Product comparability through the engine's own rule, not string equality.
 * "Manufactured" against "Manufactured On Land" is the SAME kind of home to the
 * selector, and a live 2026-09-07 check of cma-64726-horseman had this printing
 * "a manufactured, and yours is a manufactured on land" — a distinction with no
 * meaning to a reader, on three sales the review dropped for other reasons.
 */
function sameProduct(a: string | null | undefined, b: string | null | undefined): boolean {
  const norm = (s: string | null | undefined) => (s ?? '').trim()
  if (!norm(a) || !norm(b)) return true
  return productTypeCompatible(norm(b), norm(a))
}

/** "a townhouse, and yours is a single family residence" */
function productPhrase(sale: string | null | undefined, subject: string | null | undefined): string {
  return `a ${String(sale).trim().toLowerCase()}, and yours is a ${String(subject).trim().toLowerCase()}`
}

function monthsSince(closeDate: string | null | undefined, asOfMs: number): number | null {
  if (!closeDate) return null
  const t = new Date(String(closeDate)).getTime()
  if (!Number.isFinite(t)) return null
  return Math.max(0, (asOfMs - t) / MS_PER_MONTH)
}

/**
 * The first true, material fact about this sale against the reader's home.
 * Never the review's own words.
 */
export function rejectionReason(
  sale: RejectedCandidate,
  subject: { sqft?: number | null; yearBuilt?: number | null; propertySubType?: string | null },
  asOfMs: number = Date.now(),
): string {
  if (!sameProduct(sale.propertySubType, subject.propertySubType)) {
    return productPhrase(sale.propertySubType, subject.propertySubType)
  }
  const subjectSqft = Number(subject.sqft)
  const saleSqft = Number(sale.sqft)
  if (subjectSqft > 0 && saleSqft > 0 && Math.abs(saleSqft - subjectSqft) / subjectSqft >= SIZE_GAP) {
    return `${saleSqft.toLocaleString('en-US')} square feet against your ${subjectSqft.toLocaleString('en-US')}`
  }
  const subjectYear = Number(subject.yearBuilt)
  const saleYear = Number(sale.yearBuilt)
  if (subjectYear > 0 && saleYear > 0 && Math.abs(saleYear - subjectYear) >= AGE_GAP) {
    return `built in ${saleYear}, and yours in ${subjectYear}`
  }
  const months = monthsSince(sale.closeDate, asOfMs)
  if (months != null && months > STALE_MONTHS) {
    return `sold ${Math.round(months)} months ago`
  }
  if (sale.proximity && sale.proximity.trim()) {
    return `${sale.proximity.trim()} from your home`
  }
  return 'a different kind of home from the sales that set this price'
}

/**
 * The considered-and-not-used list, capped at eight.
 *
 * The comparability review's exclusions come first — they are the substantive
 * ones — then the price-per-square-foot outliers, which are stated as what they
 * are: a sale priced far away from the rest.
 */
export function buildRejectedSales(args: {
  candidates: readonly RejectedCandidate[]
  excludedKeys: readonly string[]
  outliers?: readonly { address: string; closePrice: number; ppsf: number; reason: string }[]
  subject: { sqft?: number | null; yearBuilt?: number | null; propertySubType?: string | null }
  asOfMs?: number
  limit?: number
}): RejectedSale[] {
  const limit = args.limit ?? MAX_REJECTED
  const asOfMs = args.asOfMs ?? Date.now()
  const byKey = new Map(args.candidates.map((c) => [c.listingKey, c]))
  const out: RejectedSale[] = []
  const seen = new Set<string>()

  for (const key of args.excludedKeys) {
    const sale = byKey.get(key)
    if (!sale || seen.has(key)) continue
    seen.add(key)
    out.push({
      listingKey: key,
      address: sale.address,
      reason: rejectionReason(sale, args.subject, asOfMs),
    })
    if (out.length >= limit) return out
  }

  for (const outlier of args.outliers ?? []) {
    if (out.length >= limit) break
    const ppsf = Math.round(Number(outlier.ppsf))
    out.push({
      listingKey: null,
      address: outlier.address,
      reason:
        ppsf > 0
          ? `sold at $${ppsf.toLocaleString('en-US')} a square foot, outside the range of the sales that set this price`
          : 'priced well outside the range of the sales that set this price',
    })
  }
  return out
}
