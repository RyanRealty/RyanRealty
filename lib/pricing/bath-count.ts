/**
 * Bath counts as the MLS records them, for the one-room rule and the letter.
 *
 * This feed's `BathroomsTotal` (and sale_pricing_facts.baths, copied from it)
 * counts a half bath as a whole one: 2 full baths and a powder room read 3.
 * The split is on `listings.baths_full` / `listings.baths_half` (Spark
 * BathsFull / BathsHalf). 915 Saginaw (2 full + a powder room by its remarks)
 * reads BathroomsTotal 3, baths_full 2, baths_half 1; 1335 12th (2.5 by its
 * remarks) reads the same (audit row read 2026-10-07).
 *
 * Rule 4 compares the WHOLE bath count, so when both homes carry the split the
 * rule compares full baths. When either side has only a total, the totals are
 * compared exactly as before: a full count against a total that counts half
 * baths whole would invent a gap. Nothing is guessed from remarks.
 *
 * `baths` stays the MLS total everywhere it is compared; the letter prints
 * the MLS's own reading (2.5) through `printedBaths`.
 */

export type BathCounts = {
  baths?: number | null
  bathsFull?: number | null
  bathsHalf?: number | null
}

function count(value: number | null | undefined): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null
}

/** Full baths when the MLS split is present (at least one full bath), else null. */
export function fullBaths(x: BathCounts | null | undefined): number | null {
  const full = count(x?.bathsFull)
  return full != null && full > 0 ? full : null
}

/**
 * The bath counts the one-room rule compares for this pair: full baths when
 * both carry the split, else the two totals as recorded.
 */
export function wholeBathPair(
  subject: BathCounts | null | undefined,
  sale: BathCounts | null | undefined,
): { subject: number | null; sale: number | null } {
  const a = fullBaths(subject)
  const b = fullBaths(sale)
  if (a != null && b != null) return { subject: a, sale: b }
  return { subject: subject?.baths ?? null, sale: sale?.baths ?? null }
}

/**
 * The count a reader sees, the way the MLS prints it: full baths plus a half
 * for each half bath (2 full + 1 half prints 2.5). Without the split, the
 * recorded total.
 */
export function printedBaths(x: BathCounts | null | undefined): number | null {
  const full = fullBaths(x)
  if (full != null) return full + 0.5 * (count(x?.bathsHalf) ?? 0)
  const total = x?.baths
  return total != null && Number.isFinite(total) && total > 0 ? total : null
}
