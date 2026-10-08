/**
 * The traced inputs behind the Bend cost-to-sell worked example, in a module
 * with no page copy in it, so the seller net sheet's client island
 * (app/tools/seller-net-sheet) can import the same rates without pulling the
 * guide's HTML into the browser bundle. lib/blog/cost-to-sell.ts re-exports
 * everything here; the two pages print the same numbers because they read the
 * same constants.
 */

/** The figures the page prints, each traced (brief section 0). */
export const COST_TO_SELL_INPUTS = {
  /** T0: "median sale price, last 12 months", single-family, ryan-realty.com/housing-market/bend (Oregon Data Share MLS). */
  medianSalePrice: 765_000,
  /** T0: the as-of day that page printed for the median above (YYYY-MM-DD, Pacific). */
  figuresAsOf: '2026-10-08',
  /** T1: Ryan Realty listing fee, no add-on fees. */
  listingFeeRate: 0.03,
  /** T2: ILLUSTRATIVE only. Not a typical, standard, or average rate; commission is negotiable. */
  illustrativeBuyerAgentRate: 0.025,
  /**
   * T4: OTIRO Rating Manual (eff. 2025-09-01) section 1.008(A), the county
   * lien search fee table currently in force: Deschutes, $25 per account.
   */
  lienSearchFee: 25,
  /** T5: Deschutes County Title rate card (rev. 03/2023), "Sale (Total Fee)" row at medianSalePrice. Look it up again when the price changes. */
  escrowSaleTotalFee: 2_679,
  /** T6: Deschutes County Clerk, first page, effective 2026-07-01. */
  recordingFirstPage: 102,
  /** T6: Deschutes County Clerk, each additional page, effective 2026-07-01. */
  recordingAdditionalPage: 5,
  /** T8: ILLUSTRATIVE. DOR FY 2025-26 average effective rate for Deschutes, $6.98 per $1,000. */
  illustrativeEffectiveTaxRate: 0.00698,
  /** T8: ILLUSTRATIVE closing day for the proration: Oct 30, 2026, Jul 1 to Oct 30 inclusive. */
  illustrativeProrationDays: 122,
} as const

export type CostToSellInputs = typeof COST_TO_SELL_INPUTS

/**
 * OTIRO Oregon Rating Manual (eff. 2025-09-01), Schedule One, Basic Insurance
 * Rate for $500,000.01 to $10,000,000: $1,350 plus $1.50 for each $1,000 (and
 * fraction) over $500,000, rounded to the dollar (section 2.010). A standard
 * owner's policy is 100% of the Basic Insurance Rate (section 3.002(A)). Only
 * this bracket is implemented because only this bracket is sourced here.
 */
export function otiroStandardOwnersPolicy(price: number): number {
  if (!(price > 500_000 && price <= 10_000_000)) {
    throw new Error(`otiroStandardOwnersPolicy: ${price} is outside the sourced $500,000.01 to $10M bracket`)
  }
  const thousandsOver = Math.ceil((price - 500_000) / 1_000)
  return Math.round(1_350 + 1.5 * thousandsOver)
}
