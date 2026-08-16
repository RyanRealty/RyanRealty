import { describe, expect, it } from 'vitest'
import { GBP_REVIEW_URL } from '@/lib/brand/contact'
import { checkBrandVoice } from '@/lib/voice/check'
import {
  REVIEW_ASK_SUBJECT,
  buildReviewAskBody,
  isReviewAskDraft,
  shouldStageReviewAsk,
} from './review-ask'

describe('review-ask template', () => {
  it('includes the write-review URL and the address when present', () => {
    const body = buildReviewAskBody('123 NW Oregon Ave, Bend')
    expect(body).toContain(GBP_REVIEW_URL)
    expect(body).toContain('123 NW Oregon Ave, Bend')
    expect(body).not.toMatch(/[—–;!]/)
  })

  it('omits a blank address rather than inventing one', () => {
    expect(buildReviewAskBody('  ')).not.toContain('on  ')
    expect(buildReviewAskBody(null)).toContain(GBP_REVIEW_URL)
  })

  it('passes the runtime voice scanner', () => {
    const body = buildReviewAskBody('4125 SW Glacier Place')
    const result = checkBrandVoice({ subject: REVIEW_ASK_SUBJECT, body })
    expect(result.ok, result.violations.map((v) => v.term).join(' | ')).toBe(true)
  })

  it('recognizes only our staged draft', () => {
    expect(isReviewAskDraft({ subject: REVIEW_ASK_SUBJECT, body: buildReviewAskBody('x') })).toBe(true)
    expect(isReviewAskDraft({ subject: 'Hi', body: buildReviewAskBody('x') })).toBe(false)
    expect(isReviewAskDraft({ subject: REVIEW_ASK_SUBJECT, body: 'thanks' })).toBe(false)
  })
})

describe('shouldStageReviewAsk', () => {
  it('stages once when entering a closed stage with a person', () => {
    expect(
      shouldStageReviewAsk({ enteringClosedStage: true, wasAlreadyClosed: false, personId: 12 }),
    ).toBe(true)
  })

  it('refuses a re-entry, a missing person, and a non-close', () => {
    expect(
      shouldStageReviewAsk({ enteringClosedStage: true, wasAlreadyClosed: true, personId: 12 }),
    ).toBe(false)
    expect(
      shouldStageReviewAsk({ enteringClosedStage: true, wasAlreadyClosed: false, personId: null }),
    ).toBe(false)
    expect(
      shouldStageReviewAsk({ enteringClosedStage: false, wasAlreadyClosed: false, personId: 12 }),
    ).toBe(false)
  })
})
