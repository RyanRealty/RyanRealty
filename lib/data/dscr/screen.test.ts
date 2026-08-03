import { describe, it, expect } from 'vitest'
import { applyDealScores, DEAL_SCORE_WEIGHTS, type DscrRow } from './screen'

/**
 * Deal Score is what ranks the list Matt actually acts on, and the list gets
 * emailed to real people. These lock the properties that matter: an unpriced
 * property is never scored as a bad deal, the weights sum to a whole, and a
 * strictly better property always outranks a strictly worse one.
 */

function row(over: Partial<DscrRow>): DscrRow {
  return {
    listingKey: Math.random().toString(36).slice(2),
    listNumber: null, address: '1 Test St', city: 'Bend', county: 'Deschutes',
    subdivision: null, propertySubType: 'Single Family Residence', photoUrl: null,
    listingUrl: '/listing/x', price: 500_000, beds: 3, baths: 2, sqft: 1500,
    yearBuilt: 2000, dom: 10, unitsTotal: null, strPermit: false, aduYn: false,
    rent: 3000, rentSource: 'zillow-rentzestimate', taxAnnual: 4000, taxMeasured: true,
    hoaMonthly: 0, insuranceAnnual: 1750,
    pi: 2400, pitia: 2879, rentForDscr1: 2879, rentForPositiveCf: 3739,
    dscr: 1.04, cashFlowMonthly: -569, cashNeeded: 132_500, cashOnCashPct: -5.2,
    maxPriceForDscr: 520_000, priceDelta: 20_000, priceDeltaPct: 4,
    dealScore: null,
    ...over,
  }
}

describe('Deal Score', () => {
  it('weights sum to 1 — a score can reach 100 but never exceed it', () => {
    const total = Object.values(DEAL_SCORE_WEIGHTS).reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(1, 10)
  })

  it('leaves properties without a rent estimate unscored, never zero', () => {
    // Scoring an unknown as 0 would bury it below every genuinely bad deal.
    const rows = [
      row({ dscr: 1.4, cashFlowMonthly: 300, cashOnCashPct: 6, priceDeltaPct: 20 }),
      row({ rent: null, rentSource: null, dscr: null, cashFlowMonthly: null, cashOnCashPct: null, priceDeltaPct: null, maxPriceForDscr: null }),
    ]
    applyDealScores(rows)
    expect(rows[0].dealScore).not.toBeNull()
    expect(rows[1].dealScore).toBeNull()
  })

  it('ranks a strictly better property above a strictly worse one', () => {
    const better = row({ dscr: 1.8, cashFlowMonthly: 800, cashOnCashPct: 12, priceDeltaPct: 40 })
    const worse = row({ dscr: 0.6, cashFlowMonthly: -1200, cashOnCashPct: -9, priceDeltaPct: -45 })
    applyDealScores([better, worse])
    expect(better.dealScore).toBeGreaterThan(worse.dealScore as number)
    expect(better.dealScore).toBe(100)
    expect(worse.dealScore).toBe(0)
  })

  it('scores every component, so a property cannot win on cash flow alone', () => {
    // Big absolute cash flow but poor return on a huge cash outlay must not
    // outrank a smaller deal that is better on every ratio.
    const bigButInefficient = row({
      price: 3_000_000, cashNeeded: 795_000,
      dscr: 1.05, cashFlowMonthly: 400, cashOnCashPct: 0.6, priceDeltaPct: 2,
    })
    const smallAndEfficient = row({
      price: 200_000, cashNeeded: 53_000,
      dscr: 1.9, cashFlowMonthly: 380, cashOnCashPct: 8.6, priceDeltaPct: 45,
    })
    applyDealScores([bigButInefficient, smallAndEfficient])
    expect(smallAndEfficient.dealScore).toBeGreaterThan(bigButInefficient.dealScore as number)
  })

  it('is stable when every property is identical (no NaN from a zero range)', () => {
    const rows = [row({}), row({}), row({})]
    applyDealScores(rows)
    for (const r of rows) {
      expect(Number.isFinite(r.dealScore as number)).toBe(true)
    }
  })

  it('handles a single scored property without dividing by zero', () => {
    const only = row({ dscr: 1.2, cashFlowMonthly: 100, cashOnCashPct: 3, priceDeltaPct: 10 })
    applyDealScores([only])
    expect(Number.isFinite(only.dealScore as number)).toBe(true)
  })
})
