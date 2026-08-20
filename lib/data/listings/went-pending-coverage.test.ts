/**
 * The pending source's coverage boundary.
 *
 * `activity_events` begins 2026-03-12 (verified live 2026-08-19, anon role,
 * two shapes: the earliest row of any event_type is 2026-03-12T12:54:05.062Z,
 * and a count across every event type over 2026-02-01..2026-03-11 returns 0
 * while 2026-03-12..2026-03-18 returns 813). Over an earlier window the reader
 * returns nothing, and any caller that prints that as `0` publishes a
 * fabricated fact — which is what /reports/sales/<city>/last-year did over
 * calendar 2025, in the visible figure, in the Dataset JSON-LD, and in "No
 * pending sales in this period".
 */
import { describe, it, expect } from 'vitest'
import {
  PENDING_SOURCE_COVERAGE_START_ISO,
  isPendingWindowCovered,
} from '@/lib/data/listings/getWentPendingInWindow'
import { SALES_PERIODS, getDateRangeForPeriod } from '@/lib/sales-report-periods'

describe('isPendingWindowCovered', () => {
  it('names the day activity_events starts', () => {
    expect(PENDING_SOURCE_COVERAGE_START_ISO).toBe('2026-03-12T12:54:05.062Z')
  })

  it('refuses calendar 2025 — the last-year sales report window', () => {
    expect(isPendingWindowCovered('2025-01-01T00:00:00.000Z')).toBe(false)
    expect(isPendingWindowCovered('2025-12-31T23:59:59.999Z')).toBe(false)
  })

  it('refuses the weeks between the feed and the event log', () => {
    expect(isPendingWindowCovered('2026-02-01T00:00:00.000Z')).toBe(false)
    expect(isPendingWindowCovered('2026-03-12T00:00:00.000Z')).toBe(false)
  })

  it('accepts a window that opens on or after the first row', () => {
    expect(isPendingWindowCovered(PENDING_SOURCE_COVERAGE_START_ISO)).toBe(true)
    expect(isPendingWindowCovered('2026-03-15T00:00:00.000Z')).toBe(true)
    expect(isPendingWindowCovered('2026-08-09T00:00:00.000Z')).toBe(true)
  })

  it('treats an unparseable or missing window as uncovered, never as covered', () => {
    expect(isPendingWindowCovered('')).toBe(false)
    expect(isPendingWindowCovered(null)).toBe(false)
    expect(isPendingWindowCovered(undefined)).toBe(false)
    expect(isPendingWindowCovered('last year')).toBe(false)
  })

  it('classifies every sales-report period the page can render', () => {
    const verdicts = Object.fromEntries(
      SALES_PERIODS.map((p) => [p, isPendingWindowCovered(getDateRangeForPeriod(p).start.toISOString())]),
    )
    // last-year is calendar 2025 and can never be covered by this source.
    expect(verdicts['last-year']).toBe(false)
    expect(verdicts['this-week']).toBe(true)
    expect(verdicts['last-week']).toBe(true)
    expect(verdicts['last-month']).toBe(true)
  })
})
