/**
 * Canonical months-of-supply (MoS) formula + internal classification. Audit p0.4.
 *
 * CLAUDE.md §0 mandate: MoS = active listings / (homes closed in the last 6
 * months / 6). Thresholds stay in this file for CMA and other internal
 * branching: <= 4 sellers, 4-6 balanced, >= 6 buyers.
 *
 * Public copy prints the months-of-supply figure (`label` is that line), never
 * a market-type phrase. Several market pages previously PRINTED a different,
 * wrong formula in their AI-citable methodology trace ("active listings divided
 * by (closed last 30 days times 2)") — a §0 data-accuracy/compliance hazard on
 * a licensed-broker surface, since the printed math contradicted both the
 * canonical formula and the number actually shown (which comes from the
 * market_pulse_live.months_of_supply column computed by the
 * refresh_market_pulse() RPC). This module is the single source for the formula
 * text and the thresholds.
 */
import { publicSupplyLine } from '@/lib/format/months-of-supply'

export type MarketKind = 'sellers' | 'balanced' | 'buyers' | 'unknown'

export const MOS_SELLER_MAX = 4
export const MOS_BALANCED_MAX = 6

/** Canonical MoS = active listings / (homes closed in the last 6 months / 6). */
export function monthsOfSupply(activeListings: number, closedLast6Months: number): number | null {
  if (!Number.isFinite(activeListings) || !Number.isFinite(closedLast6Months)) return null
  if (closedLast6Months <= 0) return null
  return activeListings / (closedLast6Months / 6)
}

/**
 * Classification for a months-of-supply value. `kind` is internal.
 * `label` is the public line ("4.2 months of supply"), never a market type.
 */
export function marketVerdict(mos: number | null | undefined): { kind: MarketKind; label: string } {
  if (mos == null || !Number.isFinite(mos)) return { kind: 'unknown', label: 'unknown' }
  const label = publicSupplyLine(mos)
  if (mos <= MOS_SELLER_MAX) return { kind: 'sellers', label }
  if (mos < MOS_BALANCED_MAX) return { kind: 'balanced', label }
  return { kind: 'buyers', label }
}

/** One-sentence formula clause for AI-citable methodology traces (§0). */
export const MOS_METHODOLOGY_CLAUSE =
  'Months of supply = active listings divided by average monthly closings over the last 6 months (homes closed in the last 6 months divided by 6).'

/**
 * Plain-language name for the MOS figure (DATA_GRAPHICS / TASTE).
 * The drawing is homes for sale vs a month of sales, not a "3.9 MOS" tile.
 */
export const MOS_PLAIN_LABEL = 'homes for sale vs a month of sales'

/**
 * What a high or low months-of-supply figure means, without a market-type
 * label. Public pages print this beside the number.
 */
export const MOS_THRESHOLD_CLAUSE =
  'A lower months-of-supply figure means fewer homes for sale relative to the recent sales pace.'
