/**
 * `pricing.review` — the flag a document must not be able to hide.
 *
 * The rule these tests hold: whenever the engine set `needsReview`, the block
 * says so and carries at least one reason; and no reason it carries is engine
 * prose. cma-19968's own reviewReason contained "indefensible" and reached no
 * surface at all.
 */
import { describe, expect, it } from 'vitest'
import {
  RENDERER_NOTICE,
  RANGE_REVIEW_SHARE,
  buildPricingReview,
  confidenceForVerdict,
  rangeWiderThanShare,
  REVIEW_REASONS,
} from './review'
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
    expect(r).toEqual({
      needsReview: false,
      reasons: [],
      auditVerdict: 'pass',
      severity: 'none',
      rendererNotice: null,
    })
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

  it('a fail verdict is blocked, everything else that needs a broker is review', () => {
    expect(buildPricingReview({ needsReview: false, reviewReason: null, auditVerdict: 'fail' }).severity).toBe('blocked')
    // The engine flag cannot talk a failed audit down to a softer word.
    expect(buildPricingReview({ needsReview: true, reviewReason: null, auditVerdict: 'fail' }).severity).toBe('blocked')
    for (const verdict of ['review', 'did-not-run'] as const) {
      expect(buildPricingReview({ needsReview: false, reviewReason: null, auditVerdict: verdict }).severity).toBe('review')
    }
    expect(buildPricingReview({ needsReview: true, reviewReason: null, auditVerdict: 'pass' }).severity).toBe('review')
    expect(buildPricingReview({ needsReview: false, reviewReason: null, auditVerdict: 'pass' }).severity).toBe('none')
  })

  it('carries one seller-safe sentence a letter or a PDF can print', () => {
    const blocked = buildPricingReview({ needsReview: true, reviewReason: null, auditVerdict: 'fail' })
    expect(blocked.rendererNotice).toBe(RENDERER_NOTICE.blocked)
    const review = buildPricingReview({ needsReview: true, reviewReason: null, auditVerdict: 'pass' })
    expect(review.rendererNotice).toBe(RENDERER_NOTICE.review)
    expect(buildPricingReview({ needsReview: false, reviewReason: null, auditVerdict: 'pass' }).rendererNotice).toBeNull()
    for (const notice of Object.values(RENDERER_NOTICE)) {
      expect(notice).not.toMatch(/[—–;]/)
      expect(notice).not.toMatch(/\b(comp|comps|audit|verdict|indefensible|dispersion)\b/i)
      expect(notice.endsWith('.')).toBe(true)
    }
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


/**
 * Round four, class C: cma-19968 stamped confidence "High" in the same object
 * that carried `verdict: 'fail'` and three critical findings. Confidence is a
 * claim about how much the reader may lean on the number, and the refuter's
 * verdict outranks the dispersion statistic that produced it.
 */
describe('confidenceForVerdict', () => {
  it('a failed audit can never read High', () => {
    expect(confidenceForVerdict('High', 'fail').confidence).toBe('Supportable')
    expect(confidenceForVerdict('Moderate', 'fail').confidence).toBe('Supportable')
    expect(confidenceForVerdict('Supportable', 'fail').confidence).toBe('Supportable')
  })

  it('a review or a missing audit holds High down to Moderate', () => {
    expect(confidenceForVerdict('High', 'review').confidence).toBe('Moderate')
    expect(confidenceForVerdict('High', 'did-not-run').confidence).toBe('Moderate')
    expect(confidenceForVerdict('Moderate', 'review').confidence).toBe('Moderate')
  })

  it('a clean pass leaves the engine figure alone', () => {
    expect(confidenceForVerdict('High', 'pass')).toEqual({ confidence: 'High', reason: null })
    expect(confidenceForVerdict('High', null)).toEqual({ confidence: 'High', reason: null })
  })

  it('never silently downgrades: the reason names what moved it, seller-safe', () => {
    const r = confidenceForVerdict('High', 'fail')
    expect(r.reason).toBeTruthy()
    expect(r.reason!).not.toMatch(/[—–;]/)
    expect(r.reason!).not.toMatch(/indefensible|verdict|comp\b/i)
  })

  it('never raises a confidence the engine did not give', () => {
    expect(confidenceForVerdict('Supportable', 'pass').confidence).toBe('Supportable')
    expect(confidenceForVerdict('Moderate', 'did-not-run').confidence).toBe('Moderate')
  })
})

describe('the value range and the broker (Matt 2026-09-09: cap it and force review)', () => {
  it("Blake's 1617 NW 8th, $699,000 to $932,000 around $816,000, is wide on both sides", () => {
    const r = rangeWiderThanShare({ recommended: 816000, valueLow: 699000, valueHigh: 932000 })
    expect(r.wide).toBe(true)
    expect(r.lowShare).toBeCloseTo(0.143, 3)
    expect(r.highShare).toBeCloseTo(0.142, 3)
  })

  it("Avery's 2465 NE 7th, $412,000 to $443,000 around $435,000, is inside the share", () => {
    const r = rangeWiderThanShare({ recommended: 435000, valueLow: 412000, valueHigh: 443000 })
    expect(r.wide).toBe(false)
    expect(RANGE_REVIEW_SHARE).toBe(0.08)
  })

  it('one wide side is enough, and a swapped low/high still reads', () => {
    expect(rangeWiderThanShare({ recommended: 500000, valueLow: 480000, valueHigh: 560000 }).wide).toBe(true)
    expect(rangeWiderThanShare({ recommended: 500000, valueLow: 530000, valueHigh: 470000 }).wide).toBe(false)
    expect(rangeWiderThanShare({ recommended: 0, valueLow: 1, valueHigh: 2 }).wide).toBe(false)
  })

  it('the contract detail maps to the seller sentence', () => {
    const r = buildPricingReview({
      needsReview: true,
      reviewReason: 'The value range is wider than 8% of the recommended list on a side: $699,000 to $932,000 around $816,000.',
      auditVerdict: 'pass',
    })
    expect(r.reasons).toEqual([REVIEW_REASONS.rangeWidth])
    expect(r.severity).toBe('review')
  })
})
