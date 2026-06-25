/**
 * market-report-cadence — the pure cadence math for the market-report send
 * engine (Wave 8).
 *
 * A contact subscribes to a frequency (weekly | monthly | quarterly). The cron
 * ticks more often than any cadence and asks, per contact, "is this one due?"
 * `isDue` answers from the frequency + the last successful send time, with no
 * I/O — so the rule is unit-tested without the DB and the cron stays a thin
 * orchestrator over it.
 *
 * Window definition: a contact is due when at least the cadence window has
 * elapsed since their last send. A never-sent contact (null lastSentAt) is
 * always due. Windows are deliberately one day shy of the nominal period so a
 * monthly contact mailed on the 1st at 09:00 is due again on the 1st of the
 * next month even if the cron fires a few minutes earlier — cadence drift over
 * months should not push a "monthly" report to the 2nd, then the 3rd, and so on.
 *
 *   weekly    >= 7 days
 *   monthly   >= 30 days
 *   quarterly >= 89 days   (a hair under 90 to absorb 28/29-day Februaries
 *                           without sliding a quarterly send later each cycle)
 */

import type { ReportFrequency } from '@/lib/data/crm/getContactReportSubscriptions'

const DAY_MS = 24 * 60 * 60 * 1000

/** Minimum elapsed window per cadence, in milliseconds. */
export const CADENCE_WINDOW_MS: Record<ReportFrequency, number> = {
  weekly: 7 * DAY_MS,
  monthly: 30 * DAY_MS,
  quarterly: 89 * DAY_MS,
}

export interface IsDueInput {
  frequency: ReportFrequency
  /** ISO string, Date, or null/undefined when never sent. */
  lastSentAt: string | Date | null | undefined
  /** Evaluation moment. Defaults to now. */
  now?: Date
}

/** Parse an ISO string / Date to epoch ms, or null when unusable. */
function toMs(v: string | Date | null | undefined): number | null {
  if (v == null) return null
  if (v instanceof Date) {
    const t = v.getTime()
    return Number.isNaN(t) ? null : t
  }
  const t = new Date(v).getTime()
  return Number.isNaN(t) ? null : t
}

/**
 * Is a subscription due for its next market-report send?
 *
 * - A never-sent contact (null/invalid lastSentAt) is ALWAYS due.
 * - Otherwise due when (now - lastSentAt) >= the cadence window.
 * - A lastSentAt in the FUTURE (clock skew / bad data) is treated as not yet due
 *   rather than crashing — fail-safe toward not re-sending.
 *
 * Pure. Exported for the unit test.
 */
export function isDue(input: IsDueInput): boolean {
  const window = CADENCE_WINDOW_MS[input.frequency]
  // An unknown frequency has no window — treat as not due (never spam an
  // unrecognized cadence). The type guards this, but be defensive at runtime.
  if (window == null) return false

  const lastMs = toMs(input.lastSentAt)
  if (lastMs == null) return true // never sent → due

  const nowMs = (input.now ?? new Date()).getTime()
  return nowMs - lastMs >= window
}
