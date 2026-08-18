/**
 * Effective property tax rate — the ONE constant every payment estimate reads.
 *
 * Six places used to carry their own answer to the same question, spanning
 * three different values: 1.2% in the sync mapper, 1.2% in the DSCR screen,
 * 1.2% in `app_config.default_tax_rate_pct` (which fed the mortgage-calculator
 * page), 0.85% in the listing-detail mortgage calculator, 0.75% in the
 * listing-detail rental module, 0.75% as the DAL's unreachable-app_config
 * floor. On a $700K listing with no reported tax bill the ends of that range
 * were $437.50/mo and $700.00/mo — a $262.50/mo spread on the same property,
 * decided by which module the visitor happened to open. This module is the fix:
 * one measured number, imported everywhere.
 *
 * MEASURED 2026-08-17 against live Supabase (dwvlophlbvvygjfxcrhm). Not chosen,
 * not remembered, not inherited from a prior version of this file:
 *
 *   SELECT count(*) AS n,
 *          percentile_cont(0.25) WITHIN GROUP (ORDER BY tax_annual_amount / "ListPrice"),
 *          percentile_cont(0.50) WITHIN GROUP (ORDER BY tax_annual_amount / "ListPrice"),
 *          avg(tax_annual_amount / "ListPrice"),
 *          percentile_cont(0.75) WITHIN GROUP (ORDER BY tax_annual_amount / "ListPrice")
 *   FROM public.listings
 *   WHERE "StandardStatus" = 'Active'
 *     AND tax_annual_amount > 0
 *     AND "ListPrice" > 50000
 *     AND tax_annual_amount / "ListPrice" < 0.05;
 *
 *   n = 6,213 · p25 0.3489% · MEDIAN 0.5690% · mean 0.5764% · p75 0.7604%
 *
 * The median is adopted and carried at 0.57%. Mean and median agree to within
 * 0.008 points, so the distribution is not being dragged by a tail and the
 * median is not a lucky pick. The filters are guards, not shaping: `> 50000`
 * drops placeholder prices, `< 5%` drops rows where the MLS tax field holds a
 * multi-year or multi-parcel figure. 6,213 of the 6,868 actives that report any
 * tax at all survive them.
 *
 * WHY IT IS THIS LOW. Oregon Measure 5 (1990) capped the rate against real
 * market value; Measure 50 (1997) reset assessed value to a 1995 base that
 * grows 3%/yr and does NOT reprice on sale. Assessed value therefore sits well
 * under market price, and tax as a share of LIST price lands far below the
 * statutory rate. It also means the seller's bill carries forward to the buyer,
 * which is why every consumer below prefers a reported `tax_annual_amount` and
 * reaches for this constant only when the row has none.
 *
 * WHAT THIS NUMBER IS NOT. It is a share of LIST PRICE, not a millage rate and
 * not a rate against assessed value. Do not print it as "the Deschutes County
 * tax rate" and do not use it to reconstruct an assessed value.
 *
 * WHY `listings.tax_rate` CANNOT ANSWER THIS INSTEAD. That column is defined as
 * `tax_annual_amount / tax_assessed_value * 100`, and `tax_assessed_value` is
 * NULL on all 7,567 actives — verified 2026-08-17 across every status, 0 of
 * 595,074 rows non-null, so `tax_rate` is NULL on 100% of the table and can
 * never populate from the current feed. Recorded here as the reason this
 * constant exists; fixing the ingest is separate work and is not done here.
 *
 * WHO IS STILL NOT ON THIS CONSTANT, ON PURPOSE:
 *   - `public.compute_listing_derived_fields()` — the BEFORE INSERT OR UPDATE
 *     trigger on `listings` and the authoritative writer of
 *     `estimated_monthly_piti`. It already declares
 *     `tax_fallback_pct constant numeric := 0.0057` (read from the live catalog
 *     2026-08-17). It agrees with this file; it is simply not able to import it.
 *     Change one and you must change the other.
 *   - `public.app_config.default_tax_rate_pct` — holds 0.012, written once by
 *     migration 20260414210000 and never since. No JS reads it any more (see
 *     lib/data/config.ts). Two SQL routines still do —
 *     `compute_and_cache_period_stats()` and `build_cache_methodology()` —
 *     so the row is not dead and must not be deleted on the strength of the
 *     JS-side removal alone.
 *
 * ONE LITERAL LIVES IN THIS FILE. `PROPERTY_TAX_RATE_PCT` is derived from the
 * fraction rather than typed a second time, so the two can never drift apart.
 */

/**
 * Annual property tax as a decimal fraction of price (0.0057 = 0.57%).
 * The canonical form. Multiply by price to get an annual dollar estimate.
 */
export const PROPERTY_TAX_RATE_FRACTION = 0.0057

/**
 * The same rate in PERCENT units (0.57 = 0.57%), for the surfaces whose
 * contract is percent. Rounded off the fraction because `0.0057 * 100` is
 * `0.5700000000000001` in IEEE-754 and that string reaches the screen.
 */
export const PROPERTY_TAX_RATE_PCT = Math.round(PROPERTY_TAX_RATE_FRACTION * 1e6) / 1e4

/** The measurement behind the constant, for anything that has to cite it. */
export const PROPERTY_TAX_RATE_SOURCE = {
  measuredOn: '2026-08-17',
  table: 'public.listings',
  filter: 'StandardStatus=Active, tax_annual_amount>0, ListPrice>50000, ratio<5%',
  sampleSize: 6213,
  medianPct: 0.569,
  meanPct: 0.5764,
  p25Pct: 0.3489,
  p75Pct: 0.7604,
  basis: 'share of list price, not of assessed value (Oregon Measure 5/50)',
} as const
