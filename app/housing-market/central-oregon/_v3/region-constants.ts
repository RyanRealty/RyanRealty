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

import { formatPriceExact } from '@/lib/format/money'

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

/** The closed-sales window this page publishes. Floor is the first year the mart holds. */
export const CLOSED_SALES_FROM_YEAR = 1998
export const CLOSED_SALES_TO_YEAR = 2024

/**
 * The closed-sales explorer. app/housing-market/history/page.tsx clamps `year` to
 * 1998 through 2030, so every year in the window above is a real filtered door.
 */
export const HISTORY_PATH = '/housing-market/history'

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

/**
 * Closed-sales dollar volume, in the exact rounding the KB size strip published:
 * billions to two decimals, millions to one, anything smaller in whole dollars.
 * lib/format/money has no billions-scale compact form, and formatPrice rounds to the
 * nearest $1,000, which is wrong for an aggregate this size. Not a primitive, so the
 * barrel's format-free rule does not reach it; the page still hands the barrel a
 * finished string.
 */
export function volumeLabel(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  return formatPriceExact(n)
}
