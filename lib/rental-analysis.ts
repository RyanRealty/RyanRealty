/**
 * Long-term rental (buy & hold) investment analysis.
 *
 * Pure functions only — no I/O, no React — so the same engine drives the
 * standalone calculator page, the listing-detail embed, and the PDF report,
 * and can be unit-tested against known-good numbers.
 *
 * Formulas reconciled against a verified long-term-rental sample report. See
 * lib/rental-analysis.test.ts for the reconciliation. Every figure that reaches
 * a user must trace to this engine (CLAUDE.md §0 data-accuracy).
 */

import { monthlyPrincipalAndInterest } from './mortgage'

/** Monthly operating-expense line items (dollars per month). */
export interface OperatingExpensesMonthly {
  propertyTaxes?: number
  insurance?: number
  propertyManagement?: number
  maintenance?: number
  capitalReserves?: number
  hoa?: number
  other?: number
}

export interface RentalAnalysisInputs {
  purchasePrice: number
  downPaymentPct: number
  interestRatePct: number
  loanTermYears: number
  loanType?: 'amortizing' | 'interest-only'
  /**
   * Explicit loan amount. If omitted, computed as purchasePrice * (1 - downPaymentPct/100).
   * Provide to model financed points / closing costs rolled into the loan.
   */
  loanAmount?: number
  /** Cash-paid purchase / closing costs (excludes any amount financed into the loan). */
  purchaseCostsCash?: number
  /** Rehab budget, paid in cash. */
  rehabCost?: number
  /**
   * Current market value (or after-repair value). Used for cap-rate-on-market and as the
   * base for appreciation in the projection. Defaults to purchasePrice.
   */
  marketValue?: number
  grossRentMonthly: number
  /** Percent, e.g. 5 for 5%. Default 5. */
  vacancyPct?: number
  otherIncomeMonthly?: number
  expenses?: OperatingExpensesMonthly
  /** Percent per year. Default 3. */
  appreciationPct?: number
  /** Percent per year. Default 2. */
  rentGrowthPct?: number
  /** Percent per year. Default 2. */
  expenseGrowthPct?: number
  /** Which years to include in the projection table. Default [1,2,3,5,10,20,30]. */
  projectionYears?: number[]
}

export interface ProjectionYear {
  year: number
  propertyValue: number
  loanBalance: number
  equity: number
  grossRent: number
  operatingExpenses: number
  noi: number
  cashFlow: number
}

export interface RentalAnalysisResult {
  // Acquisition
  downPayment: number
  loanAmount: number
  totalCashNeeded: number
  // Financing
  monthlyDebtService: number
  annualDebtService: number
  // Income
  grossRentMonthly: number
  grossRentAnnual: number
  vacancyAnnual: number
  otherIncomeAnnual: number
  operatingIncomeAnnual: number
  // Expenses
  operatingExpensesMonthly: number
  operatingExpensesAnnual: number
  // Returns
  noiMonthly: number
  noiAnnual: number
  cashFlowMonthly: number
  cashFlowAnnual: number
  capRatePurchase: number // %
  capRateMarket: number // %
  cashOnCash: number // %
  returnOnEquityYear1: number // %
  grossRentMultiplier: number
  rentToValue: number // %
  dscr: number
  operatingExpenseRatio: number // %
  // Long-term
  projection: ProjectionYear[]
}

const DEFAULT_PROJECTION_YEARS = [1, 2, 3, 5, 10, 20, 30]

function sumExpenses(e?: OperatingExpensesMonthly): number {
  if (!e) return 0
  return (
    (e.propertyTaxes ?? 0) +
    (e.insurance ?? 0) +
    (e.propertyManagement ?? 0) +
    (e.maintenance ?? 0) +
    (e.capitalReserves ?? 0) +
    (e.hoa ?? 0) +
    (e.other ?? 0)
  )
}

/** Remaining loan balance after `months` payments of a fully-amortizing loan. */
export function remainingBalance(
  loanAmount: number,
  annualRatePercent: number,
  termYears: number,
  months: number
): number {
  if (loanAmount <= 0) return 0
  const monthlyRate = annualRatePercent / 100 / 12
  const payment = monthlyPrincipalAndInterest(loanAmount, annualRatePercent, termYears)
  if (monthlyRate <= 0) {
    return Math.max(0, loanAmount - payment * months)
  }
  // Standard remaining-balance closed form.
  const compounded = Math.pow(1 + monthlyRate, months)
  const balance = loanAmount * compounded - payment * ((compounded - 1) / monthlyRate)
  return Math.max(0, balance)
}

export function analyzeRental(inputs: RentalAnalysisInputs): RentalAnalysisResult {
  const price = Math.max(0, inputs.purchasePrice || 0)
  const downPaymentPct = inputs.downPaymentPct ?? 20
  const marketValue = inputs.marketValue && inputs.marketValue > 0 ? inputs.marketValue : price
  const loanType = inputs.loanType ?? 'amortizing'
  const vacancyPct = inputs.vacancyPct ?? 5
  const appreciationPct = inputs.appreciationPct ?? 3
  const rentGrowthPct = inputs.rentGrowthPct ?? 2
  const expenseGrowthPct = inputs.expenseGrowthPct ?? 2

  // Acquisition
  const downPayment = Math.round((price * downPaymentPct) / 100)
  const loanAmount =
    inputs.loanAmount != null && inputs.loanAmount >= 0 ? inputs.loanAmount : Math.max(0, price - downPayment)
  const purchaseCostsCash = Math.max(0, inputs.purchaseCostsCash ?? 0)
  const rehabCost = Math.max(0, inputs.rehabCost ?? 0)
  const totalCashNeeded = downPayment + purchaseCostsCash + rehabCost

  // Financing
  const monthlyDebtService =
    loanType === 'interest-only'
      ? (loanAmount * (inputs.interestRatePct / 100)) / 12
      : monthlyPrincipalAndInterest(loanAmount, inputs.interestRatePct, inputs.loanTermYears)
  const annualDebtService = monthlyDebtService * 12

  // Income
  const grossRentMonthly = Math.max(0, inputs.grossRentMonthly || 0)
  const grossRentAnnual = grossRentMonthly * 12
  const otherIncomeAnnual = Math.max(0, inputs.otherIncomeMonthly ?? 0) * 12
  const vacancyAnnual = (grossRentAnnual * vacancyPct) / 100
  const operatingIncomeAnnual = grossRentAnnual - vacancyAnnual + otherIncomeAnnual

  // Expenses
  const operatingExpensesMonthly = sumExpenses(inputs.expenses)
  const operatingExpensesAnnual = operatingExpensesMonthly * 12

  // NOI & cash flow
  const noiAnnual = operatingIncomeAnnual - operatingExpensesAnnual
  const noiMonthly = noiAnnual / 12
  const cashFlowAnnual = noiAnnual - annualDebtService
  const cashFlowMonthly = cashFlowAnnual / 12

  // Ratios
  const capRatePurchase = price > 0 ? (noiAnnual / price) * 100 : 0
  const capRateMarket = marketValue > 0 ? (noiAnnual / marketValue) * 100 : 0
  const cashOnCash = totalCashNeeded > 0 ? (cashFlowAnnual / totalCashNeeded) * 100 : 0
  const grossRentMultiplier = grossRentAnnual > 0 ? price / grossRentAnnual : 0
  const rentToValue = price > 0 ? (grossRentMonthly / price) * 100 : 0
  const dscr = annualDebtService > 0 ? noiAnnual / annualDebtService : 0
  const operatingExpenseRatio =
    operatingIncomeAnnual > 0 ? (operatingExpensesAnnual / operatingIncomeAnnual) * 100 : 0

  // Long-term projection
  const years = inputs.projectionYears ?? DEFAULT_PROJECTION_YEARS
  const projection: ProjectionYear[] = years.map((year) => {
    const propertyValue = marketValue * Math.pow(1 + appreciationPct / 100, year)
    const loanBalance =
      loanType === 'interest-only'
        ? loanAmount
        : remainingBalance(loanAmount, inputs.interestRatePct, inputs.loanTermYears, year * 12)
    const equity = propertyValue - loanBalance
    const rentFactor = Math.pow(1 + rentGrowthPct / 100, year - 1)
    const grossRent = grossRentAnnual * rentFactor
    const vacancy = (grossRent * vacancyPct) / 100
    const otherInc = otherIncomeAnnual * rentFactor
    const operatingIncome = grossRent - vacancy + otherInc
    const operatingExpenses = operatingExpensesAnnual * Math.pow(1 + expenseGrowthPct / 100, year - 1)
    const noi = operatingIncome - operatingExpenses
    const cashFlow = noi - annualDebtService
    return { year, propertyValue, loanBalance, equity, grossRent, operatingExpenses, noi, cashFlow }
  })

  const equityYear1 =
    projection.find((p) => p.year === 1)?.equity ??
    marketValue * (1 + appreciationPct / 100) - remainingBalance(loanAmount, inputs.interestRatePct, inputs.loanTermYears, 12)
  const returnOnEquityYear1 = equityYear1 > 0 ? (cashFlowAnnual / equityYear1) * 100 : 0

  return {
    downPayment,
    loanAmount,
    totalCashNeeded,
    monthlyDebtService,
    annualDebtService,
    grossRentMonthly,
    grossRentAnnual,
    vacancyAnnual,
    otherIncomeAnnual,
    operatingIncomeAnnual,
    operatingExpensesMonthly,
    operatingExpensesAnnual,
    noiMonthly,
    noiAnnual,
    cashFlowMonthly,
    cashFlowAnnual,
    capRatePurchase,
    capRateMarket,
    cashOnCash,
    returnOnEquityYear1,
    grossRentMultiplier,
    rentToValue,
    dscr,
    operatingExpenseRatio,
    projection,
  }
}

/** USD, no cents. */
export function formatUSD(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0)
}

/** Percent with one decimal, e.g. "7.2%". */
export function formatPct(n: number): string {
  return `${(Number.isFinite(n) ? n : 0).toFixed(1)}%`
}
