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
 * Withhold — do not invent a substitute formula under the same label. A
 * 12-month fallback (CRM email, CMA) is the SAME closed series that made the
 * pulse figure wrong, so it may only be computed after this returns null AND
 * `isSoldAttributionTrusted(grain)` is true.
 */

import { isSoldAttributionTrusted, type MarketGrain } from '@/lib/market/geo-grain-trust'

export type { MarketGrain }

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
}): number | null {
  if (!isSoldAttributionTrusted(input.grain)) return null

  const mos = asFinite(input.pulseMos)
  if (mos == null || mos <= 0) return null

  const pulseActive = asFinite(input.pulseActiveCount)
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
