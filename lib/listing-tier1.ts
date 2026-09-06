/**
 * Tier 1 derived listing metrics — the pricing ratios and the monthly payment
 * estimate the sync writes onto every `listings` row.
 *
 * Split out of lib/listing-mapper.ts (file-size budget) and re-exported there,
 * so existing importers keep working unchanged. The mapper maps; this computes.
 *
 * The PITI rate used to be `const rate = 0.065` inline, which meant every
 * `listings.estimated_monthly_piti` row implied exactly 6.50% regardless of
 * when it synced. It is now an input: the sync resolves the live 30-yr rate
 * once per run (lib/data/market/getLiveMortgageRate.ts, off
 * market_history_weekly / freddie:pmms30) and hands it down.
 *
 * The rest of the payment assumptions — 20% down, 30-yr term, 0.35%/yr
 * insurance — are unchanged and are disclosed wherever the number is displayed.
 *
 * The tax fallback used to be a local `0.012` (1.2%). It is now the measured
 * repo-wide constant in lib/property-tax-rate.ts, 0.57% of list price, which is
 * also what the `compute_listing_derived_fields()` trigger uses. The two write
 * the same column and now agree.
 */

import { PROPERTY_TAX_RATE_FRACTION } from '@/lib/property-tax-rate'

/**
 * Rate used when the caller supplies none: 6.5%, the value every row written
 * before 2026-08-17 carries. It is the FALLBACK, not the intended input —
 * keeping it means a caller that passes nothing produces a byte-identical row.
 * Face Est. $/mo and the listing payment calculator seed this same fallback.
 */
export const DEFAULT_PITI_RATE = 0.065

/** Financed share, i.e. 20% down. Face and the calculator seed share this. */
export const DEFAULT_PITI_DOWN_PAYMENT_FRACTION = 0.8
export const DEFAULT_PITI_DOWN_PAYMENT_PCT = 20
export const DEFAULT_PITI_TERM_MONTHS = 360
export const DEFAULT_PITI_TERM_YEARS = 30
/** Hazard insurance as a share of price per year. Face and the calculator seed share this. */
export const DEFAULT_PITI_INSURANCE_RATE = 0.0035

const DOWN_PAYMENT_FRACTION = DEFAULT_PITI_DOWN_PAYMENT_FRACTION
const TERM_MONTHS = DEFAULT_PITI_TERM_MONTHS
const INSURANCE_RATE = DEFAULT_PITI_INSURANCE_RATE

/**
 * Coerce a caller-supplied rate to the decimal fraction the math wants.
 * Accepts either shape because both circulate here: `app_config.mortgage_rate`
 * stores a fraction (0.065), while `getCalculatorDefaults()` and
 * `market_history_weekly` carry percent (6.67). A real 30-yr rate is 2–20%, so
 * anything under 1 can only be a fraction — and anything outside that band
 * after normalization is not a rate, so it falls back rather than writing a
 * fabricated payment.
 */
export function normalizePitiRate(rate: number | null | undefined): number {
  if (rate == null || typeof rate !== 'number' || !Number.isFinite(rate)) return DEFAULT_PITI_RATE
  const fraction = rate >= 1 ? rate / 100 : rate
  return fraction >= 0.02 && fraction <= 0.2 ? fraction : DEFAULT_PITI_RATE
}

export interface MonthlyPitiInput {
  listPrice: number | null
  taxAnnual: number | null
  hoaMonthly: number | null
  /** Fraction (0.0667) or percent (6.67). Null / omitted → DEFAULT_PITI_RATE. */
  mortgageRate?: number | null
  /**
   * Financed share of price. Omit / null → 0.8 (20% down). The listing
   * calculator passes this when the visitor changes the down-payment field;
   * the face estimate omits it so both seed the same cents.
   */
  financedFraction?: number | null
  /**
   * Loan term in months. Omit / null → 360. Same seed rule as financedFraction.
   */
  termMonths?: number | null
  /**
   * Annual insurance dollars. Omit / null → listPrice × 0.35%. 0 is a quote
   * of zero, not a miss — unlike tax, where 0 means "use the fallback".
   */
  insuranceAnnual?: number | null
}

export type MonthlyPitiBreakdown = {
  pi: number
  taxMonthly: number
  insuranceMonthly: number
  hoaMonthly: number
  total: number
}

function financedShare(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return DOWN_PAYMENT_FRACTION
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function termLength(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value) || value <= 0) return TERM_MONTHS
  return value
}

function monthlyPrincipalAndInterest(principal: number, monthlyRate: number, termMonths: number): number {
  if (principal <= 0 || termMonths <= 0) return 0
  if (monthlyRate === 0) return principal / termMonths
  const growth = Math.pow(1 + monthlyRate, termMonths)
  return (principal * monthlyRate * growth) / (growth - 1)
}

/**
 * The one PITI breakdown. Face Est. $/mo and the listing calculator seed
 * this with listPrice, taxAnnual, hoaMonthly, and the same rate/insurance
 * defaults. Interactive calculator fields pass the optional overrides.
 */
export function computeMonthlyPitiBreakdown(input: MonthlyPitiInput): MonthlyPitiBreakdown | null {
  const { listPrice, taxAnnual, hoaMonthly } = input
  if (listPrice == null || listPrice <= 0) return null

  const monthlyRate = normalizePitiRate(input.mortgageRate) / 12
  const principal = listPrice * financedShare(input.financedFraction)
  const pi = monthlyPrincipalAndInterest(principal, monthlyRate, termLength(input.termMonths))
  // 0 is treated as missing, matching the trigger: COALESCE(NULLIF(tax,0), fallback)
  const taxMonthly = (taxAnnual != null && taxAnnual > 0 ? taxAnnual : listPrice * PROPERTY_TAX_RATE_FRACTION) / 12
  const insuranceAnnual =
    input.insuranceAnnual != null && Number.isFinite(input.insuranceAnnual)
      ? Math.max(0, input.insuranceAnnual)
      : listPrice * INSURANCE_RATE
  const insuranceMonthly = insuranceAnnual / 12
  const hoa = hoaMonthly ?? 0
  const total = Math.round((pi + taxMonthly + insuranceMonthly + hoa) * 100) / 100
  return { pi, taxMonthly, insuranceMonthly, hoaMonthly: hoa, total }
}

/** Monthly PITI rounded to cents, or null when there is no price to price. */
export function computeMonthlyPiti(input: MonthlyPitiInput): number | null {
  return computeMonthlyPitiBreakdown(input)?.total ?? null
}

// ---------------------------------------------------------------------------
// Tier 1 computations — pricing ratios and derived metrics
// ---------------------------------------------------------------------------

function safeDiv(a: number | null, b: number | null, decimals: number): number | null {
  if (a == null || b == null || b === 0) return null
  return Math.round((a / b) * Math.pow(10, decimals)) / Math.pow(10, decimals)
}

export interface Tier1Input {
  listPrice: number | null
  closePrice: number | null
  originalListPrice: number | null
  sqft: number | null
  lotAcres: number | null
  lotSqft: number | null
  bedrooms: number | null
  bathrooms: number | null
  rooms: number | null
  yearBuilt: number | null
  aboveGrade: number | null
  buildingTotal: number | null
  hoaMonthly: number | null
  taxAnnual: number | null
  taxAssessed: number | null
  /** 30-yr rate for the PITI estimate; fraction or percent. See normalizePitiRate. */
  mortgageRate?: number | null
}

export function computeTier1(input: Tier1Input) {
  const {
    listPrice, closePrice, originalListPrice, sqft, lotAcres, lotSqft,
    bedrooms, bathrooms, rooms, yearBuilt, aboveGrade, buildingTotal,
    hoaMonthly, taxAnnual, taxAssessed
  } = input

  const currentYear = new Date().getFullYear()
  const piti = computeMonthlyPiti({ listPrice, taxAnnual, hoaMonthly, mortgageRate: input.mortgageRate })

  return {
    price_per_sqft: safeDiv(listPrice, sqft, 2),
    close_price_per_sqft: safeDiv(closePrice, sqft, 2),
    sale_to_list_ratio: safeDiv(closePrice, originalListPrice, 4),
    sale_to_final_list_ratio: safeDiv(closePrice, listPrice, 4),
    total_price_change_pct: originalListPrice && listPrice
      ? Math.round(((listPrice - originalListPrice) / originalListPrice) * 10000) / 100
      : null,
    total_price_change_amt: originalListPrice != null && listPrice != null
      ? listPrice - originalListPrice
      : null,
    price_per_acre: safeDiv(listPrice, lotAcres, 2),
    price_per_bedroom: safeDiv(listPrice, bedrooms, 2),
    price_per_room: safeDiv(listPrice, rooms, 2),
    property_age: yearBuilt != null ? currentYear - yearBuilt : null,
    sqft_efficiency: safeDiv(sqft, lotSqft, 4),
    bed_bath_ratio: safeDiv(bedrooms, bathrooms, 2),
    above_grade_pct: safeDiv(aboveGrade, buildingTotal, 4),
    hoa_annual_cost: hoaMonthly != null ? hoaMonthly * 12 : null,
    hoa_pct_of_price: hoaMonthly != null && listPrice
      ? Math.round((hoaMonthly * 12 / listPrice) * 10000) / 100
      : null,
    tax_rate: safeDiv(taxAnnual, taxAssessed, 4) != null
      ? safeDiv(taxAnnual, taxAssessed, 4)! * 100
      : null,
    estimated_monthly_piti: piti,
  }
}
