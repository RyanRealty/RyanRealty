import { describe, it, expect } from 'vitest'
import { analyzeRental, remainingBalance, formatUSD, formatPct, type RentalAnalysisInputs } from './rental-analysis'

/**
 * Reconciliation against a verified long-term-rental sample report
 * ("2629 Bonnybrook Dr SW, Atlanta GA").
 *
 * The report finances $2,000 of loan points, so the loan is $102,000 on a
 * $125,000 purchase (not $100,000). We pass that explicitly via `loanAmount`
 * to reproduce the report's exact loan payment and downstream metrics.
 */
const RENTAL_SAMPLE: RentalAnalysisInputs = {
  purchasePrice: 125000,
  downPaymentPct: 20, // -> $25,000 down
  loanAmount: 102000, // 80% of price ($100k) + $2k financed points
  interestRatePct: 5.25,
  loanTermYears: 30,
  loanType: 'amortizing',
  purchaseCostsCash: 3600, // cash closing costs (the $2k points are financed, not cash)
  rehabCost: 6400,
  marketValue: 145000, // ARV
  grossRentMonthly: 1550,
  vacancyPct: 5,
  otherIncomeMonthly: 0,
  expenses: {
    propertyTaxes: 2750 / 12,
    insurance: 750 / 12,
    propertyManagement: 1414 / 12,
    maintenance: 1860 / 12,
    capitalReserves: 930 / 12,
  },
  appreciationPct: 3,
  rentGrowthPct: 2,
  expenseGrowthPct: 2,
}

describe('analyzeRental — reconciles to the verified rental sample', () => {
  const r = analyzeRental(RENTAL_SAMPLE)

  it('acquisition: down payment, loan, total cash needed', () => {
    expect(r.downPayment).toBe(25000)
    expect(r.loanAmount).toBe(102000)
    expect(r.totalCashNeeded).toBe(35000) // 25,000 + 3,600 + 6,400
  })

  it('financing: monthly debt service ~ $563', () => {
    expect(r.monthlyDebtService).toBeCloseTo(563, 0)
    expect(r.annualDebtService).toBeCloseTo(6759, -1) // ~$6,759/yr
  })

  it('income & expenses: operating income, NOI', () => {
    expect(r.grossRentAnnual).toBe(18600)
    expect(r.vacancyAnnual).toBe(930)
    expect(r.operatingIncomeAnnual).toBe(17670)
    expect(r.operatingExpensesAnnual).toBeCloseTo(7704, 0)
    expect(r.noiAnnual).toBeCloseTo(9966, 0)
  })

  it('cash flow: ~$267/mo, ~$3,207/yr', () => {
    expect(r.cashFlowMonthly).toBeCloseTo(267, 0)
    expect(r.cashFlowAnnual).toBeCloseTo(3207, 0)
  })

  it('returns & ratios match the report', () => {
    expect(r.capRatePurchase).toBeCloseTo(8.0, 1) // 7.97 -> 8%
    expect(r.capRateMarket).toBeCloseTo(6.9, 1)
    expect(r.cashOnCash).toBeCloseTo(9.2, 1) // 9.16
    expect(r.grossRentMultiplier).toBeCloseTo(6.72, 1)
    expect(r.rentToValue).toBeCloseTo(1.2, 1)
    expect(r.dscr).toBeCloseTo(1.47, 1)
    expect(r.operatingExpenseRatio).toBeCloseTo(43.6, 0)
  })

  it('projection: year-1 equity & ROE, year-2 rent growth', () => {
    const y1 = r.projection.find((p) => p.year === 1)!
    expect(y1.propertyValue).toBeCloseTo(149350, -1) // 145,000 * 1.03
    expect(y1.equity).toBeCloseTo(48788, -2) // value - loan balance after 12 payments
    expect(r.returnOnEquityYear1).toBeCloseTo(6.6, 1)

    const y2 = r.projection.find((p) => p.year === 2)!
    expect(y2.grossRent).toBeCloseTo(18972, -1) // 18,600 * 1.02
  })
})

describe('analyzeRental — edge cases', () => {
  it('cash purchase (no financing) has zero debt service', () => {
    const r = analyzeRental({
      purchasePrice: 300000,
      downPaymentPct: 100,
      interestRatePct: 7,
      loanTermYears: 30,
      grossRentMonthly: 2000,
    })
    expect(r.loanAmount).toBe(0)
    expect(r.monthlyDebtService).toBe(0)
    expect(r.cashFlowAnnual).toBeCloseTo(r.noiAnnual, 5)
  })

  it('interest-only loan: balance never amortizes', () => {
    const r = analyzeRental({
      purchasePrice: 400000,
      downPaymentPct: 25,
      interestRatePct: 8,
      loanTermYears: 30,
      loanType: 'interest-only',
      grossRentMonthly: 3000,
    })
    expect(r.loanAmount).toBe(300000)
    expect(r.monthlyDebtService).toBeCloseTo((300000 * 0.08) / 12, 2)
    expect(r.projection.every((p) => p.loanBalance === 300000)).toBe(true)
  })

  it('does not divide by zero on empty inputs', () => {
    const r = analyzeRental({
      purchasePrice: 0,
      downPaymentPct: 20,
      interestRatePct: 7,
      loanTermYears: 30,
      grossRentMonthly: 0,
    })
    expect(Number.isFinite(r.capRatePurchase)).toBe(true)
    expect(Number.isFinite(r.cashOnCash)).toBe(true)
    expect(r.capRatePurchase).toBe(0)
  })
})

describe('remainingBalance', () => {
  it('is the full amount at month 0', () => {
    expect(remainingBalance(200000, 6, 30, 0)).toBeCloseTo(200000, 0)
  })
  it('is zero at the end of the term', () => {
    expect(remainingBalance(200000, 6, 30, 360)).toBeCloseTo(0, 0)
  })
  it('decreases over time', () => {
    const y5 = remainingBalance(200000, 6, 30, 60)
    const y10 = remainingBalance(200000, 6, 30, 120)
    expect(y10).toBeLessThan(y5)
    expect(y5).toBeLessThan(200000)
  })
})

describe('formatters', () => {
  it('formatUSD has no cents', () => {
    expect(formatUSD(3207.49)).toBe('$3,207')
    expect(formatUSD(0)).toBe('$0')
    expect(formatUSD(NaN)).toBe('$0')
  })
  it('formatPct has one decimal', () => {
    expect(formatPct(7.249)).toBe('7.2%')
    expect(formatPct(NaN)).toBe('0.0%')
  })
})
