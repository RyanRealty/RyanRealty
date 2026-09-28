import { describe, expect, it } from 'vitest'
import {
  DELIBERATE_BUILD_LABEL,
  buildErrorCodeFromMessage,
  classifyBuildError,
  cmaBuildFailureLead,
  cmaDetailBadgeLabel,
  mergeBuildErrorCode,
} from '@/lib/cma/build-error-code'
import { CMA_QUEUE_STATE_LABEL } from '@/lib/cma/queue-view'

const SHORTAGE = 'Found 2 of the 3 closed sales this home needs to be priced.'
const UNSTABLE =
  'JUDGE_UNSTABLE. The comparability review did not agree on whether this home has enough kept sales. 1 of 6 stayed in every pass and 4 if every split sale is kept, and this home needs 3. The build was not priced.'

describe('classifyBuildError', () => {
  it('reads a stored code without needing the message', () => {
    expect(classifyBuildError('anything', { build_error_code: 'COMP_SHORTAGE' })).toBe('COMP_SHORTAGE')
    expect(classifyBuildError(null, { build_error_code: 'JUDGE_UNSTABLE' })).toBe('JUDGE_UNSTABLE')
  })

  it('lets the stored code win over a conflicting message', () => {
    expect(classifyBuildError(UNSTABLE, { build_error_code: 'COMP_SHORTAGE' })).toBe('COMP_SHORTAGE')
  })

  it('ignores an unknown stored code and falls through to the message', () => {
    expect(classifyBuildError(SHORTAGE, { build_error_code: 'NOPE' })).toBe('COMP_SHORTAGE')
    expect(classifyBuildError('subject not resolved', { build_error_code: '' })).toBeNull()
  })

  it('classifies a comp shortage from the message when no code is stored', () => {
    expect(classifyBuildError(SHORTAGE, null)).toBe('COMP_SHORTAGE')
    expect(classifyBuildError(SHORTAGE, {})).toBe('COMP_SHORTAGE')
    expect(
      buildErrorCodeFromMessage(
        'Not enough sales of the same product type to price this home. 1 of 8 candidates matched, and this home needs 3.',
      ),
    ).toBe('COMP_SHORTAGE')
    expect(
      buildErrorCodeFromMessage(
        'Not enough comparable sales the review would keep. 2 of 7 stayed, and this home needs 3.',
      ),
    ).toBe('COMP_SHORTAGE')
    expect(
      buildErrorCodeFromMessage(
        'facts path: only 2 apples-to-apples sale(s) after the full pricing ladder (minimum 3).',
      ),
    ).toBe('COMP_SHORTAGE')
    expect(
      buildErrorCodeFromMessage(
        'listings path: the widest tier walked returned 4 candidate row(s). This subject has no comparable sales on record.',
      ),
    ).toBe('COMP_SHORTAGE')
  })

  it('classifies JUDGE_UNSTABLE only when the message starts with that token', () => {
    expect(classifyBuildError(UNSTABLE, null)).toBe('JUDGE_UNSTABLE')
    expect(
      classifyBuildError(
        'JUDGE_UNSTABLE. The stored comparability review did not agree on enough kept sales. The build was not priced.',
        null,
      ),
    ).toBe('JUDGE_UNSTABLE')
    expect(classifyBuildError('the log mentioned JUDGE_UNSTABLE later', null)).toBeNull()
  })

  it('leaves a real crash unclassified', () => {
    expect(classifyBuildError('subject not resolved', null)).toBeNull()
    expect(classifyBuildError('Pricing could not be computed (subject sqft missing).', {})).toBeNull()
    expect(classifyBuildError('Accuracy contract failed: min-comps: short', null)).toBeNull()
    expect(classifyBuildError(null, null)).toBeNull()
    expect(classifyBuildError('   ', { pricing: { recommended: 10 } })).toBeNull()
  })
})

describe('mergeBuildErrorCode', () => {
  it('sets the code and keeps the previous letter summary fields', () => {
    const prior = {
      builder: 'deterministic',
      pricing: { recommended: 640000 },
      judge_cache: { inputChecksum: 'abc', keptKeys: ['k1'] },
      public_listing_read: { show: false },
      audit: { verdict: 'pass' },
    }
    const next = mergeBuildErrorCode(prior, 'COMP_SHORTAGE')
    expect(next.build_error_code).toBe('COMP_SHORTAGE')
    expect(next.pricing).toEqual(prior.pricing)
    expect(next.judge_cache).toEqual(prior.judge_cache)
    expect(next.public_listing_read).toEqual(prior.public_listing_read)
    expect(next.audit).toEqual(prior.audit)
    expect(next).not.toHaveProperty('html_path')
    expect(prior).not.toHaveProperty('build_error_code')
  })

  it('clears a previous deliberate code on a real crash', () => {
    const next = mergeBuildErrorCode(
      { pricing: { recommended: 1 }, build_error_code: 'JUDGE_UNSTABLE' },
      null,
    )
    expect(next.build_error_code).toBeNull()
    expect(next.pricing).toEqual({ recommended: 1 })
  })
})

describe('admin badge labels', () => {
  it('names the two deliberate outcomes and leaves a crash on the old failure lead', () => {
    expect(DELIBERATE_BUILD_LABEL.COMP_SHORTAGE).toBe('Comp shortage')
    expect(DELIBERATE_BUILD_LABEL.JUDGE_UNSTABLE).toBe('Comps unstable')
    expect(cmaBuildFailureLead(SHORTAGE, null)).toBe('Comp shortage')
    expect(cmaBuildFailureLead(UNSTABLE, null)).toBe('Comps unstable')
    expect(cmaBuildFailureLead('subject not resolved', null)).toBe('last build failed')
  })

  it('shows the deliberate label on an unsent detail badge and keeps a sent status', () => {
    expect(
      cmaDetailBadgeLabel({
        status: 'draft',
        buildError: SHORTAGE,
        buildSummary: null,
        deliveredAt: null,
      }),
    ).toBe('Comp shortage')
    expect(
      cmaDetailBadgeLabel({
        status: 'draft',
        buildError: UNSTABLE,
        buildSummary: { build_error_code: 'JUDGE_UNSTABLE' },
        deliveredAt: null,
      }),
    ).toBe('Comps unstable')
    expect(
      cmaDetailBadgeLabel({
        status: 'draft',
        buildError: 'subject not resolved',
        buildSummary: null,
        deliveredAt: null,
      }),
    ).toBe('draft')
    expect(
      cmaDetailBadgeLabel({
        status: 'delivered',
        buildError: SHORTAGE,
        buildSummary: { build_error_code: 'COMP_SHORTAGE' },
        deliveredAt: '2026-09-28T20:02:00.000Z',
      }),
    ).toBe('delivered')
  })

  it('uses the same words on the queue state label', () => {
    expect(CMA_QUEUE_STATE_LABEL['comp-shortage']).toBe('Comp shortage')
    expect(CMA_QUEUE_STATE_LABEL['comps-unstable']).toBe('Comps unstable')
    expect(CMA_QUEUE_STATE_LABEL.failed).toBe('Build failed')
    expect(CMA_QUEUE_STATE_LABEL.bounced).toBe('Bounced')
  })
})
