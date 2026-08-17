/**
 * Listing Plan — the section that converts. Every other block in the CMA
 * tells the seller what the home is worth; this one tells them what we would
 * DO about it, and every line derives from a number this report already
 * computed (CLAUDE.md §0: never invent a service, a timeline, a cost, or a
 * guarantee).
 *
 * Pure function, no DB. Each rule below reads one figure already computed by
 * lib/cma/extras.ts (seasonality, band, subdivisionPulse, financing,
 * photoBench), lib/cma/expired-audit.ts (ExpiredAuditData), or the subject /
 * pricing blocks, and only fires when that figure clears its threshold. A
 * rule with no supporting data emits nothing — never an estimate, never a
 * hedge.
 *
 * Voice: marketing_brain_skills/brand-voice/VOICE.md. State the fact, then
 * stop. No sentence explains another sentence, no coined maxim, no promise of
 * an outcome ("will sell", "guaranteed"). Actions describe what we DO, not
 * what will happen. Every emitted string is scanned by lib/voice/check.ts's
 * checkBrandVoice before it can be said to pass (see listing-plan.test.ts).
 */

import type { CmaExtras } from '@/lib/cma/extras'
import type { ExpiredAuditData } from '@/lib/cma/expired-audit'
import type { CmaMarketContext, CmaPricing, CmaSubject } from '@/lib/cma/types'

export interface ListingPlanItem {
  /** The measured fact about this listing's situation, short. */
  trigger: string
  /** What we do about it — concrete, checkable, never a promised result. */
  action: string
  /** Which figure in this report the item traces to. */
  basis: string
}

export interface ListingPlan {
  items: ListingPlanItem[]
  source: string
}

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

// ── Thresholds (business heuristics, not claimed figures — nothing here is
// printed to the reader as a sourced stat; they only gate whether a rule's
// OWN figures clear the bar worth a listing-plan line). ─────────────────────

/** "More than 10 days better," per spec — the seasonality gap a listing-date
 *  recommendation has to clear before it is worth making. */
const SEASONALITY_GAP_DAYS = 10
/** A band reads as crowded once actives run at least this multiple of
 *  pendings, with a floor so a 2-vs-1 band does not qualify. */
const BAND_CROWDED_RATIO = 2
const BAND_CROWDED_MIN_ACTIVE = 4
/** A month-plus median DOM in the live band triggers the early-exposure item. */
const BAND_DOM_HIGH_DAYS = 30
/** A cash share above this line means a meaningful part of the buyer pool
 *  does not need a loan contingency. */
const CASH_PCT_HIGH = 30
/** Fewer than this many qualifying items and the section does not print. */
const MIN_QUALIFYING_ITEMS = 3

/**
 * Rule: expiredAudit present + a known failed ask -> correct it. The failed
 * price is subject.lastListPrice (already verified and rendered elsewhere in
 * the audit); the corrected number is pricing.recommended (the comp-set
 * output for this same report).
 */
export function buildFailedAskItem(
  subject: CmaSubject,
  pricing: CmaPricing,
  expiredAudit: ExpiredAuditData | null,
): ListingPlanItem | null {
  if (!expiredAudit) return null
  const ask = subject.lastListPrice
  if (ask == null || !(ask > 0)) return null
  if (!(pricing.recommended > 0)) return null
  return {
    trigger: `The last listing asked ${usd(ask)} and did not sell.`,
    action: `We price the relist at ${usd(pricing.recommended)}, the number the comp set supports today.`,
    basis: `Last list ${usd(ask)} against the recommended list of ${usd(pricing.recommended)}.`,
  }
}

/**
 * Rule: subdivisionPulse present -> price against the street's own sales
 * rather than the wider city median. No threshold beyond the block's own
 * existence (extras.ts already refuses to build it under 3 sales).
 */
export function buildSubdivisionItem(extras: CmaExtras): ListingPlanItem | null {
  const sp = extras.subdivisionPulse
  if (!sp || sp.medianClose == null) return null
  return {
    trigger: `${sp.name} carries a median closed price of ${usd(sp.medianClose)} over its last ${sp.closedCount} sales.`,
    action: `We market against ${sp.name}'s own closed sales, not the citywide median, so buyers compare this home to the ${sp.closedCount} homes they have actually seen sell here.`,
    basis: `${sp.name} median close ${usd(sp.medianClose)} across ${sp.closedCount} sales.`,
  }
}

/**
 * Rule: band.activeCount high relative to band.pendingCount -> price to
 * compete in a crowded band instead of testing above the supported number.
 */
export function buildCrowdedBandItem(extras: CmaExtras): ListingPlanItem | null {
  const b = extras.band
  if (!b) return null
  if (b.activeCount < BAND_CROWDED_MIN_ACTIVE) return null
  if (b.activeCount < b.pendingCount * BAND_CROWDED_RATIO) return null
  return {
    trigger: `${b.activeCount} homes are active in this price band right now, against ${b.pendingCount} pending.`,
    action: `With ${b.activeCount} homes already listed in this band, we lead the launch on what makes this one different rather than on price alone.`,
    basis: `${b.activeCount} homes like yours are for sale in this band now, from ${usd(b.lo)} to ${usd(b.hi)}.`,
  }
}

/**
 * Rule: band.activeMedianDom high -> the first two weeks matter. Priced
 * inside the range from day one, not tested and cut later.
 */
export function buildEarlyExposureItem(extras: CmaExtras): ListingPlanItem | null {
  const b = extras.band
  if (!b || b.activeMedianDom == null) return null
  const dom = Math.round(b.activeMedianDom)
  if (dom < BAND_DOM_HIGH_DAYS) return null
  return {
    trigger: `Active listings in this price band carry a median of ${dom} days on market.`,
    action: `The median home in this band sits ${b.activeMedianDom} days. We front-load showings and feedback into the first two weeks, while the listing is new.`,
    basis: `Homes in this band have been listed a median of ${dom} days, from ${usd(b.lo)} to ${usd(b.hi)}.`,
  }
}

/**
 * Rule: financing.cashPct high -> write close-date flexibility into the
 * terms, since a real share of the buyer pool carries no loan contingency.
 */
export function buildFinancingItem(extras: CmaExtras): ListingPlanItem | null {
  const f = extras.financing
  if (!f) return null
  if (f.cashPct < CASH_PCT_HIGH) return null
  return {
    trigger: `${f.cashPct}% of recent sales in this market closed with cash financing.`,
    action: `We write close-date flexibility into the listing terms.`,
    basis: `${f.cashPct}% of ${f.sampleCount} recent sales closed in cash.`,
  }
}

/**
 * Rule: the fastest months are more than SEASONALITY_GAP_DAYS faster than the
 * slowest -> time the launch toward the faster month.
 */
export function buildTimingItem(extras: CmaExtras): ListingPlanItem | null {
  const s = extras.seasonality
  if (!s) return null
  const fastName = s.fastestMonths[0]
  const slowName = s.slowestMonths[s.slowestMonths.length - 1]
  if (!fastName || !slowName) return null
  const fast = s.byMonth.find((m) => m.monthName === fastName)
  const slow = s.byMonth.find((m) => m.monthName === slowName)
  if (!fast || !slow || fast.medianDaysToPending == null || slow.medianDaysToPending == null) return null
  const fastMed = fast.medianDaysToPending
  const slowMed = slow.medianDaysToPending
  if (slowMed - fastMed <= SEASONALITY_GAP_DAYS) return null
  return {
    trigger: `${fastName} listings in this market reach pending in a median of ${fastMed} days. ${slowName} listings take a median of ${slowMed}.`,
    action: `We aim the launch at ${fastName}, when homes here have gone pending in a median of ${fastMed} days against ${slowMed} in ${slowName}.`,
    basis: `${fastName} homes here have gone pending in a median of ${fastMed} days. ${slowName} homes take a median of ${slowMed}.`,
  }
}

/**
 * Rule: photoBench.subjectPhotos below the comp median -> reshoot before it
 * lists, sized to the comp median.
 */
export function buildPhotoItem(extras: CmaExtras): ListingPlanItem | null {
  const pb = extras.photoBench
  if (!pb) return null
  if (pb.subjectPhotos >= pb.compMedianPhotos) return null
  return {
    trigger: `This listing carries ${pb.subjectPhotos} photos. The sold comps in this report carry a median of ${pb.compMedianPhotos}.`,
    action: `We reshoot the photo set before this lists, targeted to match the comp median count.`,
    basis: `This listing has ${pb.subjectPhotos} photos. The sold comps in this report have a median of ${pb.compMedianPhotos}.`,
  }
}

/**
 * Rule (spec item 8): subject.sqft/beds vs the subdivision -> a positioning
 * item, gated on extras supplying a percentile. CmaExtras (lib/cma/extras.ts)
 * does not currently expose a sqft/beds percentile on any block —
 * subdivisionPulse carries closed PRICE stats only (medianClose/low/high),
 * nothing sized. There is no number here to cite, so per §0 (cut, don't
 * guess) this rule is a deliberate no-op until extras grows that field.
 * Kept as a named, exported function so the 8-rule set stays complete and the
 * day this data exists, wiring it in is a one-line change here.
 */
export function buildPositioningItem(_subject: CmaSubject, _extras: CmaExtras): ListingPlanItem | null {
  return null
}

/**
 * Orchestrator. Runs every rule against this report's own figures and
 * returns the qualifying items in a fixed, deterministic order: the failed
 * ask first when this is an expired-audit relist, then price-band standing,
 * then terms, timing, and presentation. Fewer than MIN_QUALIFYING_ITEMS
 * qualifying items and the section does not print (§0: cut, don't pad).
 *
 * `market` is accepted for signature parity with the rest of the report
 * bundle (lib/cma/render.ts's RenderCmaArgs carries the same five blocks);
 * none of the current rules need a market-context figure to fire.
 */
export function buildListingPlan(args: {
  subject: CmaSubject
  pricing: CmaPricing
  extras: CmaExtras
  expiredAudit: ExpiredAuditData | null
  market: CmaMarketContext | null
}): ListingPlan | null {
  const { subject, pricing, extras, expiredAudit } = args

  const candidates: Array<ListingPlanItem | null> = [
    buildFailedAskItem(subject, pricing, expiredAudit),
    buildSubdivisionItem(extras),
    buildCrowdedBandItem(extras),
    buildEarlyExposureItem(extras),
    buildFinancingItem(extras),
    buildTimingItem(extras),
    buildPhotoItem(extras),
    buildPositioningItem(subject, extras),
  ]

  const items = candidates.filter((item): item is ListingPlanItem => item != null)
  if (items.length < MIN_QUALIFYING_ITEMS) return null

  return {
    items,
    source: 'Every line above traces to a figure already computed in this report.',
  }
}
