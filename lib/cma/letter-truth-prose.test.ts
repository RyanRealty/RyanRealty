/**
 * Letter prose must match the final list, the last ask, and the printed grid.
 * Shapes are anonymized from the Sep 27 batch. No owner names.
 */
import { describe, expect, it } from 'vitest'
import { askAgainstRangeSentence, askStoryReading } from '@/lib/cma/ask-story'
import { failedAskBelowRangeNote, failedAskClampProse } from '@/lib/cma/expired-audit'
import { adjustmentMoveClause, keptSaleCount } from '@/lib/cma/render-pricing-page'
import { describeRangeSentence, salesForBandEndpoints } from '@/lib/pricing/estimate'
import type { CmaAdjustedComp, CmaPricing } from '@/lib/cma/types'

describe('failed-ask sentence is true to the final list', () => {
  it('Grand Targhee shape: $527k is not the 75th percentile of a $555k ask', () => {
    const sentence = failedAskClampProse({
      supported: 565_000,
      ask: 555_000,
      ceiling: 545_000,
      rec: 527_000,
      percentile: true,
    })
    expect(sentence).toContain('$555,000')
    expect(sentence).toContain('under that ceiling')
    expect(sentence).not.toContain('price on the cover, the 75th percentile')
    expect(sentence).not.toContain('that price')
    expect(sentence).not.toContain('$527,000')
    expect(sentence).not.toMatch(/—/)
  })

  it('Sage Stone shape: band-floor list is under the ask and is not the percentile', () => {
    const sentence = failedAskClampProse({
      supported: 936_000,
      ask: 920_000,
      ceiling: 910_000,
      rec: 910_000,
      percentile: true,
    })
    expect(sentence).toContain('$920,000')
    expect(sentence).toContain('stays under that ask')
    expect(sentence).not.toContain('75th percentile')
    expect(sentence).not.toContain('that price')
  })

  it('names the percentile only when the printed list still is that ceiling', () => {
    const sentence = failedAskClampProse({
      supported: 1_973_000,
      ask: 1_500_000,
      ceiling: 1_473_000,
      rec: 1_473_000,
      percentile: true,
    })
    expect(sentence).toContain('price on the cover, the 75th percentile')
    expect(sentence).toContain('$1,500,000')
  })
})

describe('range sentence counts the sales that set the ends', () => {
  it('does not say all five when three sales set the ends', () => {
    const sentence = describeRangeSentence({
      rule: 'min-max',
      n: 5,
      kept: 3,
      printedLow: 1_120_000,
      printedHigh: 1_195_000,
      saleLow: 1_120_000,
      saleHigh: 1_195_000,
      suffix: ' The range is those adjusted sale prices.',
    })
    expect(sentence).toContain('three of the five')
    expect(sentence).not.toMatch(/the three of the five/)
    expect(sentence).not.toContain('all five')
    expect(sentence).toContain('$1,120,000 to $1,195,000')
  })

  it('Grand Targhee shape: a printed comp below the band is not called the spread', () => {
    const sentence = describeRangeSentence({
      rule: 'min-max',
      n: 5,
      kept: 4,
      printedLow: 500_000,
      printedHigh: 565_000,
      saleLow: 489_000,
      saleHigh: 565_000,
      suffix: '',
    })
    expect(sentence).toContain('run from $489,000 to $565,000')
    expect(sentence).toContain('The printed range is $500,000 to $565,000')
    expect(sentence).not.toContain('all five sale prices adjusted')
  })

  it('Foxborough shape: an opened band is not the sale spread', () => {
    const sentence = describeRangeSentence({
      rule: 'min-max',
      n: 5,
      kept: 5,
      printedLow: 537_000,
      printedHigh: 566_000,
      saleLow: 545_000,
      saleHigh: 560_000,
      suffix: '',
    })
    expect(sentence).toContain('run from $545,000 to $560,000')
    expect(sentence).toContain('The printed range is $537,000 to $566,000')
  })
})

describe('the grid count and which sales moved', () => {
  const comp = (over: Partial<CmaAdjustedComp>): CmaAdjustedComp =>
    ({
      address: '1 Test St',
      closePrice: 500_000,
      adjustedPrice: 500_000,
      timeAdjustment: 0,
      sizeAdjustment: 0,
      ...over,
    }) as CmaAdjustedComp

  it('Downey shape: four printed rows are four, not rangeRule.kept of three', () => {
    const comps = [0, 1, 2, 3].map((i) => comp({ address: `${i} Grid St`, listingKey: `k${i}` }))
    const pricing = {
      rangeRule: { rule: 'min-max', n: 4, kept: 3, sentence: 'stale' },
    } as unknown as CmaPricing
    expect(keptSaleCount(pricing, comps)).toBe(4)
  })

  it('says how many moved for date when only some did', () => {
    const comps = [
      comp({ timeAdjustment: -12_000 }),
      comp({ timeAdjustment: -4_000 }),
      comp({ timeAdjustment: 0 }),
      comp({ timeAdjustment: 800 }),
      comp({ timeAdjustment: 0 }),
    ]
    expect(adjustmentMoveClause(comps)).toBe('three of the five moved for date')
  })

  it('still says each when every sale moved', () => {
    const comps = [comp({ timeAdjustment: -1000 }), comp({ timeAdjustment: 2000 })]
    expect(adjustmentMoveClause(comps)).toBe('each moved for date')
  })
})

describe('ask versus band uses the last ask', () => {
  it('Slate shape: $589,900 is below $594,000-$623,000, not inside it', () => {
    const ask = 589_900
    const low = 594_000
    const high = 623_000
    const story = askStoryReading({
      ask,
      rangeLow: low,
      rangeHigh: high,
      days: 168,
      city: 'Bend',
      marketMedianDom: 26,
    })
    const note = failedAskBelowRangeNote(ask)
    expect(askAgainstRangeSentence(ask, low, high)).toContain('below the bottom')
    expect(story).toContain('below the bottom')
    expect(story).not.toContain('inside the range')
    expect(note).toContain('below the sales band')
    expect(`${story} ${note}`).not.toMatch(/inside the range/)
  })

  it('a cut from $1,895,000 to $1,845,000 is measured on the last ask', () => {
    const high = 1_195_000
    const original = ((1_895_000 - high) / high) * 100
    const last = ((1_845_000 - high) / high) * 100
    expect(original).toBeCloseTo(58.6, 1)
    expect(last).toBeCloseTo(54.4, 1)
    expect(askAgainstRangeSentence(1_845_000, 1_120_000, high)).toContain('54.4 percent above')
    expect(askAgainstRangeSentence(1_845_000, 1_120_000, high)).not.toContain('58.6')
  })
})

describe('endpoint weights use the printed cap', () => {
  it('a raw 3.5% share that prints above 5% can set an end', () => {
    const rows = [
      { id: 'a', ppsfTimeAdjusted: 370, adjustedPrice: 1_195_000, weight: 0.2442 },
      { id: 'b', ppsfTimeAdjusted: 372, adjustedPrice: 1_121_252, weight: 0.3222 },
      { id: 'c', ppsfTimeAdjusted: 355, adjustedPrice: 1_160_690, weight: 0.0392 },
      { id: 'd', ppsfTimeAdjusted: 336, adjustedPrice: 1_145_745, weight: 0.033 },
      { id: 'bracket', ppsfTimeAdjusted: 400, adjustedPrice: 1_410_600, weight: 0.0234 },
    ]
    const ends = salesForBandEndpoints(rows)
    expect(ends.map((r) => r.id)).toContain('bracket')
    expect(ends.map((r) => r.id)).toContain('d')
  })
})
