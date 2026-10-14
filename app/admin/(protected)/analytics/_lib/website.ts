/**
 * The Website view's windows and words (Matt 2026-10-14: one page that
 * "actually makes sense", read on a phone). Pure: no I/O, no React.
 *
 * WINDOWS. Every first-party and CRM figure covers the last 7 FULL days
 * (UTC calendar days, today left out because it is not over), compared with the
 * 7 days before. A window that ended "now" would compare a part day against
 * full ones and read as a drop every morning. Search Console and Business
 * Profile report days late, so their windows end on the newest day each source
 * has reported (windowEndingOn).
 */
import type { ChannelGroup } from '@/lib/data/analytics/channel-grouping'

export type DayWindow = {
  /** Inclusive YYYY-MM-DD bounds. */
  startDate: string
  endDate: string
  /** The same bounds as instants: 00:00:00.000Z and 23:59:59.999Z. */
  startIso: string
  endIso: string
}

export type WindowPair = { current: DayWindow; previous: DayWindow }

const DAY_MS = 86_400_000

function ymd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

function dayWindow(startMs: number, days: number): DayWindow {
  const startDate = ymd(startMs)
  const endDate = ymd(startMs + (days - 1) * DAY_MS)
  return {
    startDate,
    endDate,
    startIso: `${startDate}T00:00:00.000Z`,
    endIso: `${endDate}T23:59:59.999Z`,
  }
}

/** `days` full days ending yesterday (UTC), and the `days` before them. */
export function lastFullDays(now: Date, days: number): WindowPair {
  const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const currentStart = todayMs - days * DAY_MS
  return {
    current: dayWindow(currentStart, days),
    previous: dayWindow(currentStart - days * DAY_MS, days),
  }
}

/** `days` days ending on `endDate` (YYYY-MM-DD, inclusive), and the `days` before them. */
export function windowEndingOn(endDate: string, days: number): WindowPair {
  const endMs = Date.parse(`${endDate}T00:00:00.000Z`)
  const currentStart = endMs - (days - 1) * DAY_MS
  return {
    current: dayWindow(currentStart, days),
    previous: dayWindow(currentStart - days * DAY_MS, days),
  }
}

/** YYYY-MM-DD shifted by whole days. */
export function addDays(date: string, days: number): string {
  return ymd(Date.parse(`${date}T00:00:00.000Z`) + days * DAY_MS)
}

/** "2026-10-07" → "Oct 7". */
export function shortDay(date: string): string {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
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
