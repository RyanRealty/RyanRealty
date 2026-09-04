import { describe, expect, it } from 'vitest'
import { isSendableQueueState, type CmaQueueState } from '@/lib/data/cma/unified-queue'

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
      'queued',
      'sent',
      'archived',
    ]
    for (const s of notSendable) expect(isSendableQueueState(s)).toBe(false)
  })
})
