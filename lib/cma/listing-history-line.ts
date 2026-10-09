/**
 * One plain listing-history line for subject, sold comps, competition, and
 * expired peers. Matt HARD LOCK: every home in the letter carries days on
 * market + list/price-change history — once, in broker voice.
 *
 * Never invents a cut: OriginalListPrice must be present and differ from the
 * later ask before a reduction is named.
 */

import { formatDate } from '@/lib/format/date'
import { formatPriceExact } from '@/lib/format/money'
import { pacificDay, pacificDaysBetween } from '@/lib/cma/listing-status'

export type ListingHistoryFacts = {
  listPrice?: number | null
  originalListPrice?: number | null
  closePrice?: number | null
  status?: string | null
  onMarketDate?: string | null
  closeDate?: string | null
  daysOnMarket?: number | null
}

function usd(n: number): string {
  return formatPriceExact(n)
}

function monthWhen(iso: string | null | undefined): string | null {
  if (!iso) return null
  const s = formatDate(iso, { month: 'short', day: undefined, year: 'numeric' })
  return s === '—' ? null : s
}

function dayWhen(iso: string | null | undefined): string | null {
  if (!iso) return null
  const s = formatDate(iso, { month: 'short', day: 'numeric', year: 'numeric' })
  return s === '—' ? null : s
}

/**
 * YYYY-MM-DD of a listing/history timestamp, as the Pacific calendar day it
 * happened on (lib/cma/listing-status.ts pacificDay). Bare dates stay as
 * written. It used to cut the UTC day: 3177 Coho's list at 7:13 PM Pacific on
 * Dec 1 printed as Dec 2 (reader review 2026-10-08).
 */
export function closedCompCivilDay(iso: string | null | undefined): string | null {
  return pacificDay(iso ?? null)
}

/**
 * The on-market (or offer-clock) Pacific day is after the close. A same-day
 * close is not this: the days are 0 and that 0 is real. 1654 Meadow went on
 * the market Jun 6, 2025 and closed May 30, and a 0 there is not an offer.
 */
export function onMarketAfterClose(
  onMarket: string | null | undefined,
  close: string | null | undefined,
): boolean {
  const from = closedCompCivilDay(onMarket)
  const to = closedCompCivilDay(close)
  return from != null && to != null && from > to
}

/**
 * Whole calendar days between two dates, each read as its Pacific day. The one
 * day count the letter prints (lib/cma/listing-status.ts). Never invents.
 */
export function calendarDaysBetween(
  fromIso: string | Date | null | undefined,
  toIso: string | Date | null | undefined,
): number | null {
  return pacificDaysBetween(fromIso ?? null, toIso ?? null)
}

/**
 * Days a listing that is still on the market has been on it, as of the
 * letter's date: calendar days from its on-market day to the day the letter
 * is dated, both read in Pacific time as the letter prints them.
 *
 * Never the MLS DaysOnMarket field. On a live listing that field is the count
 * as of the last feed update, and it goes stale between updates: 3062 NW
 * Kelly Hill went on the market May 1, 2026 and its letter, dated Oct 7, 2026,
 * printed 156 days off the field where the dates give 159 (reader review
 * 2026-10-08). CLAUDE.md §7 also warns that field is list-to-close on a sale.
 * Null when either day is missing or the on-market day is after the letter's.
 */
export function liveListingDays(
  onMarketDate: string | null | undefined,
  asOf?: string | Date | null,
): number | null {
  const from = pacificDay(onMarketDate)
  const to = pacificDay(asOf ?? new Date())
  return calendarDaysBetween(from, to)
}

const LIST_START_EVENTS = new Set(['newlisting', 'backonmarket', 'originalentry'])

/**
 * Spark listing/price history rows that mark a list (original entry / first
 * list / a later back-on-market). Close and photo events do not.
 */
export function isClosedCompListStartEvent(
  event: string | null | undefined,
  description?: string | null,
): boolean {
  const e = (event ?? '').trim().toLowerCase().replace(/[\s_-]/g, '')
  if (LIST_START_EVENTS.has(e)) return true
  if (e === 'fieldchange' && /listprice/i.test(description ?? '')) return true
  return false
}

export type ClosedCompHistoryEvent = {
  event?: string | null
  date?: string | null
  description?: string | null
  /** price_history rows are always a list/ask date. */
  source?: 'price_history' | 'listing_history' | string | null
}

/** Civil days that count as a list start from listing_history + price_history. */
export function listStartDatesFromHistory(
  events: readonly ClosedCompHistoryEvent[] | null | undefined,
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const ev of events ?? []) {
    const fromPrice = (ev.source ?? '').toLowerCase() === 'price_history'
    if (!fromPrice && !isClosedCompListStartEvent(ev.event, ev.description)) continue
    const day = closedCompCivilDay(ev.date)
    if (!day || seen.has(day)) continue
    seen.add(day)
    out.push(day)
  }
  return out.sort((a, b) => a.localeCompare(b))
}

export type ClosedCompListStartFacts = {
  onMarketDate?: string | null
  listDate?: string | null
  /**
   * The day the listing was keyed in. A list start only when the row has no
   * `originalOnMarketTimestamp`, and never on a day the status log shows it
   * was still Coming Soon: on a Coming Soon listing the entry is weeks before
   * a buyer can act on it. 2124 Carrie was entered Jul 28 and went Active Aug
   * 17, and the letter printed "Listed Jul 28" and an offer clock 20 days too
   * long (reader review 2026-10-08). `originalOnMarketTimestamp` is the first
   * day it was on the market.
   */
  originalEntryTimestamp?: string | null
  originalOnMarketTimestamp?: string | null
  historyListDates?: readonly (string | null | undefined)[]
  /**
   * The day the listing left Coming Soon, when the status log shows it. A list
   * start before that day is a Coming Soon day, not a market day, and is
   * dropped.
   */
  preMarketUntil?: string | null
}

/**
 * First list for a closed comp: earliest of current on-market, ListDate, the
 * first on-market timestamp (else the entry timestamp), and listing/price
 * history list starts, each read as its Pacific day. Never a Coming Soon day.
 *
 * Relists reset MLS OnMarketDate to the back-on-market day (MARKET_TRUTH §3.2).
 * Calendar DOM from that date undercounts when history still holds the first list.
 */
export function earliestClosedCompListDate(facts: ClosedCompListStartFacts): string | null {
  const floor = closedCompCivilDay(facts.preMarketUntil)
  const dates = [
    facts.onMarketDate,
    facts.listDate,
    facts.originalOnMarketTimestamp ?? facts.originalEntryTimestamp,
    ...(facts.historyListDates ?? []),
  ]
    .map((d) => closedCompCivilDay(d))
    .filter((d): d is string => d != null && (floor == null || d >= floor))
    .sort((a, b) => a.localeCompare(b))
  return dates[0] ?? null
}

/**
 * Honest DOM for a closed sale (Matt HARD LOCK: DOM on every home).
 *
 * Calendar days from the earliest list date (history / first on-market when
 * that is earlier than the current on-market date) to close, whenever MLS
 * cdom/DaysOnMarket is missing OR shorter than that span (Clearpine/Linda:
 * last-cycle OnMarketDate understates first-list → close). Otherwise keep
 * the MLS figure. Never invents dates.
 */
export function closedSaleDomTotal(facts: {
  daysOnMarket?: number | null
  onMarketDate?: string | null
  closeDate?: string | null
  listDate?: string | null
  originalEntryTimestamp?: string | null
  originalOnMarketTimestamp?: string | null
  historyListDates?: readonly (string | null | undefined)[]
  preMarketUntil?: string | null
}): number | null {
  const mls =
    facts.daysOnMarket != null && Number.isFinite(facts.daysOnMarket) && facts.daysOnMarket >= 0
      ? Math.round(facts.daysOnMarket)
      : null
  const start = earliestClosedCompListDate(facts) ?? facts.onMarketDate
  const calendar = calendarDaysBetween(start, facts.closeDate)
  if (calendar != null && (mls == null || mls < calendar)) return calendar
  // A zero MLS count with the on-market day after the close is not a run
  // (1654 Meadow). A positive MLS count still stands.
  if ((mls == null || mls === 0) && onMarketAfterClose(start, facts.closeDate)) return null
  if (mls != null) return mls
  return calendar
}

/**
 * Days to an accepted offer, on the listing period that produced the sale.
 *
 * The count is Active to Pending on that period (lib/cma/listing-status.ts
 * offerRun), the same clock the reader's own listing is counted on: the days a
 * buyer could act on it. A sale that was listed, withdrawn and brought back
 * waited for its offer from the day it came back. This used to move the clock
 * back to the first list so it would match a first-list-to-close count beside
 * it (reader review 2026-10-07), and that printed 61197 Cottonwood's offer at
 * 264 days when it came back Nov 13 and went Pending Dec 30, 47 days later,
 * and 2124 Carrie's at 39 when it was Active 19 days (reader review
 * 2026-10-08). The grid, the outcome line, the pin, the days chart and the
 * price path now all print this one count, and the path starts on the day the
 * count starts (`CmaComp.offerFrom`).
 *
 * Three checks keep a figure that cannot be this sale's off the page:
 *  - an offer clock longer than the whole run to close is not an offer clock
 *    (2107 Carrie printed 66 days on market beside an offer in 67): null, and
 *    the row falls back to the listed-to-closed count, labeled as that;
 *  - nor is one that, counted from the day it started, ends after the close;
 *  - nor is a count, including 0, whose on-market day is itself after the
 *    close (1654 Meadow). A same-day close still returns 0.
 */
export function closedSaleDaysToOffer(facts: {
  daysToOffer: number | null | undefined
  /** The day the offer clock started: the Active day of the period that produced the sale. */
  measuredFrom?: string | null
  /** The first list date (`earliestClosedCompListDate`), the start when the clock's own is unknown. */
  firstListDate?: string | null
  /** First list to close, from `closedSaleDomTotal`. */
  domTotal?: number | null
  /** The close date. */
  closeDate?: string | null
}): number | null {
  const raw = facts.daysToOffer
  if (raw == null || !Number.isFinite(raw) || raw < 0) return null
  const days = Math.round(raw)
  const total = facts.domTotal
  if (total != null && Number.isFinite(total) && total >= 0 && days > Math.round(total)) return null
  const from = closedCompCivilDay(facts.measuredFrom) ?? closedCompCivilDay(facts.firstListDate)
  if (onMarketAfterClose(from, facts.closeDate)) return null
  const run = from ? calendarDaysBetween(from, facts.closeDate) : null
  if (run != null && days > run) return null
  return days
}

/**
 * Whole days on market. Prefer the measured count; else the calendar days
 * from the on-market day to `asOf` (today), both read as Pacific days.
 */
export function daysOnMarketFrom(facts: {
  daysOnMarket?: number | null
  onMarketDate?: string | null
  asOf?: Date
}): number | null {
  if (facts.daysOnMarket != null && Number.isFinite(facts.daysOnMarket) && facts.daysOnMarket >= 0) {
    return Math.round(facts.daysOnMarket)
  }
  return calendarDaysBetween(facts.onMarketDate, facts.asOf ?? new Date())
}

function statusKey(status: string | null | undefined): string {
  return (status ?? '').trim().toLowerCase()
}

function isTerminalOff(status: string | null | undefined): boolean {
  const s = statusKey(status)
  return s === 'expired' || s === 'withdrawn' || s === 'canceled' || s === 'cancelled' || s === 'off market'
}

/**
 * "came off expired", and for a listing that left the market under one status
 * and took another later (lib/cma/listing-status.ts cameOffStatus), "came off
 * the market".
 */
function cameOffLabel(status: string | null | undefined): string {
  const s = statusKey(status)
  return s === '' || s === 'off market' ? 'came off the market' : `came off ${s}`
}

function isClosed(status: string | null | undefined): boolean {
  return statusKey(status) === 'closed'
}

function isActiveLike(status: string | null | undefined): boolean {
  const s = statusKey(status)
  return s === 'active' || s === 'pending' || s === ''
}

/**
 * Broker-facing timeline line. Returns null when there is nothing truthful to say.
 * Prefer a dated list → cut → close arc when the MLS carries those facts.
 * Callers that must always print DOM can append days separately.
 */
export function listingHistoryLine(facts: ListingHistoryFacts): string | null {
  const list = facts.listPrice != null && facts.listPrice > 0 ? facts.listPrice : null
  const orig =
    facts.originalListPrice != null && facts.originalListPrice > 0 ? facts.originalListPrice : null
  const close = facts.closePrice != null && facts.closePrice > 0 ? facts.closePrice : null
  const cut =
    orig != null && list != null && Math.abs(orig - list) >= 1000
      ? { from: orig, to: list }
      : null
  const when = dayWhen(facts.onMarketDate) ?? monthWhen(facts.onMarketDate)
  const closedWhen = dayWhen(facts.closeDate) ?? monthWhen(facts.closeDate)
  const dom = daysOnMarketFrom(facts)
  // A recorded 0 with the on-market day after the close is not a same-day
  // offer (1654 Meadow). A real same-day close still prints 0. An active
  // listing has no close, so its 0 still prints.
  const invertedZero = dom === 0 && onMarketAfterClose(facts.onMarketDate, facts.closeDate)
  const domBit = dom != null && !invertedZero ? `${dom} day${dom === 1 ? '' : 's'} on market` : null

  const bits: string[] = []

  if (isClosed(facts.status) && close != null) {
    if (cut && when && closedWhen) {
      bits.push(
        `Listed ${when} at ${usd(cut.from)}, cut to ${usd(cut.to)}, sold ${closedWhen} at ${usd(close)}`,
      )
    } else if (cut) {
      bits.push(
        `Listed at ${usd(cut.from)}, cut to ${usd(cut.to)}, sold at ${usd(close)}${closedWhen ? ` (${closedWhen})` : ''}`,
      )
    } else if (list != null && Math.abs(list - close) >= 1000) {
      bits.push(
        `Listed${when ? ` ${when}` : ''} at ${usd(list)}, sold${closedWhen ? ` ${closedWhen}` : ''} at ${usd(close)}`,
      )
    } else if (when && closedWhen) {
      bits.push(`Listed ${when}, sold ${closedWhen} at ${usd(close)}`)
    } else {
      bits.push(`Sold at ${usd(close)}${closedWhen ? ` (${closedWhen})` : ''}`)
    }
  } else if (isTerminalOff(facts.status) && list != null) {
    const off = cameOffLabel(facts.status)
    if (cut && when) {
      bits.push(
        `Listed ${when} at ${usd(cut.from)}, cut to ${usd(cut.to)}, ${off}`,
      )
    } else if (cut) {
      bits.push(`Asked ${usd(cut.from)}, cut to ${usd(cut.to)}, ${off}`)
    } else if (when) {
      bits.push(`Listed ${when} at ${usd(list)}, ${off}`)
    } else {
      bits.push(`Asked ${usd(list)}, ${off}`)
    }
  } else if (isActiveLike(facts.status) && list != null) {
    if (cut && when) bits.push(`Listed ${when} at ${usd(cut.from)}, now ${usd(cut.to)}`)
    else if (cut) bits.push(`Listed at ${usd(cut.from)}, now ${usd(cut.to)}`)
    else bits.push(`Listed at ${usd(list)}${when ? ` since ${when}` : ''}`)
  } else if (list != null) {
    if (cut && when) bits.push(`Listed ${when} at ${usd(cut.from)}, later ${usd(cut.to)}`)
    else if (cut) bits.push(`Listed at ${usd(cut.from)}, later ${usd(cut.to)}`)
    else bits.push(`Last ask ${usd(list)}${when ? ` (${when})` : ''}`)
  } else {
    return null
  }

  if (domBit) bits.push(domBit)
  return bits.join(' · ')
}

/** Short DOM label for cards that already carry a separate history sentence. */
export function daysOnMarketLabel(dom: number | null | undefined): string | null {
  if (dom == null || !Number.isFinite(dom) || dom < 0) return null
  const n = Math.round(dom)
  return `${n} day${n === 1 ? '' : 's'} on market`
}
