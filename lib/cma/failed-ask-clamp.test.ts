/**
 * The clamp the document never printed (tasteReview round three, §2 item 1).
 *
 * On cma-65365-concorde the reconciliation's own weights carry to $1,972,665
 * and the document printed $1,473,000 — the $1,500,000 failed ask times the
 * failed-then-sold p75 — with nothing between the two. These tests hold the
 * connection: whenever the ceiling binds, `pricing.clamp` says what the sales
 * supported, what they were held to, the measured basis, and one sentence a
 * seller can read. When it does not bind, the field is null.
 */
import { describe, expect, it } from 'vitest'
import { applyFailedAskCap, FAILED_ASK_BACKTEST } from './expired-audit'
import type { CmaPricing } from './types'

const recentOff = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString()
const staleOff = new Date(Date.now() - 400 * 24 * 3600 * 1000).toISOString()

type Clampable = Pick<
  CmaPricing,
  'conservative' | 'recommended' | 'highEnd' | 'needsReview' | 'reviewReason' | 'notes' | 'clamp'
>

function p(over: Partial<Clampable> = {}): Clampable {
  return {
    conservative: 0,
    recommended: 0,
    highEnd: 0,
    needsReview: false,
    reviewReason: null,
    notes: [],
    ...over,
  }
}

describe('pricing.clamp — the failed-ask ceiling, on render_args', () => {
  it('binds on the Concorde shape and prints what overrode the method', () => {
    // The live figures: the weighted reconciliation carries to $1,973,000, the
    // ask that failed was $1,500,000, and the p75 ceiling is $1,473,000.
    const x = p({ conservative: 1390000, recommended: 1973000, highEnd: 1930000 })
    const r = applyFailedAskCap(x, { lastFailedListPrice: 1500000, offMarketDate: recentOff })

    expect(r.applied).toBe(true)
    expect(x.recommended).toBe(1473000)
    const clamp = x.clamp
    expect(clamp).not.toBeNull()
    expect(clamp!.kind).toBe('failed-ask')
    expect(clamp!.appliedTo).toBe('recommended')
    expect(clamp!.before).toBe(1973000)
    expect(clamp!.after).toBe(1473000)
    expect(clamp!.basis.ratio).toBe(FAILED_ASK_BACKTEST.closeP75Ratio)
    expect(clamp!.basis.source).toContain(FAILED_ASK_BACKTEST.pairs.toLocaleString('en-US'))
    expect(clamp!.basis.source).toContain(FAILED_ASK_BACKTEST.runstamp)
    // Every tier the ceiling moved is recorded, not only the headline one.
    // The conservative tier sat below its own ceiling ($1,413,000) and is
    // therefore absent: a clamp records what it moved, never what it allowed.
    expect(clamp!.applications.map((a) => a.tier).sort()).toEqual(['highEnd', 'recommended'])
    expect(clamp!.applications.find((a) => a.tier === 'highEnd')).toMatchObject({
      before: 1930000,
      after: 1500000,
      ratio: 1,
    })
  })

  it('the sentence names both numbers, the failed ask, and the corpus', () => {
    const x = p({ conservative: 1390000, recommended: 1973000, highEnd: 1930000 })
    applyFailedAskCap(x, { lastFailedListPrice: 1500000, offMarketDate: recentOff })
    const s = x.clamp!.sentence
    expect(s).toContain('$1,973,000')
    expect(s).toContain('$1,500,000')
    expect(s).toContain('$1,473,000')
    expect(s).toContain('75th percentile')
    expect(s).toContain('3,394')
    // Seller language, not engine language.
    expect(s).not.toMatch(/\b(clamp|cap|quantile|p75|comp|comps|subject)\b/i)
  })

  it('is null when the ceiling does not bind', () => {
    const x = p({ conservative: 590000, recommended: 610000, highEnd: 640000 })
    const r = applyFailedAskCap(x, { lastFailedListPrice: 715000, offMarketDate: recentOff })
    expect(r.applied).toBe(false)
    expect(x.clamp).toBeNull()
  })

  it('is null when there is no failed ask at all', () => {
    const x = p({ conservative: 590000, recommended: 610000, highEnd: 640000 })
    applyFailedAskCap(x, { lastFailedListPrice: null, offMarketDate: recentOff })
    expect(x.clamp).toBeNull()
  })

  it('a stale failure clamps at the ask itself and says so without a percentile', () => {
    const x = p({ conservative: 780000, recommended: 800000, highEnd: 830000 })
    applyFailedAskCap(x, { lastFailedListPrice: 600000, offMarketDate: staleOff })
    const clamp = x.clamp!
    expect(clamp.basis.ratio).toBe(1)
    expect(clamp.appliedTo).toBe('recommended')
    expect(clamp.before).toBe(800000)
    expect(clamp.after).toBe(600000)
    expect(clamp.sentence).toContain('$800,000')
    expect(clamp.sentence).toContain('$600,000')
    expect(clamp.sentence).not.toContain('percentile')
  })

  it('the ask ceiling then the recent ceiling report ONE distance, from the evidence', () => {
    // The order the build applies them: lib/pricing/estimate.ts clips to the
    // ask with no off-market date, then lib/cma/build.ts re-applies with the
    // real one. `before` must stay the figure the sales supported.
    const x = p({ conservative: 1390000, recommended: 1973000, highEnd: 1930000 })
    applyFailedAskCap(x, { lastFailedListPrice: 1500000, offMarketDate: null })
    expect(x.clamp!.before).toBe(1973000)
    expect(x.clamp!.after).toBe(1500000)
    applyFailedAskCap(x, { lastFailedListPrice: 1500000, offMarketDate: recentOff })
    expect(x.clamp!.before).toBe(1973000)
    expect(x.clamp!.after).toBe(1473000)
    expect(x.clamp!.applications.find((a) => a.tier === 'recommended')!.before).toBe(1973000)
  })

  it('the review reason names the evidence, not the previous application of itself', () => {
    const x = p({ conservative: 1390000, recommended: 1973000, highEnd: 1930000 })
    applyFailedAskCap(x, { lastFailedListPrice: 1500000, offMarketDate: null })
    applyFailedAskCap(x, { lastFailedListPrice: 1500000, offMarketDate: recentOff })
    // "supported $1,500,000 against the $1,500,000 asking that just failed" is
    // the first pass's own output described as evidence. It shipped on
    // cma-65365-concorde and on cma-2465-7th-redmond-97756.
    expect(x.reviewReason).toContain('supported $1,973,000 against the $1,500,000 asking that just failed')
    expect(x.reviewReason).not.toContain('supported $1,500,000 against the $1,500,000')
    expect(x.reviewReason!.match(/Comp evidence supported/g)).toHaveLength(1)
    // And the seller-facing note is written once, not once per application.
    expect(x.notes.filter((n) => n.includes('did not sell'))).toHaveLength(1)
  })

  it('names the high end when only the high end moved', () => {
    // Below both quantile ceilings, above the ask itself.
    const x = p({ conservative: 400000, recommended: 460000, highEnd: 530000 })
    applyFailedAskCap(x, { lastFailedListPrice: 500000, offMarketDate: recentOff })
    expect(x.recommended).toBe(460000)
    expect(x.highEnd).toBe(500000)
    expect(x.clamp!.appliedTo).toBe('highEnd')
    expect(x.clamp!.basis.ratio).toBe(1)
    expect(x.clamp!.applications).toHaveLength(1)
  })
})
