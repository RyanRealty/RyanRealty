/**
 * numeric(p,s) capacity clamp for `listings` rows.
 *
 * Why this exists: every sync-delta run from 2026-08-04T17:33Z to the fix
 * failed a chunk with Postgres "numeric field overflow" — one pathological
 * MLS row (a tiny divisor under a big price) produced a derived metric that
 * cannot fit its bounded column, and the cursor-safety rule then (correctly)
 * refused to advance the delta cursor, retrying the same window for 21 hours.
 * An absurd ratio is meaningless data — §0 prefers absent over wrong — so an
 * unfittable value stores as NULL instead of killing ingestion for every
 * listing sharing the chunk.
 *
 * Bounds mirror the LIVE column definitions (pg_attribute audit 2026-08-05):
 * |value| must be < 10^(p−s) to fit numeric(p,s). Unbounded numerics
 * (ListPrice, Latitude, …) need no entry.
 */

const NUMERIC_BOUNDS: Record<string, number> = {
  building_area_total: 1e8,
  above_grade_finished_area: 1e8,
  below_grade_finished_area: 1e8,
  lot_size_acres: 1e8,
  lot_size_sqft: 1e10,
  tax_annual_amount: 1e10,
  tax_assessed_value: 1e12,
  association_fee: 1e8,
  hoa_monthly: 1e8,
  concessions_amount: 1e8,
  price_per_sqft: 1e8,
  close_price_per_sqft: 1e8,
  sale_to_list_ratio: 1e2,
  sale_to_final_list_ratio: 1e2,
  total_price_change_pct: 1e6,
  total_price_change_amt: 1e10,
  price_per_acre: 1e12,
  price_per_bedroom: 1e10,
  price_per_room: 1e10,
  sqft_efficiency: 1e2,
  bed_bath_ratio: 1e2,
  above_grade_pct: 1e1,
  hoa_annual_cost: 1e8,
  hoa_pct_of_price: 1e4,
  tax_rate: 1e2,
  estimated_monthly_piti: 1e8,
}

function boundedOrNull(value: number, maxAbs: number): number | null {
  if (!Number.isFinite(value) || Math.abs(value) >= maxAbs) return null
  return value
}

/** Clamp every bounded column on a mapped listings row, in place. */
export function clampListingNumericBounds(row: Record<string, unknown>): void {
  for (const [col, maxAbs] of Object.entries(NUMERIC_BOUNDS)) {
    const v = row[col]
    if (typeof v === 'number') row[col] = boundedOrNull(v, maxAbs)
  }
}
