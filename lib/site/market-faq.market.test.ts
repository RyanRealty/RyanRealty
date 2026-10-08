/**
 * The /housing-market/<city> FAQ (SEO & AEO Desk brief 2026-10-08 §4b): Q2 and
 * Q5 word for word at the Oct 8, 2026 Bend figures, the fallbacks every other
 * page keeps, and the three new Dataset variables.
 */
import { describe, expect, it } from 'vitest'
import { buildMarketFaq, type MarketFaqInput } from './market-faq'

const BASE: MarketFaqInput = {
  grain: 'city',
  source: 'market-truth',
  monthsOfSupply: 3.5,
  soldCount12mo: 2206,
  activeCount: 714,
  pulseActiveCount: 714,
  medianListPrice: 874_750,
  medianSalePrice: 759_000,
  medianSaleMonthLabel: 'September 2026',
  yoyMedianPrice: -0.0128,
  medianDaysToPending: 31,
  // 6:00 AM PT on Oct 8, 2026.
  refreshedAt: '2026-10-08T13:00:00.000Z',
}

const MARKET: MarketFaqInput = {
  ...BASE,
  priorYearMonthSalePrice: 766_750,
  priorYearMonthLabel: 'September 2025',
  medianSalePrice12mo: 765_000,
  medianDaysToContract12mo: 28,
  medianDaysToClose12mo: 64,
}

describe('buildMarketFaq, market page', () => {
  const { faqs, datasetVariables } = buildMarketFaq('Bend', MARKET)

  it('asks the six questions in the brief order', () => {
    expect(faqs.map((f) => f.question)).toEqual([
      'What is the median home price in Bend?',
      'Are home prices going up in Bend?',
      'How many single-family homes are for sale in Bend?',
      "Is Bend a buyer's or seller's market?",
      'How long does it take to sell a house in Bend?',
      'How many homes sold in Bend in the last year?',
    ])
  })

  it('answers Q2 and Q5 word for word', () => {
    expect(faqs[1].answer).toBe(
      "No. Bend's median single-family sale price was $759,000 in September 2026, down 1.0% from September 2025, and the 12-month median of $765,000 is down 1.3% from the 12 months before (Oregon Data Share MLS, as of Oct 8, 2026).",
    )
    expect(faqs[4].answer).toBe(
      'A median of 64 days from listing to closing. Over the last 12 months, single-family homes in Bend took a median 28 days to get an accepted offer and a median 64 days from listing to closing, and homes that closed in the last 90 days went under contract in a median 31 days. Those figures are from Oregon Data Share MLS data as of Oct 8, 2026.',
    )
  })

  it('keeps Q1, Q3, Q4 and Q6 as they print today', () => {
    expect(faqs[0].answer).toBe(
      'The median sale price for a single-family home in Bend was $759,000 in September 2026. That is the median, the middle sale, rather than the average, which a few very large sales would pull up. The median list price of the single-family homes for sale is $874,750 as of October 2026, based on a direct count of the active MLS listings.',
    )
    expect(faqs[2].answer).toBe(
      "There are 714 active single-family listings in Bend as of October 2026, counting every home with a Bend address in the regional MLS that isn't under contract yet.",
    )
    expect(faqs[3].answer).toBe(
      "Bend has 3.5 months of supply, which is a seller's market. 4 months of supply or less is a seller's market, above 4 and under 6 is balanced, 6 or more is a buyer's market.",
    )
    expect(faqs[5].answer).toBe('2,206 single-family homes sold in Bend over the past 12 months as of October 2026.')
  })

  it('has exactly one time-to-sell question', () => {
    expect(faqs.filter((f) => /how long/i.test(f.question))).toHaveLength(1)
  })

  it('publishes the 12-month figures as Dataset variables, same values', () => {
    const byName = Object.fromEntries(datasetVariables.map((v) => [v.name, v.value]))
    expect(byName['Median sale price, last 12 months']).toBe(765_000)
    expect(byName['Median days from listing to accepted offer, last 12 months']).toBe(28)
    expect(byName['Median days from listing to closing, last 12 months']).toBe(64)
    expect(byName['Median Days to Pending']).toBe(31)
  })
})

describe('buildMarketFaq, fallbacks (every other page)', () => {
  it('without the market inputs, prints exactly what it printed before', () => {
    const { faqs, datasetVariables } = buildMarketFaq('Bend', BASE)
    expect(faqs[1].answer).toBe(
      'No. The median sale price of single-family homes in Bend over the last 12 months is down 1.3% from the 12 months before.',
    )
    expect(faqs[4]).toEqual({
      question: 'How long do homes take to sell in Bend?',
      answer: 'Single-family homes in Bend took a median of 31 days to go pending as of October 2026.',
    })
    expect(datasetVariables.map((v) => v.name)).not.toContain('Median sale price, last 12 months')
  })

  it('falls back per question when one market figure is null', () => {
    const noClose = buildMarketFaq('Bend', { ...MARKET, grain: 'city', medianDaysToClose12mo: null }).faqs
    expect(noClose[4].question).toBe('How long do homes take to sell in Bend?')
    const noPrior = buildMarketFaq('Bend', { ...MARKET, grain: 'city', priorYearMonthSalePrice: null }).faqs
    expect(noPrior[1].answer).toBe(
      'No. The median sale price of single-family homes in Bend over the last 12 months is down 1.3% from the 12 months before.',
    )
    const noRecent = buildMarketFaq('Bend', { ...MARKET, grain: 'city', medianDaysToPending: null }).faqs
    expect(noRecent.find((f) => f.question.startsWith('How long'))!.answer).toBe(
      'A median of 64 days from listing to closing. Over the last 12 months, single-family homes in Bend took a median 28 days to get an accepted offer and a median 64 days from listing to closing. Those figures are from Oregon Data Share MLS data as of Oct 8, 2026.',
    )
    for (const f of [...noClose, ...noPrior, ...noRecent]) {
      expect(f.answer).not.toMatch(/null|NaN|undefined|\b0 days/)
    }
  })
})
