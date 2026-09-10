/**
 * Route-local constants for /housing-market/central-oregon.
 *
 * They live beside the route rather than inside it because ci:file-size-budget
 * treats a NEW file over 600 LOC as a hard fail and its own instruction is to
 * split rather than re-baseline. Nothing here fetches, formats, or derives.
 *
 * NOT A GEO REGISTRY. lib/data/geo/report-cities.ts owns the canonical report-city
 * sets and ci:report-geo-registry bans re-typing one of them. This list is the
 * region report's Ledger row order, which is a presentation decision about one page.
 */

export { volumeCompact as volumeLabel } from '../../_v3/closed-kpis'

/** The cities that earn a row in the region report's market-by-city Ledger. */
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
 * This route's own path, and the value every valuation door on it passes as `from`.
 *
 * app/home-valuation/actions.ts reads that parameter off the referer to resolve the
 * lead's stored source_url, and falls back to the referer's PATH when it is missing,
 * which on a bare /sell/valuation link is the valuation page itself. A door without
 * this parameter therefore does not merely lose attribution, it records the wrong
 * origin for every seller lead the page produces (2026-07-15 conversion audit). Both
 * KB doors this migration replaced, KbSell and the market HUD, passed the same value.
 *
 * Written once here so the page's two doors cannot drift apart. The metadata and
 * JSON-LD keep their literal path strings: the SEO gates read those literals.
 */
export const PAGE_PATH = '/housing-market/central-oregon'

/**
 * The closed-sales window this page publishes. Floor is the first year the mart
 * holds. The ceiling is the last full calendar year: (today's year) - 1.
 * Verified live against analytics_mart_market_annual 2026-08-27: the region/all
 * 2025 row carries sold_count 5,769, total_volume $4,116,031,220.90, computed_at
 * 2026-08-27 08:15 UTC. Kept a literal, like ../../_v3/hub-constants.ts's
 * CLOSED_SALES_YEAR. Bump by hand each January once that year's mart row is
 * built, never ahead of it.
 */
export const CLOSED_SALES_FROM_YEAR = 1998
export const CLOSED_SALES_TO_YEAR = 2025

/**
 * The closed-sales explorer. app/housing-market/history/page.tsx clamps `year` to
 * 1998 through 2030, so every year in the window above is a real filtered door.
 */
export const HISTORY_PATH = '/housing-market/history'

/**
 * What the hero fold reveals (SITE-88). Route-local: V3Instrument's default
 * summary is "All {n} figures", which printed as a database row count. Mix
 * cells are not on this page, so the label names property-type supply and
 * pace only.
 */
export const REGION_FOLD_LABEL =
  'Supply by property type, and how fast homes are selling'

/**
 * How many figures lead when the MOS drawing is on screen (SITE-88). Two:
 * median list and under contract. Homes-for-sale and a-month-of-sales are
 * the two bars, so reprinting them as tiles is the KPI-grid tell. The
 * shared MARKET_LEAD_FIGURES cap of four still applies on city/annual
 * openings that have no two-bar on the same fold.
 */
export const REGION_LEAD_FIGURES = 2

/**
 * Cities Ledger trace. Visitor English — no MarketPulse / leftover membership.
 * Covers the count, median list, and months of supply the row actually prints.
 */
export const REGION_CITIES_SOURCE =
  'Oregon Data Share, one row per city. Count and median list are active single-family houses; months of supply uses the same listings'

/**
 * What the supply verdict means to someone deciding to buy or sell, one sentence
 * per band, keyed by `marketVerdict().kind` from lib/market/classify.ts.
 *
 * The verdict itself is a formula fact and it belongs in the headline. This is the
 * consequence of that fact, carried word for word from the KB page's narrative so
 * the migration changes the register and not the claim. Nobody is quoted: Matt,
 * 2026-08-06, no invented attributions, and a mechanical consequence of the supply
 * number is not a judgment anyone needs to own.
 */
export const MARKET_CONSEQUENCE: Record<string, string | undefined> = {
  sellers: 'Well-priced homes are moving fast, and sellers have more room to hold their price.',
  buyers:
    'Buyers have more inventory to choose from and more room to negotiate on price and terms.',
  balanced: 'Neither side has a structural edge, so pricing and presentation decide the outcome.',
}

