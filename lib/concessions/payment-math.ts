/**
 * Price cut vs the same dollars as a seller-paid rate buy-down.
 * P&I only (no taxes, insurance, HOA, PMI).
 *
 * Formula: M = L * r / (1 - (1+r)^-n), r = annual_rate/12, n = 360.
 * Port of .concessions-spec/data/payment_math.py. Rate-cut uses the landing
 * spec divide: rate_b = rate - (X/(L*0.01))*0.25/points_per_025. At the
 * documented default of 1.0 point per 0.25%, that equals the Python multiply.
 *
 * Caps: Fannie Mae Selling Guide B3-4.1-02 (fetched 2026-10-13), plus the
 * FHA / VA / USDA limits in .concessions-spec/data/rules.md.
 */

export const TERM_MONTHS = 360

/** One discount point costs 1% of the loan amount (definition, not a market rate). */
export const POINT_FRACTION_OF_LOAN = 0.01

export type LoanType = 'conventional' | 'fha' | 'va' | 'usda'
export type Occupancy = 'principal' | 'second' | 'investment'

export type CompareInput = {
  price: number
  /** Down payment as a percent of price, e.g. 20 for 20%. */
  downPct: number
  /** Annual rate as a percent, e.g. 7.4. */
  ratePct: number
  dollars: number
  /** Discount points that buy about 0.25% off the rate. Default 1.0. */
  pointsPer025: number
  loanType: LoanType
  occupancy: Occupancy
  termMonths?: number
}

export type CompareResult = {
  loan: number
  ltvPct: number
  baselinePi: number
  priceCut: {
    loan: number
    pi: number
    saves: number
    cashToCloseReduction: number
  }
  concession: {
    points: number
    ratePct: number
    pi: number
    saves: number
  }
  monthlyAdvantage: number
  fullTermAdvantage: number
  capPct: number
  capDollars: number
  withinCap: boolean
}

export const DEFAULT_COMPARE: Omit<CompareInput, 'ratePct'> = {
  price: 695_850,
  downPct: 20,
  dollars: 10_000,
  pointsPer025: 1,
  loanType: 'conventional',
  occupancy: 'principal',
}

export function monthlyPI(loan: number, annualRatePct: number, termMonths = TERM_MONTHS): number {
  if (!(loan > 0) || !(termMonths > 0)) return 0
  if (!(annualRatePct > 0)) return loan / termMonths
  const r = annualRatePct / 100 / 12
  return (loan * r) / (1 - Math.pow(1 + r, -termMonths))
}

/**
 * Rate after buying points. Spec: cut = points * 0.25 / pointsPer025.
 * 1.0 matches payment_math.py. A higher pointsPer025 buys less rate.
 */
export function rateAfterBuydown(ratePct: number, points: number, pointsPer025: number): number {
  const per = pointsPer025 > 0 ? pointsPer025 : 1
  const cut = points * 0.25 / per
  return Math.max(0, ratePct - cut)
}

/**
 * Interested-party contribution cap as a percent of price.
 * Conventional: investment 2%; LTV >90 → 3%; >75 → 6%; else 9%.
 * FHA 6, VA 4, USDA 6.
 */
export function concessionCapPct(loanType: LoanType, occupancy: Occupancy, ltvPct: number): number {
  if (loanType === 'fha' || loanType === 'usda') return 6
  if (loanType === 'va') return 4
  if (occupancy === 'investment') return 2
  if (ltvPct > 90) return 3
  if (ltvPct > 75) return 6
  return 9
}

export function comparePriceCutVsConcession(input: CompareInput): CompareResult {
  const price = Math.max(0, input.price)
  const downFraction = Math.min(100, Math.max(0, input.downPct)) / 100
  const dollars = Math.max(0, input.dollars)
  const termMonths = input.termMonths && input.termMonths > 0 ? input.termMonths : TERM_MONTHS
  const loan = price * (1 - downFraction)
  const ltvPct = price > 0 ? (loan / price) * 100 : 0
  const baselinePi = monthlyPI(loan, input.ratePct, termMonths)

  const cutLoan = Math.max(0, price - dollars) * (1 - downFraction)
  const cutPi = monthlyPI(cutLoan, input.ratePct, termMonths)

  const points = loan > 0 ? dollars / (loan * POINT_FRACTION_OF_LOAN) : 0
  const concessionRate = rateAfterBuydown(input.ratePct, points, input.pointsPer025)
  const concessionPi = monthlyPI(loan, concessionRate, termMonths)

  const capPct = concessionCapPct(input.loanType, input.occupancy, ltvPct)
  const capDollars = (capPct / 100) * price
  const monthlyAdvantage = baselinePi - concessionPi - (baselinePi - cutPi)

  return {
    loan,
    ltvPct,
    baselinePi,
    priceCut: {
      loan: cutLoan,
      pi: cutPi,
      saves: baselinePi - cutPi,
      cashToCloseReduction: dollars * downFraction,
    },
    concession: {
      points,
      ratePct: concessionRate,
      pi: concessionPi,
      saves: baselinePi - concessionPi,
    },
    monthlyAdvantage,
    fullTermAdvantage: monthlyAdvantage * termMonths,
    capPct,
    capDollars,
    withinCap: dollars <= capDollars,
  }
}


