/**
 * Canonical months-of-supply (MoS) formula + market verdict. Audit p0.4.
 *
 * CLAUDE.md §0 mandate: MoS = active listings / (homes closed in the last 6
 * months / 6). Thresholds: <= 4 seller's, 4-6 balanced, >= 6 buyer's.
 *
 * Several market pages previously PRINTED a different, wrong formula in their
 * AI-citable methodology trace ("active listings divided by (closed last 30 days
 * times 2)") — a §0 data-accuracy/compliance hazard on a licensed-broker
 * surface, since the printed math contradicted both the canonical formula and
 * the number actually shown (which comes from the market_pulse_live.months_of_supply
 * column computed by the refresh_market_pulse() RPC). This module is the single
 * source for the formula text, the thresholds, and the verdict.
 */
export type MarketKind = 'sellers' | 'balanced' | 'buyers' | 'unknown'

export const MOS_SELLER_MAX = 4
export const MOS_BALANCED_MAX = 6

/** Canonical MoS = active listings / (homes closed in the last 6 months / 6). */
export function monthsOfSupply(activeListings: number, closedLast6Months: number): number | null {
  if (!Number.isFinite(activeListings) || !Number.isFinite(closedLast6Months)) return null
  if (closedLast6Months <= 0) return null
  return activeListings / (closedLast6Months / 6)
}

/** Verdict for a months-of-supply value. Single source of the <=4 / <6 / >=6 boundaries. */
export function marketVerdict(mos: number | null | undefined): { kind: MarketKind; label: string } {
  if (mos == null || !Number.isFinite(mos)) return { kind: 'unknown', label: 'unknown' }
  if (mos <= MOS_SELLER_MAX) return { kind: 'sellers', label: "seller's market" }
  if (mos < MOS_BALANCED_MAX) return { kind: 'balanced', label: 'balanced market' }
  return { kind: 'buyers', label: "buyer's market" }
}

/** One-sentence formula clause for AI-citable methodology traces (§0). */
export const MOS_METHODOLOGY_CLAUSE =
  'Months of supply = active listings divided by average monthly closings over the last 6 months (homes closed in the last 6 months divided by 6).'

/** Threshold sentence — kept consistent with marketVerdict(). */
export const MOS_THRESHOLD_CLAUSE =
  "Under 4 months is a seller's market, 4 to 6 is balanced, over 6 is a buyer's market."
