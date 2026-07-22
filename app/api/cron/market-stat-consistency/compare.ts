/**
 * Cross-path compare — the §0 four-paths reconciliation check (2026-07-22).
 *
 * Four parallel market-metric paths can serve the same city today:
 *   (a) the get_city_period_metrics RPC over raw `listings` (the /reports
 *       range-filtered table),
 *   (b) market_pulse_live + market_stats_cache via the cache DAL (the KB city
 *       pages, the /reports hub cards, the CRM report emails),
 *   (c) geo_snapshot_mv (checked by the existing contract check in route.ts),
 *   (d) the weekly report generator (checked by the freshness check).
 *
 * This module pins (a) against (b) mechanically: for each of the 7 verdict
 * cities we compare median close price, active count, and months of supply
 * across the two paths and flag any |delta| > 1% — the same §0 reconciliation
 * threshold the Spark × Supabase pre-render gate uses. Pure functions only, so
 * the delta math is unit-tested with fixtures (compare.test.ts) without a DB.
 *
 * KNOWN divergence sources these deltas quantify (the remaining consolidation
 * targets — the alert firing on them is the point, not a false positive):
 *   - The RPC's "median_price" ranks "ListPrice" of closed homes; the cache's
 *     median_sale_price uses close price.
 *   - The RPC's textual property-type exclusions ('%condo%', '%land%', ...)
 *     never match the single-letter Spark codes (A/B/C/D/E/F per
 *     docs/DATABASE_FOR_AI_AGENTS.md), so the RPC effectively includes ALL
 *     property types while the cache is PropertyType='A' only.
 *   - The RPC's inventory_months uses a 12-month close base; the pulse's
 *     months_of_supply uses the canonical 6-month base (§0 formula).
 */

export const CROSS_PATH_TOLERANCE_PCT = 1

/**
 * The 7 verdict cities — the Central Oregon cities the report engine serves
 * with a market verdict (mirrors CITY_SLUGS in lib/data/crm/getMarketReportData.ts).
 */
export const VERDICT_CITIES = [
  'Bend',
  'Redmond',
  'Sisters',
  'Sunriver',
  'Tumalo',
  'La Pine',
  'Terrebonne',
] as const

export type CrossPathFigureName = 'median close price' | 'active count' | 'months of supply'

export type CrossPathDelta = {
  city: string
  figure: CrossPathFigureName
  /** From the get_city_period_metrics RPC path (raw listings). */
  rpcValue: number | null
  /** From the canonical cache path (market_stats_cache / market_pulse_live). */
  cacheValue: number | null
  /** Signed percent, (rpc - cache) / |cache| * 100, rounded to 2 decimals. */
  deltaPct: number | null
  /** True when the drift breaks the §0 1% reconciliation tolerance. */
  exceeds: boolean
  note?: string
}

function norm(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(v)) return null
  return v
}

/**
 * Compare one figure across the two paths. Pure.
 *
 * Rules (pinned by compare.test.ts):
 *  - both missing        → not comparable, no alert (nothing rendered to disagree)
 *  - exactly one missing → alert (one metric path is dark for a served figure)
 *  - cache 0, rpc 0      → delta 0, no alert
 *  - cache 0, rpc != 0   → alert, deltaPct null (undefined against a 0 base)
 *  - else                → deltaPct vs the cache (canonical) value; alert when
 *                          the UNROUNDED |delta| > CROSS_PATH_TOLERANCE_PCT
 */
export function crossPathDelta(
  city: string,
  figure: CrossPathFigureName,
  rpcValueIn: number | null | undefined,
  cacheValueIn: number | null | undefined,
): CrossPathDelta {
  const rpcValue = norm(rpcValueIn)
  const cacheValue = norm(cacheValueIn)

  if (rpcValue == null && cacheValue == null) {
    return { city, figure, rpcValue, cacheValue, deltaPct: null, exceeds: false, note: 'no value on either path' }
  }
  if (rpcValue == null || cacheValue == null) {
    return {
      city,
      figure,
      rpcValue,
      cacheValue,
      deltaPct: null,
      exceeds: true,
      note: 'only one path produced a value',
    }
  }
  if (cacheValue === 0) {
    if (rpcValue === 0) {
      return { city, figure, rpcValue, cacheValue, deltaPct: 0, exceeds: false }
    }
    return {
      city,
      figure,
      rpcValue,
      cacheValue,
      deltaPct: null,
      exceeds: true,
      note: 'canonical cache value is zero, RPC is not',
    }
  }

  const raw = ((rpcValue - cacheValue) / Math.abs(cacheValue)) * 100
  return {
    city,
    figure,
    rpcValue,
    cacheValue,
    deltaPct: Math.round(raw * 100) / 100,
    exceeds: Math.abs(raw) > CROSS_PATH_TOLERANCE_PCT,
  }
}

/** The RPC json shape we compare (from get_city_period_metrics). */
export type CrossPathRpcMetrics = {
  median_price: number | null
  current_listings: number | null
  inventory_months: number | null
}

/** The cache-path figures we compare (from getCityReportSnapshot). */
export type CrossPathCacheFigures = {
  /** market_stats_cache rolling_365d median_sale_price. */
  medianSalePrice: number | null
  /** market_pulse_live active_count. */
  activeCount: number | null
  /** market_pulse_live months_of_supply (canonical 6-month base). */
  monthsOfSupply: number | null
}

/**
 * Build the 3 per-city deltas. Pure.
 *
 * The RPC COALESCEs median_price to 0 when the period has no closed sales, so a
 * 0 median is mapped to null (no data) before comparing — a genuine $0 median
 * close price does not exist.
 */
export function compareCityCrossPath(
  city: string,
  rpc: CrossPathRpcMetrics,
  cache: CrossPathCacheFigures,
): CrossPathDelta[] {
  const rpcMedian = rpc.median_price != null && rpc.median_price > 0 ? rpc.median_price : null
  return [
    crossPathDelta(city, 'median close price', rpcMedian, cache.medianSalePrice),
    crossPathDelta(city, 'active count', rpc.current_listings, cache.activeCount),
    crossPathDelta(city, 'months of supply', rpc.inventory_months, cache.monthsOfSupply),
  ]
}

function fmtValue(figure: CrossPathFigureName, v: number | null): string {
  if (v == null) return 'no value'
  if (figure === 'median close price') return `$${Math.round(v).toLocaleString('en-US')}`
  if (figure === 'months of supply') return (Math.round(v * 100) / 100).toString()
  return Math.round(v).toLocaleString('en-US')
}

/**
 * Alert lines for the deltas that break tolerance. Pure. Internal ops copy
 * (goes to the matt@ ops alert email only, never a consumer surface).
 */
export function crossPathFailureLines(deltas: CrossPathDelta[]): string[] {
  return deltas
    .filter((d) => d.exceeds)
    .map((d) => {
      const deltaLabel =
        d.deltaPct != null
          ? `delta ${d.deltaPct > 0 ? '+' : ''}${d.deltaPct.toFixed(2)}%`
          : (d.note ?? 'not comparable')
      return (
        `${d.city} cross-path ${d.figure}: RPC get_city_period_metrics = ${fmtValue(d.figure, d.rpcValue)} ` +
        `vs canonical cache = ${fmtValue(d.figure, d.cacheValue)} (${deltaLabel}, tolerance ${CROSS_PATH_TOLERANCE_PCT}%) ` +
        `- the /reports RPC path and the cache path disagree for a served figure (§0 four-paths consolidation target)`
      )
    })
}
