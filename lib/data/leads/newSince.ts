/**
 * "New since last visit" — the PURE half of the /account portal badge
 * (Phase 4.1, docs/plans/SEARCH_OPTIMIZATION_PLAN_2026-07-29.md item 6).
 *
 * No I/O and no imports on purpose, so the whole rule set is unit-testable.
 * The composition layer (app/account/portal-data.ts) fetches the newest page
 * of a saved search's CURRENT matches and hands the on-market dates here.
 *
 * Why on-market dates and not listing_alerts.notified_listing_keys: the alert
 * engine (lib/alerts/event-detection.ts detectListingEvents) restamps
 * notified_at on EVERY current match on every pass, so that column is a "last
 * seen by the engine" cursor. It cannot answer "what is new to this person
 * since they last looked". The visit baseline is listing_alerts.last_viewed_at
 * (migration 20260731180000), falling back to the row's created_at so a search
 * saved five minutes ago does not claim its whole result set is new.
 *
 * Scan window: the composition layer reads one newest-first page
 * (NEW_SINCE_SCAN_SIZE rows). When every scanned row is newer than the
 * baseline the true count could be higher, so the result is marked `saturated`
 * and the UI renders "24+" rather than a number we did not verify (§0).
 */

/** Rows read per saved search when computing the badge. One cached page. */
export const NEW_SINCE_SCAN_SIZE = 24

export type NewSinceResult = {
  /** Matches whose on-market date is strictly after the baseline. */
  count: number
  /** True when the scan window was full AND every row in it counted. */
  saturated: boolean
  /** The instant the count is measured from (ISO), or null when unknowable. */
  baseline: string | null
}

export const EMPTY_NEW_SINCE: NewSinceResult = { count: 0, saturated: false, baseline: null }

function parseMs(iso: string | null | undefined): number | null {
  if (!iso) return null
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : null
}

/**
 * The instant "new" is measured from: the owner's last explicit "mark as seen",
 * else when they saved the search. Null when neither stamp parses, which
 * suppresses the badge entirely rather than guessing.
 */
export function newSinceBaseline(row: {
  lastViewedAt?: string | null
  createdAt?: string | null
}): string | null {
  if (parseMs(row.lastViewedAt) != null) return row.lastViewedAt as string
  if (parseMs(row.createdAt) != null) return row.createdAt as string
  return null
}

/**
 * Count the scanned matches that came on market after the baseline.
 *
 * `onMarketDates` is the newest-first page of current matches; entries with an
 * unparseable or missing date never count (an unknown date is not evidence of
 * newness). A full window in which everything counted is reported saturated.
 */
export function countNewSince(
  onMarketDates: ReadonlyArray<string | null | undefined>,
  baselineIso: string | null,
  scanSize: number = NEW_SINCE_SCAN_SIZE,
): NewSinceResult {
  const baselineMs = parseMs(baselineIso)
  if (baselineMs == null) return { ...EMPTY_NEW_SINCE, baseline: null }

  let count = 0
  for (const iso of onMarketDates) {
    const ms = parseMs(iso)
    if (ms != null && ms > baselineMs) count += 1
  }

  const scanned = onMarketDates.length
  const saturated = scanned > 0 && scanned >= scanSize && count === scanned
  return { count, saturated, baseline: baselineIso }
}

/**
 * Badge text, or null when there is nothing new to say. Sentence case, no
 * hype: the number does the work.
 */
export function formatNewSinceLabel(result: NewSinceResult): string | null {
  if (result.count <= 0) return null
  const value = result.saturated ? `${result.count}+` : `${result.count}`
  return `${value} new`
}
