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

/**
 * No single closed sale may carry more than this share of the weighted
 * recommendation after renormalization. Nugget / Marshmallow shapes hit
 * 75%+ on one recent similar sale; 40% still prefers the recent sale
 * without letting it own the number.
 */
export const CLOSED_COMP_WEIGHT_SHARE_CAP = 0.4

/** Cap raw shares, then renormalize. Equal shares when nothing is usable. */
export function capClosedCompShares(raw: readonly number[]): number[] {
  const n = raw.length
  if (n === 0) return []
  const positive = raw.map((w) => (Number.isFinite(w) && w > 0 ? w : 0))
  const total = positive.reduce((sum, w) => sum + w, 0)
  let shares = total <= 0 ? raw.map(() => 1 / n) : positive.map((w) => w / total)
  const cap = CLOSED_COMP_WEIGHT_SHARE_CAP
  if (n === 1) return [1]
  // Two sales cannot share a 40% cap without inverting rank. Nugget and
  // Marshmallow concentrated at 4+ sales; the two-sale contract still pulls
  // toward the recent similar close.
  if (n < 3) {
    const sum = shares.reduce((a, b) => a + b, 0)
    return sum > 0 ? shares.map((s) => s / sum) : shares.map(() => 1 / n)
  }
  const floorCap = Math.max(cap, 1 / n)
  for (let iter = 0; iter < 12; iter++) {
    const overIdx = shares.map((s, i) => (s > floorCap + 1e-12 ? i : -1)).filter((i) => i >= 0)
    if (overIdx.length === 0) break
    let excess = 0
    const next = shares.map((s) => {
      if (s > floorCap) {
        excess += s - floorCap
        return floorCap
      }
      return s
    })
    const roomIdx = next.map((s, i) => (s < floorCap ? i : -1)).filter((i) => i >= 0)
    const room = roomIdx.reduce((sum, i) => sum + (floorCap - next[i]!), 0)
    if (room <= 0 || excess <= 0) {
      shares = next
      break
    }
    for (const i of roomIdx) {
      next[i] = next[i]! + (excess * (floorCap - next[i]!)) / room
    }
    shares = next
  }
  const sum = shares.reduce((a, b) => a + b, 0)
  return sum > 0 ? shares.map((s) => s / sum) : shares.map(() => 1 / n)
}

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
