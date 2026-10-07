import { describe, expect, it } from 'vitest'
import { applyFailedAskCap } from '@/lib/cma/expired-audit'
import { pinPrintedBandToSettingSales } from '@/lib/pricing/estimate'
import type { CmaPricingClamp } from '@/lib/cma/types'

const recentOff = new Date(Date.now() - 9 * 24 * 3600 * 1000).toISOString()

describe('915 Saginaw: list tiers stay ordered under a failed ask', () => {
  it('the second cap pass pulls the floor tier under with the list, never leaves it at ask minus one thousand', () => {
    const x = {
      conservative: 955_000,
      recommended: 1_092_000,
      highEnd: 1_175_000,
      valueLow: 915_000,
      valueHigh: 1_175_000,
      needsReview: false,
      reviewReason: null as string | null,
      notes: [] as string[],
      clamp: null as CmaPricingClamp | null,
    }
    applyFailedAskCap(x, { lastFailedListPrice: 925_000, offMarketDate: null })
    expect([x.conservative, x.recommended, x.highEnd]).toEqual([924_000, 924_000, 924_000])
    applyFailedAskCap(x, {
      lastFailedListPrice: 925_000,
      offMarketDate: recentOff,
      daysOnMarket: 138,
      originalListPrice: 1_050_000,
    })
    expect(x.recommended).toBe(911_000)
    expect(x.highEnd).toBe(911_000)
    expect(x.conservative).toBeLessThanOrEqual(x.recommended)
    expect(x.clamp!.applications.find((a) => a.tier === 'conservative')).toMatchObject({
      before: 955_000,
      after: 911_000,
      ratio: 911_000 / 925_000,
    })
  })

  it('pinning the band to the exact sales never lifts the floor tier above the list', () => {
    const pinned = pinPrintedBandToSettingSales(
      {
        valueLow: 915_000,
        valueHigh: 1_175_000,
        recommended: 915_000,
        conservative: 915_000,
        highEnd: 915_000,
        failedAsk: 925_000,
        rangeRule: {
          rule: 'min-max' as const,
          n: 5,
          kept: 5,
          adjustedLow: 915_000,
          adjustedHigh: 1_175_000,
          saleToAskRatio: 0.95815,
          saleToAskSource: 'city-index' as const,
          ratiosExcluded: 0,
          sentence: 'The range is the spread of all five sale prices adjusted for date and size: $915,000 to $1,175,000.',
        },
      },
      [
        { adjustedPrice: 1_113_820, closePrice: 1_100_000, weight: 40 },
        { adjustedPrice: 915_246, closePrice: 985_000, weight: 26.1 },
        { adjustedPrice: 1_035_398, closePrice: 955_000, weight: 12.1 },
        { adjustedPrice: 1_171_751, closePrice: 1_092_000, weight: 11.3 },
        { adjustedPrice: 993_921, closePrice: 962_000, weight: 10.5 },
      ],
    )
    expect(pinned.valueLow).toBe(915_246)
    expect(pinned.valueHigh).toBe(1_171_751)
    expect(pinned.recommended).toBe(915_000)
    expect(pinned.conservative).toBeLessThanOrEqual(pinned.recommended!)
    expect(pinned.highEnd).toBeGreaterThanOrEqual(pinned.recommended!)
  })
})
