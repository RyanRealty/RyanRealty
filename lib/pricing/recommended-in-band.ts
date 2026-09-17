/**
 * Matt 2026-09-17: Low/High from the closed-comp band (valueLow/valueHigh).
 * Recommended must stay inside that band. Tip Ready refuses when Rec is outside.
 * Active high-DOM nudge may pull Recommended down within the band only.
 */

export type ClosedBandPrices = {
  recommended: number
  valueLow: number
  valueHigh: number
}

/** Closed-comp Low/High for letter FLOW (never list tiers). */
export function closedCompBand(p: {
  valueLow?: number | null
  valueHigh?: number | null
}): { low: number; high: number } | null {
  const lo = Number(p.valueLow)
  const hi = Number(p.valueHigh)
  if (!(lo > 0) || !(hi > 0)) return null
  return { low: Math.min(lo, hi), high: Math.max(lo, hi) }
}

export function recommendedInsideClosedBand(p: ClosedBandPrices): boolean {
  const band = closedCompBand(p)
  if (!band) return false
  const rec = Number(p.recommended)
  if (!(rec > 0)) return false
  return rec >= band.low && rec <= band.high
}

/** Clamp Recommended into [valueLow, valueHigh]. No-op when band or rec missing. */
export function clampRecommendedToClosedBand<T extends ClosedBandPrices>(p: T): T {
  const band = closedCompBand(p)
  const rec = Number(p.recommended)
  if (!band || !(rec > 0)) return p
  if (rec >= band.low && rec <= band.high) return p
  return {
    ...p,
    recommended: Math.min(band.high, Math.max(band.low, rec)),
  }
}
