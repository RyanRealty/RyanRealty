/**
 * The Website view's windows and words (Matt 2026-10-14: one page that
 * "actually makes sense", read on a phone). Pure: no I/O, no React.
 *
 * WINDOWS. Every first-party and CRM figure covers the last 7 FULL days on
 * Pacific time (the brokerage's day: a lead at 6 pm on Oct 13 belongs to Oct
 * 13), today left out because it is not over, compared with the 7 days before.
 * A window that ended "now" would compare a part day against full ones and read
 * as a drop every morning. Search Console and Business Profile report days
 * late, so their windows end on the newest day each source has reported
 * (windowEndingOn).
 */
import type { ChannelGroup } from '@/lib/data/analytics/channel-grouping'
import { formatCalendarDay, zonedDateKey, zonedMinutes } from '@/lib/format/date'

export type DayWindow = {
  /** Inclusive YYYY-MM-DD bounds, Pacific calendar days. */
  startDate: string
  endDate: string
  /** The same bounds as instants: Pacific midnight that starts startDate, to 1 ms before the midnight after endDate. */
  startIso: string
  endIso: string
}

export type WindowPair = { current: DayWindow; previous: DayWindow }

/** The brokerage's clock (Bend, Oregon). */
export const SITE_TIME_ZONE = 'America/Los_Angeles'

const DAY_MS = 86_400_000

function ymd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/** How far `tz` is from UTC at an instant, in ms (Pacific: -7 h in summer, -8 h in winter). */
function tzOffsetMs(utcMs: number, tz: string): number {
  const localDay = zonedDateKey(utcMs, tz)
  const localMinutes = zonedMinutes(utcMs, tz)
  return Date.parse(`${localDay}T00:00:00.000Z`) + localMinutes * 60_000 - Math.floor(utcMs / 60_000) * 60_000
}

/** The calendar day (YYYY-MM-DD) an instant falls on in `tz`. */
export function dayInZone(at: string | number, tz: string = SITE_TIME_ZONE): string {
  return zonedDateKey(at, tz)
}

/** The instant (ms) of midnight starting `date` in `tz`, DST included. */
export function zonedMidnightMs(date: string, tz: string = SITE_TIME_ZONE): number {
  const guess = Date.parse(`${date}T00:00:00.000Z`)
  const first = guess - tzOffsetMs(guess, tz)
  return guess - tzOffsetMs(first, tz)
}

function dayWindow(startDate: string, days: number, tz: string): DayWindow {
  const endDate = addDays(startDate, days - 1)
  return {
    startDate,
    endDate,
    startIso: new Date(zonedMidnightMs(startDate, tz)).toISOString(),
    endIso: new Date(zonedMidnightMs(addDays(endDate, 1), tz) - 1).toISOString(),
  }
}

/** `days` full Pacific days ending yesterday, and the `days` before them. */
export function lastFullDays(now: Date, days: number, tz: string = SITE_TIME_ZONE): WindowPair {
  const currentStart = addDays(dayInZone(now.getTime(), tz), -days)
  return {
    current: dayWindow(currentStart, days, tz),
    previous: dayWindow(addDays(currentStart, -days), days, tz),
  }
}

/** `days` days ending on `endDate` (YYYY-MM-DD, inclusive), and the `days` before them. */
export function windowEndingOn(endDate: string, days: number, tz: string = SITE_TIME_ZONE): WindowPair {
  const currentStart = addDays(endDate, -(days - 1))
  return {
    current: dayWindow(currentStart, days, tz),
    previous: dayWindow(addDays(currentStart, -days), days, tz),
  }
}

/** YYYY-MM-DD shifted by whole days. */
export function addDays(date: string, days: number): string {
  return ymd(Date.parse(`${date}T00:00:00.000Z`) + days * DAY_MS)
}

/** "2026-10-07" → "Oct 7". */
export function shortDay(date: string): string {
  return formatCalendarDay(date, { year: undefined })
}

/** "Oct 7 to Oct 13". */
export function rangeWords(w: Pick<DayWindow, 'startDate' | 'endDate'>): string {
  return `${shortDay(w.startDate)} to ${shortDay(w.endDate)}`
}

/** The query string a detail page's range control reads for this exact window. */
export function rangeQuery(w: Pick<DayWindow, 'startDate' | 'endDate'>): string {
  return `range=custom&startDate=${w.startDate}&endDate=${w.endDate}`
}

const nf = new Intl.NumberFormat('en-US')

export function int(n: number): string {
  return nf.format(Math.round(n))
}

/** "38%" of a whole; null when the whole is 0 (a share of nothing is not 0%). */
export function share(part: number, whole: number): string | null {
  if (!(whole > 0)) return null
  const pct = (part / whole) * 100
  if (pct > 0 && pct < 1) return 'under 1%'
  return `${Math.round(pct)}%`
}

/**
 * A change against the comparison window, in words:
 * "up 24% from 1,966 the 7 days before", "down 10% from ...", "same as the 7
 * days before (12)", "none the 7 days before". `before` names the comparison.
 */
export function changeWords(current: number, previous: number, before = 'the 7 days before'): string {
  if (previous === 0) return current === 0 ? `none ${before} either` : `none ${before}`
  if (current === previous) return `same as ${before} (${int(previous)})`
  const pct = Math.round(((current - previous) / previous) * 100)
  const dir = current > previous ? 'up' : 'down'
  const size = pct === 0 ? 'under 1%' : `${Math.abs(pct)}%`
  return `${dir} ${size} from ${int(previous)} ${before}`
}

/** Search position: lower is better, so the words flip. */
export function positionWords(current: number, previous: number): string {
  if (!(current > 0) || !(previous > 0)) return ''
  const d = Math.round((current - previous) * 10) / 10
  if (d === 0) return 'same as the 7 days before'
  return d < 0
    ? `better by ${Math.abs(d).toFixed(1)} (was ${previous.toFixed(1)})`
    : `worse by ${d.toFixed(1)} (was ${previous.toFixed(1)})`
}

/**
 * The first-touch channel groups (lib/data/analytics/channel-grouping.ts) in
 * plain words, with where each one comes from.
 */
export const CHANNEL_PLAIN: Record<ChannelGroup, string> = {
  'Organic Search': 'Google and other search engines',
  'Google Business Profile': 'Google Business Profile',
  'AI Assistant': 'AI assistants (ChatGPT, Perplexity, Gemini, Copilot, Claude)',
  'Organic Social': 'Social media posts',
  'Paid Social': 'Paid social ads (Facebook, Instagram)',
  'Paid Search': 'Paid search ads',
  Email: 'Email',
  SMS: 'Text messages',
  Referral: 'Links on other websites',
  'Other Campaign': 'Our other tagged links',
  Direct: 'No source we can see',
}

/** Display order: the channels Matt asked about first, the unknown last. */
export const CHANNEL_ORDER: readonly ChannelGroup[] = [
  'Organic Search',
  'Google Business Profile',
  'AI Assistant',
  'Organic Social',
  'Paid Social',
  'Paid Search',
  'Email',
  'SMS',
  'Referral',
  'Other Campaign',
  'Direct',
]

/** Sort rows by the display order above. */
export function byChannelOrder<T extends { channel: ChannelGroup }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => CHANNEL_ORDER.indexOf(a.channel) - CHANNEL_ORDER.indexOf(b.channel))
}
