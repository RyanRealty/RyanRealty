/**
 * When a pulse months-of-supply figure is honest to print.
 *
 * Pulse MOS is `active / (closed_6mo / 6)` on THAT row's `active_count`.
 * A page that prints a different active count (alias-aware tiles, boundary
 * inventory) next to the pulse MOS attributes the wrong numerator to the
 * ratio. A page that also prints a 12-month sold count cannot imply more
 * six-month closes than that year (impossible arithmetic).
 *
 * Founding case: /communities/tetherow printed 4.6 months of supply and 35
 * actives (implies ~45.7 closes in 6 months) next to FAQ "36 sold in 12
 * months". Pulse row was 19 actives / 4.56 MOS (fleet 5d55abbd72a67d25a5d7232b46fd2fb0).
 *
 * THE GRAIN COMES FIRST, and it is required rather than defaulted, because the
 * two checks below only catch a row that contradicts ITSELF. The neighborhood
 * rows were internally consistent and externally false: one writer took the
 * numerator from a polygon and the denominator from a subdivision-name text
 * join, so both figures agreed with each other while describing different
 * homes. /cities/bend/century-west published 48.0 months against roughly 2.3
 * on any same-population count. No arithmetic available to this function sees
 * that, so the grain registry does — see lib/market/geo-grain-trust.ts for the
 * per-writer attribution proof and the measured counts.
 *
 * SAMPLE FLOOR. A caller that knows how many homes closed in the six-month
 * window passes it as `closedSixMonths`; otherwise a pulse figure's own close
 * count is recovered from the ratio (active * 6 / MoS). Below the Market Truth
 * floor for months of supply (30 closes, docs/plans/MARKET_TRUTH/REGISTRY.md
 * section 2.3 D4) the ratio is an anecdote and is withheld. Founding case: the city pulse stored
 * terrebonne at 30.0 months on 5 actives and 1 close (audit DATA-7, 2026-09-22).
 * Migration 20260923014700_pulse_withhold_unverified_closed_side.sql puts the
 * same floor in the pulse writers; this check holds it at publish time whether
 * or not that migration has been applied.
 *
 * Withhold — do not invent a substitute formula under the same label. A
 * 12-month fallback (CRM email, CMA) is the SAME closed series that made the
 * pulse figure wrong, so it may only be computed after this returns null AND
 * `isSoldAttributionTrusted(grain)` is true.
 */

import { isSoldAttributionTrusted, type MarketGrain } from '@/lib/market/geo-grain-trust'
import { STAT_BY_ID } from '@/lib/data/market-truth/registry'

export type { MarketGrain }
export { publishSoldCount, isSoldAttributionTrusted } from '@/lib/market/geo-grain-trust'

/** Fewest six-month closes a published months-of-supply figure may rest on (Market Truth min_n). */
export const MIN_MOS_SIX_MONTH_CLOSES: number = STAT_BY_ID.get('months_of_supply')?.minN ?? 30

export function impliedSixMonthCloses(
  activeCount: number,
  monthsOfSupply: number,
): number | null {
  if (!Number.isFinite(activeCount) || activeCount < 0) return null
  if (!Number.isFinite(monthsOfSupply) || monthsOfSupply <= 0) return null
  return (activeCount * 6) / monthsOfSupply
}

function asFinite(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null
  return value
}

export function publishMonthsOfSupply(input: {
  /** The geo grain this figure is being published at. Required: see the header. */
  grain: MarketGrain
  pulseMos: number | null | undefined
  pulseActiveCount?: number | null
  displayedActiveCount?: number | null
  soldCount12mo?: number | null
  /**
   * Homes closed in the six-month window the ratio divides by, when the caller
   * has it. Fewer than MIN_MOS_SIX_MONTH_CLOSES withholds the figure.
   */
  closedSixMonths?: number | null
  /**
   * Pulse neighborhood MOS is mixed-method (polygon actives, alias closes).
   * Market Truth MOS uses place_membership is_primary on both sides.
   */
  source?: 'pulse' | 'market-truth'
}): number | null {
  if (input.source !== 'market-truth' && !isSoldAttributionTrusted(input.grain)) return null

  const mos = asFinite(input.pulseMos)
  if (mos == null || mos <= 0) return null

  const pulseActive = asFinite(input.pulseActiveCount)

  // A pulse ratio carries its own close count: closes = active * 6 / MoS
  // (the stored MoS is rounded to 2 places, so allow half a close). Market
  // Truth cells are already withheld under min_n by their writer.
  const closed6 =
    asFinite(input.closedSixMonths) ??
    (input.source !== 'market-truth' && pulseActive != null
      ? impliedSixMonthCloses(pulseActive, mos)
      : null)
  if (closed6 != null && closed6 < MIN_MOS_SIX_MONTH_CLOSES - 0.5) return null

  const shownActive = asFinite(input.displayedActiveCount)
  if (pulseActive != null && shownActive != null && pulseActive !== shownActive) {
    return null
  }

  const sold = asFinite(input.soldCount12mo)
  const numerator = shownActive ?? pulseActive
  if (sold != null && sold > 0 && numerator != null) {
    const implied = impliedSixMonthCloses(numerator, mos)
    if (implied != null && implied > sold) return null
  }

  return mos
}
