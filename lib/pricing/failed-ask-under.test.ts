import { describe, expect, it } from 'vitest'
import {
  FAILED_ASK_BARE_STEP,
  priceUnderFailedAsk,
  recommendedAfterFailedAsk,
} from '@/lib/pricing/failed-ask-under'

describe('failed ask sits under the price that did not sell', () => {
  it('an expired whose comps reconcile at or above the last ask gets a recommended price under that ask', () => {
    const ask = 500_000
    const atAsk = recommendedAfterFailedAsk({ recommended: ask, lastAsk: ask })
    const overAsk = recommendedAfterFailedAsk({ recommended: 640_000, lastAsk: ask })
    expect(atAsk).toBe(ask - FAILED_ASK_BARE_STEP)
    expect(atAsk).toBeLessThan(ask)
    expect(overAsk).toBe(atAsk)
    expect(overAsk).toBeLessThan(ask)

    const longDom = recommendedAfterFailedAsk({
      recommended: 640_000,
      lastAsk: ask,
      facts: { daysOnMarket: 120, originalListPrice: ask },
    })
    const cut = recommendedAfterFailedAsk({
      recommended: 640_000,
      lastAsk: ask,
      facts: { daysOnMarket: 120, originalListPrice: 560_000 },
    })
    expect(longDom).toBeLessThan(ask)
    expect(longDom).toBe(priceUnderFailedAsk(ask, { daysOnMarket: 120, originalListPrice: ask }))
    expect(longDom).toBeLessThan(cut)
    expect(cut).toBeLessThan(ask)
    expect(ask - longDom).toBeLessThan(ask * 0.15)
    expect(longDom).toBeGreaterThan(ask * 0.85)
  })

  it('an expired whose comps are already under the ask is not discounted a second time', () => {
    const ask = 500_000
    const already = 470_000
    expect(recommendedAfterFailedAsk({ recommended: already, lastAsk: ask })).toBe(already)
    expect(
      recommendedAfterFailedAsk({
        recommended: already,
        lastAsk: ask,
        facts: { daysOnMarket: 180, originalListPrice: 620_000 },
      }),
    ).toBe(already)
  })
})
