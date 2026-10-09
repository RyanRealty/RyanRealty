/**
 * Seller net sheet math for Bend and Deschutes County (SEO & AEO Desk brief
 * 2026-10-08, /tools/seller-net-sheet, section 4b). Pure functions only: the
 * server-rendered worked example and the client calculator both call these,
 * so the crawled text and the live calculator can never disagree.
 *
 * Every rate comes from lib/blog/cost-to-sell-inputs.ts, the same constants the
 * cost-to-sell guide prints, so the two pages show the same numbers:
 *   listing fee 3% (our own fee), lien search $25 (OTIRO manual section
 *   1.008(A), Deschutes), recording $102 first page and $5 each added page
 *   (Deschutes County Clerk, July 1, 2026), tax default 0.698% (Deschutes
 *   average effective rate, DOR FY 2025-26). The title and escrow schedules
 *   below are the published formulas: OTIRO Schedule One (manual effective
 *   Sept. 1, 2025) and the Deschutes County Title "Sale (Total Fee)" rate card
 *   (revised 03/2023).
 *
 * No wall clock and no Date objects: closing days are civil YYYY-MM-DD strings,
 * so the result is the same on the server and in the browser.
 */
import { COST_TO_SELL_INPUTS } from '@/lib/blog/cost-to-sell-inputs'

export const NET_SHEET_RATES = {
  listingFeeRate: COST_TO_SELL_INPUTS.listingFeeRate,
  illustrativeBuyerAgentRate: COST_TO_SELL_INPUTS.illustrativeBuyerAgentRate,
  lienSearchFee: COST_TO_SELL_INPUTS.lienSearchFee,
  recordingFirstPage: COST_TO_SELL_INPUTS.recordingFirstPage,
  recordingAdditionalPage: COST_TO_SELL_INPUTS.recordingAdditionalPage,
  effectiveTaxRate: COST_TO_SELL_INPUTS.illustrativeEffectiveTaxRate,
} as const

/** Calculator bounds (brief section 4a). */
export const NET_SHEET_LIMITS = {
  priceMin: 50_000,
  priceMax: 25_000_000,
  buyerAgentPctMax: 6,
  loansMax: 2,
  pagesMin: 1,
  pagesMax: 10,
} as const

/** The rate card has no row above this price. */
export const ESCROW_CARD_MAX = 1_000_000

/** Round half up to the dollar (OTIRO section 2.010). Inputs here are positive. */
function roundHalfUp(n: number): number {
  return Math.floor(n + 0.5)
}

/**
 * OTIRO Oregon Rating Manual, Schedule One, Basic Insurance Rate. "Each $1,000
 * (and fraction)" over the bracket floor, rounded to the dollar. A standard
 * owner's policy is 100% of this rate (section 3.002(A)).
 */
export function otiroBasic(price: number): number {
  const over = (floor: number) => Math.ceil((price - floor) / 1_000)
  let rate: number
  if (price <= 25_000) rate = 200
  else if (price <= 50_000) rate = 200 + 4 * over(25_000)
  else if (price <= 100_000) rate = 300 + 3 * over(50_000)
  else if (price <= 300_000) rate = 450 + 2.5 * over(100_000)
  else if (price <= 500_000) rate = 950 + 2 * over(300_000)
  else if (price <= 10_000_000) rate = 1_350 + 1.5 * over(500_000)
  else rate = 15_600 + 1.25 * over(10_000_000)
  return roundHalfUp(rate)
}

/** The rate card row at or above the price ($5,000 steps). */
export function escrowCardRow(price: number): number {
  return Math.ceil(price / 5_000) * 5_000
}

/**
 * Deschutes County Title "Sale (Total Fee)": $800 under $100,000, otherwise
 * $850 plus $2.75 per $1,000 over $100,000, read at the card row. Above
 * $1,000,000 the card has no row; the same slope is used and the result is
 * flagged illustrative.
 */
export function escrowTotal(price: number): number {
  const row = escrowCardRow(price)
  if (row < 100_000) return 800
  return roundHalfUp(850 + (2.75 * (row - 100_000)) / 1_000)
}

/** The seller's half; split 50/50 by local custom (the contract controls). */
export function escrowSeller(price: number): number {
  return roundHalfUp(escrowTotal(price) / 2)
}

/** One recorded release per loan, first page plus each added page. */
export function recordingReleases(loans: number, pagesPerRelease: number): number {
  if (loans <= 0) return 0
  const pages = Math.max(1, Math.round(pagesPerRelease))
  return Math.round(loans) * (NET_SHEET_RATES.recordingFirstPage + NET_SHEET_RATES.recordingAdditionalPage * (pages - 1))
}

/** Annual property tax estimate at the Deschutes average effective rate. */
export function estimatedAnnualTax(price: number): number {
  return Math.round(price * NET_SHEET_RATES.effectiveTaxRate)
}

/* ------------------------------------------------------------------------ */
/* Civil-day arithmetic (no Date objects).                                   */
/* ------------------------------------------------------------------------ */

export type CivilDay = { y: number; m: number; d: number }

export function parseCivilDay(ymd: string): CivilDay | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null
  return { y, m, d }
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

export function daysInMonth(y: number, m: number): number {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
}

/** Days since 1970-01-01 for a civil day (Howard Hinnant's days_from_civil). */
function dayNumber({ y, m, d }: CivilDay): number {
  const yy = m <= 2 ? y - 1 : y
  const era = Math.floor(yy / 400)
  const yoe = yy - era * 400
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy
  return era * 146_097 + doe - 719_468
}

function civilFromDayNumber(n: number): CivilDay {
  const z = n + 719_468
  const era = Math.floor(z / 146_097)
  const doe = z - era * 146_097
  const yoe = Math.floor((doe - Math.floor(doe / 1_460) + Math.floor(doe / 36_524) - Math.floor(doe / 146_096)) / 365)
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100))
  const mp = Math.floor((5 * doy + 2) / 153)
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1
  const m = mp < 10 ? mp + 3 : mp - 9
  return { y: yoe + era * 400 + (m <= 2 ? 1 : 0), m, d }
}

export function formatCivilDay({ y, m, d }: CivilDay): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** ymd plus n days, as YYYY-MM-DD. */
export function addDays(ymd: string, n: number): string | null {
  const day = parseCivilDay(ymd)
  if (!day) return null
  return formatCivilDay(civilFromDayNumber(dayNumber(day) + n))
}

/**
 * The worked example's closing day: the next 30th after the as-of day (the
 * last day of February in February). An Oct 8 as-of closes Oct 30.
 */
export function exampleClosingDate(asOfYmd: string): string | null {
  const day = parseCivilDay(asOfYmd)
  if (!day) return null
  const target = (y: number, m: number) => Math.min(30, daysInMonth(y, m))
  if (day.d < target(day.y, day.m)) return formatCivilDay({ y: day.y, m: day.m, d: target(day.y, day.m) })
  const y = day.m === 12 ? day.y + 1 : day.y
  const m = day.m === 12 ? 1 : day.m + 1
  return formatCivilDay({ y, m, d: target(y, m) })
}

export type TaxYearShare = {
  /** First day of the July-through-June tax year that holds the closing. */
  taxYearStart: string
  /** 365, or 366 when that tax year holds a Feb 29. */
  taxYearDays: number
  /** Jul 1 through the closing day, inclusive. */
  sellerDays: number
}

export function taxYearShare(closingYmd: string): TaxYearShare | null {
  const day = parseCivilDay(closingYmd)
  if (!day) return null
  const startYear = day.m >= 7 ? day.y : day.y - 1
  const start = { y: startYear, m: 7, d: 1 }
  const nextStart = { y: startYear + 1, m: 7, d: 1 }
  return {
    taxYearStart: formatCivilDay(start),
    taxYearDays: dayNumber(nextStart) - dayNumber(start),
    sellerDays: dayNumber(day) - dayNumber(start) + 1,
  }
}

/**
 * Oregon tax bills go out around Oct 25. A closing from Jul 1 through Oct 24
 * falls before this year's bill exists, so it cannot have been paid.
 */
export function taxBillCanBePaid(closingYmd: string): boolean {
  const day = parseCivilDay(closingYmd)
  if (!day) return true
  const md = day.m * 100 + day.d
  return !(md >= 701 && md <= 1024)
}

export type TaxProration = { debit: number; credit: number; share: TaxYearShare }

/** The seller's share (unpaid bill) or the buyer's share back (paid in full). */
export function taxProration(annualTax: number, closingYmd: string, paidInFull: boolean): TaxProration | null {
  const share = taxYearShare(closingYmd)
  if (!share || !(annualTax >= 0)) return null
  if (paidInFull) {
    return {
      debit: 0,
      credit: Math.round((annualTax * (share.taxYearDays - share.sellerDays)) / share.taxYearDays),
      share,
    }
  }
  return { debit: Math.round((annualTax * share.sellerDays) / share.taxYearDays), credit: 0, share }
}

/* ------------------------------------------------------------------------ */
/* The sheet.                                                                */
/* ------------------------------------------------------------------------ */

export type NetSheetInput = {
  price: number
  /** Buyer's-agent compensation you agree to cover, as a percent (2.5 = 2.5%) or dollars. */
  buyerAgent: { mode: 'pct'; value: number } | { mode: 'usd'; value: number }
  loans: number
  pagesPerRelease: number
  /** Blank (null) keeps the result "before loan payoff". */
  payoff: number | null
  closingDate: string
  annualTax: number
  paidInFull: boolean
  hoaFees: number
  otherCosts: number
}

export type NetSheet = {
  price: number
  listingFee: number
  buyerAgent: number
  ownersTitlePolicy: number
  escrowTotal: number
  escrowSeller: number
  /** The price is above the rate card's last row: the escrow line is illustrative. */
  escrowIllustrative: boolean
  lienSearch: number
  recording: number
  transferTax: number
  costOfSale: number
  costShare: number
  taxDebit: number
  taxCredit: number
  taxShare: TaxYearShare | null
  hoaFees: number
  otherCosts: number
  netBeforePayoff: number
  payoff: number | null
  net: number
}

export function netSheet(input: NetSheetInput): NetSheet {
  const price = input.price
  const listingFee = Math.round(price * NET_SHEET_RATES.listingFeeRate)
  const buyerAgent =
    input.buyerAgent.mode === 'pct'
      ? Math.round((price * input.buyerAgent.value) / 100)
      : Math.round(input.buyerAgent.value)
  const ownersTitlePolicy = otiroBasic(price)
  const total = escrowTotal(price)
  const seller = escrowSeller(price)
  const lienSearch = NET_SHEET_RATES.lienSearchFee
  const recording = recordingReleases(input.loans, input.pagesPerRelease)
  const transferTax = 0
  const costOfSale = listingFee + buyerAgent + ownersTitlePolicy + lienSearch + seller + recording + transferTax
  const proration = taxProration(input.annualTax, input.closingDate, input.paidInFull)
  const taxDebit = proration?.debit ?? 0
  const taxCredit = proration?.credit ?? 0
  const netBeforePayoff = price - costOfSale - taxDebit + taxCredit - input.hoaFees - input.otherCosts
  return {
    price,
    listingFee,
    buyerAgent,
    ownersTitlePolicy,
    escrowTotal: total,
    escrowSeller: seller,
    escrowIllustrative: price > ESCROW_CARD_MAX,
    lienSearch,
    recording,
    transferTax,
    costOfSale,
    costShare: costOfSale / price,
    taxDebit,
    taxCredit,
    taxShare: proration?.share ?? null,
    hoaFees: input.hoaFees,
    otherCosts: input.otherCosts,
    netBeforePayoff,
    payoff: input.payoff,
    net: netBeforePayoff - (input.payoff ?? 0),
  }
}

export type NetSheetField =
  | 'price'
  | 'buyerAgent'
  | 'loans'
  | 'pagesPerRelease'
  | 'payoff'
  | 'closingDate'
  | 'annualTax'
  | 'hoaFees'
  | 'otherCosts'

/** Inline messages for out-of-range inputs. An empty object means the sheet can run. */
export function validateNetSheet(input: NetSheetInput): Partial<Record<NetSheetField, string>> {
  const errors: Partial<Record<NetSheetField, string>> = {}
  const L = NET_SHEET_LIMITS
  const finite = (n: number | null) => n == null || Number.isFinite(n)
  if (!Number.isFinite(input.price) || input.price < L.priceMin || input.price > L.priceMax) {
    errors.price = 'Enter a sale price from $50,000 to $25,000,000.'
  }
  if (input.buyerAgent.mode === 'pct') {
    if (!Number.isFinite(input.buyerAgent.value) || input.buyerAgent.value < 0 || input.buyerAgent.value > L.buyerAgentPctMax) {
      errors.buyerAgent = 'Enter 0% to 6%.'
    }
  } else if (
    !Number.isFinite(input.buyerAgent.value) ||
    input.buyerAgent.value < 0 ||
    (Number.isFinite(input.price) && input.buyerAgent.value > (input.price * L.buyerAgentPctMax) / 100)
  ) {
    errors.buyerAgent = 'Enter a dollar amount from $0 up to 6% of the price.'
  }
  if (!Number.isInteger(input.loans) || input.loans < 0 || input.loans > L.loansMax) {
    errors.loans = 'Choose 0, 1, or 2 loans.'
  }
  if (!Number.isInteger(input.pagesPerRelease) || input.pagesPerRelease < L.pagesMin || input.pagesPerRelease > L.pagesMax) {
    errors.pagesPerRelease = 'Enter 1 to 10 pages.'
  }
  if (!finite(input.payoff) || (input.payoff != null && input.payoff < 0)) {
    errors.payoff = 'Enter your payoff in dollars, or leave it blank.'
  }
  if (!parseCivilDay(input.closingDate)) errors.closingDate = 'Choose a closing date.'
  if (!Number.isFinite(input.annualTax) || input.annualTax < 0) errors.annualTax = 'Enter your annual tax in dollars.'
  if (!Number.isFinite(input.hoaFees) || input.hoaFees < 0) errors.hoaFees = 'Enter a dollar amount, or 0.'
  if (!Number.isFinite(input.otherCosts) || input.otherCosts < 0) errors.otherCosts = 'Enter a dollar amount, or 0.'
  return errors
}

/* ------------------------------------------------------------------------ */
/* The worked example at the 12-month median.                                */
/* ------------------------------------------------------------------------ */

export type NetSheetExample = {
  asOf: string
  closingDate: string
  annualTax: number
  low: NetSheet
  high: NetSheet
  /** Title, escrow half, lien search, and recording: the lines that are not commission. */
  fixedCosts: number
}

/**
 * The static example: one mortgage, a one-page release, this year's bill not
 * yet paid, no HOA or credits, payoff left blank. Low covers no buyer's agent;
 * high covers the illustrative 2.5%.
 */
export function netSheetExample(price: number, asOfYmd: string): NetSheetExample | null {
  const closingDate = exampleClosingDate(asOfYmd)
  if (!closingDate || !(price > 0)) return null
  const annualTax = estimatedAnnualTax(price)
  const base: Omit<NetSheetInput, 'buyerAgent'> = {
    price,
    loans: 1,
    pagesPerRelease: 1,
    payoff: null,
    closingDate,
    annualTax,
    paidInFull: false,
    hoaFees: 0,
    otherCosts: 0,
  }
  const low = netSheet({ ...base, buyerAgent: { mode: 'pct', value: 0 } })
  const high = netSheet({
    ...base,
    buyerAgent: { mode: 'pct', value: NET_SHEET_RATES.illustrativeBuyerAgentRate * 100 },
  })
  return {
    asOf: asOfYmd,
    closingDate,
    annualTax,
    low,
    high,
    fixedCosts: low.ownersTitlePolicy + low.escrowSeller + low.lienSearch + low.recording,
  }
}
