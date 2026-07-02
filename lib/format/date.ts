/**
 * Canonical date/timezone formatting (audit p1.4).
 *
 * ~96 files format dates inline and ~30 hardcode an `America/...` timezone. This
 * is the single source; default zone is America/Los_Angeles (Central Oregon).
 * The `ci:date-format` gate ratchets new inline date formatting toward zero.
 */
const TZ = 'America/Los_Angeles'

/** Format a date in the brand timezone. Defaults to "Jun 22, 2026"; override via opts. */
export function formatDate(
  d: string | number | Date | null | undefined,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (d == null) return '—'
  const date = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...opts,
  }).format(date)
}

/** Date + time in the brand timezone, e.g. "Jun 22, 2026, 3:04 PM". */
export function formatDateTime(d: string | number | Date | null | undefined): string {
  return formatDate(d, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/**
 * YYYY-MM-DD calendar-day key for an instant in the brand timezone. Used by the
 * §09 Tasks/Calendar surfaces to group true-instant timestamps (crm_tasks.due_at)
 * into Pacific calendar days. Lives here so Intl stays inside lib/format
 * (ci:date-format).
 */
export function zonedDateKey(d: string | number | Date, timeZone: string = TZ): string {
  const date = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(date.getTime())) return ''
  // en-CA yields YYYY-MM-DD directly.
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(date)
}

/** Minutes since midnight for an instant in the brand timezone (grid placement). */
export function zonedMinutes(d: string | number | Date, timeZone: string = TZ): number {
  const date = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(date.getTime())) return 0
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0')
  return (get('hour') % 24) * 60 + get('minute')
}

/**
 * Local short weekday ("Mon".."Sun") + minutes since midnight for an instant in
 * an IANA zone. Used by the office-hours evaluator (lib/crm/office-hours.ts) —
 * a timezone CALCULATION, kept here so every Intl.DateTimeFormat call lives in
 * the canonical module (ci:date-format).
 */
export function zonedDayMinutes(now: Date, timeZone: string): { day: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone || TZ,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const day = get('weekday') || 'Mon'
  // hour12:false can yield "24" for midnight in some ICU versions — normalize.
  const hour = Number(get('hour')) % 24
  const minute = Number(get('minute'))
  return { day, minutes: hour * 60 + minute }
}
