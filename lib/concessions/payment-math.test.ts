import { describe, expect, it } from 'vitest'
import {
  comparePriceCutVsConcession,
  concessionCapPct,
  monthlyPI,
  rateAfterBuydown,
} from './payment-math'

const BASE = {
  price: 695_850,
  downPct: 20,
  ratePct: 7.4,
  pointsPer025: 1,
  loanType: 'conventional' as const,
  occupancy: 'principal' as const,
}

describe('monthlyPI', () => {
  it('matches payment_math.py baseline P&I at the documented 7.4% case', () => {
    expect(monthlyPI(556_680, 7.4)).toBeCloseTo(3854.3398709689172, 8)
  })
})

describe('rateAfterBuydown', () => {
  it('at 1.0 point per 0.25% matches the Python multiply', () => {
    const points = 10_000 / (556_680 * 0.01)
    expect(rateAfterBuydown(7.4, points, 1)).toBeCloseTo(6.950908960264425, 10)
  })

  it('a higher points-per-0.25 assumption buys less rate', () => {
    expect(rateAfterBuydown(7.4, 1, 2)).toBeCloseTo(7.275, 10)
  })
})

describe('concessionCapPct', () => {
  it('conventional principal / second home uses 3 / 6 / 9 by LTV', () => {
    expect(concessionCapPct('conventional', 'principal', 95)).toBe(3)
    expect(concessionCapPct('conventional', 'principal', 80)).toBe(6)
    expect(concessionCapPct('conventional', 'principal', 75)).toBe(9)
    expect(concessionCapPct('conventional', 'second', 80)).toBe(6)
  })

  it('conventional investment is 2%', () => {
    expect(concessionCapPct('conventional', 'investment', 80)).toBe(2)
  })

  it('FHA 6, VA 4, USDA 6', () => {
    expect(concessionCapPct('fha', 'principal', 96.5)).toBe(6)
    expect(concessionCapPct('va', 'principal', 100)).toBe(4)
    expect(concessionCapPct('usda', 'principal', 100)).toBe(6)
  })
})

describe('comparePriceCutVsConcession', () => {
  it('default $10,000: price cut saves ~$55/mo, concession ~$169/mo', () => {
    const r = comparePriceCutVsConcession({ ...BASE, dollars: 10_000 })
    expect(r.loan).toBe(556_680)
    expect(r.baselinePi).toBeCloseTo(3854.34, 2)
    expect(r.priceCut.loan).toBe(548_680)
    expect(r.priceCut.pi).toBeCloseTo(3798.95, 2)
    expect(r.priceCut.saves).toBeCloseTo(55.39, 2)
    expect(r.priceCut.cashToCloseReduction).toBe(2_000)
    expect(r.concession.points).toBeCloseTo(1.8, 2)
    expect(r.concession.ratePct).toBeCloseTo(6.951, 3)
    expect(r.concession.pi).toBeCloseTo(3685.27, 2)
    expect(r.concession.saves).toBeCloseTo(169.07, 2)
    expect(r.monthlyAdvantage).toBeCloseTo(113.68, 2)
    expect(Math.round(r.fullTermAdvantage)).toBe(40_924)
    expect(r.capPct).toBe(6)
    expect(r.capDollars).toBe(41_751)
    expect(r.withinCap).toBe(true)
  })

  it('default $20,000 still matches payment_math_results.txt', () => {
    const r = comparePriceCutVsConcession({ ...BASE, dollars: 20_000 })
    expect(r.priceCut.pi).toBeCloseTo(3743.56, 2)
    expect(r.priceCut.saves).toBeCloseTo(110.78, 2)
    expect(r.priceCut.cashToCloseReduction).toBe(4_000)
    expect(r.concession.points).toBeCloseTo(3.59, 2)
    expect(r.concession.ratePct).toBeCloseTo(6.502, 3)
    expect(r.concession.pi).toBeCloseTo(3519.26, 2)
    expect(r.concession.saves).toBeCloseTo(335.08, 2)
    expect(r.monthlyAdvantage).toBeCloseTo(224.3, 2)
    expect(Math.round(r.fullTermAdvantage)).toBe(80_747)
    expect(r.withinCap).toBe(true)
  })

  it('warns when dollars exceed the conventional 6% cap', () => {
    const r = comparePriceCutVsConcession({ ...BASE, dollars: 50_000 })
    expect(r.capDollars).toBe(41_751)
    expect(r.withinCap).toBe(false)
  })
})
