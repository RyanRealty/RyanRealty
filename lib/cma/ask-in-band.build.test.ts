/**
 * The hold lib/cma/build.ts writes after the pin (SKILL.md rule 22, Matt
 * 2026-10-07), replayed on a pricing object with no database: the last
 * failed ask inside valueLow..valueHigh on an expired home makes the build a
 * hold for Matt, an ask under the band stays the existing failed-ask path,
 * and a home that did not fail its last cycle is never held here. The helper
 * under test is the one build.ts and the dry run call.
 */
import { describe, expect, it } from 'vitest'
import { applyAskInBandHold } from '@/lib/cma/gap-hold'
import { REVIEW_REASONS } from '@/lib/pricing/review'
import type { CmaPricing } from '@/lib/cma/types'

function pricingAfterPin(over: Partial<CmaPricing> = {}): CmaPricing {
  return {
    valueLow: 893_000,
    valueHigh: 951_000,
    recommended: 915_000,
    conservative: 893_000,
    highEnd: 951_000,
    needsReview: false,
    reviewReason: null,
    failedAsk: 925_000,
    clamp: null,
    hold: null,
    ...over,
  } as unknown as CmaPricing
}

describe('the ask-in-band hold on the built document (rule 22)', () => {
  it('holds an expired home whose failed ask sits inside the pinned band', () => {
    const p = applyAskInBandHold(pricingAfterPin(), { lastCycleFailed: true, lastListPrice: 925_000, auditVerdict: 'pass' })
    expect(p.needsReview).toBe(true)
    expect(p.hold?.kind).toBe('ask-in-band')
    expect(p.hold?.ask).toBe(925_000)
    expect(p.hold?.bandLow).toBe(893_000)
    expect(p.hold?.bandHigh).toBe(951_000)
    expect(p.reviewReason).toContain('The last ask of $925,000 sits inside the sales range of $893,000 to $951,000')
    expect(p.review?.reasons).toContain(REVIEW_REASONS.askInBand)
    expect(p.reviewReason).not.toMatch(/[—–]/)
  })

  it('keeps an earlier review reason and appends the hold', () => {
    const p = applyAskInBandHold(pricingAfterPin({ needsReview: true, reviewReason: 'The range is wider than usual.' }), {
      lastCycleFailed: true,
      lastListPrice: 925_000,
      auditVerdict: 'pass',
    })
    expect(p.reviewReason).toMatch(/^The range is wider than usual\. The last ask of \$925,000/)
  })

  it('reads the ask off the subject when the pricer carried none', () => {
    const p = applyAskInBandHold(pricingAfterPin({ failedAsk: null }), { lastCycleFailed: true, lastListPrice: 900_000, auditVerdict: 'pass' })
    expect(p.hold?.kind).toBe('ask-in-band')
    expect(p.hold?.ask).toBe(900_000)
  })

  it('does not hold an ask under the band: that is the existing failed-ask path', () => {
    const p = applyAskInBandHold(pricingAfterPin({ failedAsk: 880_000 }), { lastCycleFailed: true, lastListPrice: 880_000, auditVerdict: 'pass' })
    expect(p.hold ?? null).toBeNull()
    expect(p.needsReview).toBe(false)
  })

  it('does not hold an ask over the band: that is rule 16 pulling the list under it', () => {
    const p = applyAskInBandHold(pricingAfterPin({ failedAsk: 975_000 }), { lastCycleFailed: true, lastListPrice: 975_000, auditVerdict: 'pass' })
    expect(p.hold ?? null).toBeNull()
  })

  it('never holds a home whose last cycle did not fail', () => {
    const p = applyAskInBandHold(pricingAfterPin(), { lastCycleFailed: false, lastListPrice: 925_000, auditVerdict: 'pass' })
    expect(p.hold ?? null).toBeNull()
    expect(p.needsReview).toBe(false)
  })

  it('records whether it measured an ask against a band, held or not', () => {
    const held = applyAskInBandHold(pricingAfterPin(), { lastCycleFailed: true, lastListPrice: 925_000, auditVerdict: 'pass' })
    expect(held.askInBandMeasured).toBe(true)
    const above = applyAskInBandHold(pricingAfterPin({ failedAsk: 975_000 }), {
      lastCycleFailed: true,
      lastListPrice: 975_000,
      auditVerdict: 'pass',
    })
    expect(above.askInBandMeasured).toBe(true)
    expect(above.hold ?? null).toBeNull()
    const notFailed = applyAskInBandHold(pricingAfterPin(), { lastCycleFailed: false, lastListPrice: 925_000, auditVerdict: 'pass' })
    expect(notFailed.askInBandMeasured).toBe(false)
    const noAsk = applyAskInBandHold(pricingAfterPin({ failedAsk: null }), { lastCycleFailed: true, lastListPrice: null, auditVerdict: 'pass' })
    expect(noAsk.askInBandMeasured).toBe(false)
    const noBand = applyAskInBandHold(pricingAfterPin({ valueLow: 0 }), { lastCycleFailed: true, lastListPrice: 925_000, auditVerdict: 'pass' })
    expect(noBand.askInBandMeasured).toBe(false)
  })
})
