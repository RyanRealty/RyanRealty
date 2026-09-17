/**
 * Matt 2026-09-17: Recommended is weighted toward more recent / more similar
 * closed comps. Market cool / no false hope: heavy recent weight so earlier
 * hotter closeds (e.g. March) do not overstate when similar homes sit.
 * Still clamped inside Low/High. Pending/Active never enter this weight.
 *
 * Recency half-life ~3 months (was ~12): a 6-month-old sale carries ~¼ the
 * recency of a fresh close. Size proximity unchanged.
 */

export type ClosedCompWeightInput = {
  subjectSqft: number
  saleSqft: number
  monthsSinceClose: number
}

/** Months for recency to halve — heavy recent weight for market cool. */
export const CLOSED_COMP_RECENCY_HALF_LIFE_MONTHS = 3

/** size proximity × heavy recency — higher when closer in size and more recent. */
export function closedCompWeight(input: ClosedCompWeightInput): number {
  const months = Math.max(0, Number(input.monthsSinceClose) || 0)
  const subjectSqft = Number(input.subjectSqft) || 0
  const saleSqft = Number(input.saleSqft) || 0
  const sizeProximity =
    subjectSqft > 0 ? 1 / (1 + Math.abs(subjectSqft - saleSqft) / subjectSqft) : 1
  // Heavy recent: half-life CLOSED_COMP_RECENCY_HALF_LIFE_MONTHS (Matt cool).
  const recency = Math.pow(0.5, months / CLOSED_COMP_RECENCY_HALF_LIFE_MONTHS)
  return +(sizeProximity * recency).toFixed(4)
}
