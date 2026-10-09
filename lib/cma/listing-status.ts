/**
 * A LISTING'S DAYS ARE THE DAYS IT WAS ACTIVE (reader review 2026-10-08).
 *
 * Three letters counted time that no buyer could act on:
 *
 *  - 3177 Coho went Active Dec 1, 2025, was withdrawn Feb 10, 2026, and the
 *    listing expired Sep 30. The letter said "Your home sat 302 days", "expired
 *    after 302 days" and "You asked $585,000 for 31 days, then $569,000 for
 *    271", counting the seven and a half months it was withdrawn. It was on the
 *    market 71 days.
 *  - 2124 Carrie was entered as Coming Soon Jul 28, went Active Aug 17 and went
 *    Pending Sep 5. The letter printed "offer in 39 days", counting the Coming
 *    Soon weeks. A buyer could make an offer for 19 days.
 *  - 2820 Aldrich, under contract since Sep 11, printed "44 days" and a status
 *    date of Aug 24: days since listing, dated on the list day.
 *
 * And every MLS timestamp was cut to its UTC day before it was printed: a list
 * at 7:13 PM Pacific on Dec 1 (03:13 UTC Dec 2) printed "Dec 2".
 *
 * ONE RULE, every surface: a listing's time on the market runs from the day it
 * went Active to the day it left Active (Pending, Withdrawn, Canceled,
 * Expired or Closed), both read as Pacific calendar days, counted as whole
 * calendar days between them. A Coming Soon stretch is not on the market. A
 * Pending period ends the time to an offer. A Pending that flips back to
 * Active within an hour at the same ask does not end that stretch: it is an
 * MLS correction, and the stretch already open keeps its clock and the ask
 * it opened at (2254 Indigo, 22 minutes). A return the next day or later
 * still starts a new stretch. The status history says when each of those
 * happened; the listing row's own dates are the fallback when the
 * history does not, and the MLS `days_to_pending` the last one (it counts
 * elapsed hours, so a Friday-to-Monday offer can be a day short of the dates a
 * reader sees printed beside it).
 *
 * Pure. Every date here is a recorded MLS event; nothing is estimated.
 */
import { formatDate, zonedDateKey } from '@/lib/format/date'
import { isComingSoonStatus } from '@/lib/listing-status-public'

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
/** A date-only column stored as a timestamp lands on midnight UTC. */
const MIDNIGHT_UTC_RE = /^(\d{4}-\d{2}-\d{2})[T ]00:00:00(?:\.0+)?(?:Z|[+-]00(?::?00)?)$/

/** "2025-12-02 03:13:18+00" (the SQL shape) → an ISO string `Date` parses everywhere. */
function isoOf(raw: string): string {
  return raw.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')
}

/**
 * The Pacific calendar day of an MLS date or timestamp.
 *
 * A bare YYYY-MM-DD stays as written, and so does a midnight-UTC timestamp:
 * that is how a date-only column (CloseDate, off_market_date) arrives through
 * a timestamp, and reading it in Pacific would move it back a day. Every other
 * timestamp is an event, and its day is the day it was in Bend.
 */
export function pacificDay(value: string | Date | null | undefined): string | null {
  if (value == null) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : zonedDateKey(value) || null
  const raw = String(value).trim()
  if (!raw) return null
  if (DAY_RE.test(raw)) return raw
  const midnight = MIDNIGHT_UTC_RE.exec(raw)
  if (midnight) return midnight[1]!
  const d = new Date(isoOf(raw))
  if (Number.isNaN(d.getTime())) return null
  return zonedDateKey(d) || null
}

/** Whole calendar days between two Pacific days. Null when either is missing or the order is reversed. */
export function pacificDaysBetween(
  from: string | Date | null | undefined,
  to: string | Date | null | undefined,
): number | null {
  const a = pacificDay(from)
  const b = pacificDay(to)
  if (!a || !b) return null
  const days = Math.round((Date.parse(`${b}T12:00:00.000Z`) - Date.parse(`${a}T12:00:00.000Z`)) / 86_400_000)
  return Number.isFinite(days) && days >= 0 ? days : null
}

/** One MLS status transition. `at` is the event's timestamp. */
export type ListingStatusChange = {
  at: string
  from: string | null
  to: string
}

const STATUS_CHANGE_RE = /^\s*MlsStatus:\s*(.*?)\s*(?:→|->|=>)\s*(.+?)\s*$/

/** "MlsStatus: Active → Withdrawn", the change-log line the Spark sync stores in `listing_history.description`. */
export function parseMlsStatusChange(
  description: string | null | undefined,
): { from: string | null; to: string } | null {
  const m = STATUS_CHANGE_RE.exec(description ?? '')
  if (!m) return null
  const to = m[2]!.trim()
  if (!to) return null
  return { from: m[1]!.trim() || null, to }
}

export type StatusKind = 'active' | 'offer' | 'sold' | 'off' | 'pre' | 'unknown'

/**
 * What a status means for the clock. "Active Under Contract" is an accepted
 * offer, not a listing a buyer can still act on, so it is read before the
 * plain Active test.
 */
export function statusKind(raw: string | null | undefined): StatusKind {
  const s = (raw ?? '').trim().toLowerCase()
  if (!s) return 'unknown'
  // The pre-marketing status, by the one predicate the site uses for it.
  if (isComingSoonStatus(s)) return 'pre'
  if (/under contract|pending|contingent/.test(s)) return 'offer'
  if (/^active\b|^back on market/.test(s)) return 'active'
  if (/^closed\b|^sold\b/.test(s)) return 'sold'
  if (/^(expired|withdrawn|cancell?ed|hold|temp|off market|deleted|incomplete)/.test(s)) return 'off'
  return 'unknown'
}

/**
 * Whether two MLS status words name the same status. The feed spells one of
 * them both ways: 3037 Purcell's change log says "Cancelled" and its
 * StandardStatus says "Canceled".
 */
export function sameStatus(a: string | null | undefined, b: string | null | undefined): boolean {
  const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase().replace(/^cancelled/, 'canceled')
  const x = norm(a)
  return x !== '' && x === norm(b)
}

function eventTime(value: string): number {
  const raw = value.trim()
  const t = Date.parse(DAY_RE.test(raw) ? `${raw}T12:00:00.000Z` : isoOf(raw))
  return Number.isNaN(t) ? Number.NaN : t
}

/** Epoch milliseconds of an MLS timestamp in either shape the reads return (a bare day reads as its noon). NaN when unusable. */
export function mlsEventMillis(value: string | null | undefined): number {
  return value ? eventTime(value) : Number.NaN
}

/**
 * The two writers' status changes as one log, oldest first.
 *
 * `listing_history` holds the MLS's own change log with the MLS's timestamps;
 * `status_history` is what the delta sync saw, minutes later, and it is the
 * only record of a change the history backfill has not reached yet. A sync row
 * that repeats a logged change inside a day is the same change, and the MLS
 * timestamp wins.
 */
export function mergeStatusChanges(
  logged: readonly ListingStatusChange[],
  synced: readonly ListingStatusChange[] = [],
): ListingStatusChange[] {
  const out: ListingStatusChange[] = []
  const valid = (c: ListingStatusChange) => Boolean(c.to?.trim()) && Number.isFinite(eventTime(c.at))
  for (const c of logged) if (valid(c)) out.push(c)
  for (const c of synced) {
    if (!valid(c)) continue
    const t = eventTime(c.at)
    const repeat = out.some(
      (o) =>
        sameStatus(o.to, c.to) &&
        (sameStatus(o.from, c.from) || (!o.from?.trim() && !c.from?.trim())) &&
        Math.abs(eventTime(o.at) - t) < 86_400_000,
    )
    if (!repeat) out.push(c)
  }
  return out.sort((a, b) => eventTime(a.at) - eventTime(b.at))
}

/**
 * A Pending, or Active Under Contract, that flips back to Active inside this
 * window at the same ask is an MLS correction, not a new stretch. 2254 Indigo
 * went Pending at 00:59:52 UTC on 2025-10-09 and Active again at 01:22:32 UTC,
 * still $699,900. A return the next day (that same listing, Aug 27 to Aug 28)
 * or weeks later (61197 Cottonwood) still starts the clock over.
 */
export const PENDING_REVERSAL_BLIP_MS = 60 * 60 * 1000

type PeriodOpts = {
  listedAt?: string | null
  /**
   * Ask changes the caller read. An array, including an empty one, means the
   * ask log was checked. Omit it when the ask was not read: a short reversal
   * then stays a new stretch, because the same-ask half of the rule is unknown.
   */
  askChanges?: readonly AskChange[] | null
}

/** One stretch a listing was Active, in Pacific days. `to` is null while it still is. */
export type ActivePeriod = {
  from: string
  to: string | null
  /** The status it left Active for. Null while it is still Active. */
  endedAs: string | null
}

/**
 * Every stretch the status log shows the listing Active, oldest first.
 *
 * A log that opens mid-listing ("Active → Withdrawn" as its first line, with
 * no "→ Active" before it) began at the listing's own on-market day, when the
 * caller has one that is not after that first change. Without one the stretch
 * has no start the record can give, and it is left out rather than guessed.
 * An empty log returns no periods; the caller falls back to the listing row.
 */
export function activePeriods(
  changes: readonly ListingStatusChange[],
  opts: PeriodOpts = {},
): ActivePeriod[] {
  return timedActivePeriods(changes, opts).map(({ from, to, endedAs }) => ({ from, to, endedAs }))
}

/**
 * True when a recorded ask change falls after `fromAt` and at or before `toAt`.
 * A change on the pending timestamp is already the ask that stretch was at.
 * A change as it comes back is a different ask, and the return is a new stretch.
 */
function askChangedBetween(asks: readonly AskChange[], fromAt: string, toAt: string): boolean {
  const start = eventTime(fromAt)
  const end = eventTime(toAt)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return true
  return mergeAskChanges(asks).some((c) => {
    const t = eventTime(c.at)
    return t > start && t <= end
  })
}

/** An Active stretch with the exact moment it opened: the status change's timestamp, or the listing's own on-market timestamp. */
type TimedPeriod = ActivePeriod & { fromAt: string }

function timedActivePeriods(
  changes: readonly ListingStatusChange[],
  opts: PeriodOpts = {},
): TimedPeriod[] {
  const sorted = mergeStatusChanges(changes)
  const out: TimedPeriod[] = []
  let open: string | null = null
  let openAt: string | null = null
  /** The moment the open stretch last left Active, and the status it left for. */
  let closedAt: string | null = null
  let closedAs: string | null = null
  const asks = Array.isArray(opts.askChanges) ? opts.askChanges : null
  const first = sorted[0]
  if (first && statusKind(first.from) === 'active' && opts.listedAt) {
    const start = pacificDay(opts.listedAt)
    const firstDay = pacificDay(first.at)
    if (start && firstDay && start <= firstDay) {
      open = start
      openAt = opts.listedAt
    }
  }
  for (const c of sorted) {
    const day = pacificDay(c.at)
    if (!day) continue
    if (statusKind(c.to) === 'active') {
      if (open == null) {
        const prev = out[out.length - 1]
        const gap = closedAt != null ? eventTime(c.at) - eventTime(closedAt) : Number.NaN
        const sameAsk = asks != null && closedAt != null && !askChangedBetween(asks, closedAt, c.at)
        const blip =
          prev != null &&
          closedAt != null &&
          sameAsk &&
          statusKind(c.from) === 'offer' &&
          statusKind(closedAs) === 'offer' &&
          Number.isFinite(gap) &&
          gap >= 0 &&
          gap <= PENDING_REVERSAL_BLIP_MS
        if (blip) {
          open = prev.from
          openAt = prev.fromAt
          out.pop()
        } else {
          open = day
          openAt = c.at
        }
        closedAt = null
        closedAs = null
      }
      continue
    }
    if (open != null) {
      out.push({ from: open, fromAt: openAt ?? open, to: day, endedAs: c.to.trim() })
      closedAt = c.at
      closedAs = c.to
      open = null
      openAt = null
    }
  }
  if (open != null) out.push({ from: open, fromAt: openAt ?? open, to: null, endedAs: null })
  return out
}

/**
 * The listing's last stretch on the market: the day it went Active, the day it
 * left Active, what it left Active for, and the whole calendar days between.
 *
 * From the status log when it holds a period. Otherwise from the listing row:
 * its on-market day to its off-market day, which is right for a listing that
 * went straight from Active to its status of record and wrong for one that was
 * withdrawn first, so the log is always read first.
 */
export type ActiveRun = {
  from: string | null
  to: string | null
  leftAs: string | null
  days: number | null
  source: 'status-history' | 'listing-dates'
}

type ActiveRunInput = {
  changes?: readonly ListingStatusChange[] | null
  /** The listing row's on-market day (OnMarketDate, else ListDate). */
  onMarketDate?: string | null
  /** The first day it was ever on the market (original_on_market_timestamp), for a log that opens mid-listing. */
  firstOnMarketAt?: string | null
  /** The listing row's off-market day (off_market_date, else status_change_timestamp). */
  offMarketDate?: string | null
  /** The listing's status of record. */
  status?: string | null
  /** Ask changes the caller read. See `PeriodOpts.askChanges`. */
  askChanges?: readonly AskChange[] | null
}

export function lastActiveRun(input: ActiveRunInput): ActiveRun | null {
  const run = lastActiveRunTimed(input)
  if (!run) return null
  return { from: run.from, to: run.to, leftAs: run.leftAs, days: run.days, source: run.source }
}

/**
 * `lastActiveRun` with the exact moment the stretch began (`fromAt`): the
 * status change that put it on the market, or the row's own on-market
 * timestamp. The ask in effect at that moment is the stretch's first ask
 * (`listingStretch`), so it needs the time of day, not the day: 2260 Indigo
 * came back at 16:16:30 UTC and was cut 19 seconds later.
 */
export function lastActiveRunTimed(input: ActiveRunInput): (ActiveRun & { fromAt: string | null }) | null {
  const periods = timedActivePeriods(input.changes ?? [], {
    listedAt: input.firstOnMarketAt ?? input.onMarketDate ?? null,
    askChanges: input.askChanges,
  })
  const last = periods[periods.length - 1]
  if (last) {
    return {
      from: last.from,
      fromAt: last.fromAt,
      to: last.to,
      leftAs: last.endedAs,
      days: last.to ? pacificDaysBetween(last.from, last.to) : null,
      source: 'status-history',
    }
  }
  const from = pacificDay(input.onMarketDate)
  const to = pacificDay(input.offMarketDate)
  if (!from && !to) return null
  return {
    from,
    fromAt: from ? (input.onMarketDate ?? null) : null,
    to,
    leftAs: to ? (input.status?.trim() || null) : null,
    days: from && to ? pacificDaysBetween(from, to) : null,
    source: 'listing-dates',
  }
}

/**
 * Days to an accepted offer, on the listing period that produced it.
 *
 * The status log's last Active stretch that ended in an offer, Active day to
 * Pending day. A listing that went Pending, fell out and came back counts from
 * the day it came back (61197 Cottonwood: back Nov 13, Pending Dec 30, 47
 * days, not 264 from its first list in April). A return within an hour at the
 * same ask does not count as coming back (2254 Indigo). Without the log, the listing
 * row's on-market day to its pending timestamp. Without either date, the
 * MLS `days_to_pending`, which counts from that same on-market day.
 */
export type OfferRun = {
  from: string | null
  to: string | null
  days: number | null
  source: 'status-history' | 'listing-dates' | 'mls-days-to-pending'
}

type OfferRunInput = {
  changes?: readonly ListingStatusChange[] | null
  onMarketDate?: string | null
  firstOnMarketAt?: string | null
  pendingAt?: string | null
  mlsDaysToPending?: number | null
  /** An offer after the close is not this sale's. */
  closeDate?: string | null
  /** Ask changes the caller read. See `PeriodOpts.askChanges`. */
  askChanges?: readonly AskChange[] | null
}

export function offerRun(input: OfferRunInput): OfferRun | null {
  const run = offerRunTimed(input)
  if (!run) return null
  return { from: run.from, to: run.to, days: run.days, source: run.source }
}

/** `offerRun` with the exact moment its clock started (see `lastActiveRunTimed`). */
export function offerRunTimed(input: OfferRunInput): (OfferRun & { fromAt: string | null }) | null {
  const close = pacificDay(input.closeDate)
  const periods = timedActivePeriods(input.changes ?? [], {
    listedAt: input.firstOnMarketAt ?? input.onMarketDate ?? null,
    askChanges: input.askChanges,
  }).filter((p) => p.to != null && statusKind(p.endedAs) === 'offer' && (!close || p.to <= close))
  const last = periods[periods.length - 1]
  if (last) {
    return {
      from: last.from,
      fromAt: last.fromAt,
      to: last.to,
      days: pacificDaysBetween(last.from, last.to),
      source: 'status-history',
    }
  }
  const from = pacificDay(input.onMarketDate)
  const fromAt = from ? (input.onMarketDate ?? null) : null
  const to = pacificDay(input.pendingAt)
  if (from && to && (!close || to <= close)) {
    const days = pacificDaysBetween(from, to)
    if (days != null) return { from, fromAt, to, days, source: 'listing-dates' }
  }
  const mls = input.mlsDaysToPending
  if (mls != null && Number.isFinite(mls) && mls >= 0) {
    return { from, fromAt, to: null, days: Math.round(mls), source: 'mls-days-to-pending' }
  }
  return null
}

// ── The last stretch on the market (Matt 2026-10-08, "Last stretch, labeled") ──

/**
 * ONE CLOCK PER HOME: ITS LAST STRETCH ON THE MARKET (Matt 2026-10-08).
 *
 * A home that was withdrawn, expired or fell out of contract and came back is
 * measured on its last stretch: its days run from the last time it came on the
 * market (as Bend's 26-day median is measured, off days_to_pending), and the
 * first ask printed for it is the price in effect when that stretch began.
 * Reader reviews found the two clocks mixed on every surface: 61197 Cottonwood
 * printed "First ask $850K" (April's listing) beside "offer in 47 days" (from
 * Nov 13, when it came back at $774,900); 628 Portland printed $1.48M for a
 * stretch that began at $1,395,000; competitor 2260 Indigo printed "Original
 * list $670,000" and a $120,000 cut over 115 days that began Jun 15 at
 * $645,000; and 20676 Wild Rose's own letter said "You first asked $625,000",
 * its Coming Soon price, changed to $599,900 fourteen seconds before it went
 * Active. Where the stretch is not the listing's first, the letter says so.
 */
export type ListingStretch = {
  /** The Pacific day the stretch began. */
  from: string
  /** The ask in effect the moment it began. Null when the record cannot say. */
  firstAsk: number | null
  /** True when the listing had been on the market before this stretch: withdrawn, expired, canceled or out of contract, and back. */
  restarted: boolean
}

/** One recorded change to a listing's ask. `at` is the event's timestamp; `from` is the ask before it, when recorded. */
export type AskChange = {
  at: string
  from: number | null
  to: number
}

function positiveAsk(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

/**
 * `ListPrice: 475000.00 → 460000.00`, the MLS change-log line the Spark sync
 * stores in `listing_history.description`.
 */
const LIST_PRICE_CHANGE_RE = /^\s*ListPrice:\s*([\d.,]+)\s*(?:→|->|=>)\s*([\d.,]+)/i

export function parseListPriceChange(
  description: string | null | undefined,
): { from: number | null; to: number } | null {
  const m = LIST_PRICE_CHANGE_RE.exec(description ?? '')
  if (!m) return null
  const to = positiveAsk(Number(m[2]!.replace(/,/g, '')))
  if (to == null) return null
  return { from: positiveAsk(Number(m[1]!.replace(/,/g, ''))), to }
}

/**
 * The two writers' ask changes as one log, oldest first. `listing_history`
 * carries the MLS's own timestamps; `price_history` is what the delta sync saw,
 * minutes later (20676 Wild Rose's cut is 04:05:49 in the MLS log and 04:18:13
 * in the sync's), and the sync sometimes writes one change more than once. A
 * sync row that repeats a logged change inside a day is that change, and the
 * MLS timestamp wins.
 */
export function mergeAskChanges(
  logged: readonly AskChange[],
  synced: readonly AskChange[] = [],
): AskChange[] {
  const valid = (c: AskChange) => positiveAsk(c.to) != null && Number.isFinite(eventTime(c.at))
  const out: AskChange[] = logged.filter(valid)
  for (const c of synced) {
    if (!valid(c)) continue
    const t = eventTime(c.at)
    const repeat = out.some(
      (o) =>
        Math.round(o.to) === Math.round(c.to) &&
        (o.from == null || c.from == null || Math.round(o.from) === Math.round(c.from)) &&
        Math.abs(eventTime(o.at) - t) < 86_400_000,
    )
    if (!repeat) out.push(c)
  }
  // A change to the ask already in effect is no change: the sync wrote 628
  // Portland's May 14 cut again on May 15 and May 21.
  const kept: AskChange[] = []
  let state: number | null = null
  for (const c of out.sort((a, b) => eventTime(a.at) - eventTime(b.at))) {
    const to = Math.round(c.to)
    if (state != null && to === state) continue
    kept.push(c)
    state = to
  }
  return kept
}

/**
 * The ask in effect at one moment: the last recorded change at or before it,
 * else the ask the first later change moved off of, else the listing's opening
 * ask (OriginalListPrice). With no change on record the ask never moved, so the
 * opening ask stands for a first stretch; for a stretch that restarted it
 * stands only when the opening and current asks agree, and otherwise the
 * record cannot say (null, never a guess). A row with no opening ask on record
 * has none here either: the current ask is not evidence the ask never moved.
 */
export function askInEffectAt(
  changes: readonly AskChange[],
  at: string | null | undefined,
  opts: { openingAsk?: number | null; currentAsk?: number | null; restarted?: boolean } = {},
): number | null {
  const opening = positiveAsk(opts.openingAsk)
  const current = positiveAsk(opts.currentAsk)
  const t = at ? eventTime(at) : Number.NaN
  const sorted = mergeAskChanges(changes)
  if (sorted.length > 0 && Number.isFinite(t)) {
    let before: AskChange | null = null
    for (const c of sorted) if (eventTime(c.at) <= t) before = c
    if (before) return positiveAsk(before.to)
    const after = sorted.find((c) => eventTime(c.at) > t)
    return positiveAsk(after?.from) ?? opening
  }
  if (!opts.restarted) return opening
  return opening != null && current != null && opening === current ? current : null
}

/**
 * Whether the listing had been on the market before the stretch that began on
 * `from`: its first on-market day (original_on_market_timestamp, which is the
 * day it went Active, never a Coming Soon day) is earlier, or the status log
 * shows an Active stretch that began on an earlier day.
 */
export function stretchRestarted(input: {
  from: string | null | undefined
  changes?: readonly ListingStatusChange[] | null
  firstOnMarketAt?: string | null
  listedAt?: string | null
  /** The same ask log the stretch clock used, so a correction blip is not an earlier stretch. */
  askChanges?: readonly AskChange[] | null
}): boolean {
  const day = pacificDay(input.from)
  if (!day) return false
  const first = pacificDay(input.firstOnMarketAt)
  if (first && first < day) return true
  return timedActivePeriods(input.changes ?? [], {
    listedAt: input.firstOnMarketAt ?? input.listedAt ?? null,
    askChanges: input.askChanges,
  }).some((p) => p.from < day)
}

/**
 * The stretch that began at `startAt`: its day, the ask in effect at that
 * moment, and whether it is the listing's first. `startAt` is the moment the
 * days are counted from (`offerRunTimed` / `lastActiveRunTimed`'s `fromAt`, or
 * the row's OnMarketDate for a live listing), so the first ask and the days
 * are one clock.
 */
export function listingStretch(input: {
  startAt: string | null | undefined
  changes?: readonly ListingStatusChange[] | null
  firstOnMarketAt?: string | null
  /** The row's on-market timestamp, for a status log that opens mid-listing. */
  listedAt?: string | null
  askChanges?: readonly AskChange[] | null
  /** MLS OriginalListPrice: the ask the listing opened at. */
  openingAsk?: number | null
  /** MLS ListPrice. */
  currentAsk?: number | null
}): ListingStretch | null {
  const from = pacificDay(input.startAt)
  if (!from) return null
  const restarted = stretchRestarted({
    from,
    changes: input.changes,
    firstOnMarketAt: input.firstOnMarketAt,
    listedAt: input.listedAt,
    askChanges: input.askChanges,
  })
  const firstAsk = askInEffectAt(input.askChanges ?? [], input.startAt, {
    openingAsk: input.openingAsk,
    currentAsk: input.currentAsk,
    restarted,
  })
  return { from, firstAsk, restarted }
}

/**
 * The status word for the day a listing came off the market.
 *
 * `leftAs` is the status it left Active for; `status` is its MLS status of
 * record. When they are the same, that is the word ("withdrawn after 26
 * days"). When they differ (withdrawn Feb 10, expired Sep 30) no one MLS word
 * names the day it came off, and printing the later one ("expired after 71
 * days") dates the expiry to the withdrawal. The event is then
 * `CAME_OFF_MIXED`, which every surface prints as "came off", and the later
 * status is told with its own date (`cameOffThenSentence`).
 */
export const CAME_OFF_MIXED = 'Off market'

export function cameOffStatus(
  status: string | null | undefined,
  leftAs: string | null | undefined,
): string | null {
  const record = (status ?? '').trim()
  const left = (leftAs ?? '').trim()
  if (left && record && !sameStatus(left, record)) return CAME_OFF_MIXED
  return record || left || null
}

function monthDay(day: string): string {
  const s = formatDate(day, { month: 'short', day: 'numeric', year: undefined })
  return s === '—' ? day : s
}

/** "expired", "was canceled", "was withdrawn": the status of record as a verb phrase. */
function laterStatusPhrase(status: string): string | null {
  const s = status.trim().toLowerCase()
  if (s.startsWith('expired')) return 'expired'
  if (s.startsWith('withdrawn')) return 'was withdrawn'
  if (/^cancell?ed/.test(s)) return 'was canceled'
  return null
}

/**
 * "It came off the market on Feb 10 after 71 days, and the listing expired on
 * Sep 30."
 *
 * Only when the listing left the market on one day and took its status of
 * record on a later one; otherwise the status word already says how it ended
 * and this returns null. A run that ended in an accepted offer that later fell
 * through says so ("It went under contract on ..."), because "came off" would
 * hide that a buyer said yes.
 */
/** The facts `cameOffThenSentence` tells, as a renderer carries them. */
export type CameOffFacts = {
  offMarketDate: string | null | undefined
  days: number | null | undefined
  leftAs: string | null | undefined
  status: string | null | undefined
  statusDate: string | null | undefined
}

export function cameOffThenSentence(input: CameOffFacts, opts: { withDays?: boolean } = {}): string | null {
  const off = pacificDay(input.offMarketDate)
  const later = pacificDay(input.statusDate)
  const status = (input.status ?? '').trim()
  if (!off || !later || later <= off || !status) return null
  if (cameOffStatus(status, input.leftAs) !== CAME_OFF_MIXED) return null
  const phrase = laterStatusPhrase(status)
  if (!phrase) return null
  const days = input.days != null && Number.isFinite(input.days) && input.days > 0 ? Math.round(input.days) : null
  const span =
    days != null && opts.withDays !== false ? ` after ${days.toLocaleString('en-US')} ${days === 1 ? 'day' : 'days'}` : ''
  const event = statusKind(input.leftAs) === 'offer' ? 'went under contract' : 'came off the market'
  return `It ${event} on ${monthDay(off)}${span}, and the listing ${phrase} on ${monthDay(later)}.`
}
