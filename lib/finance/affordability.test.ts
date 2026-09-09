import { describe, it, expect } from 'vitest'
import {
  AFFORDABILITY_CEILING_STEP,
  opensOnCash,
  monthlyAtPrice,
  roundCeilingDown,
  solveCash,
  solveFromMonthly,
  solveFromPrice,
  solvePriceForMonthlyPayment,
  withMaxPrice,
} from './affordability'
import { estimatedMonthlyPayment } from '@/lib/mortgage'

/**
 * The promise this file exists to keep: the number on the button is never above
 * the number that was solved, and the two directions agree.
 */
const terms = { interestRatePercent: 6.71, downPaymentPct: 20, loanTermYears: 30 }

describe('solvePriceForMonthlyPayment · the inverse nobody ships', () => {
  it('never returns a price whose published payment exceeds the target', () => {
    for (const monthly of [1200, 2500, 3333, 4510, 7800, 19_999]) {
      const price = solvePriceForMonthlyPayment(monthly, terms)!
      expect(price).toBeGreaterThan(0)
      expect(estimatedMonthlyPayment(price, 20, 6.71, 30)).toBeLessThanOrEqual(monthly + 1e-4)
    }
  })

  it('returns the LARGEST such price — one dollar more overshoots', () => {
    const price = solvePriceForMonthlyPayment(4510, terms)!
    expect(estimatedMonthlyPayment(price + 1, 20, 6.71, 30)).toBeGreaterThan(4510)
  })

  it('round-trips price to payment to price within a dollar', () => {
    for (const price of [350_000, 599_999, 899_000, 947_000, 1_375_000, 2_500_000]) {
      const monthly = monthlyAtPrice(price, terms)!
      const back = solvePriceForMonthlyPayment(monthly, terms)!
      expect(Math.abs(back - price)).toBeLessThanOrEqual(1)
    }
  })

  it('round-trips across every rate, term and down payment the UI offers', () => {
    for (const rate of [0, 3, 6.71, 9.5, 12]) {
      for (const years of [15, 30]) {
        for (const down of [0, 5, 20, 50]) {
          const t = { interestRatePercent: rate, downPaymentPct: down, loanTermYears: years }
          const monthly = monthlyAtPrice(875_000, t)!
          const back = solvePriceForMonthlyPayment(monthly, t)!
          expect(Math.abs(back - 875_000)).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('refuses terms that cannot make a payment rather than inventing one', () => {
    expect(solvePriceForMonthlyPayment(0, terms)).toBeNull()
    expect(solvePriceForMonthlyPayment(-100, terms)).toBeNull()
    expect(solvePriceForMonthlyPayment(NaN, terms)).toBeNull()
    expect(solvePriceForMonthlyPayment(3000, { ...terms, downPaymentPct: 100 })).toBeNull()
    expect(solvePriceForMonthlyPayment(3000, { ...terms, loanTermYears: 0 })).toBeNull()
  })

  it('handles a zero rate as straight division, not a divide by zero', () => {
    const price = solvePriceForMonthlyPayment(2000, {
      interestRatePercent: 0,
      downPaymentPct: 20,
      loanTermYears: 30,
    })!
    // $2,000 x 360 payments = a $720,000 loan, which is 80% of $900,000.
    expect(price).toBeGreaterThan(895_000)
    expect(price).toBeLessThanOrEqual(900_000)
  })
})

describe('roundCeilingDown · the button never promises more than was solved', () => {
  it('rounds down, never to nearest', () => {
    expect(roundCeilingDown(947_999)).toBe(947_000)
    expect(roundCeilingDown(947_001)).toBe(947_000)
    expect(roundCeilingDown(947_000)).toBe(947_000)
  })

  it('keeps the ceiling at or under the solved price for every solved answer', () => {
    for (const monthly of [1500, 2750, 4510, 9000]) {
      const solved = solveFromMonthly(monthly, terms)!
      expect(solved.ceiling).toBeLessThanOrEqual(solved.price)
      expect(solved.ceiling % AFFORDABILITY_CEILING_STEP).toBe(0)
      expect(solved.ceilingMonthly).toBeLessThanOrEqual(monthly + 1e-4)
    }
  })
})

describe('solveFromPrice · down and loan foot to the ceiling', () => {
  it('splits the CEILING, not the raw price, so the two figures sum to the promise', () => {
    const solved = solveFromPrice(947_000, terms)!
    expect(solved.downPayment + solved.loanAmount).toBe(solved.ceiling)
    expect(solved.downPayment).toBe(189_400)
  })

  it('publishes the payment at the price and at the ceiling separately', () => {
    const solved = solveFromPrice(947_999, terms)!
    expect(solved.ceiling).toBe(947_000)
    expect(solved.ceilingMonthly).toBeLessThan(solved.monthly)
  })
})

describe('solveCash · no loan, and no down payment invented from a cash share', () => {
  it('makes the ceiling the money and the loan zero', () => {
    const solved = solveCash(825_400)!
    expect(solved.ceiling).toBe(825_000)
    expect(solved.loanAmount).toBe(0)
    expect(solved.downPayment).toBe(825_000)
    expect(solved.monthly).toBe(0)
  })

  it('refuses a non-figure', () => {
    expect(solveCash(0)).toBeNull()
    expect(solveCash(NaN)).toBeNull()
  })
})

describe('opensOnCash · a share of other people`s sales is not this visitor`s plan', () => {
  it('opens financed unless most closed sales in the window were cash', () => {
    // Bend detached, 12 months, market_metric cash_share 0.2778 (n 2,073).
    expect(opensOnCash(0.277858176555716)).toBe(false)
    // Awbrey Butte detached, 12 months, cash_share 0.3917 (n 120).
    expect(opensOnCash(0.391666666666667)).toBe(false)
    expect(opensOnCash(0.5)).toBe(true)
    expect(opensOnCash(0.75)).toBe(true)
    expect(opensOnCash(null)).toBe(false)
    expect(opensOnCash(undefined)).toBe(false)
  })
})

describe('withMaxPrice · the confirmed search param, on the caller`s own path', () => {
  it('adds maxPrice to a bare browse path', () => {
    expect(withMaxPrice('/homes-for-sale/bend', 850_000)).toBe('/homes-for-sale/bend?maxPrice=850000')
  })

  it('keeps a path that already carries params', () => {
    expect(withMaxPrice('/homes-for-sale/bend?beds=3', 850_000)).toBe(
      '/homes-for-sale/bend?beds=3&maxPrice=850000',
    )
  })

  it('replaces an existing ceiling rather than appending a second one', () => {
    expect(withMaxPrice('/homes-for-sale/bend?maxPrice=1', 850_000)).toBe(
      '/homes-for-sale/bend?maxPrice=850000',
    )
  })

  it('leaves the path alone when there is no ceiling to carry', () => {
    expect(withMaxPrice('/homes-for-sale/bend', 0)).toBe('/homes-for-sale/bend')
    expect(withMaxPrice('', 850_000)).toBe('')
  })
})
