/**
 * `pricing.review` — the flag a document must not be able to hide.
 *
 * The rule these tests hold: whenever the engine set `needsReview`, the block
 * says so and carries at least one reason; and no reason it carries is engine
 * prose. cma-19968's own reviewReason contained "indefensible" and reached no
 * surface at all.
 */
import { describe, expect, it } from 'vitest'
import { buildPricingReview, REVIEW_REASONS } from './review'
import type { CmaPricingClamp } from '@/lib/cma/types'

const clamp: CmaPricingClamp = {
  kind: 'failed-ask',
  appliedTo: 'recommended',
  before: 1947000,
  after: 1473000,
  basis: { ratio: 0.982, source: 'x' },
  applications: [{ tier: 'recommended', before: 1947000, after: 1473000, ratio: 0.982 }],
  sentence: 's',
}

describe('buildPricingReview', () => {
  it('a clean build carries the block with the flag down and no reasons', () => {
    const r = buildPricingReview({ needsReview: false, reviewReason: null, auditVerdict: 'pass' })
    expect(r).toEqual({ needsReview: false, reasons: [], auditVerdict: 'pass' })
  })

  it('the document is never quieter than the queue', () => {
    // cma-19968's stored row: the engine flag is down and the adversarial
    // audit's verdict is `review`, which /admin/cmas renders as `flagged`.
    // The banner has to agree with the pill.
    for (const verdict of ['fail', 'review', 'did-not-run'] as const) {
      const r = buildPricingReview({ needsReview: false, reviewReason: null, auditVerdict: verdict })
      expect(r.needsReview).toBe(true)
      expect(r.reasons.length).toBeGreaterThan(0)
    }
  })

  it('a flagged build always carries at least one reason', () => {
    const r = buildPricingReview({ needsReview: true, reviewReason: null, auditVerdict: null })
    expect(r.needsReview).toBe(true)
    expect(r.reasons).toEqual([REVIEW_REASONS.other])
  })

  it('reads the Concorde reviewReason into its two real causes', () => {
    const r = buildPricingReview({
      needsReview: true,
      reviewReason:
        'Comparable sales span a wide price-per-square-foot range ($368 to $829/sqft, 28% variation). ' +
        'The set mixes different quality or location tiers, so a broker should confirm the comp selection ' +
        'before this goes to a client. Comp evidence supported $1,947,000 against the $1,500,000 asking ' +
        'that just failed. List tiers clamped to the failed-ask backtest quantiles.',
      clamp,
      auditVerdict: 'pass',
    })
    expect(r.reasons).toEqual([REVIEW_REASONS.dispersion, REVIEW_REASONS.failedAskCeiling])
  })

  it('never lets the engine wording through, whatever the audit wrote', () => {
    const r = buildPricingReview({
      needsReview: true,
      reviewReason:
        'The $443,000 recommendation sits far above the machine-adjusted values of the three comps the ' +
        'analysis actually kept, which makes the recommendation indefensible.',
      auditVerdict: 'review',
    })
    const prose = r.reasons.join(' ')
    expect(prose).not.toMatch(/indefensible|machine-adjusted|\bcomps?\b|\$443,000/i)
    expect(r.reasons).toContain(REVIEW_REASONS.auditFindings)
  })

  it('an audit that never ran is its own reason', () => {
    const r = buildPricingReview({ needsReview: true, reviewReason: null, auditVerdict: 'did-not-run' })
    expect(r.reasons).toEqual([REVIEW_REASONS.auditMissing])
    expect(r.auditVerdict).toBe('did-not-run')
  })

  it('the clamp alone raises the ceiling reason, with no matching prose', () => {
    const r = buildPricingReview({ needsReview: true, reviewReason: 'something else', clamp, auditVerdict: 'pass' })
    expect(r.reasons).toEqual([REVIEW_REASONS.failedAskCeiling])
  })

  it('every reason is seller-safe prose', () => {
    for (const reason of Object.values(REVIEW_REASONS)) {
      expect(reason).not.toMatch(/[—–;]/)
      expect(reason).not.toMatch(/\b(comp|comps|subject|band|tier|quantile|backtest|cv|dispersion)\b/i)
      expect(reason.endsWith('.')).toBe(true)
    }
  })
})

describe('a flagged row cannot present as ready', () => {
  it('resolveCmaQueueState sends every needsReview row to flagged', async () => {
    const { resolveCmaQueueState } = await import('@/lib/data/cma/unified-queue')
    const base = {
      status: 'draft',
      archivedAt: null,
      buildError: null,
      hasDocument: true,
      deliveredAt: null,
      emailSentAt: null,
      queuedAt: null,
    }
    expect(resolveCmaQueueState({ ...base, needsReview: true, auditVerdict: 'pass' })).toBe('flagged')
    expect(resolveCmaQueueState({ ...base, needsReview: false, auditVerdict: 'pass' })).toBe('ready')
  })

  it('a flagged row is not sendable', async () => {
    const { isSendableQueueState } = await import('@/lib/data/cma/unified-queue')
    expect(isSendableQueueState('flagged')).toBe(false)
    expect(isSendableQueueState('ready')).toBe(true)
  })
})
