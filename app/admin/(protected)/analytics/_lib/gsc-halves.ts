/**
 * Two equal, comparable halves of a Search Console range.
 *
 * Search Console runs 2-3 days behind, so the snapshot has no rows for the
 * last days of a range that ends today. Splitting the calendar range in half
 * left the second half 2-3 days short, and every query looked like it was
 * slipping. The range is first cut back to the latest date the snapshot holds,
 * then split into two halves of the same number of days (an odd middle day is
 * left out, and no day is counted in both halves). Pure; tested in
 * gsc-halves.test.ts.
 */

export type DayRange = { from: string; to: string }

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

/**
 * Null when fewer than two reported days fall in the range, so there is
 * nothing to compare. `latestStored` null means the latest date is unknown;
 * the range end is then used as is.
 */
export function comparableGscHalves(
  sinceDate: string,
  endDate: string,
  latestStored: string | null,
): { first: DayRange; second: DayRange; through: string } | null {
  const through = latestStored !== null && latestStored < endDate ? latestStored : endDate
  const n = daysBetween(sinceDate, through) + 1
  if (n < 2) return null
  const half = Math.floor(n / 2)
  return {
    first: { from: sinceDate, to: addDays(sinceDate, half - 1) },
    second: { from: addDays(through, -(half - 1)), to: through },
    through,
  }
}
