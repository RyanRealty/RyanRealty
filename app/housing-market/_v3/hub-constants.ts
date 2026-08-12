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

/** The last full calendar year the closed-sales marts cover. */
export const CLOSED_SALES_YEAR = 2024

/** The closed-sales explorer. */
export const HISTORY_PATH = '/housing-market/history'

/**
 * app/housing-market/history/page.tsx reads `sp.type` and keeps it only when it is
 * one of these four, so a figure door carrying any other code would silently drop
 * its filter and land on an unfiltered page.
 */
export const HISTORY_TYPE_CODES = new Set(['A', 'B', 'C', 'D'])
