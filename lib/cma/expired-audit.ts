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
import type { BpoListingCycle, BpoListingHistory } from '@/lib/bpo/types'
import { listingHistoryLine as buildListingHistoryLine } from '@/lib/cma/listing-history-line'
import type { ListingTimelineInput, ListingTimelineStep } from '@/lib/cma/market-charts'

// ── Fee facts (Matt, principal broker, 2026-07-14) ──────────────────────────
/** Listing fee for every expired-listing engagement. */
export const EXPIRED_LISTING_FEE_PCT = 2.5
/** Our normal listing fee (the site's Enhanced plan) — stated for contrast. */
export const STANDARD_LISTING_FEE_PCT = 3.0
/** Net-sheet assumption for buyer-broker compensation. Negotiable per offer
 *  under the current rules; the seller decides. Shown as an assumption line. */
export const BUYER_BROKER_ASSUMPTION_PCT = 2.5

/** Keep a market-move fact. Drop stored lecture from older builds. */
export function sellerFacingFindingMeaning(raw: string | null | undefined): string {
  const t = (raw ?? '').trim()
  if (!t) return ''
  const sentences = t.split(/(?<=\.)\s+/).map((s) => s.trim()).filter(Boolean)
  const move = sentences.filter((s) => /\bmoved \d+(?:\.\d+)?% (?:up|down) over the past year\.?$/i.test(s))
  if (move.length) {
    return move.map((s) => (/[.]$/.test(s) ? s : `${s}.`)).join(' ')
  }
  if (
    /narrows the pool|teaches buyers|stale listings|inherits the history|gives buyers less reason|shifts the relist|not unrecoverable|sends no new signal|cross-shop|defensible|room above the last ask|restarts the clock/i.test(
      t,
    )
  ) {
    return ''
  }
  return t
}

export interface ExpiredFailureFinding {
  /** Which of the audit lenses this belongs to. 'Ownership' is deliberately
   *  display-cased: the renderer (lib/cma/render.ts expiredAuditPage) falls
   *  back to the raw lens string for values missing from LENS_LABELS, so this
   *  value renders as a correct sentence-case subhead without a render change. */
  lens: 'pricing' | 'time-on-market' | 'price-cuts' | 'attempts' | 'presentation' | 'Ownership'
  /** The factual observation (numbers, no adjectives). */
  fact: string
  /** Extra fact, or empty when the observation stands alone. */
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

/**
 * The final listing period, as a shape a renderer can draw.
 *
 * Contract from docs/plans/CMA_REIMAGINED_2026-09-07.md chapter 1, written at
 * BUILD onto `render_args.expiredAudit.finalCycle`. Nothing derives it in a
 * renderer: `lib/pricing` and the build own every figure on it.
 */
export interface ExpiredFinalCycle {
  /** The day the final listing period opened. */
  listDate: string | null
  /** The ask it opened at. */
  initialAsk: number | null
  /** Every price change on that period, in order. Empty when it never cut. */
  cuts: Array<{ date: string | null; ask: number }>
  /** The day it came off. Null while it is still live. */
  offMarketDate: string | null
  /** Expired / Withdrawn / Canceled. */
  status: string | null
  /** List date to off-market date, whole days. */
  days: number | null
}

export interface ExpiredAuditData {
  findings: ExpiredFailureFinding[]
  services: string[]
  netSheet: ExpiredNetSheet
  feeLine: string
  /**
   * Chapter 1's timeline. Optional because rows built before this contract
   * landed do not carry it — `resolveListingTimeline` degrades to the subject's
   * own list date, final ask and days on market when it is absent, and the
   * chapter falls back to a sentence when even that is missing.
   */
  finalCycle?: ExpiredFinalCycle | null
}

const usd = (n: number) => `$${Math.round(n).toLocaleString()}`

/** UTC midnight of the YYYY-MM-DD a date or timestamp falls on, else null. */
function utcDay(value: string | null | undefined): number | null {
  const day = String(value ?? '').trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const t = Date.parse(`${day}T00:00:00.000Z`)
  return Number.isNaN(t) ? null : t
}

/**
 * THE subject's days on market, one definition for the whole document.
 *
 * For a home that came off the market unsold, the defensible measure is the
 * FINAL listing period's own exposure: list date to off-market date. That is
 * the number the market median compares against (a single-cycle measure), and
 * it is the only span the seller lived through on the listing being reviewed.
 *
 * NOT `CumulativeDaysOnMarket` (list-to-close across relists — CLAUDE.md §7
 * forbids publishing it as DOM), and NOT list-date-to-today (a home off the
 * market is not accruing market time). The cycle's own reported DOM is used
 * only when the cycle is missing one of the two dates, which is the best the
 * record supports; when neither is available the number is omitted (§0: cut,
 * never estimate).
 *
 * Exported because both consumers must read the same value:
 *  - the comps matrix, via the DOM baked into `subject.listingHistoryLine`
 *    (see stampFinalCycleDom);
 *  - the "your last listing" review's time-on-market finding, below.
 */
export function finalCycleDaysOnMarket(
  cycle: Pick<BpoListingCycle, 'listDate' | 'offMarketDate' | 'daysOnMarket'> | null | undefined,
): number | null {
  if (!cycle) return null
  // Difference the CALENDAR DATES, not the raw values. The MLS stores one side
  // as a timestamp ("2026-02-26T23:27:57+00:00") and the other as a bare date
  // ("2026-09-01"); subtracting those directly makes the answer depend on the
  // time of day the listing was keyed in, which moved this subject's DOM by a
  // day. Whole days between the two dates is the number a broker can check.
  const start = utcDay(cycle.listDate)
  const end = utcDay(cycle.offMarketDate)
  if (start != null && end != null) {
    const d = Math.round((end - start) / 86_400_000)
    if (Number.isFinite(d) && d >= 0) return d
  }
  const reported = cycle.daysOnMarket
  return reported != null && Number.isFinite(reported) && reported >= 0 ? Math.round(reported) : null
}

/**
 * Stamp the final cycle's days on market onto the subject so every consumer
 * reads one number.
 *
 * The comps matrix (lib/cma/comp-matrix.ts subjectDomDays) takes the subject's
 * DOM from the "N days on market" token inside `subject.listingHistoryLine`,
 * which lib/cma/subject.ts builds from the MLS row's CumulativeDaysOnMarket.
 * On a relisted or off-market subject that count is a different measurement
 * from the review's, and the document then printed two numbers for one fact
 * (look pass 2026-09-07, cma-2465-7th-redmond-97756: 192 vs 186).
 *
 * This rewrites the line from the FINAL CYCLE's own facts — its asks, its list
 * date, and finalCycleDaysOnMarket — so the matrix, the history sentence, and
 * the review all carry the same span. No-op when the cycle proves no span.
 *
 * Returns the stamped DOM, or null when nothing was changed.
 */
export function stampFinalCycleDom(
  subject: CmaSubject,
  cycle: BpoListingCycle | null | undefined,
): number | null {
  const dom = finalCycleDaysOnMarket(cycle)
  if (dom == null || !cycle) return null
  const line = buildListingHistoryLine({
    listPrice: cycle.finalListPrice ?? subject.lastListPrice,
    originalListPrice: cycle.originalListPrice,
    status: subject.standardStatus ?? cycle.status,
    onMarketDate: cycle.listDate ?? subject.lastListDate,
    daysOnMarket: dom,
  })
  if (!line) return null
  subject.listingHistoryLine = line.endsWith('.') ? line : `${line}.`
  return dom
}

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

  return { lens: 'Ownership', fact, meaning: '' }
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
        ? `${market?.geoLabel ?? 'The market'} moved ${Math.abs(yoy).toFixed(1)}% ${yoy > 0 ? 'up' : 'down'} over the past year.`
        : ''
    if (askAboveRange) {
      const overPct = ((finalAsk - pricing.highEnd) / pricing.highEnd) * 100
      findings.push({
        lens: 'pricing',
        fact: `The final asking price was ${usd(finalAsk)}. The comparable sales support ${usd(pricing.conservative)} to ${usd(pricing.highEnd)} today, which puts that ask ${overPct.toFixed(1)}% above the top of the supported range.`,
        meaning: marketMoveNote,
      })
    } else if (finalAsk >= pricing.conservative) {
      findings.push({
        lens: 'pricing',
        fact: `The final asking price was ${usd(finalAsk)}, inside the ${usd(pricing.conservative)} to ${usd(pricing.highEnd)} range the comparable sales support today.`,
        meaning: marketMoveNote,
      })
    } else {
      findings.push({
        lens: 'pricing',
        fact: `The final asking price was ${usd(finalAsk)}, below the ${usd(pricing.conservative)} to ${usd(pricing.highEnd)} range the comparable sales support today.`,
        meaning: marketMoveNote,
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
  const cycleDom = finalCycleDaysOnMarket(cycle)
  const medianDom = market?.medianDom ?? null
  if (cycleDom != null && medianDom != null && medianDom > 0) {
    findings.push({
      lens: 'time-on-market',
      fact: `${cycleDom} days on market for the final listing period, against a ${Math.round(medianDom)}-day median for ${market?.geoLabel ?? 'the market'}.`,
      meaning: '',
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
    findings.push({
      lens: 'price-cuts',
      fact: `The ask moved from ${usd(cycle.originalListPrice)} to ${usd(cycle.finalListPrice)}, a ${usd(cut)} reduction (${cutPct.toFixed(1)}%)${cuts > 0 ? ` over ${cuts} cut${cuts === 1 ? '' : 's'}` : ''}.`,
      meaning: '',
    })
  } else if (cycle && cycle.originalListPrice && cycle.originalListPrice === cycle.finalListPrice && askAboveRange) {
    findings.push({
      lens: 'price-cuts',
      fact: `The asking price never moved from ${usd(cycle.originalListPrice)} across the full listing period.`,
      meaning: '',
    })
  }

  // 4. Attempts (relistings).
  if (history.failedAttemptsCount >= 2) {
    findings.push({
      lens: 'attempts',
      fact: `This property has been listed ${history.attemptsCount} times, with ${history.failedAttemptsCount} attempts ending without a sale${history.peakAskingPrice ? `, peaking at ${usd(history.peakAskingPrice)}` : ''}.`,
      meaning: '',
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
      meaning: '',
    })
  }
  if (remarksLen > 0 && remarksLen < 400) {
    findings.push({
      lens: 'presentation',
      fact: `The public description ran ${remarksLen} characters.`,
      meaning: '',
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

  let recent = false
  if (args.offMarketDate) {
    const off = new Date(args.offMarketDate)
    if (!Number.isNaN(off.getTime())) {
      const asOf = args.asOf ?? new Date()
      const months = (asOf.getTime() - off.getTime()) / (30.44 * 24 * 3600 * 1000)
      recent = months >= 0 && months <= FAILED_ASK_RECENCY_MONTHS
    }
  }

  const round1k = (n: number) => Math.round(n / 1000) * 1000
  const consCeil = recent ? Math.min(ask, round1k(FAILED_ASK_BACKTEST.closeMedianRatio * ask)) : ask
  const recCeil = recent ? Math.min(ask, round1k(FAILED_ASK_BACKTEST.closeP75Ratio * ask)) : ask
  if (pricing.conservative <= consCeil && pricing.recommended <= recCeil && pricing.highEnd <= ask) return none

  const uncapped = pricing.recommended
  pricing.conservative = Math.min(pricing.conservative, consCeil)
  pricing.recommended = Math.min(pricing.recommended, recCeil)
  pricing.highEnd = Math.min(pricing.highEnd, ask)
  pricing.needsReview = true
  pricing.reviewReason = [
    pricing.reviewReason,
    recent
      ? `Comp evidence supported ${usd(uncapped)} against the ${usd(ask)} asking that just failed. List tiers clamped to the failed-ask backtest quantiles (median ${FAILED_ASK_BACKTEST.closeMedianRatio}, p75 ${FAILED_ASK_BACKTEST.closeP75Ratio}, cap 1.00).`
      : `Comp evidence supported ${usd(uncapped)} against the ${usd(ask)} asking that failed to sell. The printed list sits at or below that ask.`,
  ]
    .filter(Boolean)
    .join(' ')
  pricing.notes.push(`Your last listing asked ${usd(ask)} and did not sell.`)
  return { applied: true, cappedTo: recCeil, uncappedRecommended: uncapped }
}

/**
 * Chapter 1's timeline, resolved from the row.
 *
 * PREFERRED: `expiredAudit.finalCycle`, written at build from the MLS listing
 * cycles, which carries every price change on the final period.
 *
 * DEGRADED: the subject's own fields. A row built before that contract landed
 * carries `lastListDate`, `lastListPrice`, `standardStatus` and a days-on-market
 * figure, which is a real one-segment listing period — a flat line at the ask
 * it finished on, ending the day it came off. The blueprint already specifies a
 * flat line for a period with no cut, so the degraded drawing is honest: it
 * states less, never something false. It never invents a cut, and it never
 * reads a price out of the prose history line.
 *
 * Returns null when there is no failed period to draw at all.
 */
export function resolveListingTimeline(input: {
  subject: CmaSubject
  expiredAudit?: ExpiredAuditData | null
  rangeLow: number
  rangeHigh: number
  rangeLabel: string
  /** The final cycle's days on market, resolved once for the whole document. */
  domDays: number | null
}): ListingTimelineInput | null {
  const cycle = input.expiredAudit?.finalCycle ?? null
  const s = input.subject
  const listDate = (cycle?.listDate ?? s.lastListDate ?? '').trim()
  if (!listDate) return null

  const steps: ListingTimelineStep[] = []
  if (cycle) {
    if (cycle.initialAsk != null && cycle.initialAsk > 0) {
      steps.push({ date: listDate, ask: cycle.initialAsk })
    }
    for (const cut of cycle.cuts ?? []) {
      if (cut.ask > 0 && cut.date) steps.push({ date: cut.date, ask: cut.ask })
    }
  }
  if (steps.length === 0 && s.lastListPrice != null && s.lastListPrice > 0) {
    steps.push({ date: listDate, ask: s.lastListPrice })
  }
  if (steps.length === 0) return null

  const offMarket = cycle?.offMarketDate ?? offMarketFromDays(listDate, input.domDays)
  const status = (cycle?.status ?? s.standardStatus ?? '').trim().toLowerCase() || null
  return {
    listDate,
    offMarketDate: offMarket,
    steps,
    rangeLow: input.rangeLow,
    rangeHigh: input.rangeHigh,
    rangeLabel: input.rangeLabel,
    status,
    days: cycle?.days ?? input.domDays,
    caption: 'Your asking price against what homes like yours sold for',
  }
}

/** List date plus the days it ran. Null when either side is unknown. */
function offMarketFromDays(listDate: string, days: number | null): string | null {
  if (days == null || !Number.isFinite(days) || days < 0) return null
  const start = utcDay(listDate)
  if (start == null) return null
  return new Date(start + days * 86_400_000).toISOString().slice(0, 10)
}

/**
 * The one sentence under the timeline. Every figure on it is already drawn
 * above it, so the reader can check the sentence against the picture.
 */
export function listingTimelineReading(input: {
  timeline: ListingTimelineInput
  city: string
  marketMedianDom: number | null
}): string {
  const t = input.timeline
  const finalAsk = t.steps[t.steps.length - 1]?.ask ?? null
  const low = Math.min(t.rangeLow, t.rangeHigh)
  const high = Math.max(t.rangeLow, t.rangeHigh)
  const bits: string[] = []
  if (finalAsk != null && finalAsk > 0) {
    if (finalAsk > high) {
      bits.push(
        `The asking price was ${pct1((finalAsk - high) / high)} percent above the top of the range homes like yours sold in.`,
      )
    } else if (finalAsk < low) {
      bits.push(
        `The asking price was ${pct1((low - finalAsk) / low)} percent below the bottom of the range homes like yours sold in.`,
      )
    } else {
      bits.push('The asking price sat inside the range homes like yours sold in.')
    }
  }
  if (t.days != null && t.days > 0) bits.push(`It sat ${Math.round(t.days).toLocaleString('en-US')} days.`)
  const place = input.city.trim()
  if (input.marketMedianDom != null && input.marketMedianDom > 0 && place) {
    bits.push(`The ${place} median is ${Math.round(input.marketMedianDom)}.`)
  }
  return bits.join(' ')
}

function pct1(ratio: number): string {
  return (Math.abs(ratio) * 100).toFixed(1)
}
