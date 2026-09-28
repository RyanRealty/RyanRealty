import { describe, expect, it } from 'vitest'
import { resolveCmaQueueState, type CmaQueueState } from '@/lib/data/cma/unified-queue'

const base = {
  status: 'draft',
  archivedAt: null,
  hasDocument: false,
  needsReview: false,
  auditVerdict: 'did-not-run' as const,
  deliveredAt: null,
  emailSentAt: null,
  queuedAt: null,
}

const SHORTAGE = 'Found 2 of the 3 closed sales this home needs to be priced.'
const UNSTABLE = 'JUDGE_UNSTABLE. The build was not priced.'

describe('resolveCmaQueueState deliberate build outcomes', () => {
  it('splits comp shortage and an unstable judge off failed', () => {
    expect(resolveCmaQueueState({ ...base, buildError: SHORTAGE })).toBe('comp-shortage')
    expect(resolveCmaQueueState({ ...base, buildError: UNSTABLE })).toBe('comps-unstable')
    expect(
      resolveCmaQueueState({
        ...base,
        buildError: 'Not enough comparable sales the review would keep. 1 of 6 stayed, and this home needs 3.',
      }),
    ).toBe('comp-shortage')
  })

  it('uses a stored code when the prose is not the current sentence', () => {
    expect(
      resolveCmaQueueState({
        ...base,
        buildError: 'kept 2',
        buildSummary: { build_error_code: 'COMP_SHORTAGE', pricing: { recommended: 1 } },
      }),
    ).toBe('comp-shortage')
    expect(
      resolveCmaQueueState({
        ...base,
        buildError: 'kept 2',
        buildSummary: { build_error_code: 'JUDGE_UNSTABLE' },
      }),
    ).toBe('comps-unstable')
  })

  it('keeps a real crash on failed, and does not count the new states as failed', () => {
    expect(resolveCmaQueueState({ ...base, buildError: 'subject not resolved' })).toBe('failed')
    const states: CmaQueueState[] = [
      resolveCmaQueueState({ ...base, buildError: SHORTAGE }),
      resolveCmaQueueState({ ...base, buildError: UNSTABLE }),
    ]
    expect(states.filter((s) => s === 'failed')).toEqual([])
  })

  it('still lets a send outrank a later build error', () => {
    expect(
      resolveCmaQueueState({
        ...base,
        buildError: SHORTAGE,
        hasDocument: true,
        deliveredAt: '2026-09-28T20:02:00.000Z',
        buildSummary: { build_error_code: 'COMP_SHORTAGE' },
      }),
    ).toBe('sent')
  })
})
