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
 *     voice_guidelines §4.7 + the expired-listing-lp SKILL: the data tells the
 *     story, never editorialize, NEVER blame the prior agent, no "most agents
 *     do X" framing.
 *  2. SERVICES — what every Ryan Realty listing gets. Mirrors the site's own
 *     published claims (app/sell/page.tsx) verbatim-adjacent so the document
 *     never promises anything the site doesn't.
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
  /** Which of the audit lenses this belongs to. */
  lens: 'pricing' | 'time-on-market' | 'price-cuts' | 'attempts' | 'presentation'
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
 * Deterministic failure analysis. Every finding derives from a number the
 * engine verified; anything not supported by data is simply absent.
 */
export function buildFailureFindings(args: {
  subject: CmaSubject
  pricing: CmaPricing
  market: CmaMarketContext | null
  history: BpoListingHistory
  photosCount: number | null
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

/**
 * What every Ryan Realty listing gets. Mirrors the site's published Essential-
 * plan claims (app/sell/page.tsx) — the document never promises anything the
 * site doesn't already state publicly.
 */
export function buildServicesList(): string[] {
  return [
    'Listed on the MLS and every national feed it syndicates to (Zillow, Redfin, Realtor.com, and the rest).',
    'Professional photography, paid for by us.',
    'A 3D tour, so out-of-area buyers walk the home before they fly in.',
    'Every showing coordinated and every inquiry answered by the broker on your listing agreement, not a team assistant.',
    'A written report every week it is listed: showings, saves, views, and what we are doing next.',
    'Data-driven pricing built the way this audit was built, from verified closed sales and county records.',
    'Transaction management through close, including inspection negotiation and title coordination.',
  ]
}

/**
 * Seller net sheet at the expired rate. Our fees are facts; third-party costs
 * are labeled estimates. Every number computed here, shown with its formula.
 */
export function buildNetSheet(pricing: CmaPricing): ExpiredNetSheet {
  const price = pricing.recommended

  const listingFee = price * (EXPIRED_LISTING_FEE_PCT / 100)
  const buyerSide = price * (BUYER_BROKER_ASSUMPTION_PCT / 100)
  // Owner's title policy + half escrow, Central Oregon typical band. ESTIMATE —
  // the seller confirms with the title company at listing.
  const titleEscrowEstimate = Math.round(Math.min(Math.max(price * 0.005, 2000), 6000))
  const recordingMisc = 350

  const lines: ExpiredNetSheetLine[] = [
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
  const costOf = (p: number) =>
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
      'Property-tax prorations, HOA transfer fees, and any repair credits vary by closing date and negotiation, and are not included.',
      'Your mortgage payoff (if any) comes off the estimated net. Your lender provides the exact payoff figure.',
      'Every third-party line is an estimate, not a quote. This is not a closing statement.',
    ],
  }
}

/** One-line fee statement for the services page. Like-for-like framing: the
 *  site publishes plans at 2.5% to 3.5%, and most sellers choose the 3%
 *  Enhanced plan — so the honest comparison names the plans rather than
 *  presenting 2.5% as an expired-only concession (audit finding 2026-07-14). */
export function feeLine(): string {
  return `For an expired listing we list at ${EXPIRED_LISTING_FEE_PCT}% of the sale price, where our standard Enhanced plan runs ${STANDARD_LISTING_FEE_PCT}%. Every service above is included at that rate. Commission is negotiable and every listing agreement is its own conversation.`
}
