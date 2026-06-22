import { describe, it, expect } from 'vitest'
import { buildMarketFaq } from './market-faq'

// buildMarketFaq is the single source feeding the visible FAQ AND the FAQPage /
// Dataset JSON-LD, so visible text and markup can never diverge. Every figure is
// null-guarded (no invented numbers). Data-accuracy-critical (CLAUDE S0). Audit p3.2.
describe('buildMarketFaq', () => {
  it('null pulse -> no faqs, no dataset vars', () => {
    const r = buildMarketFaq('Bend', null)
    expect(r.faqs).toEqual([])
    expect(r.datasetVariables).toEqual([])
    expect(r.asOfIso).toBeNull()
    expect(r.asOfLabel).toBeNull()
  })

  it('builds all four Q&A from a full pulse, rounding price to the nearest $1,000', () => {
    const r = buildMarketFaq('Bend', {
      activeCount: 120,
      medianListPrice: 894750,
      monthsOfSupply: 3.25,
      medianDaysToPending: 14,
      refreshedAt: '2026-05-15',
    })
    expect(r.faqs).toHaveLength(4)
    expect(r.asOfIso).toBe('2026-05-15')
    expect(r.asOfLabel).toBe('May 2026')
    const price = r.faqs.find((f) => f.question.includes('median home price'))
    expect(price?.answer).toContain('$895,000') // 894750 -> nearest $1,000
    expect(price?.answer).toContain('as of May 2026')
    const mos = r.faqs.find((f) => f.question.includes("buyer's or seller's"))
    expect(mos?.answer).toContain('3.3 months of supply') // 3.25 -> 1 decimal
    expect(mos?.answer).toContain("seller's market") // <= 4 months
  })

  it('visible numbers and dataset variables come from one source (cannot diverge)', () => {
    const r = buildMarketFaq('Redmond', {
      activeCount: 88,
      medianListPrice: 650000,
      monthsOfSupply: null,
      medianDaysToPending: null,
      refreshedAt: null,
    })
    const active = r.datasetVariables.find((v) => v.name === 'Active Listings')
    expect(active?.value).toBe(88)
    expect(r.faqs.find((f) => f.question.includes('homes are for sale'))?.answer).toContain('88 active')
  })

  it('null or non-positive stats produce no question and no dataset variable', () => {
    const r = buildMarketFaq('Sisters', {
      activeCount: 0,
      medianListPrice: -5,
      monthsOfSupply: null,
      medianDaysToPending: 14,
      refreshedAt: null,
    })
    expect(r.faqs).toHaveLength(1)
    expect(r.datasetVariables).toHaveLength(1)
    expect(r.faqs[0].question).toContain('take to sell')
    expect(r.datasetVariables[0].name).toBe('Median Days to Pending')
  })
})
