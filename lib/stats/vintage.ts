/**
 * Vintage reconciliation — pure, so every decision the ingest makes is testable
 * without a network or a service key (lib/stats/vintage.test.ts).
 *
 * THE INVARIANT THIS FILE EXISTS TO HOLD. public.stat_observations carries a
 * partial unique index:
 *
 *     stat_observations_current_uq (series_id, observation_date)
 *       WHERE realtime_end = 'infinity'
 *
 * At most one row per (series, observation date) may be the current figure.
 * Writing a new vintage without first closing the one it supersedes violates
 * that index; writing a different open-ended sentinel (9999-12-31) satisfies
 * the insert and defeats the guarantee, because the index predicate no longer
 * matches and two rows can both claim to be current with nothing complaining.
 * So a new vintage always arrives as a PAIR: a closure on the superseded row
 * and an upsert of the new one.
 *
 * THE CLAMP. A narrow FRED request over a narrow real-time window reports every
 * still-running vintage at the window start rather than at the date it became
 * current (measured 2026-08-17: a DGS10 window over 2008-01-02..2010-01-07
 * returned 12,526 rows, 11,999 of them clamped to the window start). Storing
 * those as written would fabricate vintage dates for thousands of figures.
 *
 * THE COLLAPSE RULE removes them without any clamp bookkeeping: walking one
 * observation date's vintages in ascending order, an entry reporting the SAME
 * value as the entry already current is not a revision — it is the same figure
 * still standing, so it is dropped and the earlier vintage keeps the interval.
 * This is lossless for output_type=1, where FRED never emits two consecutive
 * equal-valued intervals inside one request (they would be one interval), so
 * two consecutive equal values can only be one interval split across two
 * requests. For output_type=3 it drops a restatement that changed no figure,
 * which is the right answer: the current value still became current on the
 * earlier date.
 *
 * A row already stored is never collapsed away. Collapsing decides what to
 * WRITE; it cannot retract something the database already holds.
 */

import type { FredObservation } from '@/lib/stats/fred'
import { FRED_EPOCH } from '@/lib/stats/fred'
import {
  FRED_OPEN_REALTIME_END,
  OPEN_REALTIME_END,
  type StatObservationClosure,
  type StatObservationRow,
} from '@/lib/stats/contract'

/**
 * How far behind the ingest may fall before it re-walks a series instead of
 * asking for the difference. output_type=3's server cost scales with the
 * vintages in the window — measured on DGS10 2026-08-17: a 30-day window
 * answered in 5.3s, 100 vintages in 16.5s, 250 in 40.9s, 500 timed out at the
 * publisher's gateway. Ninety days of a business-day series is about 62
 * vintages, which sits inside the measured-safe range with room to spare.
 */
export const MAX_INCREMENTAL_WINDOW_DAYS = 90

/* ------------------------------------------------------------------ */
/* Calendar helpers — UTC only. A date here is a calendar fact.        */
/* ------------------------------------------------------------------ */

/** YYYY-MM-DD for a Date, in UTC. */
export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Whole days between two YYYY-MM-DD strings; negative when `to` precedes `from`. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`)
  const b = Date.parse(`${to}T00:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.NaN
  return Math.round((b - a) / 86_400_000)
}

/** Shift a YYYY-MM-DD by whole days, in UTC. */
export function shiftDays(day: string, delta: number): string {
  const t = Date.parse(`${day}T00:00:00Z`)
  if (!Number.isFinite(t)) return day
  return isoDay(new Date(t + delta * 86_400_000))
}

/* ------------------------------------------------------------------ */
/* Planning                                                            */
/* ------------------------------------------------------------------ */

export type IngestMode = 'backfill' | 'incremental'

export type IngestPlan =
  /** No rows yet, or too far behind to ask for a difference. Walk the whole
   *  real-time range with the fast narrow shape and let the collapse rule sort
   *  out the clamped continuations. */
  | { mode: 'backfill'; outputType: 1; realtimeStart: string; realtimeEnd: string }
  /** Ask only for what the publisher marked new or revised. */
  | { mode: 'incremental'; outputType: 3; realtimeStart: string; realtimeEnd: string }

export type SeriesCursor = {
  /** Newest vintage already stored for this series, or null when empty. */
  latestRealtimeStart: string | null
  /**
   * Newest period this database holds a CURRENT row for, whether or not the
   * publisher put a figure in it. This is the coverage cursor — the one that
   * answers "have we caught up with the source", because the source counts a
   * period it published a "." for as covered.
   */
  latestObservationDate: string | null
  /**
   * Newest period holding an actual figure. Separate from the line above
   * because a series can be fully caught up while its newest period is a market
   * holiday, and grading coverage on the published figure would report that
   * caught-up series as behind its publisher every time.
   */
  latestPublishedObservationDate: string | null
  /** Rows already stored for this series. */
  rowCount: number
}

export const EMPTY_CURSOR: SeriesCursor = {
  latestRealtimeStart: null,
  latestObservationDate: null,
  latestPublishedObservationDate: null,
  rowCount: 0,
}

/** Decide the request for one series. `today` is passed in so the plan is deterministic under test. */
export function planSeriesIngest(cursor: SeriesCursor, today: string): IngestPlan {
  const backfill: IngestPlan = {
    mode: 'backfill',
    outputType: 1,
    realtimeStart: FRED_EPOCH,
    realtimeEnd: FRED_OPEN_REALTIME_END,
  }

  const storedVintage = cursor.latestRealtimeStart
  if (cursor.rowCount === 0 || storedVintage === null) return backfill

  const gap = daysBetween(storedVintage, today)
  if (!Number.isFinite(gap) || gap > MAX_INCREMENTAL_WINDOW_DAYS) return backfill

  return {
    mode: 'incremental',
    outputType: 3,
    // Re-request FROM the newest stored vintage, not the day after it: a second
    // vintage published later on the same date would otherwise be skipped, and
    // re-reading one vintage costs nothing because the writes are idempotent.
    realtimeStart: storedVintage,
    realtimeEnd: today,
  }
}

/* ------------------------------------------------------------------ */
/* Reconciliation                                                      */
/* ------------------------------------------------------------------ */

/** The vintage currently marked 'infinity' for one observation date. */
export type CurrentVintage = {
  realtimeStart: string
  value: number | null
}

export type ReconcileParams = {
  /** Namespaced stat_series id, e.g. `fred:DGS10`. */
  seriesId: string
  observations: readonly FredObservation[]
  /** What the database already holds as current, keyed by observation date. */
  currentByDate: ReadonlyMap<string, CurrentVintage>
  /** Timestamp stamped on every row this run actually fetched. */
  fetchedAt: string
}

export type ReconcileResult = {
  /** Rows to upsert, ascending by realtime_start. */
  rows: StatObservationRow[]
  /** Stored rows whose realtime_end must move off 'infinity' first. */
  closures: StatObservationClosure[]
  /** What is current for each touched observation date once these writes land. */
  nextCurrentByDate: Map<string, CurrentVintage>
  /** Vintages reporting "." — a real period with no published figure. */
  missingValueCount: number
  /** Rows dropped because the figure had not changed (clamped continuations). */
  collapsedCount: number
  /** Rows dropped because the same (date, vintage) appeared twice in one payload. */
  duplicateVintageCount: number
}

type TimelineEntry = {
  realtimeStart: string
  value: number | null
  /** True when this vintage is already a row in the database. */
  stored: boolean
}

/**
 * Turn one batch of publisher observations into the writes that keep the
 * one-current-value invariant true.
 *
 * Rows come back sorted ascending by realtime_start so a chunked writer can
 * only ever advance the stored cursor monotonically: if chunk k fails, every
 * vintage in chunks after it is still unstored AND newer than the newest stored
 * vintage, so the next run's incremental window starts at exactly the right
 * place and redoes the rest. That is what makes a half-finished run self-heal
 * instead of leaving a hole nobody notices.
 */
export function reconcileVintages(params: ReconcileParams): ReconcileResult {
  const { seriesId, observations, currentByDate, fetchedAt } = params

  const byDate = new Map<string, FredObservation[]>()
  for (const obs of observations) {
    const list = byDate.get(obs.observationDate)
    if (list) list.push(obs)
    else byDate.set(obs.observationDate, [obs])
  }

  const rows: StatObservationRow[] = []
  const closures: StatObservationClosure[] = []
  const nextCurrentByDate = new Map<string, CurrentVintage>()
  let missingValueCount = 0
  let collapsedCount = 0
  let duplicateVintageCount = 0

  for (const [observationDate, incoming] of byDate) {
    // One entry per vintage. A later row for the same vintage in the same
    // payload wins; an incoming row wins over the stored one it restates.
    const entries = new Map<string, TimelineEntry>()
    const stored = currentByDate.get(observationDate)
    if (stored) {
      entries.set(stored.realtimeStart, { realtimeStart: stored.realtimeStart, value: stored.value, stored: true })
    }
    for (const obs of incoming) {
      if (obs.value === null) missingValueCount += 1
      const existing = entries.get(obs.realtimeStart)
      if (existing && !existing.stored) duplicateVintageCount += 1
      entries.set(obs.realtimeStart, {
        realtimeStart: obs.realtimeStart,
        value: obs.value,
        // A vintage the database already holds stays marked stored ONLY while
        // the publisher still reports the same figure for it. If the figure
        // differs, the stored row is wrong and has to be rewritten, not closed.
        stored: existing?.stored === true && existing.value === obs.value,
      })
    }

    const timeline = [...entries.values()].sort((a, b) => (a.realtimeStart < b.realtimeStart ? -1 : 1))

    // Collapse: an unstored vintage repeating the figure already standing is
    // the same figure, not a revision. A stored vintage is never dropped —
    // this decides what to write, it cannot retract a row already held.
    const kept: TimelineEntry[] = []
    for (const entry of timeline) {
      const previous = kept[kept.length - 1]
      if (previous && !entry.stored && previous.value === entry.value) {
        collapsedCount += 1
        continue
      }
      kept.push(entry)
    }
    if (kept.length === 0) continue

    for (let i = 0; i < kept.length; i += 1) {
      const entry = kept[i]
      const next = kept[i + 1]
      // Every vintage runs until the day before the next one starts. Entries
      // are strictly increasing, so this is never earlier than realtime_start
      // and the realtime_start <= realtime_end CHECK always holds.
      const realtimeEnd = next ? shiftDays(next.realtimeStart, -1) : OPEN_REALTIME_END

      if (entry.stored) {
        // Already in the database. Write only when it stops being current, and
        // write only the end — re-upserting would restamp fetched_at on a row
        // this run never fetched.
        if (realtimeEnd !== OPEN_REALTIME_END) {
          closures.push({ series_id: seriesId, observation_date: observationDate, realtime_start: entry.realtimeStart, realtime_end: realtimeEnd })
        }
        continue
      }

      rows.push({
        series_id: seriesId,
        observation_date: observationDate,
        realtime_start: entry.realtimeStart,
        realtime_end: realtimeEnd,
        value: entry.value,
        fetched_at: fetchedAt,
      })
    }

    const current = kept[kept.length - 1]
    nextCurrentByDate.set(observationDate, { realtimeStart: current.realtimeStart, value: current.value })
  }

  rows.sort((a, b) =>
    a.realtime_start === b.realtime_start
      ? a.observation_date < b.observation_date
        ? -1
        : 1
      : a.realtime_start < b.realtime_start
        ? -1
        : 1,
  )

  return { rows, closures, nextCurrentByDate, missingValueCount, collapsedCount, duplicateVintageCount }
}

/** Split rows into write-sized chunks. PostgREST handles 1,000 comfortably. */
export function chunkRows<T>(rows: readonly T[], size: number): T[][] {
  if (size <= 0) return [rows.slice()]
  const out: T[][] = []
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size))
  return out
}

/**
 * Group closures by the end date they share, so a batch that supersedes many
 * observation dates on one vintage becomes one UPDATE instead of hundreds.
 */
export function groupClosuresByEnd(
  closures: readonly StatObservationClosure[],
): { realtimeEnd: string; observationDates: string[] }[] {
  const byEnd = new Map<string, Set<string>>()
  for (const c of closures) {
    const set = byEnd.get(c.realtime_end)
    if (set) set.add(c.observation_date)
    else byEnd.set(c.realtime_end, new Set([c.observation_date]))
  }
  return [...byEnd.entries()].map(([realtimeEnd, dates]) => ({ realtimeEnd, observationDates: [...dates].sort() }))
}
