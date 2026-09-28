import { describe, expect, it } from 'vitest'
import { cmaDetailBadgeLabel } from '@/lib/cma/build-error-code'
import { CMA_QUEUE_STATE_LABEL } from '@/lib/cma/queue-view'
import { resolveCmaQueueState } from '@/lib/data/cma/unified-queue'
import {
  CMA_BOUNCED_LABEL,
  carryDeliveryAcrossRebuild,
  cmaSlugFromSentEvent,
  countsAsEmailDelivered,
  mergeCmaDelivery,
  readCmaDeliveryStatus,
} from '@/lib/cma/delivery-status'

const base = {
  status: 'delivered',
  archivedAt: null,
  buildError: null,
  hasDocument: true,
  needsReview: false,
  auditVerdict: 'pass' as const,
  deliveredAt: '2026-09-28T20:02:00.000Z',
  emailSentAt: null,
  queuedAt: null,
}

describe('carryDeliveryAcrossRebuild', () => {
  it('keeps the bounce stamp and drops the build error code', () => {
    const next = carryDeliveryAcrossRebuild(
      { builder: 'v', judge_cache: { keptKeys: ['new'] }, pricing: { recommended: 2 } },
      {
        judge_cache: { keptKeys: ['old'] },
        build_error_code: 'COMP_SHORTAGE',
        delivery: { status: 'bounced', at: '2026-09-28T21:00:00.000Z' },
        pricing: { recommended: 1 },
      },
    )
    expect(next.delivery).toEqual({ status: 'bounced', at: '2026-09-28T21:00:00.000Z' })
    expect(next).not.toHaveProperty('build_error_code')
    expect(next.judge_cache).toEqual({ keptKeys: ['new'] })
    expect(next.pricing).toEqual({ recommended: 2 })
  })

  it('leaves the new summary alone when the prior row has no delivery stamp', () => {
    const next = { builder: 'v', judge_cache: { keptKeys: ['new'] } }
    expect(carryDeliveryAcrossRebuild(next, { build_error_code: 'JUDGE_UNSTABLE' })).toBe(next)
    expect(carryDeliveryAcrossRebuild(next, null)).toBe(next)
  })
})

describe('CMA hard-bounce status', () => {
  it('shows Bounced on the queue and the detail badge, and not as sent', () => {
    const summary = mergeCmaDelivery(
      { pricing: { recommended: 1 } },
      {
        status: 'bounced',
        at: '2026-09-28T21:00:00.000Z',
        enhanced_status: '5.1.1',
        smtp_code: '550',
        recipient: 'buyer@example.com',
        diagnostic: '550 5.1.1',
        source: 'gmail-dsn',
      },
    )
    expect(readCmaDeliveryStatus(summary, base.deliveredAt)).toBe('bounced')
    expect(summary.pricing).toEqual({ recommended: 1 })
    const state = resolveCmaQueueState({ ...base, buildSummary: summary })
    expect(state).toBe('bounced')
    expect(state).not.toBe('sent')
    expect(CMA_QUEUE_STATE_LABEL.bounced).toBe(CMA_BOUNCED_LABEL)
    expect(CMA_BOUNCED_LABEL).toBe('Bounced')
    expect(
      cmaDetailBadgeLabel({
        status: 'delivered',
        buildError: null,
        buildSummary: summary,
        deliveredAt: base.deliveredAt,
      }),
    ).toBe('Bounced')
  })

  it('keeps a soft delivery mark on the sent path', () => {
    expect(
      resolveCmaQueueState({
        ...base,
        buildSummary: { delivery: { status: 'deferred' } },
      }),
    ).toBe('sent')
  })

  it('drops a bounced send out of delivered counts', () => {
    const states = [
      resolveCmaQueueState(base),
      resolveCmaQueueState({
        ...base,
        buildSummary: { delivery: { status: 'bounced', at: '2026-09-28T21:00:00.000Z' } },
      }),
    ]
    expect(states.filter((s) => s === 'sent')).toEqual(['sent'])
    expect(states.filter((s) => s === 'bounced')).toEqual(['bounced'])
    expect(countsAsEmailDelivered('2026-09-28T21:00:00.000Z', false)).toBe(true)
    expect(countsAsEmailDelivered('2026-09-28T21:00:00.000Z', true)).toBe(false)
    expect(countsAsEmailDelivered(null, false)).toBe(false)
  })

  it('ignores a bounce stamp older than the latest send', () => {
    const summary = { delivery: { status: 'bounced', at: '2026-09-28T18:00:00.000Z' } }
    const deliveredAt = '2026-09-28T20:02:00.000Z'
    expect(readCmaDeliveryStatus(summary, deliveredAt)).toBeNull()
    expect(resolveCmaQueueState({ ...base, deliveredAt, buildSummary: summary })).toBe('sent')
    expect(
      cmaDetailBadgeLabel({
        status: 'delivered',
        buildError: null,
        buildSummary: summary,
        deliveredAt,
      }),
    ).toBe('delivered')
  })

  it('reads bounced when the stamp is at or after the latest send', () => {
    const atSend = { delivery: { status: 'bounced', at: '2026-09-28T20:02:00Z' } }
    const after = { delivery: { status: 'bounced', at: '2026-09-28T21:00:00.000Z' } }
    expect(readCmaDeliveryStatus(atSend, '2026-09-28T20:02:00.000Z')).toBe('bounced')
    expect(readCmaDeliveryStatus(after, base.deliveredAt)).toBe('bounced')
    expect(resolveCmaQueueState({ ...base, buildSummary: atSend })).toBe('bounced')
    expect(
      cmaDetailBadgeLabel({
        status: 'delivered',
        buildError: null,
        buildSummary: after,
        deliveredAt: base.deliveredAt,
      }),
    ).toBe('Bounced')
  })

  it('reads the CMA slug off the sent event', () => {
    expect(
      cmaSlugFromSentEvent({
        send_type: 'cma',
        email_key: 'cma:cma-1109-yapoah-bend',
        meta: { slug: 'cma-1109-yapoah-bend', transport: 'gmail' },
      }),
    ).toBe('cma-1109-yapoah-bend')
    expect(cmaSlugFromSentEvent({ send_type: 'newsletter', email_key: 'nl:1', meta: {} })).toBeNull()
  })
})
