import { describe, it, expect } from 'vitest'
import { computeNextDeltaCursor } from './deltaCursor'

const RUN_START = '2026-06-20T10:00:00.000Z'
const MAX_TS = '2026-06-20T09:58:30.000Z'

describe('computeNextDeltaCursor (audit p0.1 — no silent data loss)', () => {
  it('clean full drain → advances to runStartedAt', () => {
    expect(
      computeNextDeltaCursor({ upsertFailed: false, truncated: false, runStartedAt: RUN_START, maxProcessedTs: MAX_TS }),
    ).toBe(RUN_START)
  })

  it('truncated (overflow) → advances only to the newest processed row, NOT now()', () => {
    expect(
      computeNextDeltaCursor({ upsertFailed: false, truncated: true, runStartedAt: RUN_START, maxProcessedTs: MAX_TS }),
    ).toBe(MAX_TS)
  })

  it('truncated with nothing processed → leaves cursor unchanged (null)', () => {
    expect(
      computeNextDeltaCursor({ upsertFailed: false, truncated: true, runStartedAt: RUN_START, maxProcessedTs: null }),
    ).toBeNull()
  })

  it('any upsert failure → cursor unchanged (null), so the window is retried', () => {
    expect(
      computeNextDeltaCursor({ upsertFailed: true, truncated: false, runStartedAt: RUN_START, maxProcessedTs: MAX_TS }),
    ).toBeNull()
  })

  it('upsert failure overrides truncation → still null (never skip failed rows)', () => {
    expect(
      computeNextDeltaCursor({ upsertFailed: true, truncated: true, runStartedAt: RUN_START, maxProcessedTs: MAX_TS }),
    ).toBeNull()
  })
})
