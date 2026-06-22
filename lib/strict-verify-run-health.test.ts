import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { summarizeStrictVerifyHealth, type StrictVerifyRunRow } from './strict-verify-run-health'

// Health state-machine for the strict-verify sync cron (admin monitor). A wrong
// status hides a stalled/degraded data pipeline. Date.now()-dependent -> fake timers.
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-06-22T12:00:00Z'))
})
afterEach(() => vi.useRealTimers())

const run = (o: Partial<StrictVerifyRunRow> = {}): StrictVerifyRunRow => ({
  completed_at: '2026-06-22T11:59:00Z', // 1 min before "now" = fresh
  ok: true,
  query_succeeded: true,
  processed: 100,
  marked_verified: 50,
  fetch_failures: 1,
  history_rows_inserted: 0,
  limit_param: null,
  concurrency_param: null,
  year_filter: null,
  duration_ms: 1000,
  error_message: null,
  ...o,
})

describe('summarizeStrictVerifyHealth', () => {
  it('no runs -> unknown (message depends on backlog)', () => {
    expect(summarizeStrictVerifyHealth([], 5).status).toBe('unknown')
    expect(summarizeStrictVerifyHealth([], 5).summary).toMatch(/migration|wait for the next cron/)
    expect(summarizeStrictVerifyHealth([], 0).summary).toMatch(/backlog is clear/)
  })

  it('backlog clear -> healthy regardless of run detail', () => {
    expect(summarizeStrictVerifyHealth([run()], 0).status).toBe('healthy')
  })

  it('stale last run while backlog remains -> stalled', () => {
    const r = summarizeStrictVerifyHealth([run({ completed_at: '2026-06-22T11:40:00Z' })], 5)
    expect(r.status).toBe('stalled')
    expect(Math.round(r.minutesSinceLastRun ?? 0)).toBe(20)
  })

  it('last run failed the listing query -> degraded (surfaces error)', () => {
    const r = summarizeStrictVerifyHealth([run({ query_succeeded: false, error_message: 'boom' })], 5)
    expect(r.status).toBe('degraded')
    expect(r.summary).toContain('boom')
  })

  it('high fetch-failure ratio on the last run -> degraded', () => {
    const r = summarizeStrictVerifyHealth([run({ processed: 10, fetch_failures: 5 })], 5)
    expect(r.status).toBe('degraded')
    expect(r.summary).toContain('5/10')
  })

  it('low success rate over the last >=5 runs -> degraded', () => {
    const runs = [run(), run({ ok: false }), run({ ok: false }), run({ ok: false }), run({ ok: false })]
    const r = summarizeStrictVerifyHealth(runs, 5)
    expect(r.status).toBe('degraded')
    expect(r.successRateLast10).toBe(20)
  })

  it('current + ok + low failures -> healthy, with rolled-up metrics', () => {
    const r = summarizeStrictVerifyHealth([run({ marked_verified: 40, fetch_failures: 2 })], 5)
    expect(r.status).toBe('healthy')
    expect(r.summary).toContain('40')
    expect(r.successRateLast10).toBe(100)
    expect(r.avgMarkedVerifiedLast5).toBe(40)
    expect(r.avgFetchFailuresLast5).toBe(2)
  })
})
