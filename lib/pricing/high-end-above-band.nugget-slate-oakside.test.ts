import { describe, expect, it } from 'vitest'
import { applyEngineRecommendedList } from '@/lib/pricing/estimate'
import { highEndAtOrBelowBandCheck } from '@/lib/cma/letter-consistency'
import type { CmaPricing } from '@/lib/cma/types'

function board(over: Partial<CmaPricing> = {}): CmaPricing {
  return {
    conservative: 0,
    recommended: 0,
    highEnd: 0,
    valueLow: 0,
    valueHigh: 0,
    predictedClose: null,
    confidence: 'High',
    confidenceReason: '',
    needsReview: false,
    reviewReason: null,
    notes: [],
    ...over,
  } as CmaPricing
}

describe('high end at or below the band — Nugget / Slate / Oakside', () => {
  it('Nugget shape: $1,034k high clamps to the $1,000k band top', () => {
    const cover = applyEngineRecommendedList(
      board({ conservative: 900_000, recommended: 950_000, highEnd: 1_034_000, valueLow: 900_000, valueHigh: 1_000_000 }),
      {
        recommendedList: 950_000,
        predictedClose: 930_000,
        conservativeList: 900_000,
        highEndList: 1_034_000,
        source: 'comps',
        rangeRule: {
          rule: 'min-max',
          n: 5,
          kept: 5,
          adjustedLow: 900_000,
          adjustedHigh: 1_000_000,
          saleToAskRatio: null,
          saleToAskSource: 'none',
          ratiosExcluded: 0,
          sentence: '',
        },
      },
    )
    expect(cover.highEnd).toBeLessThanOrEqual(cover.valueHigh)
    expect(cover.highEnd).toBe(1_000_000)
    expect(highEndAtOrBelowBandCheck(cover).pass).toBe(true)
  })

  it('Slate and Oakside shapes: aspirational cannot sit above the printed band', () => {
    const slate = highEndAtOrBelowBandCheck({ highEnd: 644_000, valueLow: 594_000, valueHigh: 623_000 })
    expect(slate.pass).toBe(false)
    const oakside = highEndAtOrBelowBandCheck({ highEnd: 520_000, valueLow: 448_000, valueHigh: 505_000 })
    expect(oakside.pass).toBe(false)
    const clamped = highEndAtOrBelowBandCheck({ highEnd: 505_000, valueLow: 448_000, valueHigh: 505_000 })
    expect(clamped.pass).toBe(true)
  })
})
