/**
 * Considered and not used.
 *
 * An appraisal names the sales it looked at and set aside, with the reason
 * (research brief 2026-09-07, item 10). Our document asserted a search radius
 * and showed nothing that failed it, so a reader had no way to see that the
 * bigger house down the street was looked at and rejected rather than missed.
 *
 * TWO RULES GOVERN THIS FILE, both written after the 2026-09-07 document pass.
 *
 * 1. A SALE THE GRID PRINTS CAN NEVER APPEAR HERE. On cma-65365-concorde five
 *    of the six sales in the grid also printed under "considered and not used",
 *    because the list was built from the comparability review's exclusions
 *    while the price was built from the FULL set — the review had asked to drop
 *    more sales than the comp floor allows, so nothing was actually dropped.
 *    The kept set is therefore an input here, not an assumption: every key and
 *    every address the grid renders is removed before a row is written, and no
 *    sale is written twice.
 *
 * 2. A REASON STATES THE RULE THAT CUT THE SALE, NEVER A FACT ABOUT IT. The old
 *    last-resort branch printed "0.18 miles NE from your home", so a reader saw
 *    a CLOSER home rejected than the ones kept and the section argued against
 *    the document around it. Distance is gone. What is left is a ladder of
 *    rules the engine actually applies — a different kind of home, a different
 *    bath count, the far side of US-97, outside the two-year window — each of
 *    which is stated only when it is TRUE AND DISCRIMINATING: a size or age gap
 *    is named only when it is wider than the widest gap among the sales that
 *    did set the price, which is the guard the distance branch never had.
 *    Below that sits the comparability review's own stated reason, rewritten
 *    into seller language. A sale with no recoverable rule is OMITTED. An
 *    honest short list beats a long one padded with facts dressed as reasons.
 */

import { bathCountCompatible, productTypeCompatible } from '@/lib/cma/market-area'
import { sanitizeClientProse } from '@/lib/cma/voice-sanitize'
import { crossesUs97 } from '@/lib/pricing/highway-cross'

const MAX_REJECTED = 8

/** Size gap at or above this share of the reader's home is worth stating. */
const SIZE_GAP = 0.2
/** Years apart at or above this is worth stating. */
const AGE_GAP = 20
/**
 * The window the analysis draws from. Mirrors COMP_MAX_AGE_MONTHS in
 * lib/cma/contract.ts, which is the check that fails a build over it. Held
 * locally so lib/pricing does not import the CMA contract to write a sentence.
 */
const WINDOW_MONTHS = 24

const MS_PER_MONTH = 30.44 * 86_400_000

export interface RejectedCandidate {
  listingKey: string
  address: string
  sqft?: number | null
  yearBuilt?: number | null
  baths?: number | null
  propertySubType?: string | null
  closeDate?: string | null
  latitude?: number | null
  longitude?: number | null
}

export interface RejectionSubject {
  sqft?: number | null
  yearBuilt?: number | null
  baths?: number | null
  propertySubType?: string | null
  latitude?: number | null
  longitude?: number | null
}

/**
 * A sale the grid prints. Two jobs: it is removed from this list, and it sets
 * the bar a numeric reason has to clear before it may be stated as one.
 */
export interface KeptSale {
  listingKey: string
  address: string
  sqft?: number | null
  yearBuilt?: number | null
  closeDate?: string | null
  closePrice?: number | null
}

/** What the kept set makes true, so a reason can be checked against it. */
export interface RejectionContext {
  /** Widest size gap among the kept sales, as a share of the reader's home. */
  widestKeptSizeGap?: number | null
  /** Widest year gap among the kept sales. */
  widestKeptAgeGap?: number | null
  /** Months since the OLDEST kept sale closed. */
  oldestKeptMonths?: number | null
  /** Median $ per square foot across the kept sales. */
  keptMedianPpsf?: number | null
  /** What the comparability review said, when the review is what cut this sale. */
  reviewReason?: string | null
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

function monthsSince(closeDate: string | null | undefined, asOfMs: number): number | null {
  if (!closeDate) return null
  const t = new Date(String(closeDate)).getTime()
  if (!Number.isFinite(t)) return null
  return Math.max(0, (asOfMs - t) / MS_PER_MONTH)
}

function num(n: unknown): number | null {
  const v = Number(n)
  return Number.isFinite(v) && v > 0 ? v : null
}

/** "3" · "2.5" — a half bath is real to a reader, a trailing zero is not. */
function bathLabel(n: number): string {
  return String(Math.round(n * 10) / 10)
}

/**
 * The comparability review's own words, in seller language, or null.
 *
 * The review is an LLM. Its prose carries model punctuation and the trade's
 * vocabulary, neither of which belongs on a page a seller reads, so it is
 * punctuation-sanitized and its jargon is mapped to the words a seller uses.
 *
 * TRANSLATION IS WHITELISTED, NOT BLANKET. "comp" for "sale" and "tier" for
 * "level" are noun-for-noun and always read. "subject" is not: the review
 * writes "12 years after the 2004 subject", and a blanket swap produces "the
 * 2004 your home" on a page a seller reads. Only the closed forms are
 * translated; a bare "subject" that survives means the sentence cannot be put
 * into seller language, and the row is OMITTED rather than shipped mangled.
 */
export function sellerizeReviewReason(raw: string | null | undefined): string | null {
  const first = sanitizeClientProse(String(raw ?? '')).split(/(?<=[.!?])\s+/)[0] ?? ''
  const mapped = first
    .replace(/\bthe subject(?:'|\u2019)s\b/gi, "your home's")
    .replace(/\bsubject(?:'|\u2019)s\b/gi, "your home's")
    .replace(/\bthe subject property\b/gi, 'your home')
    .replace(/\bsubject property\b/gi, 'your home')
    .replace(/\bthe subject\b/gi, 'your home')
    .replace(/\bcomparables\b/gi, 'sales')
    .replace(/\bcomparable\b/gi, 'sale')
    .replace(/\bcomps\b/gi, 'sales')
    .replace(/\bcomp\b/gi, 'sale')
    .replace(/\btiers\b/gi, 'levels')
    .replace(/\btier\b/gi, 'level')
    .replace(/\bbands\b/gi, 'ranges')
    .replace(/\bband\b/gi, 'range')
    .replace(/\s+/g, ' ')
    .replace(/[.\s]+$/, '')
    .trim()
  if (!mapped) return null
  // A term with no seller word, or a "subject" no closed form could translate.
  if (/\b(subject|ladder|rung|percentile|regression|adjustment grid)\b/i.test(mapped)) return null
  // A paragraph is not a reason. One clause, or nothing.
  if (mapped.length > 160) return null
  // The first letter is left alone. Lowercasing it to fit the lead-in turned
  // "Dry Canyon 55+ community" into "dry Canyon 55+ community"; a capital after
  // a colon reads correctly and a mangled place name does not.
  return mapped
}

/**
 * The rule that cut this sale, or null when none is recoverable.
 *
 * Order is rule severity as the engine applies it: a different kind of home,
 * then bath count, then the far side of US-97, then outside the window — all
 * hard selector rules — then the size and age gaps and recency, each of which
 * must beat every sale that DID set the price before it may be stated, then
 * whatever the comparability review said in its own words.
 */
export function rejectionReason(
  sale: RejectedCandidate,
  subject: RejectionSubject,
  asOfMs: number = Date.now(),
  context: RejectionContext = {},
): string | null {
  if (!sameProduct(sale.propertySubType, subject.propertySubType)) {
    return `a different kind of home: a ${String(sale.propertySubType).trim().toLowerCase()}, and yours is a ${String(
      subject.propertySubType,
    )
      .trim()
      .toLowerCase()}`
  }

  const subjectBaths = num(subject.baths)
  const saleBaths = num(sale.baths)
  if (subjectBaths != null && saleBaths != null && !bathCountCompatible(subjectBaths, saleBaths)) {
    return `${bathLabel(saleBaths)} baths against your ${bathLabel(subjectBaths)}`
  }

  if (
    crossesUs97(
      { lat: subject.latitude ?? NaN, lng: subject.longitude ?? NaN },
      { lat: sale.latitude ?? NaN, lng: sale.longitude ?? NaN },
    )
  ) {
    return 'across US-97 from your home, a different pool of buyers'
  }

  const months = monthsSince(sale.closeDate, asOfMs)
  if (months != null && months > WINDOW_MONTHS) {
    return `sold ${Math.round(months)} months ago, outside the two years this analysis draws from`
  }

  // A gap is a reason only when it is WIDER than the widest gap among the sales
  // that set the price. Without that guard this repeats the distance bug: a
  // sale rejected on a measure the kept sales score worse on.
  const subjectSqft = num(subject.sqft)
  const saleSqft = num(sale.sqft)
  if (subjectSqft != null && saleSqft != null) {
    const gap = Math.abs(saleSqft - subjectSqft) / subjectSqft
    const bar = context.widestKeptSizeGap
    if (gap >= SIZE_GAP && (bar == null || gap > bar)) {
      return `${saleSqft.toLocaleString('en-US')} square feet against your ${subjectSqft.toLocaleString('en-US')}`
    }
  }

  const subjectYear = num(subject.yearBuilt)
  const saleYear = num(sale.yearBuilt)
  if (subjectYear != null && saleYear != null) {
    const gap = Math.abs(saleYear - subjectYear)
    const bar = context.widestKeptAgeGap
    if (gap >= AGE_GAP && (bar == null || gap > bar)) {
      return `built in ${saleYear}, and yours in ${subjectYear}`
    }
  }

  if (months != null && context.oldestKeptMonths != null && months > context.oldestKeptMonths) {
    return `sold ${Math.round(months)} months ago, longer ago than any sale that set this price`
  }

  const review = sellerizeReviewReason(context.reviewReason)
  if (review) return `our comparability review set it aside: ${review}`

  return null
}

/** Addresses are the only key an outlier trim carries, so match them loosely. */
function addressKey(address: string): string {
  return address.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.,]+$/, '')
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

/** What the kept set makes true. Derived once, per build. */
function contextFromKept(
  kept: readonly KeptSale[],
  subject: RejectionSubject,
  asOfMs: number,
): RejectionContext {
  const subjectSqft = num(subject.sqft)
  const subjectYear = num(subject.yearBuilt)
  const sizeGaps = kept
    .map((k) => {
      const s = num(k.sqft)
      return subjectSqft != null && s != null ? Math.abs(s - subjectSqft) / subjectSqft : null
    })
    .filter((n): n is number => n != null)
  const ageGaps = kept
    .map((k) => {
      const y = num(k.yearBuilt)
      return subjectYear != null && y != null ? Math.abs(y - subjectYear) : null
    })
    .filter((n): n is number => n != null)
  const ages = kept
    .map((k) => monthsSince(k.closeDate, asOfMs))
    .filter((n): n is number => n != null)
  const ppsfs = kept
    .map((k) => {
      const price = num(k.closePrice)
      const sqft = num(k.sqft)
      return price != null && sqft != null ? price / sqft : null
    })
    .filter((n): n is number => n != null)
  return {
    widestKeptSizeGap: sizeGaps.length > 0 ? Math.max(...sizeGaps) : null,
    widestKeptAgeGap: ageGaps.length > 0 ? Math.max(...ageGaps) : null,
    oldestKeptMonths: ages.length > 0 ? Math.max(...ages) : null,
    keptMedianPpsf: median(ppsfs),
  }
}

/**
 * The considered-and-not-used list, capped at eight.
 *
 * The comparability review's exclusions come first — they are the substantive
 * ones — then the price-per-square-foot outliers, which are stated as what they
 * are: a sale priced far away from the rest. A sale the grid prints is never in
 * either group, and a sale with no recoverable rule is left out entirely.
 */
export function buildRejectedSales(args: {
  candidates: readonly RejectedCandidate[]
  /** What the comparability review set aside, with its own stated reason. */
  excluded: readonly { listingKey: string; reason?: string | null }[]
  /** The sales the grid prints. Never listed here, whatever else says so. */
  kept: readonly KeptSale[]
  outliers?: readonly { address: string; closePrice: number; ppsf: number; reason: string }[]
  subject: RejectionSubject
  asOfMs?: number
  limit?: number
}): RejectedSale[] {
  const limit = args.limit ?? MAX_REJECTED
  const asOfMs = args.asOfMs ?? Date.now()
  const context = contextFromKept(args.kept, args.subject, asOfMs)
  const byKey = new Map(args.candidates.map((c) => [c.listingKey, c]))

  // Rule 1: the printed set is the exclusion, by key AND by address — an
  // outlier trim carries no key, and the same sale can reach here under a
  // second key from a different query shape.
  const keptKeys = new Set(args.kept.map((k) => k.listingKey))
  const keptAddresses = new Set(args.kept.map((k) => addressKey(k.address)))

  const out: RejectedSale[] = []
  const seenKeys = new Set<string>()
  const seenAddresses = new Set<string>()

  const take = (row: RejectedSale): boolean => {
    const addr = addressKey(row.address)
    if (row.listingKey != null) {
      if (keptKeys.has(row.listingKey) || seenKeys.has(row.listingKey)) return false
    }
    if (keptAddresses.has(addr) || seenAddresses.has(addr)) return false
    if (row.listingKey != null) seenKeys.add(row.listingKey)
    seenAddresses.add(addr)
    out.push(row)
    return true
  }

  for (const entry of args.excluded) {
    if (out.length >= limit) return out
    const sale = byKey.get(entry.listingKey)
    if (!sale) continue
    if (keptKeys.has(entry.listingKey) || seenKeys.has(entry.listingKey)) continue
    const reason = rejectionReason(sale, args.subject, asOfMs, {
      ...context,
      reviewReason: entry.reason ?? null,
    })
    if (!reason) continue
    take({ listingKey: entry.listingKey, address: sale.address, reason })
  }

  for (const outlier of args.outliers ?? []) {
    if (out.length >= limit) break
    const ppsf = Math.round(Number(outlier.ppsf))
    const bar = context.keptMedianPpsf
    const gapPct = bar != null && bar > 0 && ppsf > 0 ? Math.round((ppsf / bar - 1) * 100) : null
    const reason =
      ppsf > 0 && gapPct != null && gapPct !== 0
        ? `sold at $${ppsf.toLocaleString('en-US')} a square foot, ${Math.abs(gapPct)} percent ${
            gapPct > 0 ? 'above' : 'below'
          } the sales that set this price`
        : ppsf > 0
          ? `sold at $${ppsf.toLocaleString('en-US')} a square foot, outside the range of the sales that set this price`
          : 'priced well outside the range of the sales that set this price'
    take({ listingKey: null, address: outlier.address, reason })
  }
  return out
}
