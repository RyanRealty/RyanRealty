/**
 * Google Chrome stable release dates, one per milestone, for the stale-browser
 * automation rule (lib/analytics/automation.ts, 2026-10-14).
 *
 * Source: the Chromium release schedule, chromiumdash.appspot.com
 * `fetch_milestone_schedule?mstone=<n>`, field `stable_date` (the day the
 * milestone's stable rollout begins on Windows, macOS and Linux). Fetched
 * 2026-10-14 for milestones 138 to 160. Dates after 2026-10-14 are Google's
 * published schedule, not observed releases. Chrome moved from a four-week to a
 * two-week cadence at milestone 153, so the gaps below are not regular and no
 * formula stands in for this table.
 *
 * Refresh: append the next milestones from the same endpoint. A milestone newer
 * than the last row is never judged stale (the rule fails open), so a stale
 * table can only miss automation, never flag a current browser.
 */
export const CHROME_STABLE_DATES: Readonly<Record<number, string>> = {
  138: '2025-06-24',
  139: '2025-08-05',
  140: '2025-09-02',
  141: '2025-09-30',
  142: '2025-10-28',
  143: '2025-12-02',
  144: '2026-01-13',
  145: '2026-02-10',
  146: '2026-03-10',
  147: '2026-04-07',
  148: '2026-05-05',
  149: '2026-06-02',
  150: '2026-06-30',
  151: '2026-07-28',
  152: '2026-08-25',
  153: '2026-09-08',
  154: '2026-09-22',
  155: '2026-10-06',
  156: '2026-10-20',
  157: '2026-11-03',
  158: '2026-11-17',
  159: '2026-12-08',
  160: '2027-01-05',
}

const MILESTONES = Object.keys(CHROME_STABLE_DATES).map(Number).sort((a, b) => a - b)

/** The oldest milestone the table lists. Anything older was superseded on or before its stable date. */
export const OLDEST_LISTED_CHROME = MILESTONES[0]

/**
 * When `major` stopped being the newest stable Chrome: the stable date of the
 * next milestone, as epoch ms. null when the table does not know the successor
 * (a current or future milestone, or one past the table's end). For a milestone
 * older than the table, the first listed stable date (its successor came even
 * earlier than that).
 */
export function chromeSupersededAt(major: number): number | null {
  if (!Number.isInteger(major) || major <= 0) return null
  if (major < OLDEST_LISTED_CHROME) return Date.parse(`${CHROME_STABLE_DATES[OLDEST_LISTED_CHROME]}T00:00:00Z`)
  const next = CHROME_STABLE_DATES[major + 1]
  return next ? Date.parse(`${next}T00:00:00Z`) : null
}
