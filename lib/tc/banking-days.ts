/**
 * Banking-day math for the OAR 863-015-0140 principal-broker review deadline
 * ("within seven banking days"). A banking day is a weekday on which banks are
 * open — i.e. excluding Saturdays, Sundays, and US federal holidays (federal
 * observance: a holiday on Sat is observed Fri, on Sun is observed Mon).
 *
 * Pure + deterministic (no Date.now() inside — callers pass the reference date).
 */

function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  // month 0-indexed; weekday 0=Sun..6=Sat; n=1..5
  const first = new Date(Date.UTC(year, month, 1))
  const offset = (7 + weekday - first.getUTCDay()) % 7
  return new Date(Date.UTC(year, month, 1 + offset + (n - 1) * 7))
}
function lastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const last = new Date(Date.UTC(year, month + 1, 0))
  const offset = (7 + last.getUTCDay() - weekday) % 7
  return new Date(Date.UTC(year, month + 1, 0 - offset))
}
function observed(d: Date): Date {
  const day = d.getUTCDay()
  if (day === 6) return new Date(d.getTime() - 86400000) // Sat → Fri
  if (day === 0) return new Date(d.getTime() + 86400000) // Sun → Mon
  return d
}
function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

/** US federal banking holidays (observed) for a calendar year. */
function federalHolidays(year: number): Set<string> {
  const fixed = [
    new Date(Date.UTC(year, 0, 1)), // New Year's
    new Date(Date.UTC(year, 5, 19)), // Juneteenth
    new Date(Date.UTC(year, 6, 4)), // Independence Day
    new Date(Date.UTC(year, 10, 11)), // Veterans Day
    new Date(Date.UTC(year, 11, 25)), // Christmas
  ].map(observed)
  const floating = [
    nthWeekdayOfMonth(year, 0, 1, 3), // MLK — 3rd Mon Jan
    nthWeekdayOfMonth(year, 1, 1, 3), // Presidents — 3rd Mon Feb
    lastWeekdayOfMonth(year, 4, 1), // Memorial — last Mon May
    nthWeekdayOfMonth(year, 8, 1, 1), // Labor — 1st Mon Sep
    nthWeekdayOfMonth(year, 9, 1, 2), // Columbus — 2nd Mon Oct
    nthWeekdayOfMonth(year, 10, 4, 4), // Thanksgiving — 4th Thu Nov
  ]
  return new Set([...fixed, ...floating].map(ymd))
}

const holidayCache = new Map<number, Set<string>>()
function isHoliday(d: Date): boolean {
  const y = d.getUTCFullYear()
  if (!holidayCache.has(y)) holidayCache.set(y, federalHolidays(y))
  return holidayCache.get(y)!.has(ymd(d))
}

export function isBankingDay(d: Date): boolean {
  const day = d.getUTCDay()
  return day !== 0 && day !== 6 && !isHoliday(d)
}

/** The date that is `n` banking days after `start` (n>0 moves forward). */
export function addBankingDays(start: Date, n: number): Date {
  const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()))
  let remaining = n
  while (remaining > 0) {
    d.setUTCDate(d.getUTCDate() + 1)
    if (isBankingDay(d)) remaining--
  }
  return d
}

/** Banking days from `from` to `to` (signed: negative if `to` is before `from`). */
export function bankingDaysBetween(from: Date, to: Date): number {
  const a = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
  const b = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()))
  if (a.getTime() === b.getTime()) return 0
  const forward = b > a
  const lo = forward ? a : b
  const hi = forward ? b : a
  let count = 0
  const d = new Date(lo)
  while (d < hi) {
    d.setUTCDate(d.getUTCDate() + 1)
    if (isBankingDay(d)) count++
  }
  return forward ? count : -count
}

export type ReviewDeadline = {
  /** ISO date the 7-banking-day window closes. */
  dueIso: string
  /** Banking days remaining until due (negative = overdue by that many). */
  bankingDaysRemaining: number
  overdue: boolean
}

/**
 * The OAR 863-015-0140 deadline: 7 banking days after the clock-start date
 * (the document's acceptance/rejection/withdrawal). `now` is passed in.
 */
export function reviewDeadline(clockStartIso: string | null, now: Date, days = 7): ReviewDeadline | null {
  if (!clockStartIso) return null
  const start = new Date(clockStartIso)
  if (Number.isNaN(start.getTime())) return null
  const due = addBankingDays(start, days)
  const remaining = bankingDaysBetween(now, due)
  return { dueIso: ymd(due), bankingDaysRemaining: remaining, overdue: remaining < 0 }
}
