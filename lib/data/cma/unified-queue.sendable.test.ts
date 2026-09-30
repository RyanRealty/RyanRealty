import { describe, expect, it } from 'vitest'
import { isSendableQueueState, resolveCmaQueueState, type CmaQueueState } from '@/lib/data/cma/unified-queue'

/**
 * §0 guard. On 2026-09-04 the adversarial audit failed 210 of 418 live CMAs
 * for real defects — fabricated comp counts, recommendations the adjusted
 * values do not support. If `audit-failed` ever becomes sendable, the queue
 * mails those to homeowners under a licensed broker's name. This test is the
 * mechanism that stops a well-meaning refactor from widening the rule.
 */
describe('isSendableQueueState', () => {
  it('allows exactly one state', () => {
    expect(isSendableQueueState('ready')).toBe(true)
  })

  it('refuses a CMA whose audit failed', () => {
    expect(isSendableQueueState('audit-failed')).toBe(false)
  })

  it('refuses a CMA nothing has checked', () => {
    expect(isSendableQueueState('unvetted')).toBe(false)
  })

  it('refuses every other state', () => {
    const notSendable: CmaQueueState[] = [
      'failed',
      'building',
      'audit-failed',
      'unvetted',
      'flagged',
      'held',
      'queued',
      'sent',
      'archived',
    ]
    for (const s of notSendable) expect(isSendableQueueState(s)).toBe(false)
  })
})

describe("resolveCmaQueueState and Matt's 80% line (2026-09-30)", () => {
  const base = {
    status: 'draft',
    archivedAt: null,
    buildError: null,
    hasDocument: true,
    needsReview: false,
    auditVerdict: 'pass' as const,
    deliveredAt: null,
    emailSentAt: null,
    queuedAt: null,
  }

  it('a clean expired CMA under the line is held, never ready', () => {
    expect(resolveCmaQueueState({ ...base, belowFloor: true })).toBe('held')
    expect(resolveCmaQueueState({ ...base, belowFloor: false })).toBe('ready')
  })

  it('a queued row under the line shows as held', () => {
    expect(resolveCmaQueueState({ ...base, queuedAt: '2026-09-30T20:00:00Z', belowFloor: true })).toBe('held')
  })

  it('sent and archived stay what they are', () => {
    expect(resolveCmaQueueState({ ...base, deliveredAt: '2026-09-30T21:00:00Z', belowFloor: true })).toBe('sent')
    expect(resolveCmaQueueState({ ...base, archivedAt: '2026-09-30T22:48:00Z', belowFloor: true })).toBe('archived')
  })

  it('a failed build is still failed, not held', () => {
    expect(resolveCmaQueueState({ ...base, buildError: 'boom', belowFloor: true })).toBe('failed')
  })
})
