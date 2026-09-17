/**
 * Matt 2026-09-17: Recommended is weighted toward more recent / more similar
 * closed comps (size proximity × recency). Still clamped inside Low/High.
 * Pending and Active never enter this weight — closed comps only.
 *
 * Same formula `adjustCmaCompAlongMarket` has always used; extracted so Tip
 * Ready can refuse a silent drift away from recent/similar weighting.
 */

export type ClosedCompWeightInput = {
  subjectSqft: number
  saleSqft: number
  monthsSinceClose: number
}

/** size proximity × recency — higher when closer in size and more recent. */
export function closedCompWeight(input: ClosedCompWeightInput): number {
  const months = Math.max(0, Number(input.monthsSinceClose) || 0)
  const subjectSqft = Number(input.subjectSqft) || 0
  const saleSqft = Number(input.saleSqft) || 0
  const sizeProximity =
    subjectSqft > 0 ? 1 / (1 + Math.abs(subjectSqft - saleSqft) / subjectSqft) : 1
  const recency = 1 / (1 + months / 12)
  return +(sizeProximity * recency).toFixed(4)
}
