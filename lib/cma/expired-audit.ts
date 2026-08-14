/**
 * Expired Audit — the expired-listing variant of the CMA (Matt directive
 * 2026-07-14: "CMAs (sellers), EXPIRED AUDITS, BPOs (buyers). All three use the
 * same pricing engine but the output is tailored for each scenario").
 *
 * The shared engine (comps → judge → pricing → adversarial audit → contract →
 * site intelligence) runs identically. This module adds the three audit-only
 * layers, each deterministic:
 *
 *  1. FAILURE ANALYSIS — why the listing didn't sell, derived from the numbers
 *     (final ask vs the comp-supported range, DOM vs the market median, the
 *     price-cut pattern, attempt count, photo count, remarks length). Voice per
 *     VOICE.md + the expired-listing-lp SKILL: the data tells the
 *     story, never editorialize, NEVER blame the prior agent, no "most agents
 *     do X" framing.
 *  2. THIS-HOME PLAN — how we would market THIS address (list-kit first:
 *     listing video, flyers, photo set). Generic services (3D, weekly report,
 *     MLS) stay secondary. Never a "/sell brochure" hero.
 *  3. NET SHEET — estimated seller proceeds at the recommended price, at the
 *     2.5% expired-listing rate (our normal rate is 3% — stated explicitly).
 *     Our fee facts come from Matt (the principal broker). Third-party costs
 *     are labeled estimates. Math is computed here, penny-exact, and traced.
 */

import type { CmaPricing, CmaSubject } from '@/lib/cma/types'
import type { CmaMarketContext } from '@/lib/cma/types'
import type { BpoListingHistory } from '@/lib/bpo/types'

// ── Fee facts (Matt, principal broker, 2026-07-14) ──────────────────────────
/** Listing fee for every expired-listing engagement. */
export const EXPIRED_LISTING_FEE_PCT = 2.5
/** Our normal listing fee (the site's Enhanced plan) — stated for contrast. */
export const STANDARD_LISTING_FEE_PCT = 3.0
/** Net-sheet assumption for buyer-broker compensation. Negotiable per offer
 *  under the current rules; the seller decides. Shown as an assumption line. */
export const BUYER_BROKER_ASSUMPTION_PCT = 2.5

export interface ExpiredFailureFinding {
  /** Which of the audit lenses this belongs to. 'Ownership' is deliberately
   *  display-cased: the renderer (lib/cma/render.ts expiredAuditPage) falls
   *  back to the raw lens string for values missing from LENS_LABELS, so this
   *  value renders as a correct sentence-case subhead without a render change. */
  lens: 'pricing' | 'time-on-market' | 'price-cuts' | 'attempts' | 'presentation' | 'Ownership'
  /** The factual observation (numbers, no adjectives). */
  fact: string
  /** What it means for the relist, plainly stated. */
  meaning: string
}

export interface ExpiredNetSheetLine {
  label: string
  amount: number | null
  /** true = our fee (fact); false = third-party estimate the seller confirms. */
  isOurFee: boolean
  note: string | null
}

export interface ExpiredNetSheet {
  salePrice: number
  lines: ExpiredNetSheetLine[]
  totalCosts: number
  estimatedNet: number
  /** The engine's conservative + high-end nets for the same cost structure. */
  netConservative: number
  netHighEnd: number
  assumptions: string[]
}

export interface ExpiredAuditData {
  findings: ExpiredFailureFinding[]
  services: string[]
  netSheet: ExpiredNetSheet
  feeLine: string
}

const usd = (n: number) => `$${Math.round(n).toLocaleString()}`

/**
 * Ownership-tenure line for the pricing/context section — 'Owned since YYYY
 * (N years)' when a primary source proves the date, omitted when none does
 * (§0: never estimated). Source priority:
 *   1. `ownershipSince` — the county deed record resolved by the owner-lookup
 *      chain (lib/expired-owner-lookup.ts fetchDialOwnershipSince), when the
 *      caller passes it through.
 *   2. `history.lastSaleDate` — the last closed MLS sale at the address, which
 *      the engine already reconstructed and traced (lib/bpo/history.ts).
 * Exported for tests. Returns null when neither source has a usable date or
 * the date does not precede the audited listing period.
 */
export function buildOwnershipFinding(args: {
  history: BpoListingHistory
  ownershipSince?: string | null
  asOf?: Date
}): ExpiredFailureFinding | null {
  const { history } = args
  const asOf = args.asOf ?? new Date()

  const fromCounty = args.ownershipSince?.trim() || null
  const fromMls = history.lastSaleDate?.trim() || null
  const since = fromCounty ?? fromMls
  if (!since || !/^\d{4}-\d{2}-\d{2}/.test(since)) return null
  const sinceDate = new Date(since.slice(0, 10))
  if (Number.isNaN(sinceDate.getTime())) return null

  const ms = asOf.getTime() - sinceDate.getTime()
  if (ms < 0) return null
  // Tenure must predate the listing period we are auditing — a sale recorded
  // after the final cycle listed means the record is not this owner's story.
  const cycleListDate = history.currentCycle?.listDate
  if (cycleListDate && since.slice(0, 10) > String(cycleListDate).slice(0, 10)) return null

  const years = Math.floor(ms / (365.2425 * 86_400_000))
  const yearsLabel = years >= 1 ? `${years} ${years === 1 ? 'year' : 'years'}` : 'under a year'
  const yyyy = since.slice(0, 4)

  const fact = fromCounty
    ? `Owned since ${yyyy} (${yearsLabel}) per the county deed record.`
    : `Owned since ${yyyy} (${yearsLabel}). The MLS record shows the last sale at this address closed in ${yyyy}${
        history.lastSalePrice ? ` at ${usd(history.lastSalePrice)}` : ''
      }.`

  const meaning =
    years >= 5
      ? 'That much time in one home shifts the relist conversation from the last ask to your net. The net sheet in this report runs the numbers at the recommended price.'
      : 'A recent purchase price anchors expectations. The comparable sales in this report are the market\'s current answer, independent of what was paid.'

  return { lens: 'Ownership', fact, meaning }
}

/**
 * Deterministic failure analysis. Every finding derives from a number the
 * engine verified; anything not supported by data is simply absent.
 */
export function buildFailureFindings(args: {
  subject: CmaSubject
  pricing: CmaPricing
  market: CmaMarketContext | null
  history: BpoListingHistory
  photosCount: number | null
  /** County-deed ownership start (getExpiredOwnershipSince / the owner-lookup),
   *  or null when no county date resolved — buildOwnershipFinding then falls back
   *  to the last closed MLS sale in `history`. REQUIRED (not optional) so the
   *  call site can never silently drop it again: tsc/ci:commit-compiles fails if
   *  buildFailureFindings is called without it. Pass `null` for the MLS fallback. */
  ownershipSince: string | null
}): ExpiredFailureFinding[] {
  const { subject, pricing, market, history, photosCount } = args
  const findings: ExpiredFailureFinding[] = []

  // 1. Pricing — the final ask measured against the range the comps support
  // TODAY. Meanings speak to the RELIST in present tense: the market may have
  // moved since the listing period, so past-tense causation is never asserted
  // (adversarial-audit fairness finding 2026-07-14).
  const finalAsk = subject.lastListPrice
  const askAboveRange = finalAsk != null && pricing.highEnd > 0 && finalAsk > pricing.highEnd
  if (finalAsk && pricing.highEnd > 0) {
    const yoy = market?.yoyMedianPriceDeltaPct
    const marketMoveNote =
      yoy != null && Math.abs(yoy) >= 2
        ? ` ${market?.geoLabel ?? 'The market'} moved ${Math.abs(yoy).toFixed(1)}% ${yoy > 0 ? 'up' : 'down'} over the past year, so part of any gap reflects the market shifting after the listing period.`
        : ''
    if (askAboveRange) {
      const overPct = ((finalAsk - pricing.highEnd) / pricing.highEnd) * 100
      findings.push({
        lens: 'pricing',
        fact: `The final asking price was ${usd(finalAsk)}. The comparable sales support ${usd(pricing.conservative)} to ${usd(pricing.highEnd)} today, which puts that ask ${overPct.toFixed(1)}% above the top of the supported range.`,
        meaning: `At that number today, the ask sits above what the closed sales support. Buyers cross-shop the same comparables, and a price above the supported range narrows the pool.${marketMoveNote}`,
      })
    } else if (finalAsk >= pricing.conservative) {
      findings.push({
        lens: 'pricing',
        fact: `The final asking price was ${usd(finalAsk)}, inside the ${usd(pricing.conservative)} to ${usd(pricing.highEnd)} range the comparable sales support today.`,
        meaning: `Measured against today's comparables, the last price is defensible.${marketMoveNote}`,
      })
    } else {
      findings.push({
        lens: 'pricing',
        fact: `The final asking price was ${usd(finalAsk)}, below the ${usd(pricing.conservative)} to ${usd(pricing.highEnd)} range the comparable sales support today.`,
        meaning: `Measured against today's comparables, a relist has room above the last ask.${marketMoveNote}`,
      })
    }
  }

  // 1.6. Ownership tenure — 'Owned since YYYY (N years)' in the pricing
  // context, only when the county deed record or the last closed MLS sale
  // proves the date (§0: omitted when unknown, never estimated).
  const ownership = buildOwnershipFinding({ history, ownershipSince: args.ownershipSince })
  if (ownership) findings.push(ownership)

  // 2. Time on market. Use the FINAL CYCLE's own exposure (list to off-market),
  // not CumulativeDaysOnMarket — the market median is a single-cycle measure,
  // and a relisted property's cumulative count would compare mismatched units
  // (adversarial-audit correctness finding 2026-07-14).
  const cycle = history.currentCycle
  const cycleDom = (() => {
    if (cycle?.listDate && cycle?.offMarketDate) {
      const d = Math.round((new Date(cycle.offMarketDate).getTime() - new Date(cycle.listDate).getTime()) / 86_400_000)
      if (Number.isFinite(d) && d >= 0) return d
    }
    return cycle?.daysOnMarket ?? null
  })()
  const medianDom = market?.medianDom ?? null
  if (cycleDom != null && medianDom != null && medianDom > 0) {
    const ratio = cycleDom / medianDom
    findings.push({
      lens: 'time-on-market',
      fact: `${cycleDom} days on market for the final listing period, against a ${Math.round(medianDom)}-day median for ${market?.geoLabel ?? 'the market'}.`,
      meaning:
        ratio >= 2
          ? 'A listing sitting at multiple times the median reads as stale to buyers and their agents, and stale listings tend to draw lower offers.'
          : ratio >= 1.2
            ? 'Longer than typical, but not unrecoverable. A reset with correct pricing restarts the clock.'
            : 'Time on market was inside the normal band.',
    })
  }

  // 3. Price-cut pattern. The "chasing the market" reading applies only to a
  // MATERIAL path (3%+ or multiple cuts); a modest single trim gets a neutral
  // meaning, and the static-price observation only matters when the ask sat
  // above the supported range (fairness finding 2026-07-14).
  if (cycle && cycle.originalListPrice && cycle.finalListPrice && cycle.originalListPrice > cycle.finalListPrice) {
    const cut = cycle.originalListPrice - cycle.finalListPrice
    const cutPct = (cut / cycle.originalListPrice) * 100
    const cuts = cycle.priceCutCount ?? 0
    const material = cutPct >= 3 || cuts >= 2
    findings.push({
      lens: 'price-cuts',
      fact: `The ask moved from ${usd(cycle.originalListPrice)} to ${usd(cycle.finalListPrice)}, a ${usd(cut)} reduction (${cutPct.toFixed(1)}%)${cuts > 0 ? ` over ${cuts} cut${cuts === 1 ? '' : 's'}` : ''}.`,
      meaning: material
        ? 'Chasing the market down teaches buyers to wait. Starting at the supported number outperforms starting high and cutting.'
        : 'The path shows one modest adjustment during the listing period.',
    })
  } else if (cycle && cycle.originalListPrice && cycle.originalListPrice === cycle.finalListPrice && askAboveRange) {
    findings.push({
      lens: 'price-cuts',
      fact: `The asking price never moved from ${usd(cycle.originalListPrice)} across the full listing period.`,
      meaning: 'A static price on a sitting listing sends no new signal to the market.',
    })
  }

  // 4. Attempts (relistings).
  if (history.failedAttemptsCount >= 2) {
    findings.push({
      lens: 'attempts',
      fact: `This property has been listed ${history.attemptsCount} times, with ${history.failedAttemptsCount} attempts ending without a sale${history.peakAskingPrice ? `, peaking at ${usd(history.peakAskingPrice)}` : ''}.`,
      meaning: 'Buyers and their agents can see the full history. The next attempt has to look different on day one, in price and in presentation, or it inherits the history.',
    })
  }

  // 5. Presentation signals (deterministic only: photo count + remarks length).
  const remarksLen = subject.publicRemarks?.trim().length ?? 0
  if (photosCount != null && photosCount > 0 && photosCount < 20) {
    findings.push({
      lens: 'presentation',
      // "MLS record shows" — media can be reduced after a listing terminates,
      // so the fact claims only what the record proves today (audit finding).
      fact: `The MLS record shows ${photosCount} photos on the listing.`,
      meaning: 'A thin photo set gives buyers less reason to book a showing.',
    })
  }
  if (remarksLen > 0 && remarksLen < 400) {
    findings.push({
      lens: 'presentation',
      fact: `The public description ran ${remarksLen} characters.`,
      meaning: 'A short description leaves the specific features that differentiate this home unsaid, and portals index every word.',
    })
  }

  return findings
}

export type ThisHomePlanSubject = {
  streetAddress?: string | null
}

/**
 * How we would market THIS house. Hero lines name the address when we have
 * it (list-kit: video, flyers, photo set). 3D, weekly report, and MLS feeds
 * stay secondary. Omit the address rather than invent one.
 */
export function buildThisHomeMarketingPlan(subject?: ThisHomePlanSubject | null): {
  hero: string[]
  secondary: string[]
} {
  const address = subject?.streetAddress?.trim() || null
  const forHome = address ? `For ${address}` : 'For this home'
  return {
    hero: [
      `${forHome} we cut a listing video from this home's photos.`,
      `${forHome} we build a Just Listed flyer, a feature sheet, and an Instagram carousel from this address.`,
      `${forHome} we shoot a photo set made for this house.`,
    ],
    secondary: [
      'A 3D walkthrough of this home so out-of-area buyers can walk it before they fly in.',
      'A written report every week it is listed: showings, saves, views, and what we are doing next.',
      'Listed on the MLS and the national feeds it syndicates to.',
    ],
  }
}

/** Packet layer 2. Hero is the this-home plan. Secondary is not the lead. */
export function buildServicesList(subject?: ThisHomePlanSubject | null): string[] {
  const plan = buildThisHomeMarketingPlan(subject)
  return [...plan.hero, ...plan.secondary]
}

/**
 * Seller net sheet at the expired rate. Our fees are facts; third-party costs
 * are labeled estimates. Every number computed here, shown with its formula.
 */
export function buildNetSheet(
  pricing: CmaPricing,
  opts?: { expectedConcessions?: number | null },
): ExpiredNetSheet {
  const price = pricing.recommended
  const concessions = opts?.expectedConcessions ?? pricing.sellerNet?.expectedConcessions ?? null

  const listingFee = price * (EXPIRED_LISTING_FEE_PCT / 100)
  const buyerSide = price * (BUYER_BROKER_ASSUMPTION_PCT / 100)
  // Owner's title policy + half escrow, Central Oregon typical band. ESTIMATE —
  // the seller confirms with the title company at listing.
  const titleEscrowEstimate = Math.round(Math.min(Math.max(price * 0.005, 2000), 6000))
  const recordingMisc = 350

  const lines: ExpiredNetSheetLine[] = [
    ...(concessions != null && concessions > 0
      ? [
          {
            label: 'Seller concessions (median of the comparable closed sales, including sales that reported none)',
            amount: -concessions,
            isOurFee: false,
            note: 'Close price is the contract price. This credit comes off that number before commission. It is the comparable-set median, not a quote on this home.',
          } satisfies ExpiredNetSheetLine,
        ]
      : []),
    {
      label: `Listing fee at ${EXPIRED_LISTING_FEE_PCT}% (expired-listing rate. Our standard Enhanced plan runs ${STANDARD_LISTING_FEE_PCT}%)`,
      amount: -listingFee,
      isOurFee: true,
      note: `${EXPIRED_LISTING_FEE_PCT}% × ${usd(price)}. Commission is negotiable and every listing agreement is its own conversation.`,
    },
    {
      label: `Buyer-broker compensation (assumption: ${BUYER_BROKER_ASSUMPTION_PCT}%)`,
      amount: -buyerSide,
      isOurFee: false,
      note: 'Negotiated per offer under the current rules. You decide what, if anything, to offer. Shown here so the estimate is conservative.',
    },
    {
      label: 'Title and escrow (estimate)',
      amount: -titleEscrowEstimate,
      isOurFee: false,
      note: 'Owner\'s title policy plus the seller half of escrow, typical Central Oregon band. Confirm the exact quote with the title company.',
    },
    {
      label: 'Recording and miscellaneous (estimate)',
      amount: -recordingMisc,
      isOurFee: false,
      note: null,
    },
    {
      label: 'County transfer tax',
      amount: 0,
      isOurFee: false,
      note: 'Deschutes County has no real estate transfer tax.',
    },
  ]

  const totalCosts = lines.reduce((s, l) => s + Math.abs(l.amount ?? 0), 0)
  const concessionDollars = concessions != null && concessions > 0 ? concessions : 0
  const costOf = (p: number) =>
    concessionDollars +
    p * (EXPIRED_LISTING_FEE_PCT / 100) +
    p * (BUYER_BROKER_ASSUMPTION_PCT / 100) +
    Math.round(Math.min(Math.max(p * 0.005, 2000), 6000)) +
    recordingMisc

  return {
    salePrice: price,
    lines,
    totalCosts,
    estimatedNet: price - totalCosts,
    netConservative: pricing.conservative - costOf(pricing.conservative),
    netHighEnd: pricing.highEnd - costOf(pricing.highEnd),
    assumptions: [
      'Sale at the recommended list price. The conservative and high-end columns rerun the same costs at the ends of the supported range.',
      'Close price is the contract price. Seller concessions, when shown, are the median of the comparable set and come off the close before commission.',
      'Property-tax prorations, HOA transfer fees, and any repair credits vary by closing date and negotiation, and are not included.',
      'Your mortgage payoff (if any) comes off the estimated net. Your lender provides the exact payoff figure.',
      'Every third-party line is an estimate. It is not a quote. This is not a closing statement.',
    ],
  }
}

/** One-line fee statement for the services page. Like-for-like framing: the
 *  site publishes plans at 2.5% to 3.5%, and most sellers choose the 3%
 *  Enhanced plan — so the honest comparison names the plans rather than
 *  presenting 2.5% as an expired-only concession (audit finding 2026-07-14). */
export function feeLine(): string {
  return `For an expired listing we list at ${EXPIRED_LISTING_FEE_PCT}% of the sale price, where our standard Enhanced plan runs ${STANDARD_LISTING_FEE_PCT}%. Commission is negotiable and every listing agreement is its own conversation.`
}

// ── The failed-ask ceiling (Matt 2026-08-05) ────────────────────────────────

/** How long a failed asking price stays binding evidence. Past this, the
 *  market that rejected it is a different market. */
export const FAILED_ASK_RECENCY_MONTHS = 12

/**
 * Failed→sold backtest calibration. Source of every ratio below:
 * docs/research/cma-backtest-2026-08-05.json, produced by
 * scripts/cma-backtest.mjs over the live corpus — 3,394 same-address pairs
 * (a cycle ending Expired/Canceled/Withdrawn followed by a Closed sale
 * within 18 months), PropertyType 'A', 2023-08-06..2026-08-05. Re-run the
 * script and update this block together; never edit one without the other.
 */
export const FAILED_ASK_BACKTEST = {
  runstamp: '2026-08-05',
  pairs: 3394,
  /** Median eventual close ÷ the ask that failed. */
  closeMedianRatio: 0.942,
  /** 75th percentile of the same ratio. */
  closeP75Ratio: 0.982,
  /** Share of pairs that ever closed above the failed ask. */
  shareClosedAboveAskPct: 12.3,
  /** Median relist ask ÷ failed ask among sellers who then sold. */
  relistAskMedianRatio: 0.964,
  medianMonthsToClose: 5.8,
} as const

export interface FailedAskCapResult {
  applied: boolean
  /** The ceiling used, when applied. */
  cappedTo: number | null
  /** What the comp engine wanted before the ceiling. */
  uncappedRecommended: number | null
}

/**
 * A CMA must never recommend listing ABOVE a price the market just rejected
 * (Matt 2026-08-05: 33% of expired-prospect docs did — up to +36% — because
 * the comp engine carried zero weight for the subject's own failed market
 * test). When the subject's most recent cycle ended without selling within
 * FAILED_ASK_RECENCY_MONTHS, the failed asking price becomes a hard ceiling
 * on every LIST-strategy tier (conservative / recommended / highEnd). The
 * EVIDENCE range (valueLow/valueHigh) stays untouched — it is the comp math,
 * and the gap between it and the ceiling is part of the story the broker and
 * the owner need to see. Capping sets needsReview so a broker looks before
 * anything ships.
 *
 * Mutates `pricing` in place (same contract as the sanitize pass) and returns
 * what happened for the build trace.
 */
export function applyFailedAskCap(
  pricing: {
    conservative: number
    recommended: number
    highEnd: number
    needsReview: boolean
    reviewReason: string | null
    notes: string[]
  },
  args: { lastFailedListPrice: number | null; offMarketDate: string | null; asOf?: Date },
): FailedAskCapResult {
  const none: FailedAskCapResult = { applied: false, cappedTo: null, uncappedRecommended: null }
  const ask = args.lastFailedListPrice
  if (ask == null || !Number.isFinite(ask) || ask <= 0) return none
  if (!args.offMarketDate) return none
  const off = new Date(args.offMarketDate)
  if (Number.isNaN(off.getTime())) return none
  const asOf = args.asOf ?? new Date()
  const months = (asOf.getTime() - off.getTime()) / (30.44 * 24 * 3600 * 1000)
  if (months > FAILED_ASK_RECENCY_MONTHS || months < 0) return none

  // Backtest-calibrated ceilings, tightest to loosest: the median outcome
  // bounds the conservative tier, the 75th percentile bounds the
  // recommendation, and the failed ask itself stays the hard cap on the
  // stretch tier. Ratios ordered median < p75 < 1, so tier ordering holds.
  const round1k = (n: number) => Math.round(n / 1000) * 1000
  const consCeil = round1k(FAILED_ASK_BACKTEST.closeMedianRatio * ask)
  const recCeil = round1k(FAILED_ASK_BACKTEST.closeP75Ratio * ask)
  if (pricing.conservative <= consCeil && pricing.recommended <= recCeil && pricing.highEnd <= ask) return none

  const uncapped = pricing.recommended
  pricing.conservative = Math.min(pricing.conservative, consCeil)
  pricing.recommended = Math.min(pricing.recommended, recCeil)
  pricing.highEnd = Math.min(pricing.highEnd, ask)
  pricing.needsReview = true
  pricing.reviewReason = [
    pricing.reviewReason,
    `Comp evidence supported ${usd(uncapped)} against the ${usd(ask)} asking that just failed. List tiers clamped to the failed-ask backtest quantiles (median ${FAILED_ASK_BACKTEST.closeMedianRatio}, p75 ${FAILED_ASK_BACKTEST.closeP75Ratio}, cap 1.00).`,
  ]
    .filter(Boolean)
    .join(' ')
  pricing.notes.push(
    `Your last listing asked ${usd(ask)} and did not sell. ${FAILED_ASK_BACKTEST.pairs.toLocaleString('en-US')} Central Oregon homes failed to sell and later sold between ${FAILED_ASK_BACKTEST.runstamp.slice(0, 4) === '2026' ? '2023 and 2026' : 'the measured window'}. The median one closed at ${(FAILED_ASK_BACKTEST.closeMedianRatio * 100).toFixed(1)}% of the asking price that failed. ${FAILED_ASK_BACKTEST.shareClosedAboveAskPct}% closed above it. The list prices in this report are capped against those outcomes.`,
  )
  return { applied: true, cappedTo: recCeil, uncappedRecommended: uncapped }
}
