/**
 * The reconciliation, tested through the one function the engine calls.
 * Tested here: that the shares are the engine's own weights normalized, that
 * the leader is the heaviest sale, that the weighted value is a weighted
 * value and not a mean, that a superlative is written only when it is true,
 * and that the sentence stays inside the document's vocabulary.
 */

import { describe, it, expect } from 'vitest'
import { reconcileAdjustedSales, grossAdjustmentPct, type ReconcilableSale } from './reconciliation'
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
    expect(out.weights.map((w) => w.weight)).toEqual([60, 30, 10])
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

  it('partitions the single highest and single lowest out at six or more sales', async () => {
    const { partitionByRangeRule } = await import('./estimate')
    const part = partitionByRangeRule(seven)
    expect(part.rule).toBe('trimmed-one-each-end')
    expect(part.setAside.map((s) => s.listingKey).sort()).toEqual(['E', 'HIGH'])
    expect(part.kept).toHaveLength(5)
    expect(part.kept.map((s) => s.listingKey)).not.toContain('E')
  })

  it('sets nothing aside under six sales', async () => {
    const { partitionByRangeRule } = await import('./estimate')
    const part = partitionByRangeRule(seven.slice(0, 5))
    expect(part.rule).toBe('min-max')
    expect(part.setAside).toEqual([])
    expect(part.kept).toHaveLength(5)
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
})
