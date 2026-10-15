/**
 * Saved-search alert cadence — the single source of truth for the notification
 * frequencies the alert cron honors.
 *
 * Four values: `instant`, `daily`, `weekly`, `monthly` (monthly added
 * 2026-07-21 per Matt). Anything else falls back to `daily`. The consumer
 * "manage my saved searches" UI on /account must offer ONLY these four so a
 * user can't pick a cadence the cron silently ignores.
 *
 * This module also owns the DUE logic (`isCadenceDue`) so the cron, the
 * broker send surfaces, and any future sender all agree on what each cadence
 * means in elapsed time.
 *
 * Pure module (no imports, no I/O) so the option list + validator + due logic
 * are unit-testable and shared by the server action (validate the client
 * value), the client island (render the Select options), and the cron.
 */

export type SavedSearchCadence = 'instant' | 'daily' | 'weekly' | 'monthly'

/** Default cadence when a row has no stored frequency (matches the DB default + the cron fallback). */
export const DEFAULT_SAVED_SEARCH_CADENCE: SavedSearchCadence = 'daily'

/**
 * The cadence options the cron honors, in the order shown in the Select.
 * `value` is what's stored in listing_alerts.notification_frequency.
 * `label` is the visible, sentence-case option text. `hint` is a short
 * plain-language gloss for the active cadence.
 */
export const SAVED_SEARCH_CADENCES: ReadonlyArray<{
  value: SavedSearchCadence
  label: string
  hint: string
}> = [
  { value: 'instant', label: 'As they hit the market', hint: 'New matches as soon as we find them' },
  { value: 'daily', label: 'Once a day', hint: 'A daily roundup of new matches' },
  { value: 'weekly', label: 'Once a week', hint: 'A weekly roundup of new matches' },
  { value: 'monthly', label: 'Once a month', hint: 'A monthly roundup of new matches' },
] as const

const CADENCE_VALUES: ReadonlySet<string> = new Set(SAVED_SEARCH_CADENCES.map((c) => c.value))

/** True when `value` is one of the four cron-honored cadences. */
export function isSavedSearchCadence(value: unknown): value is SavedSearchCadence {
  return typeof value === 'string' && CADENCE_VALUES.has(value)
}

/**
 * Coerce an arbitrary client-supplied value to a valid cadence. Trims and
 * lowercases, then returns the matched cadence or null when it isn't one the
 * cron honors. The server action refuses the write on null.
 */
export function validateCadence(value: unknown): SavedSearchCadence | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return isSavedSearchCadence(normalized) ? normalized : null
}

/**
 * Coerce a stored/unknown frequency to a cadence for display, falling back to
 * the default when the stored value is missing or unrecognized (mirrors the
 * cron's fallback).
 */
export function normalizeStoredCadence(value: unknown): SavedSearchCadence {
  return validateCadence(value) ?? DEFAULT_SAVED_SEARCH_CADENCE
}

/** The visible option label for a cadence (sentence case). */
export function cadenceLabel(value: unknown): string {
  const cadence = normalizeStoredCadence(value)
  const match = SAVED_SEARCH_CADENCES.find((c) => c.value === cadence)
  return match ? match.label : SAVED_SEARCH_CADENCES[1].label
}

// ── Due logic ─────────────────────────────────────────────────────────────────

/**
 * Minimum elapsed time before a cadence is due again.
 *
 * 'instant' rides the hourly cron with a ~55-min floor — a new match reaches
 * the subscriber within the hour, and the floor sits just under 60 min so the
 * hourly tick is never skipped by clock jitter (Matt directive 2026-07-11).
 * 'monthly' = 30 days since the last send (Matt directive 2026-07-21).
 */
export const CADENCE_INTERVAL_MS: Record<SavedSearchCadence, number> = {
  instant: 55 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
}

/**
 * Brokerage-local timezone for per-day weekly scheduling. Bend, Oregon —
 * subscribers think in Pacific days, not UTC days.
 */
export const CADENCE_TIME_ZONE = 'America/Los_Angeles'

/**
 * Sanitize a stored schedule_days value (smallint[] — 0=Sunday..6=Saturday)
 * to a deduped list of valid day numbers. Null/empty/garbage → null, meaning
 * "no per-day restriction" (plain weekly interval applies).
 */
export function normalizeScheduleDays(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null
  const days = [...new Set(raw.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))]
  return days.length > 0 ? days.sort((a, b) => a - b) : null
}

/** "2026-07-29"-style local calendar-day stamp for a moment, in `timeZone`. */
function localDayStamp(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at)
}

/**
 * THE DAILY SLOT (Matt 2026-10-14: daily is the default for every place-page
 * signup). A daily alert goes out once per Pacific calendar day, on the first
 * hourly cron tick at or after this local hour.
 *
 * It used to mean "24 hours after the last send". On an hourly cron that
 * drifts: a send at 4:00:20 is not 24 hours old at the next day's 4:00:05
 * tick, so it went at 5:00, then 6:00, walking around the clock about an hour
 * a day. A morning slot keeps the email where a buyer reads it, with the
 * overnight listings in it.
 *
 * The first email after signup is sent at signup (runListingAlerts with
 * alertIds), whatever the hour. The next one is the following morning slot,
 * never the same local day, so the closest two sends can sit is the gap from
 * a late-night signup to 7:00 the next morning.
 */
export const DAILY_SEND_HOUR_LOCAL = 7

/** Local hour (0..23) for a moment, in `timeZone`. */
export function localHour(at: Date, timeZone: string = CADENCE_TIME_ZONE): number {
  const part = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' })
    .formatToParts(at)
    .find((p) => p.type === 'hour')
  const hour = part ? Number(part.value) : NaN
  return Number.isFinite(hour) ? hour % 24 : at.getUTCHours()
}

/** Local day-of-week (0=Sunday..6=Saturday) for a moment, in `timeZone`. */
export function localDayOfWeek(at: Date, timeZone: string = CADENCE_TIME_ZONE): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(at)
  const idx = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name)
  return idx >= 0 ? idx : at.getUTCDay()
}

/**
 * True when an alert row is due for its next send. Drop-in replacement for the
 * cron's local `shouldSendByFrequency` (app/actions/saved-search-alerts.ts):
 * a never-notified row is always due; an unknown or missing stored frequency
 * falls back to the default cadence; an unparseable timestamp is treated as
 * never-notified so a corrupt value can't silence an alert forever.
 *
 * Weekly + schedule_days (0=Sunday..6=Saturday, America/Los_Angeles): the
 * Flexmls per-day-of-week model. The alert is due only ON a scheduled local
 * day, at most once per local day (a Mon+Thu schedule sends twice a week —
 * the 7-day interval does not also apply). schedule_days is ignored for every
 * other cadence.
 */
export function isCadenceDue(
  alert: {
    notification_frequency: string | null
    last_notified_at: string | null
    schedule_days?: unknown
  },
  now: Date = new Date(),
): boolean {
  const cadence = normalizeStoredCadence(alert.notification_frequency)

  const scheduleDays = cadence === 'weekly' ? normalizeScheduleDays(alert.schedule_days) : null
  if (scheduleDays) {
    if (!scheduleDays.includes(localDayOfWeek(now))) return false
    if (!alert.last_notified_at) return true
    const last = new Date(alert.last_notified_at)
    if (!Number.isFinite(last.getTime())) return true
    // At most one send per scheduled local day.
    return localDayStamp(last, CADENCE_TIME_ZONE) !== localDayStamp(now, CADENCE_TIME_ZONE)
  }

  if (!alert.last_notified_at) return true
  const last = new Date(alert.last_notified_at).getTime()
  if (!Number.isFinite(last)) return true

  // Daily: the morning slot, at most once per Pacific day. See DAILY_SEND_HOUR_LOCAL.
  if (cadence === 'daily') {
    if (localHour(now, CADENCE_TIME_ZONE) < DAILY_SEND_HOUR_LOCAL) return false
    return localDayStamp(new Date(last), CADENCE_TIME_ZONE) !== localDayStamp(now, CADENCE_TIME_ZONE)
  }

  return now.getTime() - last >= CADENCE_INTERVAL_MS[cadence]
}
