/**
 * Has Google Search Console reported this day yet?
 *
 * Search Console runs 2 to 3 days behind. Its Search Analytics API, at the
 * default `dataState: 'final'`, returns NO rows for a day it has not finished,
 * and a summary query for that day comes back empty. The snapshot cron used to
 * read that empty answer as a zero day and store clicks, impressions, CTR and
 * position as 0 (2026-10-12, written 2026-10-14 12:20 UTC). A reader comparing
 * weeks then saw a fake drop in clicks.
 *
 * The rule here: a day is stored only when it is on or before the latest date
 * with final rows. That date comes from Google itself (one `dimensions:
 * ['date']` query at the same `dataState: 'final'` the per-day queries use),
 * not from a time-zone or lag guess. Read live 2026-10-14: final rows ran
 * through 2026-10-11, and a `dataState: 'all'` query named 2026-10-12 as
 * `firstIncompleteDate`, the same boundary.
 *
 * Deliberately conservative. Search Console leaves zero-impression days out of
 * a date query, so a finished zero day at the very edge waits until a later
 * day reports; it is deferred, never stored as a false zero. (`firstIncompleteDate`
 * would date that edge, but it describes `all` data, not the `final` data the
 * cron stores; trusting it for a day the final query has not returned yet
 * would recreate the false-zero bug.) A day before the edge with no rows is a
 * real zero day and is stored as zeros.
 *
 * Pure, so the boundary is unit-tested without Google
 * (gsc-reported-days.test.ts).
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * The latest date in a Search Analytics response grouped by `date`
 * (`rows[].keys[0]` is `YYYY-MM-DD`). Null when no row carries a date: Google
 * has reported nothing in the probed range, so nothing may be stored.
 */
export function latestReportedDate(
  rows: ReadonlyArray<{ keys?: ReadonlyArray<string | null | undefined> | null }> | null | undefined,
): string | null {
  let latest: string | null = null
  for (const row of rows ?? []) {
    const key = row.keys?.[0]
    if (typeof key !== 'string' || !ISO_DATE.test(key)) continue
    if (latest === null || key > latest) latest = key
  }
  return latest
}

/** True when Google has final data for `day` (both `YYYY-MM-DD`). */
export function isDayReported(day: string, reportedThrough: string | null): boolean {
  if (reportedThrough === null) return false
  return day <= reportedThrough
}

/**
 * Splits the days a run would write into the ones Google has reported
 * (`reported`, safe to store) and the ones it has not (`pending`, skipped this
 * run and picked up by a later run's rolling re-pull). Order is kept.
 */
export function splitReportedDays(
  days: readonly string[],
  reportedThrough: string | null,
): { reported: string[]; pending: string[] } {
  const reported: string[] = []
  const pending: string[] = []
  for (const day of days) (isDayReported(day, reportedThrough) ? reported : pending).push(day)
  return { reported, pending }
}
