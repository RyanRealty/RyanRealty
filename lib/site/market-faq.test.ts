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

  it('builds all four Q&A from a full pulse, keeping the list median exact', () => {
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
    expect(price?.answer).toContain('$894,750')
    expect(price?.answer).not.toContain('$895,000')
    expect(price?.answer).toContain('as of May 2026')
    const mos = r.faqs.find((f) => f.question.includes("buyer's or seller's"))
    expect(mos?.answer).toContain('3.3 months of supply') // 3.25 -> 1 decimal
    expect(mos?.answer).toContain("seller's market") // <= 4 months
  })

  // CLAUDE.md section 0: "Never round in a way that changes the narrative."
  // Rounding months-of-supply BEFORE classifying it walks the VERDICT across a
  // canonical boundary in both directions; rounding it naively for display walks
  // the DIGITS across the same boundary, so the answer printed "4 months of supply,
  // which is a balanced market" and then appended a threshold sentence calling 4
  // months or less a seller's market. These two cases are the boundary, and both
  // halves are asserted: the verdict comes from the raw value, and the printed
  // figure stays on the raw value's side of the threshold (formatMonthsOfSupply).
  it('classifies the RAW months of supply and prints digits on the same side of the threshold', () => {
    const justOverFour = buildMarketFaq('Central Oregon', {
      monthsOfSupply: 4.02,
      refreshedAt: null,
    })
    const over = justOverFour.faqs.find((f) => f.question.includes("buyer's or seller's"))
    expect(over?.answer).toContain('4.1 months of supply') // 4.02 never prints as 4.0
    expect(over?.answer).not.toContain('4 months of supply, which')
    // Assert the VERDICT clause, not a bare substring: the shared threshold
    // sentence appended to this answer names all three verdicts by design, so a
    // substring check for "seller's market" now matches the explanation rather
    // than the classification it is meant to protect.
    expect(over?.answer).toContain('which is a balanced market') // classified raw: 4.02 > 4
    expect(over?.answer).not.toContain("which is a seller's market")
    // The Dataset variable is the machine-readable copy of the sentence, so it
    // carries the number the sentence shows, not a second rounding of the raw value.
    expect(
      justOverFour.datasetVariables.find((v) => v.name === 'Months of Supply')?.value,
    ).toBe(4.1)

    const justUnderSix = buildMarketFaq('Central Oregon', {
      monthsOfSupply: 5.97,
      refreshedAt: null,
    })
    const under = justUnderSix.faqs.find((f) => f.question.includes("buyer's or seller's"))
    expect(under?.answer).toContain('5.9 months of supply') // 5.97 never prints as 6.0
    expect(under?.answer).not.toContain('6 months of supply, which')
    expect(under?.answer).toContain('which is a balanced market') // classified raw: 5.97 < 6
    expect(under?.answer).not.toContain("which is a buyer's market")
    expect(
      justUnderSix.datasetVariables.find((v) => v.name === 'Months of Supply')?.value,
    ).toBe(5.9)
  })

  it('keeps Southern Crossing and NorthWest Crossing list medians off the thousand-round', () => {
    const south = buildMarketFaq('Southern Crossing', { medianListPrice: 919500 })
    expect(south.faqs[0]?.answer).toContain('$919,500')
    expect(south.faqs[0]?.answer).not.toContain('$920,000')
    const nwx = buildMarketFaq('NorthWest Crossing', { medianListPrice: 1199900 })
    expect(nwx.faqs[0]?.answer).toContain('$1,199,900')
    expect(nwx.faqs[0]?.answer).not.toContain('$1,200,000')
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

  it('prints the master HOA when a higher sub-neighborhood estimate is also on file', () => {
    const r = buildMarketFaq('Tetherow', {
      hoaMasterAnnual: 1464,
      hoaAnnualEstimate: 2244,
      hoaSubEstimates: [2244, 2004, 1464],
    })
    const hoa = r.faqs.find((f) => f.question.includes('have an HOA'))
    expect(hoa?.answer).toContain('$1,464')
    expect(hoa?.answer).not.toContain('$2,244')
  })

  it('drops months of supply when implied six-month closes exceed the printed year', () => {
    const r = buildMarketFaq('Tetherow', {
      activeCount: 35,
      monthsOfSupply: 4.6,
      soldCount12mo: 36,
      refreshedAt: null,
    })
    expect(r.faqs.find((f) => f.question.includes("buyer's or seller's"))).toBeUndefined()
    expect(r.datasetVariables.find((v) => v.name === 'Months of Supply')).toBeUndefined()
    expect(r.faqs.find((f) => f.question.includes('sold in Tetherow'))?.answer).toContain('36 single-family')
  })

  it('prints the pulse half-day, not an integer-rounded second figure', () => {
    const r = buildMarketFaq('Black Butte Ranch', {
      medianDaysToPending: 39.5,
      refreshedAt: null,
    })
    const days = r.faqs.find((f) => f.question.includes('take to sell'))
    expect(days?.answer).toContain('39.5 days')
    expect(days?.answer).not.toContain('40 days')
    expect(r.datasetVariables.find((v) => v.name === 'Median Days to Pending')?.value).toBe(39.5)
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
