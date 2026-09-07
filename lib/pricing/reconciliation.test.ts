/**
 * The reconciliation, tested through the one function the engine calls.
 * Tested here: that the shares are the engine's own weights normalized, that
 * the leader is the heaviest sale, that the weighted value is a weighted
 * value and not a mean, that a superlative is written only when it is true,
 * and that the sentence stays inside the document's vocabulary.
 */

import { describe, it, expect } from 'vitest'
import { reconcileAdjustedSales, grossAdjustmentPct, type ReconcilableSale } from './reconciliation'
import { checkBrandVoice } from '@/lib/voice/check'

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
    expect(b.reason).toContain('the smallest adjustment of any sale here')
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

  it('writes prose the send-path voice check accepts', () => {
    const out = reconcileAdjustedSales({
      sales: [
        sale({ listingKey: 'A', address: '1234 NW Juniper Ave', weight: 0.9 }),
        sale({ listingKey: 'B', address: '900 SW Rimrock Way', sqft: 2_400, monthsSinceClose: 9, weight: 0.1 }),
      ],
      subjectSqft: 1_700,
    })
    const prose = [out.sentence ?? '', ...out.weights.map((w) => w.reason)].join('\n')
    expect(checkBrandVoice(prose).ok).toBe(true)
  })
})
