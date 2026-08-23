/**
 * Market Truth registry — one formula, floor, and population per stat_id.
 * Mirrors docs/plans/MARKET_TRUTH/REGISTRY.md §3. Do not invent a second copy.
 */

export const DEFINITION_ID = 'mt-v1'

export const VERDICT_SELLER_MAX = 4
export const VERDICT_BUYER_MIN = 6

export type Population = 'closed' | 'active' | 'pending' | 'derived'
export type WindowPolicy = 'ladder' | 'point' | 'fixed6' | 'fixed12'

export type StatSpec = {
  statId: string
  minN: number
  earliestYear: number
  population: Population
  windowPolicy: WindowPolicy
  /** Exclusion reasons that drop a sale from THIS stat only. */
  excludeReasons: readonly string[]
}

export const STATS: readonly StatSpec[] = [
  { statId: 'median_close', minN: 10, earliestYear: 1997, population: 'closed', windowPolicy: 'ladder', excludeReasons: [] },
  { statId: 'median_ppsf', minN: 10, earliestYear: 1997, population: 'closed', windowPolicy: 'ladder', excludeReasons: ['sqft_nonpositive'] },
  { statId: 'median_list_active', minN: 10, earliestYear: 1997, population: 'active', windowPolicy: 'point', excludeReasons: [] },
  { statId: 'total_volume', minN: 5, earliestYear: 1997, population: 'closed', windowPolicy: 'ladder', excludeReasons: [] },
  { statId: 'price_band_distribution', minN: 5, earliestYear: 1997, population: 'closed', windowPolicy: 'ladder', excludeReasons: [] },
  { statId: 'median_days_to_contract', minN: 10, earliestYear: 2006, population: 'closed', windowPolicy: 'ladder', excludeReasons: ['retroactive_entry'] },
  { statId: 'median_days_to_close', minN: 10, earliestYear: 1997, population: 'closed', windowPolicy: 'ladder', excludeReasons: ['retroactive_entry'] },
  { statId: 'median_age_active_inventory', minN: 10, earliestYear: 1997, population: 'active', windowPolicy: 'point', excludeReasons: [] },
  { statId: 'median_sale_to_final_list', minN: 10, earliestYear: 1997, population: 'closed', windowPolicy: 'ladder', excludeReasons: ['auction_list'] },
  { statId: 'median_sale_to_original_list', minN: 10, earliestYear: 2002, population: 'closed', windowPolicy: 'ladder', excludeReasons: ['auction_list'] },
  { statId: 'pct_with_price_cut', minN: 30, earliestYear: 2002, population: 'closed', windowPolicy: 'ladder', excludeReasons: [] },
  { statId: 'median_price_cut_pct', minN: 10, earliestYear: 2002, population: 'closed', windowPolicy: 'ladder', excludeReasons: [] },
  { statId: 'median_concession_reported', minN: 10, earliestYear: 2013, population: 'closed', windowPolicy: 'ladder', excludeReasons: [] },
  { statId: 'active_count', minN: 1, earliestYear: 1997, population: 'active', windowPolicy: 'point', excludeReasons: [] },
  { statId: 'new_listings', minN: 5, earliestYear: 1997, population: 'active', windowPolicy: 'ladder', excludeReasons: [] },
  { statId: 'pending_count', minN: 1, earliestYear: 1997, population: 'pending', windowPolicy: 'point', excludeReasons: [] },
  { statId: 'closed_count', minN: 1, earliestYear: 1997, population: 'closed', windowPolicy: 'ladder', excludeReasons: [] },
  { statId: 'months_of_supply', minN: 30, earliestYear: 1997, population: 'derived', windowPolicy: 'fixed6', excludeReasons: [] },
  { statId: 'months_of_supply_12mo', minN: 30, earliestYear: 1997, population: 'derived', windowPolicy: 'fixed12', excludeReasons: [] },
  { statId: 'absorption_rate', minN: 30, earliestYear: 1997, population: 'derived', windowPolicy: 'fixed6', excludeReasons: [] },
  { statId: 'market_verdict', minN: 30, earliestYear: 1997, population: 'derived', windowPolicy: 'fixed6', excludeReasons: [] },
  { statId: 'segment_share', minN: 30, earliestYear: 1997, population: 'closed', windowPolicy: 'ladder', excludeReasons: [] },
  { statId: 'bedroom_distribution', minN: 30, earliestYear: 1997, population: 'closed', windowPolicy: 'ladder', excludeReasons: [] },
  { statId: 'cash_share', minN: 30, earliestYear: 2004, population: 'closed', windowPolicy: 'ladder', excludeReasons: [] },
  { statId: 'financing_mix', minN: 30, earliestYear: 2004, population: 'closed', windowPolicy: 'ladder', excludeReasons: [] },
  { statId: 'feature_share', minN: 30, earliestYear: 1997, population: 'closed', windowPolicy: 'ladder', excludeReasons: [] },
  { statId: 'yoy_median_price', minN: 30, earliestYear: 1998, population: 'derived', windowPolicy: 'ladder', excludeReasons: [] },
  { statId: 'mom_median_price', minN: 30, earliestYear: 1998, population: 'derived', windowPolicy: 'ladder', excludeReasons: [] },
  { statId: 'yoy_sold_count', minN: 30, earliestYear: 1998, population: 'derived', windowPolicy: 'ladder', excludeReasons: [] },
  { statId: 'yoy_days_to_contract', minN: 30, earliestYear: 2007, population: 'derived', windowPolicy: 'ladder', excludeReasons: [] },
] as const

export const STAT_BY_ID: ReadonlyMap<string, StatSpec> = new Map(
  STATS.map((s) => [s.statId, s]),
)

export function marketVerdict(monthsOfSupply: number): 'seller' | 'balanced' | 'buyer' {
  if (monthsOfSupply <= VERDICT_SELLER_MAX) return 'seller'
  if (monthsOfSupply >= VERDICT_BUYER_MIN) return 'buyer'
  return 'balanced'
}

export function pickWindow(sampleN12: number, sampleN24: number, sampleN36: number, minN: number): 12 | 24 | 36 | null {
  if (sampleN12 >= minN) return 12
  if (sampleN24 >= minN) return 24
  if (sampleN36 >= minN) return 36
  return null
}
