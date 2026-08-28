/**
 * Route-local constants for /housing-market (app/housing-market/page.tsx).
 *
 * They live beside the route rather than inside it because the hub page is under
 * the ci:file-size-budget floor and the gate's own instruction when a file
 * approaches it is to split, not to re-baseline. Nothing here fetches, formats, or
 * derives: these are the covered city set, the year the closed-sales marts cover,
 * and the two facts about the closed-sales explorer's query string that the hub's
 * figure doors depend on.
 *
 * NOT A GEO REGISTRY. lib/data/geo/report-cities.ts owns the canonical report-city
 * sets and ci:report-geo-registry bans re-typing one of them. This list is the
 * hub's Ledger row order, which is a presentation decision about one page.
 */

/** The cities that earn a row in the hub's market-by-city Ledger, in row order. */
export const CITY_LABELS = [
  'Bend',
  'Redmond',
  'Sisters',
  'Sunriver',
  'La Pine',
  'Tumalo',
  'Prineville',
  'Terrebonne',
]

/** Label to the city market report the Ledger row opens. */
export const CITY_SLUG: Record<string, string> = {
  'Bend': 'bend',
  'Redmond': 'redmond',
  'Sisters': 'sisters',
  'Sunriver': 'sunriver',
  'La Pine': 'la-pine',
  'Tumalo': 'tumalo',
  'Prineville': 'prineville',
  'Terrebonne': 'terrebonne',
}

/**
 * The last full calendar year the closed-sales marts cover: (today's year) - 1.
 * Verified live against analytics_mart_market_annual 2026-08-27: the region/all
 * 2025 row carries sold_count 5,769, total_volume $4,116,031,220.90, computed_at
 * 2026-08-27 08:15 UTC. A file this small stays a literal rather than a clock
 * read (this module's own header: "nothing here fetches, formats, or derives"),
 * so bump this by hand each January once the prior calendar year's mart row is
 * built. If getCoMarketAnnual({year: CLOSED_SALES_YEAR}) starts returning
 * source:'missing', the mart has not been rebuilt for the new year yet. Do not
 * bump this constant ahead of that rebuild.
 */
export const CLOSED_SALES_YEAR = 2025

/** The closed-sales explorer. */
export const HISTORY_PATH = '/housing-market/history'

/**
 * app/housing-market/history/page.tsx reads `sp.type` and keeps it only when it is
 * one of these four, so a figure door carrying any other code would silently drop
 * its filter and land on an unfiltered page.
 */
export { CLOSED_TYPE_CODES as HISTORY_TYPE_CODES } from './closed-kpis'
