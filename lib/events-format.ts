/**
 * Human date formatting for Central Oregon event pages.
 *
 * Brand voice: no em-dash / en-dash ranges — a range reads "July 24 to 26,
 * 2026". Dates are parsed component-wise (not via `new Date('YYYY-MM-DD')`,
 * which is UTC-midnight and can shift a day in a negative timezone).
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

type Ymd = { y: number; m: number; d: number }

function parseIso(iso: string): Ymd | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return null
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) }
}

/** Weekday name for a Y-M-D, computed in UTC so it never shifts. */
function weekday(p: Ymd): string {
  return WEEKDAYS[new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()]
}

/**
 * Format a verified event date range for display.
 *
 * Single day        -> "Saturday, July 11, 2026"
 * Same-month range  -> "July 24 to 26, 2026"
 * Cross-month range -> "July 9 to August 6, 2026"
 * Cross-year range  -> "December 31, 2026 to January 2, 2027"
 *
 * Returns null when `start` is missing/invalid — callers show the recurrence
 * descriptor instead (never a fabricated date, CLAUDE.md §0).
 */
export function formatEventDate(start: string | null, end?: string | null): string | null {
  if (!start) return null
  const s = parseIso(start)
  if (!s) return null
  const e = end ? parseIso(end) : null

  if (!e || (e.y === s.y && e.m === s.m && e.d === s.d)) {
    return `${weekday(s)}, ${MONTHS[s.m - 1]} ${s.d}, ${s.y}`
  }
  if (e.y === s.y && e.m === s.m) {
    return `${MONTHS[s.m - 1]} ${s.d} to ${e.d}, ${s.y}`
  }
  if (e.y === s.y) {
    return `${MONTHS[s.m - 1]} ${s.d} to ${MONTHS[e.m - 1]} ${e.d}, ${s.y}`
  }
  return `${MONTHS[s.m - 1]} ${s.d}, ${s.y} to ${MONTHS[e.m - 1]} ${e.d}, ${e.y}`
}

/** Short month + year, e.g. "July 2026" — for compact hub cards with a date. */
export function shortEventDate(start: string | null): string | null {
  if (!start) return null
  const s = parseIso(start)
  if (!s) return null
  return `${MONTHS[s.m - 1]} ${s.d}`
}

/** Lower-case the first letter of a recurrence descriptor for inline use. */
function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1)
}

import type { AreaMarket } from '@/lib/area-market'
import { marketSentence } from '@/lib/area-market'

type EventFaqInput = {
  name: string
  venue: string
  city: string
  recurrence: string
  nextConfirmedDate: string | null
  endDate: string | null
  priceInfo?: string
}

/**
 * Build the FAQ for an event detail page from VERIFIED registry facts + the live
 * nearby-homes count. Every answer is factual (CLAUDE.md §0) — questions whose
 * data we do not have (e.g. price when unverified) are simply omitted. Feeds the
 * FAQPage schema (the direct AEO lever) and the on-page FAQ section.
 */
export function buildEventFaq(
  e: EventFaqInput,
  homes: { count: number; medianLabel: string | null; cityMarket?: AreaMarket | null },
): Array<{ question: string; answer: string }> {
  const when = formatEventDate(e.nextConfirmedDate, e.endDate)
  const faq: Array<{ question: string; answer: string }> = []

  faq.push({
    question: `When is ${e.name}?`,
    answer: when
      ? `The next ${e.name} is ${when}. It runs ${lowerFirst(e.recurrence)}.`
      : `The date for the next ${e.name} has not been posted yet. It runs ${lowerFirst(e.recurrence)}, and we update this page as soon as the organizer confirms.`,
  })

  faq.push({
    question: `Where is ${e.name} held?`,
    answer: `${e.name} takes place at ${e.venue} in ${e.city}, Central Oregon.`,
  })

  if (e.priceInfo) {
    faq.push({
      question: `How much does ${e.name} cost?`,
      answer:
        e.priceInfo === 'Free'
          ? `${e.name} is free to attend.`
          : `${e.name} is ${lowerFirst(e.priceInfo)}. Check the official event site for current pricing.`,
    })
  }

  faq.push({
    question: `Is ${e.name} held every year?`,
    answer: `Yes. ${e.recurrence}.`,
  })

  faq.push({
    question: `Are there homes for sale near ${e.venue}?`,
    answer:
      homes.count > 0
        ? `Right now there are ${homes.count} active single-family homes for sale within about 1.5 miles of ${e.venue}${
            homes.medianLabel ? `, with a median list price around ${homes.medianLabel}` : ''
          }. Inventory changes often.`
        : `There are no active single-family listings within about 1.5 miles of ${e.venue} at the moment. Inventory changes often, so it is worth checking current homes in ${e.city}.`,
  })

  const marketAnswer = homes.cityMarket ? marketSentence(homes.cityMarket) : null
  if (marketAnswer) {
    faq.push({ question: `What is the housing market like in ${e.city}?`, answer: marketAnswer })
  }

  return faq
}
