/**
 * Commission net-split math — the money path, made pure + testable.
 *
 * From the GCI (gross commission income) subtract the deductions to get the
 * splittable net, give the agent their split percentage of it, and the brokerage
 * keeps the rounded remainder (so the two nets always sum back to the net — no
 * penny leaks). Cents rounding. Nets are null until the GCI is known.
 *
 * This was inlined + untested inside updateTcCommission; a regression here
 * mis-pays an agent or the brokerage on a closed deal.
 */
export type CommissionNetsInput = {
  /** Gross commission income; null until known. */
  gci: number | null
  referralFee: number
  tcFee: number
  otherDeductions: number
  /** Agent's share of the post-deduction net, 0..100. */
  splitPercent: number
}

export type CommissionNets = {
  /** Post-deduction splittable amount (gci - fees), or null when gci is null. */
  net: number | null
  agentNet: number | null
  brokerageNet: number | null
}

const round2 = (n: number): number => Math.round(n * 100) / 100

export function computeCommissionNets(input: CommissionNetsInput): CommissionNets {
  if (input.gci == null) return { net: null, agentNet: null, brokerageNet: null }
  const net = input.gci - input.referralFee - input.tcFee - input.otherDeductions
  const agentNet = round2(net * (input.splitPercent / 100))
  // Brokerage keeps the remainder against the (already-rounded) agent net, so
  // agentNet + brokerageNet === round(net) exactly — rounding never loses a cent.
  const brokerageNet = round2(net - agentNet)
  return { net, agentNet, brokerageNet }
}
