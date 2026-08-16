/**
 * Published down payment and loan amount from a list price and a percent.
 *
 * Two widgets on one listing must print the same dollars. Down payment is
 * whole dollars of the listed price. Loan is the remainder so the two sum
 * to that price. Display those dollars exact — never nearest-thousand.
 *
 * Founding case: /homes-for-sale/bend/61579-rockway-220226183 printed
 * $130,000 down on Monthly payment (Price thousand-round) and $129,800
 * on Rental analysis (20% of $649,000). Fleet 0b2eea305a233f4a1d246cf2e8f1a299.
 */

export type PublishedFinancingSplit = {
  price: number
  downPayment: number
  loanAmount: number
  downPaymentPct: number
}

function asPositivePrice(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  return Math.round(value)
}

function asDownPct(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value < 0 || value > 100) return null
  return value
}

export function publishFinancingSplit(input: {
  price: number | null | undefined
  downPaymentPct: number | null | undefined
}): PublishedFinancingSplit | null {
  const price = asPositivePrice(input.price)
  const downPaymentPct = asDownPct(input.downPaymentPct)
  if (price == null || downPaymentPct == null) return null
  const downPayment = Math.round((price * downPaymentPct) / 100)
  const loanAmount = Math.max(0, price - downPayment)
  return { price, downPayment, loanAmount, downPaymentPct }
}
