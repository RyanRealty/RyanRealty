/**
 * lib/crm/calendar.ts — pure calendar math for the §09 Calendar module
 * (docs/fub-crm-spec/09-tasks-and-calendar.md Part 2).
 *
 * Everything here is pure (no Intl, no ambient Date.now()) so the grid
 * placement + view ranges are unit-testable and hydration-safe. Two time
 * conventions coexist in the CRM (preserved from the existing backend):
 *   - crm_appointments.start_at/end_at are WALL-CLOCK timestamps stored as
 *     UTC ("2026-07-04T09:00:00Z" means 9:00am on the calendar) — parse with
 *     the wall* helpers below.
 *   - crm_tasks.due_at are TRUE instants — convert to the brand timezone with
 *     the zoned* helpers in lib/format/date.ts before handing to the grid.
 */

export const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
export const DOW_FULL = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const
export const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const
export const MONTH_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

/** The hour band the Day/Week grids render (§2.5.1: 7am through ~10pm). */
export const GRID_START_HOUR = 7
export const GRID_END_HOUR = 22

// ── Date-key math (YYYY-MM-DD strings, UTC-proleptic) ────────────────────────

export function isDateKey(v: string | null | undefined): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)
}

function toUtc(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function fromUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(dateKey: string): number {
  return toUtc(dateKey).getUTCDay()
}

export function shiftDays(dateKey: string, days: number): string {
  const d = toUtc(dateKey)
  d.setUTCDate(d.getUTCDate() + days)
  return fromUtc(d)
}

export function shiftMonths(dateKey: string, months: number): string {
  const [y, m] = dateKey.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + months, 1))
  return fromUtc(d)
}

/** Sunday-anchored week containing dateKey → [sunday, saturday]. */
export function weekRange(dateKey: string): { from: string; to: string } {
  const from = shiftDays(dateKey, -dayOfWeek(dateKey))
  return { from, to: shiftDays(from, 6) }
}

/** First + last day of dateKey's month. */
export function monthRange(dateKey: string): { from: string; to: string } {
  const [y, m] = dateKey.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const mm = String(m).padStart(2, '0')
  return { from: `${dateKey.slice(0, 7)}-01`, to: `${y}-${mm}-${String(last).padStart(2, '0')}` }
}

/**
 * The month-view grid: Sunday-aligned weeks covering dateKey's month,
 * including the faded overflow days from adjacent months (§2.5.3).
 */
export function monthGrid(dateKey: string): { cells: string[]; from: string; to: string } {
  const { from, to } = monthRange(dateKey)
  const gridFrom = shiftDays(from, -dayOfWeek(from))
  const gridTo = shiftDays(to, 6 - dayOfWeek(to))
  const cells: string[] = []
  for (let d = gridFrom; d <= gridTo; d = shiftDays(d, 1)) cells.push(d)
  return { cells, from: gridFrom, to: gridTo }
}

// ── Labels (pure — no Intl) ───────────────────────────────────────────────────

/** "Tuesday, Jun 23" — the §1.5.2 task date-group header (count appended by caller). */
export function taskGroupLabel(dateKey: string): string {
  const d = toUtc(dateKey)
  return `${DOW_FULL[d.getUTCDay()]}, ${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}`
}

/** "June 2026" for the mini-cal / month header. */
export function monthLabel(dateKey: string): string {
  const [y, m] = dateKey.split('-').map(Number)
  return `${MONTH_FULL[m - 1]} ${y}`
}

/** "Tuesday 30" — the Day-view column header (§2.5.1). */
export function dayColumnLabel(dateKey: string): string {
  const d = toUtc(dateKey)
  return `${DOW_FULL[d.getUTCDay()]} ${d.getUTCDate()}`
}

/** Minutes since midnight → "12:12pm" (lowercase, no leading zero — §1.5.3). */
export function time12(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  const ap = h24 < 12 ? 'am' : 'pm'
  const h = h24 % 12 === 0 ? 12 : h24 % 12
  return m === 0 ? `${h}${ap}` : `${h}:${String(m).padStart(2, '0')}${ap}`
}

// ── Wall-clock ISO parsing (appointments) ─────────────────────────────────────

/** "2026-07-04T09:30:00+00:00" → "2026-07-04" (the stored wall-clock date). */
export function wallDateKey(iso: string): string {
  return iso.slice(0, 10)
}

/** Wall-clock minutes since midnight from a stored appointment timestamp. */
export function wallMinutes(iso: string): number {
  const h = Number(iso.slice(11, 13))
  const m = Number(iso.slice(14, 16))
  return (Number.isNaN(h) ? 0 : h) * 60 + (Number.isNaN(m) ? 0 : m)
}

// ── The unified calendar event ────────────────────────────────────────────────

export type CalEventKind = 'appointment' | 'task' | 'closing'

export type CalEvent = {
  /** 'appt:12' | 'task:437' | 'deal:5' */
  id: string
  kind: CalEventKind
  title: string
  dateKey: string
  /** Minutes since midnight; -1 for all-day events. */
  startMin: number
  endMin: number
  allDay: boolean
  /** '12:12pm' — empty for all-day. */
  timeLabel: string
  personId: number | null
  personName: string | null
  broker: string | null
  /** Appointment id when kind === 'appointment' (opens the edit modal). */
  apptId: number | null
}

/** Group events by dateKey, all-day first, then by start time. */
export function eventsByDate(events: CalEvent[]): Map<string, CalEvent[]> {
  const map = new Map<string, CalEvent[]>()
  for (const e of events) {
    if (!map.has(e.dateKey)) map.set(e.dateKey, [])
    map.get(e.dateKey)!.push(e)
  }
  for (const list of map.values()) {
    list.sort((a, b) => Number(a.allDay ? -1 : a.startMin) - Number(b.allDay ? -1 : b.startMin))
  }
  return map
}
