/**
 * The /housing-market/<city> answer block (SEO & AEO Desk brief 2026-10-08),
 * and the guarantee that /cities and /communities keep today's sentences.
 * Figures are the live Oct 8, 2026 Bend values the brief traces (§2, M1 to M8).
 */
import { describe, expect, it } from 'vitest'
import { placeTakeaways } from './place-takeaways'

const BEND_PLACE = {
  place: 'Bend',
  addressScope: true,
  asOfLabel: 'Oct 8, 2026',
  active: 714,
  medianList: 874_750,
  monthsOfSupply: 3.5,
  saleMedian: { value: 759_000, when: 'in September 2026' },
  yoyMedian: -0.0128,
}

const BEND_MARKET = {
  ...BEND_PLACE,
  variant: 'market' as const,
  priorYearMonthMedian: { value: 766_750, label: 'September 2025' },
  medianClose12: 765_000,
  closedCount12: 2206,
  daysToPending90: 31,
  daysToClose12: 64,
}

describe('placeTakeaways, market variant', () => {
  it('prints the brief §4a answer word for word at the Oct 8 figures', () => {
    expect(placeTakeaways(BEND_MARKET)).toEqual([
      'As of Oct 8, 2026, the median sale price of a single-family home in Bend was $759,000 in September 2026, down 1.0% from $766,750 in September 2025.',
      "Over the last 12 months, Bend's median sale price was $765,000 on 2,206 sales, down 1.3% from the 12 months before.",
      'Bend homes that closed in the last 90 days spent a median 31 days on the market before going under contract, and over the last 12 months the median time from listing to closing was 64 days.',
      "Bend has 3.5 months of supply, which makes it a seller's market (4 months or less favors sellers).",
    ])
  })

  it('carries every accept-test fact', () => {
    const text = placeTakeaways(BEND_MARKET).join(' ')
    for (const needle of [
      '$759,000', 'down 1.0%', '$766,750', '$765,000', '2,206', 'down 1.3%', '31 days', '64 days',
      '3.5 months of supply', "seller's market", 'As of Oct 8, 2026',
    ]) {
      expect(text).toContain(needle)
    }
  })

  it('drops a clause, never estimates, when a figure is null', () => {
    const t = placeTakeaways({
      ...BEND_MARKET,
      priorYearMonthMedian: null,
      closedCount12: null,
      daysToClose12: null,
      yoyMedian: null,
    })
    expect(t).toEqual([
      'As of Oct 8, 2026, the median sale price of a single-family home in Bend was $759,000 in September 2026.',
      "Over the last 12 months, Bend's median sale price was $765,000.",
      'Bend homes that closed in the last 90 days spent a median 31 days on the market before going under contract.',
      "Bend has 3.5 months of supply, which makes it a seller's market (4 months or less favors sellers).",
    ])
    const bare = placeTakeaways({
      place: 'Bend',
      variant: 'market',
      daysToPending90: 0,
      daysToClose12: 64,
      monthsOfSupply: null,
      saleMedian: null,
      medianClose12: null,
    })
    expect(bare).toEqual(['Over the last 12 months, the median time from listing to closing in Bend was 64 days.'])
    for (const s of [...t, ...bare]) expect(s).not.toMatch(/null|NaN|undefined|\b0 days/)
  })

  it('names the other verdicts with their own threshold', () => {
    expect(placeTakeaways({ place: 'X', variant: 'market', monthsOfSupply: 5.1 })[0]).toBe(
      'X has 5.1 months of supply, which makes it a balanced market (between 4 and 6 months is balanced).',
    )
    expect(placeTakeaways({ place: 'X', variant: 'market', monthsOfSupply: 6.4 })[0]).toBe(
      "X has 6.4 months of supply, which makes it a buyer's market (6 months or more favors buyers).",
    )
  })

  it('writes no dash of any kind', () => {
    for (const s of placeTakeaways(BEND_MARKET)) expect(s).not.toMatch(/\u2014|\u2013| -- /)
  })
})

// Accept test 6: /cities/bend and a community page render the same takeaways
// as before. These literals are origin/main's output for the same inputs.
describe('placeTakeaways, place variant unchanged', () => {
  it('city (/cities/bend)', () => {
    expect(placeTakeaways(BEND_PLACE)).toEqual([
      '714 single-family houses with a Bend address are for sale as of Oct 8, 2026, at a median asking price of $874,750.',
      "Bend has 3.5 months of supply, a seller's market, so sellers have the edge.",
      'The median single-family home in Bend sold for $759,000 in September 2026.',
      'The median sale price in Bend over the last 12 months is down 1.3% from the 12 months before.',
    ])
  })

  it('community (/communities/tetherow shape)', () => {
    expect(
      placeTakeaways({
        place: 'Tetherow',
        asOfLabel: 'Oct 8, 2026',
        active: 12,
        medianList: 1_650_000,
        monthsOfSupply: 7.2,
        saleMedian: { value: 1_450_000, when: 'over the last 12 months' },
        yoyMedian: 0.031,
      }),
    ).toEqual([
      'Tetherow has 12 single-family homes for sale as of Oct 8, 2026, at a median asking price of $1,650,000.',
      "Tetherow has 7.2 months of supply, a buyer's market, so buyers have room to negotiate.",
      'The median single-family home in Tetherow sold for $1,450,000 over the last 12 months.',
      'The median sale price in Tetherow over the last 12 months is up 3.1% from the 12 months before.',
    ])
  })

  it('ignores the market-only inputs unless the variant asks for them', () => {
    expect(placeTakeaways({ ...BEND_MARKET, variant: 'place' })).toEqual(placeTakeaways(BEND_PLACE))
  })
})
