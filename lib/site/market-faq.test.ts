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
      grain: 'city',
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
      grain: 'city',
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
      grain: 'city',
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
    const south = buildMarketFaq('Southern Crossing', { grain: 'city', medianListPrice: 919500 })
    expect(south.faqs[0]?.answer).toContain('$919,500')
    expect(south.faqs[0]?.answer).not.toContain('$920,000')
    const nwx = buildMarketFaq('NorthWest Crossing', { grain: 'city', medianListPrice: 1199900 })
    expect(nwx.faqs[0]?.answer).toContain('$1,199,900')
    expect(nwx.faqs[0]?.answer).not.toContain('$1,200,000')
  })

  it('visible numbers and dataset variables come from one source (cannot diverge)', () => {
    const r = buildMarketFaq('Redmond', {
      grain: 'city',
      activeCount: 88,
      medianListPrice: 650000,
      monthsOfSupply: null,
      medianDaysToPending: null,
      refreshedAt: null,
    })
    const active = r.datasetVariables.find((v) => v.name === 'Active Listings')
    expect(active?.value).toBe(88)
    expect(r.faqs.find((f) => f.question.includes('homes are for sale'))?.answer).toBe(
      'There are 88 active single-family listings in Redmond.',
    )
    expect(r.faqs.find((f) => f.question.includes('homes are for sale'))?.question).toContain(
      'single-family',
    )
  })

  it('prints the master HOA when a higher sub-neighborhood estimate is also on file', () => {
    const r = buildMarketFaq('Tetherow', {
      grain: 'city',
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
      grain: 'city',
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
      grain: 'city',
      medianDaysToPending: 39.5,
      refreshedAt: null,
    })
    const days = r.faqs.find((f) => f.question.includes('take to sell'))
    expect(days?.answer).toContain('39.5 days')
    expect(days?.answer).not.toContain('40 days')
    expect(r.datasetVariables.find((v) => v.name === 'Median Days to Pending')?.value).toBe(39.5)
  })

  it('withholds months of supply when the printed SFR count is not the pulse count', () => {
    const r = buildMarketFaq('Bend', {
      grain: 'city',
      activeCount: 980,
      pulseActiveCount: 475,
      monthsOfSupply: 3.5,
      refreshedAt: '2026-08-19',
    })
    expect(r.faqs.find((f) => f.question.includes('homes are for sale'))?.answer).toContain('980')
    expect(r.faqs.find((f) => f.question.includes('homes are for sale'))?.answer).not.toContain('475')
    expect(r.faqs.find((f) => f.question.includes("buyer's or seller's"))).toBeUndefined()
    expect(r.datasetVariables.find((v) => v.name === 'Months of Supply')).toBeUndefined()
  })

  it('null or non-positive stats produce no question and no dataset variable', () => {
    const r = buildMarketFaq('Sisters', {
      grain: 'city',
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

/**
 * The neighborhood publication path, end to end. /cities/bend/century-west
 * rendered "48.0 MONTHS" in the visible copy, a Dataset variable
 * "Months of Supply": 48, and a Dataset variable "Homes Sold (12 months)": 3,
 * all from one buildMarketFaq call on one pulse row whose 16 actives came from
 * a polygon and whose 2 closes came from a subdivision-name text join. The
 * polygon held 42 closes over the same 180 days. Nothing derived from that
 * closed series may publish at this grain, in the visible FAQ or in the markup.
 */
describe('buildMarketFaq at an untrusted grain', () => {
  const centuryWest = {
    activeCount: 16,
    medianListPrice: 749_000,
    monthsOfSupply: 48,
    soldCount12mo: 3,
    medianDaysToPending: 21,
    refreshedAt: '2026-08-19T17:00:00Z',
  } as const

  it('publishes no months-of-supply question, no verdict, and no Dataset variable', () => {
    const { faqs, datasetVariables } = buildMarketFaq('Century West', {
      grain: 'neighborhood',
      ...centuryWest,
    })
    const text = faqs.map((f) => `${f.question} ${f.answer}`).join(' ')
    expect(text).not.toMatch(/months of supply/i)
    expect(text).not.toMatch(/buyer's market|seller's market|balanced market/i)
    expect(datasetVariables.find((v) => v.name === 'Months of Supply')).toBeUndefined()
  })

  it('publishes no 12-month sold count in the answer or the Dataset', () => {
    const { faqs, datasetVariables } = buildMarketFaq('Century West', {
      grain: 'neighborhood',
      ...centuryWest,
    })
    expect(faqs.map((f) => f.question).join(' ')).not.toMatch(/how many homes sold/i)
    expect(datasetVariables.find((v) => v.name === 'Homes Sold (12 months)')).toBeUndefined()
  })

  it('publishes leftover 12-month sold at neighborhood when source is market-truth', () => {
    const { faqs, datasetVariables } = buildMarketFaq('Sunriver', {
      grain: 'neighborhood',
      source: 'market-truth',
      soldCount12mo: 117,
      activeCount: 56,
    })
    expect(faqs.map((f) => f.question).join(' ')).toMatch(/how many homes sold/i)
    expect(datasetVariables.find((v) => v.name === 'Homes Sold (12 months)')?.value).toBe(117)
  })

  it('still answers the figures that do not depend on closed-sale attribution', () => {
    const { faqs, datasetVariables } = buildMarketFaq('Century West', {
      grain: 'neighborhood',
      ...centuryWest,
    })
    // Active inventory is a polygon count and median list price is a price on
    // those same actives. Neither reads the closed series, so the page keeps a
    // real FAQ rather than going blank.
    expect(faqs.length).toBeGreaterThanOrEqual(3)
    expect(datasetVariables.map((v) => v.name)).toEqual(
      expect.arrayContaining(['Median List Price', 'Active Listings', 'Median Days to Pending']),
    )
  })

  it('publishes both figures at city grain from the identical input', () => {
    const { faqs, datasetVariables } = buildMarketFaq('Bend', { grain: 'city', ...centuryWest })
    expect(faqs.map((f) => f.question).join(' ')).toMatch(/how many homes sold/i)
    expect(datasetVariables.find((v) => v.name === 'Months of Supply')?.value).toBe(48)
  })

  it('publishes Market Truth neighborhood MOS when the source is declared and counts match', () => {
    const { faqs, datasetVariables } = buildMarketFaq('Sunriver', {
      grain: 'neighborhood',
      source: 'market-truth',
      activeCount: 56,
      pulseActiveCount: 56,
      monthsOfSupply: 7.47,
    })
    const mos = faqs.find((f) => f.question.includes("buyer's or seller's"))
    expect(mos?.answer).toContain('7.5 months of supply')
    expect(mos?.answer).toContain("which is a buyer's market")
    expect(datasetVariables.find((v) => v.name === 'Months of Supply')?.value).toBe(7.5)
  })
})
