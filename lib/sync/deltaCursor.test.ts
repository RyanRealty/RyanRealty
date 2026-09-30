import { describe, it, expect } from 'vitest'
import { computeNextDeltaCursor, DELTA_CURSOR_OVERLAP_MS } from './deltaCursor'

const RUN_START = '2026-06-20T10:00:00.000Z'
const MAX_TS = '2026-06-20T09:58:30.000Z'
const PREVIOUS = '2026-06-20T09:45:00.000Z'

const iso = (ms: number) => new Date(ms).toISOString()

describe('computeNextDeltaCursor (audit p0.1 — no silent data loss)', () => {
  it('clean full drain → re-reads the overlap: runStartedAt minus DELTA_CURSOR_OVERLAP_MS', () => {
    expect(DELTA_CURSOR_OVERLAP_MS).toBe(5 * 60 * 1000)
    expect(
      computeNextDeltaCursor({
        upsertFailed: false,
        truncated: false,
        runStartedAt: RUN_START,
        maxProcessedTs: MAX_TS,
        previousCursor: PREVIOUS,
      }),
    ).toBe(iso(Date.parse(RUN_START) - DELTA_CURSOR_OVERLAP_MS))
  })

  it('clean full drain never moves the cursor behind the one the run read from', () => {
    // Runs closer together than the overlap: keep the cursor where it is.
    expect(
      computeNextDeltaCursor({
        upsertFailed: false,
        truncated: false,
        runStartedAt: RUN_START,
        maxProcessedTs: MAX_TS,
        previousCursor: '2026-06-20T09:57:00.000Z',
      }),
    ).toBeNull()
  })

  it('truncated (overflow) → steps back one second from the newest processed row, NOT now()', () => {
    // A tie group split across the page boundary would otherwise be skipped by `Gt`.
    expect(
      computeNextDeltaCursor({
        upsertFailed: false,
        truncated: true,
        runStartedAt: RUN_START,
        maxProcessedTs: MAX_TS,
        previousCursor: PREVIOUS,
      }),
    ).toBe(iso(Date.parse(MAX_TS) - 1000))
  })

  it('truncated where the step back would not move past the previous cursor → the newest processed row (always progress)', () => {
    expect(
      computeNextDeltaCursor({
        upsertFailed: false,
        truncated: true,
        runStartedAt: RUN_START,
        maxProcessedTs: '2026-06-20T09:45:00.500Z',
        previousCursor: PREVIOUS,
      }),
    ).toBe('2026-06-20T09:45:00.500Z')
  })

  it('truncated with nothing processed → leaves cursor unchanged (null)', () => {
    expect(
      computeNextDeltaCursor({ upsertFailed: false, truncated: true, runStartedAt: RUN_START, maxProcessedTs: null, previousCursor: PREVIOUS }),
    ).toBeNull()
  })

  it('any upsert failure → cursor unchanged (null), so the window is retried', () => {
    expect(
      computeNextDeltaCursor({ upsertFailed: true, truncated: false, runStartedAt: RUN_START, maxProcessedTs: MAX_TS, previousCursor: PREVIOUS }),
    ).toBeNull()
  })

  it('upsert failure overrides truncation → still null (never skip failed rows)', () => {
    expect(
      computeNextDeltaCursor({ upsertFailed: true, truncated: true, runStartedAt: RUN_START, maxProcessedTs: MAX_TS, previousCursor: PREVIOUS }),
    ).toBeNull()
  })

  it('no previous cursor (first run) → still applies the overlap', () => {
    expect(
      computeNextDeltaCursor({ upsertFailed: false, truncated: false, runStartedAt: RUN_START, maxProcessedTs: null }),
    ).toBe(iso(Date.parse(RUN_START) - DELTA_CURSOR_OVERLAP_MS))
  })
})
