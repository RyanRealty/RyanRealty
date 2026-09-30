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
import { outsideEmailSendWindow } from '@/lib/newsletter/market-report-audience'

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

/**
 * The UTC hours the send cron fires (vercel.json: `0 4,10,16,22 * * *` for
 * /api/cron/crm-market-report-send). A unit test pins this against
 * vercel.json so the "next send" a broker is shown cannot drift from the
 * schedule that actually runs.
 */
export const MARKET_REPORT_CRON_HOURS_UTC: readonly number[] = [4, 10, 16, 22]

/**
 * Is `now` inside the email send window (8am to 8pm America/Los_Angeles)?
 * The same window the bulk market-report path enforces
 * (lib/newsletter/market-report-audience.ts). A report that lands at 3am reads
 * as spam to a person and to a mailbox provider's engagement model; before
 * 2026-09-29 the cadence path had no window and sent at 10:00 UTC (3am
 * Pacific) on 2026-09-05 and 2026-09-16.
 */
export function inReportSendWindow(now: Date = new Date()): boolean {
  return !outsideEmailSendWindow(now)
}

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

/** When a subscription next becomes due (last send + its window). Null when never sent (due now). */
export function dueAt(frequency: ReportFrequency, lastSentAt: string | Date | null | undefined): Date | null {
  const window = CADENCE_WINDOW_MS[frequency]
  const lastMs = toMs(lastSentAt)
  if (window == null || lastMs == null) return null
  return new Date(lastMs + window)
}

/**
 * The first cron run at or after `from` that falls inside the send window:
 * the moment a due report can actually go out. Walks the cron's UTC hours
 * forward (at most 8 days, which always finds one). Pure.
 */
export function nextCronRunInWindow(from: Date): Date | null {
  const start = from.getTime()
  const day0 = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  for (let d = 0; d <= 8; d++) {
    for (const h of MARKET_REPORT_CRON_HOURS_UTC) {
      const t = day0 + d * DAY_MS + h * HOUR_MS
      if (t < start) continue
      const at = new Date(t)
      if (inReportSendWindow(at)) return at
    }
  }
  return null
}

/**
 * When the next report is expected to go out, for the admin card and the
 * delivery panel. Basis, named: the later of now and (last send + the
 * cadence window), then the first cron run inside 8am to 8pm Pacific. Null
 * when nothing will send (off, or waiting on the first-send approval).
 */
export function nextReportSendAt(input: {
  isActive: boolean
  approved: boolean
  frequency: ReportFrequency
  lastSentAt: string | Date | null | undefined
  now?: Date
}): Date | null {
  if (!input.isActive || !input.approved) return null
  const now = input.now ?? new Date()
  const due = dueAt(input.frequency, input.lastSentAt)
  const from = due && due.getTime() > now.getTime() ? due : now
  return nextCronRunInWindow(from)
}
