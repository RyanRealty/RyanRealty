/**
 * Standard owner's title policy, Oregon.
 *
 * OTIRO Oregon Rating Manual, Schedule One (basic insurance rate) and section
 * 3.002 A: a standard coverage owner's policy is 100% of that rate. Section
 * 2.010 rounds a half dollar up and anything under a half dollar down, after
 * the schedule math. Each $1,000 above a bracket floor, and any fraction of
 * the next $1,000, counts as one thousand.
 */

type Bracket = { max: number; floor: number; flat: number; perThousand: number }

const BRACKETS: readonly Bracket[] = [
  { max: 25_000, floor: 0, flat: 200, perThousand: 0 },
  { max: 50_000, floor: 25_000, flat: 200, perThousand: 4 },
  { max: 100_000, floor: 50_000, flat: 300, perThousand: 3 },
  { max: 300_000, floor: 100_000, flat: 450, perThousand: 2.5 },
  { max: 500_000, floor: 300_000, flat: 950, perThousand: 2 },
  { max: 10_000_000, floor: 500_000, flat: 1_350, perThousand: 1.5 },
  { max: 25_000_000, floor: 10_000_000, flat: 15_600, perThousand: 1.25 },
  { max: 40_000_000, floor: 25_000_000, flat: 34_350, perThousand: 1 },
  { max: Number.POSITIVE_INFINITY, floor: 40_000_000, flat: 49_350, perThousand: 0.75 },
]

function roundHalfUp(n: number): number {
  return Math.floor(n + 0.5)
}

/** Premium in whole dollars, or null when there is no price to insure. */
export function ownersPolicyPremium(amount: number): number | null {
  if (!Number.isFinite(amount) || amount <= 0) return null
  const bracket = BRACKETS.find((b) => amount <= b.max) ?? BRACKETS[BRACKETS.length - 1]!
  const thousands = bracket.floor > 0 && amount > bracket.floor ? Math.ceil((amount - bracket.floor) / 1000) : 0
  return roundHalfUp(bracket.flat + thousands * bracket.perThousand)
}
