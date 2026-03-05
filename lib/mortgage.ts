/**
 * Shared mortgage math for estimated monthly principal & interest.
 * Default display: 20% down, current rate (env or 7%), 30-year term.
 */

/** Default interest rate for display when user has no saved preferences. Set NEXT_PUBLIC_DEFAULT_MORTGAGE_RATE to update. */
export const DEFAULT_DISPLAY_RATE = typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_DEFAULT_MORTGAGE_RATE != null
  ? Number(process.env.NEXT_PUBLIC_DEFAULT_MORTGAGE_RATE) || 7
  : 7

export const DEFAULT_DISPLAY_DOWN_PCT = 20
export const DEFAULT_DISPLAY_TERM_YEARS = 30

/**
 * Monthly principal & interest for a fixed-rate loan.
 */
export function monthlyPrincipalAndInterest(
  loanAmount: number,
  annualRatePercent: number,
  termYears: number
): number {
  if (loanAmount <= 0 || termYears <= 0) return 0
  const monthlyRate = annualRatePercent / 100 / 12
  const numPayments = termYears * 12
  if (monthlyRate <= 0) return loanAmount / numPayments
  return (
    (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments))) /
    (Math.pow(1 + monthlyRate, numPayments) - 1)
  )
}

/**
 * Given list price and terms, return estimated monthly P&I (no tax/insurance/PMI).
 */
export function estimatedMonthlyPayment(
  listPrice: number,
  downPaymentPercent: number,
  interestRatePercent: number,
  loanTermYears: number
): number {
  if (listPrice <= 0) return 0
  const down = (listPrice * downPaymentPercent) / 100
  const loan = listPrice - down
  return monthlyPrincipalAndInterest(loan, interestRatePercent, loanTermYears)
}

export function formatMonthlyPayment(monthly: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(monthly)
}
