/**
 * lib/crm/calendar.ts — calendar math for the §09 Calendar module
 * (docs/crm-spec/09-tasks-and-calendar.md Part 2).
 *
 * Date-key arithmetic (shiftDays, weekRange, monthGrid, …) is pure UTC-proleptic
 * math with no Intl and no ambient Date.now(), so grid ranges stay unit-testable
 * and hydration-safe.
 *
 * Instants: crm_appointments.start_at/end_at and crm_tasks.due_at are true UTC
 * instants. Display every one of them in America/Los_Angeles via the zoned*
 * helpers in lib/format/date.ts (appointmentEvents, formatAppointmentWhen).
 * wallDateKey / wallMinutes read the ISO digits as-written and are not the
 * appointment display path — a 10:00 PT booking stored at 17:00Z must print
 * "10am", not "5pm".
 */

import { zonedDateKey, zonedMinutes } from '@/lib/format/date'

const PT = 'America/Los_Angeles'

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

// ── ISO-digit parsing (not appointment display) ───────────────────────────────

/** First 10 ISO characters. Not the appointment display path — use zonedDateKey. */
export function wallDateKey(iso: string): string {
  return iso.slice(0, 10)
}

/** Hour/minute digits from the ISO string. Not the appointment display path. */
export function wallMinutes(iso: string): number {
  const h = Number(iso.slice(11, 13))
  const m = Number(iso.slice(14, 16))
  return (Number.isNaN(h) ? 0 : h) * 60 + (Number.isNaN(m) ? 0 : m)
}

/** Pacific date key + HH:mm for datetime-local / time inputs. */
export function zonedDateTimeParts(iso: string): { dateKey: string; minutes: number; hhmm: string } {
  const dateKey = zonedDateKey(iso, PT)
  const minutes = zonedMinutes(iso, PT)
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return { dateKey, minutes, hhmm: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` }
}

function tzLabel(timezone: string | null | undefined): string {
  if (timezone === 'America/New_York') return 'Eastern Time'
  if (timezone === 'America/Chicago') return 'Central Time'
  if (timezone === 'America/Denver') return 'Mountain Time'
  return 'Pacific Time'
}

/** Invite "When:" line. Times are always America/Los_Angeles. */
export function formatAppointmentWhen(params: {
  startAt: string
  endAt: string
  allDay: boolean
  timezone?: string | null
}): string {
  const dayLabel = taskGroupLabel(zonedDateKey(params.startAt, PT))
  if (params.allDay) return `${dayLabel} (all day)`
  const start = time12(zonedMinutes(params.startAt, PT))
  const end = time12(zonedMinutes(params.endAt, PT))
  return `${dayLabel}, ${start}–${end} (${tzLabel(params.timezone)})`
}

// ── The unified calendar event ────────────────────────────────────────────────

export type CalEventKind = 'appointment' | 'task' | 'closing' | 'file'

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
  /** crm_tasks.type when kind === 'task' (the §29 A.6 mobile icon map). */
  taskType?: string | null
  /** Vault deal key when kind === 'file'. */
  propertyKey?: string | null
}

/** Map an appointment instant onto the grid (Pacific day + minutes). */
export function appointmentEvents(a: {
  id: number
  title: string
  startAt: string
  endAt: string
  allDay: boolean
  personId: number | null
  personName: string | null
  brokerSlug: string | null
}): CalEvent[] {
  const startKey = zonedDateKey(a.startAt, PT)
  const endKey = zonedDateKey(a.endAt, PT)
  const base = {
    kind: 'appointment' as const,
    title: a.title,
    personId: a.personId,
    personName: a.personName,
    broker: a.brokerSlug,
    apptId: a.id,
  }
  if (endKey <= startKey) {
    const startMin = a.allDay ? -1 : zonedMinutes(a.startAt, PT)
    return [{
      ...base,
      id: `appt:${a.id}`,
      dateKey: startKey,
      startMin,
      endMin: a.allDay ? -1 : zonedMinutes(a.endAt, PT),
      allDay: a.allDay,
      timeLabel: a.allDay ? '' : time12(startMin),
    }]
  }
  const out: CalEvent[] = []
  for (let d = startKey, i = 0; d <= endKey && i < 62; d = shiftDays(d, 1), i++) {
    out.push({
      ...base,
      id: `appt:${a.id}:${d}`,
      dateKey: d,
      startMin: -1,
      endMin: -1,
      allDay: true,
      timeLabel: '',
    })
  }
  return out
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
