/**
 * Vintage reconciliation tests.
 *
 * The invariant under test is the one the live database enforces:
 * stat_observations_current_uq allows at most ONE row per
 * (series_id, observation_date) with realtime_end = 'infinity'. Most of these
 * cases exist because a plausible-looking implementation violates it silently.
 */
import { describe, it, expect } from 'vitest'
import type { FredObservation } from '@/lib/stats/fred'
import { OPEN_REALTIME_END, FRED_OPEN_REALTIME_END } from '@/lib/stats/contract'
import {
  chunkRows,
  daysBetween,
  EMPTY_CURSOR,
  groupClosuresByEnd,
  isoDay,
  MAX_INCREMENTAL_WINDOW_DAYS,
  planSeriesIngest,
  reconcileVintages,
  shiftDays,
  type CurrentVintage,
} from '@/lib/stats/vintage'

const SERIES = 'fred:DGS10'
const FETCHED_AT = '2026-08-17T22:47:00.000Z'

function obs(observationDate: string, realtimeStart: string, value: number | null, clampedStart = false): FredObservation {
  return { observationDate, realtimeStart, value, realtimeEnd: null, clampedStart }
}

function reconcile(observations: FredObservation[], current: Record<string, CurrentVintage> = {}) {
  return reconcileVintages({
    seriesId: SERIES,
    observations,
    currentByDate: new Map(Object.entries(current)),
    fetchedAt: FETCHED_AT,
  })
}

describe('calendar helpers', () => {
  it('works in UTC, not local time', () => {
    expect(isoDay(new Date('2026-08-17T23:59:59.000Z'))).toBe('2026-08-17')
    expect(shiftDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftDays('2024-03-01', -1)).toBe('2024-02-29')
    expect(daysBetween('2026-08-10', '2026-08-17')).toBe(7)
    expect(daysBetween('2026-08-17', '2026-08-10')).toBe(-7)
    expect(Number.isNaN(daysBetween('not-a-date', '2026-08-17'))).toBe(true)
  })
})

describe('planSeriesIngest', () => {
  const cursor = (latestRealtimeStart: string | null, rowCount: number) => ({
    ...EMPTY_CURSOR,
    latestRealtimeStart,
    latestObservationDate: latestRealtimeStart,
    latestPublishedObservationDate: latestRealtimeStart,
    rowCount,
  })

  it('backfills a series with no rows', () => {
    expect(planSeriesIngest(EMPTY_CURSOR, '2026-08-17')).toEqual({
      mode: 'backfill',
      outputType: 1,
      realtimeStart: '1776-07-04',
      realtimeEnd: FRED_OPEN_REALTIME_END,
    })
  })

  it('asks only for what changed once a series has rows', () => {
    expect(planSeriesIngest(cursor('2026-08-14', 16000), '2026-08-17')).toEqual({
      mode: 'incremental',
      outputType: 3,
      realtimeStart: '2026-08-14',
      realtimeEnd: '2026-08-17',
    })
  })

  it('re-requests FROM the stored vintage so a same-day second release is not skipped', () => {
    expect(planSeriesIngest(cursor('2026-08-17', 5), '2026-08-17').realtimeStart).toBe('2026-08-17')
  })

  it('degrades to a backfill rather than asking for a window the publisher cannot answer', () => {
    const stale = shiftDays('2026-08-17', -(MAX_INCREMENTAL_WINDOW_DAYS + 1))
    expect(planSeriesIngest(cursor(stale, 10), '2026-08-17').mode).toBe('backfill')
  })
})

describe('reconcileVintages — the one-current-row invariant', () => {
  it('marks exactly one vintage per observation date as current', () => {
    const result = reconcile([
      obs('2026-08-13', '2026-08-13', 4.5),
      obs('2026-08-13', '2026-08-14', 4.55),
      obs('2026-08-13', '2026-08-17', 4.6),
      obs('2026-08-14', '2026-08-14', 4.4),
    ])
    const openPerDate = new Map<string, number>()
    for (const row of result.rows) {
      if (row.realtime_end === OPEN_REALTIME_END) openPerDate.set(row.observation_date, (openPerDate.get(row.observation_date) ?? 0) + 1)
    }
    expect([...openPerDate.values()]).toEqual([1, 1])
  })

  it('stores the database sentinel, never the publisher one', () => {
    const result = reconcile([obs('2026-08-13', '2026-08-13', 4.5)])
    expect(result.rows[0].realtime_end).toBe('infinity')
    expect(result.rows.some((r) => r.realtime_end === FRED_OPEN_REALTIME_END)).toBe(false)
  })

  it('closes each superseded vintage the day before the next one starts', () => {
    const result = reconcile([
      obs('2026-08-13', '2026-08-13', 4.5),
      obs('2026-08-13', '2026-08-17', 4.6),
    ])
    expect(result.rows.map((r) => [r.realtime_start, r.realtime_end, r.value])).toEqual([
      ['2026-08-13', '2026-08-16', 4.5],
      ['2026-08-17', OPEN_REALTIME_END, 4.6],
    ])
  })

  it('never emits a row whose end precedes its start (the realtime_start <= realtime_end CHECK)', () => {
    const result = reconcile([
      obs('2026-08-13', '2026-08-13', 1),
      obs('2026-08-13', '2026-08-14', 2),
      obs('2026-08-13', '2026-08-15', 3),
    ])
    for (const row of result.rows) {
      if (row.realtime_end === OPEN_REALTIME_END) continue
      expect(row.realtime_start <= row.realtime_end).toBe(true)
    }
  })
})

describe('reconcileVintages — against what the database already holds', () => {
  const stored: Record<string, CurrentVintage> = { '2026-07-01': { realtimeStart: '2026-08-12', value: 332.813 } }

  it('closes the stored row and opens the new one when the publisher revises', () => {
    const result = reconcile([obs('2026-07-01', '2026-09-10', 333.1)], stored)
    expect(result.closures).toEqual([
      { series_id: SERIES, observation_date: '2026-07-01', realtime_start: '2026-08-12', realtime_end: '2026-09-09' },
    ])
    expect(result.rows).toEqual([
      {
        series_id: SERIES,
        observation_date: '2026-07-01',
        realtime_start: '2026-09-10',
        realtime_end: OPEN_REALTIME_END,
        value: 333.1,
        fetched_at: FETCHED_AT,
      },
    ])
  })

  it('writes nothing when a later vintage repeats the figure already standing', () => {
    const result = reconcile([obs('2026-07-01', '2026-09-10', 332.813)], stored)
    expect(result.rows).toEqual([])
    expect(result.closures).toEqual([])
    expect(result.collapsedCount).toBe(1)
    expect(result.nextCurrentByDate.get('2026-07-01')).toEqual({ realtimeStart: '2026-08-12', value: 332.813 })
  })

  it('never re-upserts a stored row that is still current — that would restamp fetched_at on rows it did not fetch', () => {
    const result = reconcile([obs('2026-07-01', '2026-08-12', 332.813)], stored)
    expect(result.rows).toEqual([])
    expect(result.closures).toEqual([])
  })

  it('rewrites a stored vintage whose figure the publisher now reports differently', () => {
    const result = reconcile([obs('2026-07-01', '2026-08-12', 999)], stored)
    expect(result.rows).toEqual([
      {
        series_id: SERIES,
        observation_date: '2026-07-01',
        realtime_start: '2026-08-12',
        realtime_end: OPEN_REALTIME_END,
        value: 999,
        fetched_at: FETCHED_AT,
      },
    ])
    expect(result.closures).toEqual([])
  })

  it('leaves the stored row current when an incoming vintage is OLDER than it', () => {
    const result = reconcile([obs('2026-07-01', '2026-07-14', 332.5)], stored)
    expect(result.rows).toEqual([
      {
        series_id: SERIES,
        observation_date: '2026-07-01',
        realtime_start: '2026-07-14',
        realtime_end: '2026-08-11',
        value: 332.5,
        fetched_at: FETCHED_AT,
      },
    ])
    expect(result.closures).toEqual([])
    expect(result.nextCurrentByDate.get('2026-07-01')?.realtimeStart).toBe('2026-08-12')
  })
})

describe('reconcileVintages — clamped continuations', () => {
  it('drops the clamp a narrow window repeats and keeps the true vintage', () => {
    // The measured shape: a later real-time window reports an unchanged figure
    // at the window start rather than at the date it became current.
    const result = reconcile([obs('1962-01-02', '2012-01-19', 4.06, true)], {
      '1962-01-02': { realtimeStart: '2005-06-28', value: 4.06 },
    })
    expect(result.rows).toEqual([])
    expect(result.collapsedCount).toBe(1)
  })

  it('keeps a same-dated row when the figure actually changed', () => {
    const result = reconcile([obs('1962-01-02', '2012-01-19', 4.07, true)], {
      '1962-01-02': { realtimeStart: '2005-06-28', value: 4.06 },
    })
    expect(result.rows).toHaveLength(1)
    expect(result.closures).toHaveLength(1)
    expect(result.collapsedCount).toBe(0)
  })

  it('collapses a run of repeats inside one batch down to its first vintage', () => {
    const result = reconcile([
      obs('2026-08-13', '2026-08-13', 4.5),
      obs('2026-08-13', '2026-08-14', 4.5),
      obs('2026-08-13', '2026-08-15', 4.5),
      obs('2026-08-13', '2026-08-16', 4.7),
    ])
    expect(result.rows.map((r) => [r.realtime_start, r.realtime_end, r.value])).toEqual([
      ['2026-08-13', '2026-08-15', 4.5],
      ['2026-08-16', OPEN_REALTIME_END, 4.7],
    ])
    expect(result.collapsedCount).toBe(2)
  })
})

describe('reconcileVintages — missing figures and duplicates', () => {
  it('stores a "." as a null figure so a withdrawn value cannot leave the old one standing', () => {
    const result = reconcile([obs('2026-01-01', '2026-01-02', null)])
    expect(result.rows).toEqual([
      {
        series_id: SERIES,
        observation_date: '2026-01-01',
        realtime_start: '2026-01-02',
        realtime_end: OPEN_REALTIME_END,
        value: null,
        fetched_at: FETCHED_AT,
      },
    ])
    expect(result.missingValueCount).toBe(1)
  })

  it('counts a repeated (date, vintage) in one payload instead of writing it twice', () => {
    const result = reconcile([obs('2026-08-13', '2026-08-14', 4.5), obs('2026-08-13', '2026-08-14', 4.6)])
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].value).toBe(4.6)
    expect(result.duplicateVintageCount).toBe(1)
  })
})

describe('reconcileVintages — write ordering', () => {
  it('returns rows ascending by vintage so a half-finished chunk run leaves the cursor below every unwritten vintage', () => {
    const result = reconcile([
      obs('2026-08-15', '2026-08-17', 1),
      obs('2026-08-13', '2026-08-13', 2),
      obs('2026-08-14', '2026-08-15', 3),
    ])
    const vintages = result.rows.map((r) => r.realtime_start)
    expect(vintages).toEqual([...vintages].sort())
  })
})

describe('groupClosuresByEnd / chunkRows', () => {
  it('folds many observation dates sharing one end date into one update', () => {
    const groups = groupClosuresByEnd([
      { series_id: SERIES, observation_date: '2026-01-01', realtime_start: '2026-02-01', realtime_end: '2026-07-27' },
      { series_id: SERIES, observation_date: '2026-02-01', realtime_start: '2026-03-01', realtime_end: '2026-07-27' },
      { series_id: SERIES, observation_date: '2026-03-01', realtime_start: '2026-04-01', realtime_end: '2026-08-11' },
    ])
    expect(groups).toEqual([
      { realtimeEnd: '2026-07-27', observationDates: ['2026-01-01', '2026-02-01'] },
      { realtimeEnd: '2026-08-11', observationDates: ['2026-03-01'] },
    ])
  })

  it('splits without dropping or duplicating a row', () => {
    const rows = Array.from({ length: 2501 }, (_, i) => i)
    const chunks = chunkRows(rows, 1000)
    expect(chunks.map((c) => c.length)).toEqual([1000, 1000, 501])
    expect(chunks.flat()).toEqual(rows)
  })
})
