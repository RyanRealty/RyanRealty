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
 * Withhold — do not invent a substitute formula under the same label.
 * Surfaces that already document a 12-month fallback (CRM email, CMA) may
 * compute that fallback AFTER this returns null.
 */

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
  pulseMos: number | null | undefined
  pulseActiveCount?: number | null
  displayedActiveCount?: number | null
  soldCount12mo?: number | null
}): number | null {
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
