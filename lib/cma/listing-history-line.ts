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

function parseUtcDay(iso: string | null | undefined): Date | null {
  const raw = iso?.trim()
  if (!raw) return null
  const then = new Date(raw.length <= 10 ? `${raw}T12:00:00.000Z` : raw)
  return Number.isNaN(then.getTime()) ? null : then
}

/** YYYY-MM-DD of a listing/history timestamp. Bare dates stay as written. */
export function closedCompCivilDay(iso: string | null | undefined): string | null {
  const raw = iso?.trim()
  if (!raw) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const then = parseUtcDay(raw)
  return then ? then.toISOString().slice(0, 10) : null
}

/** Whole calendar days between two dates (noon-UTC day stamps). Never invents. */
export function calendarDaysBetween(
  fromIso: string | null | undefined,
  toIso: string | null | undefined,
): number | null {
  const start = parseUtcDay(fromIso)
  const end = parseUtcDay(toIso)
  if (start == null || end == null) return null
  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000)
  return days >= 0 ? days : null
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
  originalEntryTimestamp?: string | null
  originalOnMarketTimestamp?: string | null
  historyListDates?: readonly (string | null | undefined)[]
}

/**
 * First list for a closed comp: earliest of current on-market, ListDate,
 * original entry / original-on-market, and listing/price history list starts.
 *
 * Relists reset MLS OnMarketDate to the back-on-market day (MARKET_TRUTH §3.2).
 * Calendar DOM from that date undercounts when history still holds the first list.
 */
export function earliestClosedCompListDate(facts: ClosedCompListStartFacts): string | null {
  const dates = [
    facts.onMarketDate,
    facts.listDate,
    facts.originalEntryTimestamp,
    facts.originalOnMarketTimestamp,
    ...(facts.historyListDates ?? []),
  ]
    .map((d) => closedCompCivilDay(d))
    .filter((d): d is string => Boolean(d))
    .sort((a, b) => a.localeCompare(b))
  return dates[0] ?? null
}

/**
 * Honest DOM for a closed sale (Matt HARD LOCK: DOM on every home).
 *
 * Calendar days from the earliest list date (history / original entry when
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
}): number | null {
  const mls =
    facts.daysOnMarket != null && Number.isFinite(facts.daysOnMarket) && facts.daysOnMarket >= 0
      ? Math.round(facts.daysOnMarket)
      : null
  const start = earliestClosedCompListDate(facts) ?? facts.onMarketDate
  const calendar = calendarDaysBetween(start, facts.closeDate)
  if (calendar != null && (mls == null || mls < calendar)) return calendar
  if (mls != null) return mls
  return calendar
}

/** Whole days on market. Prefer the measured count; else derive from on-market date. */
export function daysOnMarketFrom(facts: {
  daysOnMarket?: number | null
  onMarketDate?: string | null
  asOf?: Date
}): number | null {
  if (facts.daysOnMarket != null && Number.isFinite(facts.daysOnMarket) && facts.daysOnMarket >= 0) {
    return Math.round(facts.daysOnMarket)
  }
  const then = parseUtcDay(facts.onMarketDate)
  if (then == null) return null
  const asOf = facts.asOf ?? new Date()
  const days = Math.floor((asOf.getTime() - then.getTime()) / 86_400_000)
  return days >= 0 ? days : null
}

function statusKey(status: string | null | undefined): string {
  return (status ?? '').trim().toLowerCase()
}

function isTerminalOff(status: string | null | undefined): boolean {
  const s = statusKey(status)
  return s === 'expired' || s === 'withdrawn' || s === 'canceled' || s === 'cancelled'
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
  const domBit = dom != null ? `${dom} day${dom === 1 ? '' : 's'} on market` : null

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
    const label = statusKey(facts.status) || 'off market'
    if (cut && when) {
      bits.push(
        `Listed ${when} at ${usd(cut.from)}, cut to ${usd(cut.to)}, came off ${label}`,
      )
    } else if (cut) {
      bits.push(`Asked ${usd(cut.from)}, cut to ${usd(cut.to)}, came off ${label}`)
    } else if (when) {
      bits.push(`Listed ${when} at ${usd(list)}, came off ${label}`)
    } else {
      bits.push(`Asked ${usd(list)}, came off ${label}`)
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
