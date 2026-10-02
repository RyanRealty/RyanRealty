import { describe, expect, it } from 'vitest'
import { applyFailedAskCap } from '@/lib/cma/expired-audit'
import { finishRecommendedAfterActives } from '@/lib/cma/finish-recommended'
import { letterRecommendDollarsCheck } from '@/lib/cma/letter-consistency'
import { pricingPage } from '@/lib/cma/render-pricing-page'
import { nudgeRecommendedDownForHighDomActives } from '@/lib/pricing/active-dom-nudge'
import type { CmaPricing, CmaPricingClamp, CmaSubject } from '@/lib/cma/types'

/**
 * Marshmallow (cma-19318-marshmallow): the failed-ask clamp wrote
 * "recommend listing at $933,000", then sitting actives lowered the rec.
 * The letter failed letter-one-recommend-price on the stale $933,000.
 */
const recentOff = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString()

const subject = {
  streetAddress: '19318 Marshmallow',
  city: 'Bend',
  subdivision: 'Lodges at Bachelor Village',
  standardStatus: 'Expired',
  sqft: 2400,
  yearBuilt: 2008,
} as CmaSubject

function capped() {
  const pricing: {
    conservative: number
    recommended: number
    highEnd: number
    valueLow: number
    valueHigh: number
    needsReview: boolean
    reviewReason: string | null
    notes: string[]
    clamp: CmaPricingClamp | null
  } = {
    conservative: 925_000,
    recommended: 980_000,
    highEnd: 1_050_000,
    valueLow: 925_000,
    valueHigh: 1_100_000,
    needsReview: false,
    reviewReason: null,
    notes: [],
    clamp: null,
  }
  applyFailedAskCap(pricing, { lastFailedListPrice: 950_000, offMarketDate: recentOff })
  return pricing
}

describe('Marshmallow recommend sentence follows the actives step', () => {
  it('rewrites the clamp to the final rec in the same order the build uses', () => {
    const pricing = capped()
    expect(pricing.recommended).toBe(949_000)
    expect(pricing.recommended).toBeLessThan(950_000)
    expect(pricing.clamp?.sentence).toContain('stays under that ask')
    expect(pricing.clamp?.sentence).not.toContain('75th percentile')
    expect(pricing.clamp?.sentence).not.toContain('$949,000')
    expect(pricing.clamp?.after).toBe(949_000)

    const actives = [{ status: 'Active', listPrice: 1_020_000, daysOnMarket: 90 }]
    const nudgeOnly = nudgeRecommendedDownForHighDomActives({
      recommended: pricing.recommended,
      bandLow: pricing.valueLow,
      bandHigh: pricing.valueHigh,
      actives,
    })
    expect(nudgeOnly.recommended).toBe(931_000)
    const stale = { ...pricing, recommended: nudgeOnly.recommended }
    const staleHtml = pricingPage({
      subject,
      comps: [],
      market: null,
      pricing: stale as unknown as CmaPricing,
    }).body
    expect(staleHtml).toContain('stays under that ask')
    expect(staleHtml).not.toContain('under that ceiling')
    expect(letterRecommendDollarsCheck(staleHtml, stale).pass).toBe(true)

    const finished = finishRecommendedAfterActives(pricing, {
      actives,
      pocketClosedSupport: 900_000,
    })
    expect(finished.recommended).toBe(931_000)
    expect(finished.clamp?.after).toBe(931_000)
    expect(finished.clamp?.applications.find((a) => a.tier === 'recommended')?.after).toBe(931_000)
    expect(finished.clamp?.sentence).toContain('stays under that ask')
    expect(finished.clamp?.sentence).not.toContain('75th percentile')
    expect(finished.clamp?.sentence).not.toContain('$949,000')
    expect(finished.clamp?.sentence).not.toContain('$931,000')
    expect(finished.clamp?.sentence).not.toContain('that price')
    expect(finished.clamp?.sentence).not.toMatch(/[—–]/)

    const html = pricingPage({
      subject,
      comps: [],
      market: null,
      pricing: finished as unknown as CmaPricing,
    }).body
    expect(html).not.toContain('$949,000')
    expect(html).toContain('stays under that ask')
    expect(html).not.toContain('that price which is the 75th')
    const check = letterRecommendDollarsCheck(html, finished)
    expect(check.pass).toBe(true)
    expect(check.id).toBe('letter-one-recommend-price')
  })
})
