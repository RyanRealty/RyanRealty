/**
 * Parser + planner tests for the FRED client.
 *
 * Every fixture below is a VERBATIM slice of a real api.stlouisfed.org response
 * captured on 2026-08-17. Hand-written shapes would test the parser against my
 * memory of the API rather than against the API.
 */
import { describe, it, expect } from 'vitest'
import {
  extractFredErrorMessage,
  isNoVintagesFailure,
  isVintageCapFailure,
  parseNarrowObservations,
  parseSeriesStatus,
  parseVintageDates,
  parseVintageObservations,
  planVintageWindows,
  redactApiKey,
  MAX_VINTAGES_PER_REQUEST,
} from '@/lib/stats/fred'
import { FRED_OPEN_REALTIME_END } from '@/lib/stats/contract'

// Captured live: series/observations?series_id=CPIAUCSL&output_type=1
// &realtime_start=2026-06-01&realtime_end=2026-08-17&observation_start=2026-01-01
const NARROW_CLAMPED = {
  realtime_start: '2026-06-01',
  realtime_end: '2026-08-17',
  count: 7,
  observations: [
    { realtime_start: '2026-06-01', realtime_end: '2026-08-17', date: '2026-01-01', value: '326.588' },
    { realtime_start: '2026-06-01', realtime_end: '2026-08-17', date: '2026-04-01', value: '332.407' },
    { realtime_start: '2026-06-10', realtime_end: '2026-08-17', date: '2026-05-01', value: '333.979' },
    { realtime_start: '2026-07-14', realtime_end: '2026-08-17', date: '2026-06-01', value: '332.568' },
    { realtime_start: '2026-08-12', realtime_end: '2026-08-17', date: '2026-07-01', value: '332.813' },
  ],
}

// Captured live: the same series over the FULL real-time range (MORTGAGE30US).
const NARROW_FULL_RANGE = {
  realtime_start: '1776-07-04',
  realtime_end: '9999-12-31',
  count: 2,
  observations: [
    { realtime_start: '2013-12-19', realtime_end: '9999-12-31', date: '1971-04-02', value: '7.33' },
    { realtime_start: '2026-08-13', realtime_end: '9999-12-31', date: '2026-08-13', value: '6.67' },
  ],
}

// Captured live: DGS10 window 2008-01-02..2010-01-07 — a market holiday.
const NARROW_WITH_DOT = {
  observations: [{ realtime_start: '2008-01-02', realtime_end: '2010-01-07', date: '1962-02-12', value: '.' }],
  count: 1,
}

// Captured live: series/observations?series_id=CPIAUCSL&output_type=3
const WIDE_NEW_AND_REVISED = {
  count: 3,
  observations: [
    { date: '2026-05-01', CPIAUCSL_20260610: '333.979' },
    { date: '2026-06-01', CPIAUCSL_20260714: '332.568' },
    { date: '2026-07-01', CPIAUCSL_20260812: '332.813' },
  ],
}

describe('parseNarrowObservations', () => {
  it('flags rows clamped to the requested window start and leaves true vintages alone', () => {
    const rows = parseNarrowObservations(NARROW_CLAMPED, '2026-06-01')
    expect(rows).not.toBeNull()
    expect(rows!.map((r) => [r.observationDate, r.realtimeStart, r.clampedStart])).toEqual([
      ['2026-01-01', '2026-06-01', true],
      ['2026-04-01', '2026-06-01', true],
      ['2026-05-01', '2026-06-10', false],
      ['2026-06-01', '2026-07-14', false],
      ['2026-07-01', '2026-08-12', false],
    ])
  })

  it('flags nothing as clamped over the full real-time range and keeps the publisher open sentinel verbatim', () => {
    const rows = parseNarrowObservations(NARROW_FULL_RANGE, '1776-07-04')!
    expect(rows.every((r) => r.clampedStart === false)).toBe(true)
    expect(rows[0]).toMatchObject({
      observationDate: '1971-04-02',
      realtimeStart: '2013-12-19',
      realtimeEnd: FRED_OPEN_REALTIME_END,
      value: 7.33,
    })
  })

  it('parses a "." into a null figure rather than a zero', () => {
    const rows = parseNarrowObservations(NARROW_WITH_DOT, '2008-01-02')!
    expect(rows).toHaveLength(1)
    expect(rows[0].value).toBeNull()
  })

  it('returns null — never an empty array — when the payload carries no observations', () => {
    expect(parseNarrowObservations({ error_code: 400 }, null)).toBeNull()
    expect(parseNarrowObservations(null, null)).toBeNull()
    expect(parseNarrowObservations({ observations: [] }, null)).toEqual([])
  })
})

describe('parseVintageObservations', () => {
  it('reads the true vintage date out of the wide column key', () => {
    const rows = parseVintageObservations(WIDE_NEW_AND_REVISED, 'CPIAUCSL')!
    expect(rows).toEqual([
      { observationDate: '2026-05-01', value: 333.979, realtimeStart: '2026-06-10', realtimeEnd: null, clampedStart: false },
      { observationDate: '2026-06-01', value: 332.568, realtimeStart: '2026-07-14', realtimeEnd: null, clampedStart: false },
      { observationDate: '2026-07-01', value: 332.813, realtimeStart: '2026-08-12', realtimeEnd: null, clampedStart: false },
    ])
  })

  it('expands a date carrying several vintages into one row each', () => {
    const rows = parseVintageObservations(
      { observations: [{ date: '2026-01-01', MSACSR_20260224: '8.9', MSACSR_20260724: '9.0' }] },
      'MSACSR',
    )!
    expect(rows.map((r) => [r.realtimeStart, r.value])).toEqual([
      ['2026-02-24', 8.9],
      ['2026-07-24', 9],
    ])
  })

  it('ignores keys belonging to another series', () => {
    const rows = parseVintageObservations({ observations: [{ date: '2026-01-01', DGS10_20260101: '4.5' }] }, 'MSACSR')!
    expect(rows).toEqual([])
  })
})

describe('parseSeriesStatus / parseVintageDates', () => {
  it('pulls observation_end and last_updated off the series payload', () => {
    const status = parseSeriesStatus(
      { seriess: [{ id: 'CPIAUCSL', observation_start: '1947-01-01', observation_end: '2026-07-01', last_updated: '2026-08-12 09:10:19-05' }] },
      'CPIAUCSL',
    )
    expect(status).toEqual({ seriesCode: 'CPIAUCSL', observationEnd: '2026-07-01', lastUpdated: '2026-08-12 09:10:19-05' })
  })

  it('sorts vintage dates ascending and drops anything that is not a date', () => {
    expect(parseVintageDates({ vintage_dates: ['2005-07-06', '2005-06-28', 42, 'soon'] })).toEqual([
      '2005-06-28',
      '2005-07-06',
    ])
  })
})

describe('planVintageWindows', () => {
  it('cuts contiguous windows on real vintage boundaries and leaves the last one open-ended', () => {
    const dates = ['2020-01-01', '2020-01-02', '2020-01-03', '2020-01-04', '2020-01-05']
    expect(planVintageWindows(dates, 2)).toEqual([
      { realtimeStart: '2020-01-01', realtimeEnd: '2020-01-02' },
      { realtimeStart: '2020-01-03', realtimeEnd: '2020-01-04' },
      { realtimeStart: '2020-01-05', realtimeEnd: FRED_OPEN_REALTIME_END },
    ])
  })

  /** `count` consecutive real calendar days starting at 2005-06-28 — DGS10's first vintage. */
  function vintageRun(count: number): string[] {
    const start = Date.parse('2005-06-28T00:00:00Z')
    return Array.from({ length: count }, (_, i) => new Date(start + i * 86_400_000).toISOString().slice(0, 10))
  }

  it('covers every vintage date exactly once', () => {
    const dates = vintageRun(37)
    const windows = planVintageWindows(dates, 10)
    expect(windows[0].realtimeStart).toBe(dates[0])
    expect(windows[windows.length - 1].realtimeEnd).toBe(FRED_OPEN_REALTIME_END)
    for (let i = 1; i < windows.length; i += 1) {
      // Window n+1 starts at the vintage immediately after window n's end.
      expect(dates.indexOf(windows[i].realtimeStart)).toBe(dates.indexOf(windows[i - 1].realtimeEnd) + 1)
    }
  })

  it('never plans a window at or above the publisher ceiling, even when asked to', () => {
    // DGS10's real vintage count on 2026-08-17, which is what trips the 400.
    const dates = vintageRun(5089)
    const windows = planVintageWindows(dates, 99999)
    expect(windows.length).toBeGreaterThan(1)
    for (const w of windows) {
      const inWindow = dates.filter(
        (d) => d >= w.realtimeStart && (w.realtimeEnd === FRED_OPEN_REALTIME_END || d <= w.realtimeEnd),
      )
      expect(inWindow.length).toBeLessThan(MAX_VINTAGES_PER_REQUEST)
    }
  })

  it('returns no windows for a series with no vintages', () => {
    expect(planVintageWindows([])).toEqual([])
  })
})

describe('failure classification', () => {
  it('separates the vintage ceiling from an empty window from a real outage', () => {
    // Both bodies captured live on 2026-08-17.
    const cap = {
      kind: 'vintage_cap' as const,
      message: 'There are 5088 vintage dates in the specified real-time period: 1776-07-04 to 9999-12-31.  This exceeds the maximum number of vintage dates allowed for this file type (2000).',
    }
    const empty = { kind: 'no_vintages' as const, message: 'No vintage dates exist for the specified real-time period: 2026-08-10 to 2026-08-17' }
    const outage = { kind: 'http' as const, message: 'Bad Gateway', status: 502 }

    expect(isVintageCapFailure(cap)).toBe(true)
    expect(isNoVintagesFailure(cap)).toBe(false)
    expect(isNoVintagesFailure(empty)).toBe(true)
    expect(isVintageCapFailure(empty)).toBe(false)
    expect(isVintageCapFailure(outage)).toBe(false)
    expect(isNoVintagesFailure(outage)).toBe(false)
  })

  it('lifts FRED error_message out of the body', () => {
    expect(extractFredErrorMessage('{"error_code":400,"error_message":"Bad Request. No vintage dates exist"}')).toBe(
      'Bad Request. No vintage dates exist',
    )
    expect(extractFredErrorMessage('<html>504</html>')).toBe('<html>504</html>')
  })
})

describe('redactApiKey', () => {
  it('strips the key out of anything headed for a log or an email', () => {
    expect(redactApiKey('https://api.stlouisfed.org/fred/series?series_id=DGS10&api_key=abcdef0123456789&file_type=json')).toBe(
      'https://api.stlouisfed.org/fred/series?series_id=DGS10&api_key=[redacted]&file_type=json',
    )
  })

  it('strips it from an error body that quotes the URL', () => {
    expect(redactApiKey('fetch failed for "…api_key=deadbeef"')).toBe('fetch failed for "…api_key=[redacted]"')
  })
})
