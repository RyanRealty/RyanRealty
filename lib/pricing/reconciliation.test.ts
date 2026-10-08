/**
 * The reconciliation, tested through the one function the engine calls.
 * Tested here: that the shares are the engine's own weights normalized, that
 * the leader is the heaviest sale, that the weighted value is a weighted
 * value and not a mean, that a superlative is written only when it is true,
 * and that the sentence stays inside the document's vocabulary.
 */

import { describe, it, expect } from 'vitest'
import { reconcileAdjustedSales, grossAdjustmentPct, printedWeightPercents, type ReconcilableSale } from './reconciliation'
// The mechanical voice module was retired (main, 2026-09). What it enforced on
// these strings is checked here directly: no display punctuation, no jargon.
const BANNED_PUNCTUATION = /[—–;]/
const BANNED_JARGON = /\b(comp|comps|subject|band|bands|tier|tiers|ladder)\b/i
function readsLikeSellerProse(text: string): boolean {
  return !BANNED_PUNCTUATION.test(text) && !BANNED_JARGON.test(text)
}

function sale(over: Partial<ReconcilableSale> = {}): ReconcilableSale {
  return {
    listingKey: 'A',
    address: '1234 NW Juniper Ave',
    sqft: 1_700,
    closePrice: 500_000,
    closeDate: '2026-07-01',
    monthsSinceClose: 2,
    timeAdjustment: 5_000,
    sizeAdjustment: -5_000,
    storyAdjustment: 0,
    adjustedPrice: 500_000,
    weight: 0.8,
    ...over,
  }
}

describe('reconcileAdjustedSales', () => {
  it('turns the engine weights into shares that sum to 100', () => {
    const out = reconcileAdjustedSales({
      sales: [
        sale({ listingKey: 'A', weight: 0.6 }),
        sale({ listingKey: 'B', weight: 0.3 }),
        sale({ listingKey: 'C', weight: 0.1 }),
      ],
      subjectSqft: 1_700,
    })
    const shares = out.weights.map((w) => w.weight)
    expect(Math.max(...shares)).toBeLessThanOrEqual(40)
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 5)
    expect(out.mostWeighted).toBe('A')
  })

  it('weights the value, it does not average it', () => {
    const out = reconcileAdjustedSales({
      sales: [
        sale({ listingKey: 'A', adjustedPrice: 400_000, weight: 3 }),
        sale({ listingKey: 'B', adjustedPrice: 500_000, weight: 1 }),
      ],
      subjectSqft: 1_700,
    })
    expect(out.weightedPrice).toBe(425_000)
  })

  it('falls back to equal weighting rather than dropping sales with no weight', () => {
    const out = reconcileAdjustedSales({
      sales: [
        sale({ listingKey: 'A', adjustedPrice: 400_000, weight: 0 }),
        sale({ listingKey: 'B', adjustedPrice: 500_000, weight: 0 }),
      ],
      subjectSqft: 1_700,
    })
    expect(out.weightedPrice).toBe(450_000)
    expect(out.weights.map((w) => w.weight)).toEqual([50, 50])
  })

  it('ignores a sale with no adjusted price', () => {
    const out = reconcileAdjustedSales({
      sales: [sale({ listingKey: 'A' }), sale({ listingKey: 'B', adjustedPrice: 0 })],
      subjectSqft: 1_700,
    })
    expect(out.weights).toHaveLength(1)
    expect(out.weights[0].listingKey).toBe('A')
  })

  it('is empty, not a guess, when there is nothing to reconcile', () => {
    const out = reconcileAdjustedSales({ sales: [], subjectSqft: 1_700 })
    expect(out).toEqual({ weights: [], mostWeighted: null, weightedPrice: null, sentence: null })
  })

  it('measures the gross adjustment against the sale price', () => {
    expect(
      grossAdjustmentPct(sale({ closePrice: 500_000, timeAdjustment: 10_000, sizeAdjustment: -5_000, storyAdjustment: 0 })),
    ).toBe(3)
  })

  it('does not call a zero date and size move the smaller adjustment when that sale paid a concession', () => {
    const out = reconcileAdjustedSales({
      sales: [
        sale({
          listingKey: 'CONCESSION',
          address: '10 Quiet Ln',
          closePrice: 500_000,
          timeAdjustment: 0,
          sizeAdjustment: 0,
          storyAdjustment: 0,
          concessionsAmount: 14_600,
          weight: 1,
        }),
        sale({
          listingKey: 'DATE',
          address: '20 Date Ln',
          closePrice: 500_000,
          timeAdjustment: 9_064,
          sizeAdjustment: 0,
          storyAdjustment: 0,
          weight: 1,
        }),
      ],
      subjectSqft: 1_700,
    })
    const concession = out.weights.find((w) => w.listingKey === 'CONCESSION')!
    const dateMove = out.weights.find((w) => w.listingKey === 'DATE')!
    expect(dateMove.reason).toContain('the smallest adjustment of the sales behind this price')
    expect(concession.reason).not.toContain('the smallest adjustment of the sales behind this price')
    expect(concession.grossAdjustmentPct).toBeGreaterThan(dateMove.grossAdjustmentPct)
  })

  it('claims a superlative only when the sale actually holds it', () => {
    const out = reconcileAdjustedSales({
      sales: [
        sale({ listingKey: 'A', sqft: 1_700, monthsSinceClose: 5, timeAdjustment: 20_000, sizeAdjustment: 0, weight: 0.9 }),
        sale({ listingKey: 'B', sqft: 2_400, monthsSinceClose: 1, timeAdjustment: 1_000, sizeAdjustment: 0, weight: 0.4 }),
      ],
      subjectSqft: 1_700,
    })
    const a = out.weights.find((w) => w.listingKey === 'A')!
    const b = out.weights.find((w) => w.listingKey === 'B')!
    expect(a.reason).toContain('the same size as yours')
    expect(a.reason).not.toContain('closest in size to yours')
    expect(a.reason).not.toContain('the most recent sale')
    expect(b.reason).toContain('the most recent sale')
    expect(b.reason).toContain('the smallest adjustment of the sales behind this price')
    expect(b.reason).toContain('700 square feet larger than yours')
  })

  it('does not say the price was adjusted for size when only the date and a concession moved', () => {
    const out = reconcileAdjustedSales({
      sales: [
        sale({
          timeAdjustment: -9_064,
          sizeAdjustment: 0,
          storyAdjustment: 0,
          concessionsAmount: 0,
        }),
        sale({
          listingKey: 'B',
          address: '20 Second St',
          timeAdjustment: 0,
          sizeAdjustment: 0,
          storyAdjustment: 0,
          concessionsAmount: 14_600,
          weight: 0.2,
        }),
      ],
      subjectSqft: 1_700,
    })
    const prose = [out.sentence ?? '', ...out.weights.map((w) => w.reason)].join('\n')
    expect(prose).not.toContain('adjusted for date and size')
    expect(prose).toContain('adjusted for date')
    expect(prose).toContain('adjusted for seller concessions')
  })

  it('does not call a September 28 close sold this month on an October 5 letter', () => {
    const out = reconcileAdjustedSales({
      sales: [
        sale({
          listingKey: 'SEP',
          address: '28 September St',
          closeDate: '2026-09-28',
          monthsSinceClose: 0.23,
        }),
      ],
      subjectSqft: 1_700,
      asOf: '2026-10-05',
    })
    const prose = [out.sentence ?? '', ...out.weights.map((w) => w.reason)].join('\n')
    expect(prose).not.toContain('sold this month')
    expect(prose).toContain('sold last month')
  })

  it('counts older closes from the letter date, and leaves monthsSinceClose alone when asOf is absent', () => {
    const dated = reconcileAdjustedSales({
      sales: [
        sale({
          closeDate: '2026-07-28',
          monthsSinceClose: 0,
        }),
      ],
      subjectSqft: 1_700,
      asOf: '2026-10-05',
    })
    expect(dated.sentence).toContain('sold 3 months ago')
    expect(dated.sentence).not.toContain('sold this month')

    const sameMonth = reconcileAdjustedSales({
      sales: [
        sale({
          closeDate: '2026-10-02',
          monthsSinceClose: 4,
        }),
      ],
      subjectSqft: 1_700,
      asOf: '2026-10-05',
    })
    expect(sameMonth.sentence).toContain('sold this month')
    expect(sameMonth.sentence).not.toContain('sold 4 months ago')

    const undated = reconcileAdjustedSales({
      sales: [
        sale({
          closeDate: '2026-09-28',
          monthsSinceClose: 0,
        }),
      ],
      subjectSqft: 1_700,
    })
    expect(undated.sentence).toContain('sold this month')
  })

  it('names the leading sale in a sentence a seller can read', () => {
    const out = reconcileAdjustedSales({
      sales: [
        sale({ listingKey: 'A', address: '1234 NW Juniper Ave', sqft: 1_760, monthsSinceClose: 1.4, weight: 0.9 }),
        sale({ listingKey: 'B', address: '900 SW Rimrock Way', sqft: 2_400, monthsSinceClose: 9, weight: 0.1 }),
      ],
      subjectSqft: 1_700,
    })
    expect(out.sentence).toContain('1234 NW Juniper Ave carries the most weight')
    expect(out.sentence).toContain('60 square feet larger than yours')
    expect(out.sentence).toContain('sold a month ago')
    for (const banned of ['comp', 'band', 'subject', ' set ', 'tier']) {
      expect(out.sentence!.toLowerCase()).not.toContain(banned)
    }
  })

  it('writes prose the voice canon accepts', () => {
    const out = reconcileAdjustedSales({
      sales: [
        sale({ listingKey: 'A', address: '1234 NW Juniper Ave', weight: 0.9 }),
        sale({ listingKey: 'B', address: '900 SW Rimrock Way', sqft: 2_400, monthsSinceClose: 9, weight: 0.1 }),
      ],
      subjectSqft: 1_700,
    })
    const prose = [out.sentence ?? '', ...out.weights.map((w) => w.reason)].join('\n')
    expect(readsLikeSellerProse(prose)).toBe(true)
  })
})

describe('set aside means set aside (tasteReview round three, §2 item 1)', () => {
  // Seven sales, the shape of cma-19968: the highest and the lowest carried
  // 22.3 percent of the price while the prose said they had been removed.
  const seven = [
    sale({ listingKey: 'LOW', address: '61111 Chuckanut', adjustedPrice: 331_304, weight: 0.9 }),
    sale({ listingKey: 'HIGH', address: '19760 Mahogany', adjustedPrice: 479_614, weight: 0.9 }),
    sale({ listingKey: 'C', adjustedPrice: 478_079, weight: 0.8 }),
    sale({ listingKey: 'D', adjustedPrice: 458_723, weight: 0.8 }),
    sale({ listingKey: 'E', adjustedPrice: 321_786, weight: 0.8 }),
    sale({ listingKey: 'F', adjustedPrice: 370_698, weight: 0.8 }),
    sale({ listingKey: 'G', adjustedPrice: 469_558, weight: 0.8 }),
  ]

  it('partitions the single highest and single lowest out at five or more sales', async () => {
    const { partitionByRangeRule } = await import('./estimate')
    const part = partitionByRangeRule(seven)
    expect(part.rule).toBe('trimmed-one-each-end')
    expect(part.setAside.map((s) => s.listingKey).sort()).toEqual(['E', 'HIGH'])
    expect(part.kept).toHaveLength(5)
    expect(part.kept.map((s) => s.listingKey)).not.toContain('E')
  })

  it('sets two aside at five sales, and draws no rule at four (the band is always trimmed, Matt 2026-10-07)', async () => {
    const { partitionByRangeRule } = await import('./estimate')
    const part = partitionByRangeRule(seven.slice(0, 5))
    expect(part.rule).toBe('trimmed-one-each-end')
    expect(part.setAside.map((s) => s.listingKey).sort()).toEqual(['E', 'HIGH'])
    expect(part.kept).toHaveLength(3)
    const four = partitionByRangeRule(seven.slice(0, 4))
    expect(four.rule).toBeNull()
    expect(four.setAside).toEqual([])
    expect(four.kept).toHaveLength(4)
  })

  it('keeps the order it was given, so the grid and the weights line up', async () => {
    const { partitionByRangeRule } = await import('./estimate')
    const part = partitionByRangeRule(seven)
    expect(part.kept.map((s) => s.listingKey)).toEqual(['LOW', 'C', 'D', 'F', 'G'])
  })

  it('a sale that was set aside carries no weight in the reconciliation', async () => {
    const { partitionByRangeRule } = await import('./estimate')
    const part = partitionByRangeRule(seven)
    const out = reconcileAdjustedSales({ sales: part.kept, subjectSqft: 1_668 })
    expect(out.weights).toHaveLength(5)
    expect(out.weights.map((w) => w.listingKey)).not.toContain('HIGH')
    expect(out.weights.map((w) => w.listingKey)).not.toContain('E')
    expect(out.weights.reduce((s, w) => s + w.weight, 0)).toBeCloseTo(100, 1)
  })

  it('the sentence names the same count as the weights it is written over', async () => {
    const { partitionByRangeRule } = await import('./estimate')
    const part = partitionByRangeRule(seven)
    const out = reconcileAdjustedSales({ sales: part.kept, subjectSqft: 1_668 })
    expect(out.sentence).toContain('the five sales behind this price')
    expect(out.sentence!.toLowerCase()).not.toContain(' set ')
  })

  it('a superlative is claimed over the sales that set the price, not "any sale here"', async () => {
    const { partitionByRangeRule } = await import('./estimate')
    const part = partitionByRangeRule(seven)
    const out = reconcileAdjustedSales({ sales: part.kept, subjectSqft: 1_668 })
    const prose = [out.sentence ?? '', ...out.weights.map((w) => w.reason)].join('\n')
    expect(prose).not.toContain('any sale here')
  })

  it('2382 Jackson: one rounding, the column adds to 100.0 and the sentence quotes the column', () => {
    // Raw weights stored on cma-2382-jackson (2026-10-07): 1.5076, 1.5024,
    // 1.5014, shares 33.418, 33.302 and 33.280 percent.
    const out = reconcileAdjustedSales({
      sales: [
        sale({ listingKey: 'J', address: '2266 Jackson', sqft: 2_002, weight: 1.5076, adjustedPrice: 619_448 }),
        sale({ listingKey: 'I', address: '2225 Indigo', sqft: 1_393, weight: 1.5024, adjustedPrice: 538_569 }),
        sale({ listingKey: 'P', address: '2591 Purcell', sqft: 1_655, weight: 1.5014, adjustedPrice: 539_753 }),
      ],
      subjectSqft: 2_016,
    })
    const printed = out.weights.map((w) => w.weight)
    expect(printed).toEqual([33.4, 33.3, 33.3])
    expect(Math.round(printed.reduce((a, b) => a + b, 0) * 10)).toBe(1000)
    expect(out.weightedPrice).toBe(565_991)
    expect(out.sentence).toContain('2266 Jackson carries the most weight of the three sales behind this price, at 33.4 percent')
  })

  it('the printed column always adds to exactly 100.0, where rounding each share would not', () => {
    // Rounded one at a time these print 33.3 x3 (99.9) and 16.7 x6 (100.2).
    for (const shares of [[1 / 3, 1 / 3, 1 / 3], Array(6).fill(1 / 6), [0.40049, 0.29951, 0.15, 0.15], [0.12345, 0.87655]]) {
      const printed = printedWeightPercents(shares)
      expect(Math.round(printed.reduce((a, b) => a + b, 0) * 10)).toBe(1000)
      printed.forEach((p, i) => expect(Math.abs(p - shares[i]! * 100)).toBeLessThan(0.1 + 1e-9))
    }
  })

  it('claims no single heaviest sale when the shares tie', () => {
    const out = reconcileAdjustedSales({
      sales: [
        sale({ listingKey: 'A', address: '1 Elm', weight: 1 }),
        sale({ listingKey: 'B', address: '2 Elm', weight: 1 }),
        sale({ listingKey: 'C', address: '3 Elm', weight: 1 }),
      ],
      subjectSqft: 1_700,
    })
    expect(out.weights.map((w) => w.weight)).toEqual([33.4, 33.3, 33.3])
    expect(out.sentence).not.toContain('carries the most weight')
    expect(out.sentence).toBe(
      'The three sales behind this price carry equal weight. Rounded to add up to 100, the table shows 33.4, 33.3 and 33.3 percent.',
    )
    expect(readsLikeSellerProse(out.sentence!)).toBe(true)

    const four = reconcileAdjustedSales({
      sales: [
        sale({ listingKey: 'A', address: '1 Elm', weight: 2 }),
        sale({ listingKey: 'B', address: '2 Elm', weight: 2 }),
        sale({ listingKey: 'C', address: '3 Elm', weight: 1 }),
        sale({ listingKey: 'D', address: '4 Elm', weight: 1 }),
      ],
      subjectSqft: 1_700,
    })
    expect(four.sentence).toBe(
      '1 Elm and 2 Elm carry equal weight, the most of the four sales behind this price, at 33.3 percent each.',
    )
  })
})

describe('location first when the step is why a sale leads (rule 15, reader review 2026-10-08)', () => {
  // Weights are a location step plus a similarity fraction under one, so a
  // same-subdivision sale (3.x) outweighs every adjacent (2.x) or neighborhood
  // (1.x) sale whatever their size and date. The sentence gave size, date and
  // movement as the reasons even then.
  it('names the subdivision first when another priced sale sits a step further out', () => {
    const out = reconcileAdjustedSales({
      sales: [
        sale({ listingKey: 'A', address: '2254 Indigo', sqft: 2_091, weight: 3.134, adjustedPrice: 598_620, locationMatch: 'same-subdivision', closeDate: '2026-01-15', monthsSinceClose: 9 }),
        sale({ listingKey: 'B', address: '2799 Baroness', sqft: 2_016, weight: 2.9, adjustedPrice: 620_000, locationMatch: 'adjacent-subdivision', closeDate: '2026-09-15', monthsSinceClose: 1, timeAdjustment: 0, sizeAdjustment: 0 }),
        sale({ listingKey: 'C', address: '2591 Purcell', sqft: 1_655, weight: 1.5, adjustedPrice: 648_772, locationMatch: 'neighborhood-or-community' }),
      ],
      subjectSqft: 2_016,
      asOf: '2026-10-07',
    })
    expect(out.mostWeighted).toBe('A')
    expect(out.sentence).toMatch(/^2254 Indigo carries the most weight of the three sales behind this price, at [\d.]+ percent: it is in your subdivision, it is 75 square feet larger than yours, it sold 9 months ago, and /)
    expect(readsLikeSellerProse(out.sentence ?? '')).toBe(true)
  })

  it('says "next to yours" for an adjacent leader over a neighborhood sale', () => {
    const out = reconcileAdjustedSales({
      sales: [
        sale({ listingKey: 'A', weight: 2.5, locationMatch: 'adjacent-subdivision' }),
        sale({ listingKey: 'B', address: '9 Far St', weight: 1.9, locationMatch: 'neighborhood-or-community' }),
      ],
      subjectSqft: 1_700,
    })
    expect(out.sentence).toContain('percent: it is in the subdivision next to yours, it is the same size as yours')
  })

  it('stays on size, date and movement when every sale shares the step (2382 Jackson, all Holliday Park)', () => {
    const out = reconcileAdjustedSales({
      sales: [
        sale({ listingKey: 'A', address: '2254 Indigo', sqft: 2_091, weight: 3.134, adjustedPrice: 598_620, locationMatch: 'same-subdivision' }),
        sale({ listingKey: 'B', address: '2266 Jackson', sqft: 2_002, weight: 3.015, adjustedPrice: 624_000, locationMatch: 'same-subdivision' }),
        sale({ listingKey: 'C', address: '2591 Purcell', sqft: 1_655, weight: 1.5015, adjustedPrice: 648_772, locationMatch: 'same-subdivision' }),
      ],
      subjectSqft: 2_016,
    })
    expect(out.sentence).toMatch(/percent: it is 75 square feet larger than yours, it sold/)
    expect(out.sentence).not.toContain('subdivision')
  })

  it('says nothing about location on rows that never classed the sales', () => {
    const out = reconcileAdjustedSales({
      sales: [sale({ listingKey: 'A', weight: 0.8 }), sale({ listingKey: 'B', address: '9 Far St', weight: 0.3 })],
      subjectSqft: 1_700,
    })
    expect(out.sentence).toMatch(/percent: it is the same size as yours, it sold/)
    expect(out.sentence).not.toContain('subdivision')
    expect(out.sentence).not.toContain('neighborhood')
  })
})
