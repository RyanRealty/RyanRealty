/**
 * Route-local constants and display helpers for /housing-market/annual-review.
 *
 * They live beside the route rather than inside it because the page sits under
 * the ci:file-size-budget floor and the gate's own instruction when a file
 * approaches it is to split, not to re-baseline. Nothing here fetches: these are
 * the canonical path, the two cache keys the page queries, one documented query
 * key override, and the number-to-string helpers that carry the KB page's exact
 * display rules across the register change.
 *
 * NOT A GEO REGISTRY. lib/data/geo/report-cities.ts owns the report-city set and
 * ci:report-geo-registry bans re-typing one of its sets anywhere else.
 * CITY_DB_GEO_SLUG below is a per-city query-key override, not a city list.
 *
 * EVERY HELPER RETURNS null WHEN THE FIGURE IS ABSENT, never a placeholder
 * string. CLAUDE.md section 0: absent is not zero, and on the v3 register the
 * honest render of an unmeasured figure is no figure, not the words "not
 * available" sitting in a value slot under a live-MLS source line.
 */

import { valuationPath } from '@/lib/slug'
import { valuationHref } from '@/lib/site/valuation-href'

export const CANONICAL_PATH = '/housing-market/annual-review'
export const REGION_GEO_SLUG = 'central-oregon'
export const REGION_LABEL = 'Central Oregon'

/**
 * THE TWO SELLER DOORS, BOTH CARRYING THIS PAGE AS THEIR ORIGIN (the route's
 * invariant 5). Constants rather than inline strings because an inline
 * convention is invisible to whoever rewrites the section, which is how four
 * routes dropped the parameter at once.
 *
 * SELL_SPINE_HREF is the intake spine's own form, built by the ONE canonical
 * builder, lib/site/valuation-href.ts (PUBLIC_UI.md §3).
 * It resolves VALUATION_FORM from lib/site-nav, appends `from`, and keeps the
 * anchor last, which hand-built strings got wrong.
 *
 * WRITTEN_VALUATION_HREF is the written-CMA surface, and it is NOT built by that
 * helper, for a reason that was measured rather than assumed. The helper's base
 * is `/sell#get-value`, and the action behind that form never reads `from`:
 * app/lp/seller-home-value/actions.ts stores `sanitizePagePath(pagePath)` and
 * app/sell/page.tsx hardcodes `pagePath="/sell"`. Routing this door through the
 * helper would therefore move it to a surface that records '/sell' as the origin
 * of every lead it produces, which is the 2026-07-15 conversion-audit failure the
 * parameter exists to prevent. The written-valuation action DOES read it:
 * app/home-valuation/actions.ts takes the lead's stored source_url off the
 * referer's `from` and, when absent, falls back to the referer's own path, which
 * at submit time is /sell/valuation itself. Encoded because the value lands in a
 * query string, and CANONICAL_PATH is the string KbSell's `usePathname()`
 * produced here, so no stored source_url changes.
 */
export const SELL_SPINE_HREF = valuationHref(CANONICAL_PATH)
export const WRITTEN_VALUATION_HREF = `${valuationPath()}?from=${encodeURIComponent(CANONICAL_PATH)}`

/**
 * market_stats_cache period_type. The trailing 12 months of closed sales, with
 * yoy_* columns computed by the SAME cache job against the same 12-month window
 * one year earlier — the apples-to-apples comparison this page publishes, read
 * from the cache rather than re-derived so the page cannot drift from the job's
 * own methodology.
 */
export const PERIOD_TYPE = 'rolling_365d' as const

/**
 * market_pulse_live / market_stats_cache geo_slug overrides where the DB key does
 * not match REPORT_CITIES' public URL slug. Both caches key La Pine as "la pine"
 * (a literal space, the lowercased MLS City value — see ci:market-city-slug-canon),
 * not the "la-pine" hyphen form the public URL uses. Verified live 2026-08-03.
 * Every other REPORT_CITIES slug matches its DB geo_slug exactly. This resolves
 * the QUERY key only; the public URL slug is untouched.
 */
const CITY_DB_GEO_SLUG: Record<string, string> = {
  'la-pine': 'la pine',
}

export function dbGeoSlug(citySlug: string): string {
  return CITY_DB_GEO_SLUG[citySlug] ?? citySlug
}

/**
 * Signed whole-day delta, plain hyphen only: "3 days longer", "3 days shorter",
 * "no change". Written as words rather than a signed number because the figure it
 * qualifies is a duration, and "+3" beside "34 days on market" reads as a count
 * before it reads as a change.
 */
export function formatDayDelta(n: number | null | undefined): string | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null
  const rounded = Math.round(n)
  if (rounded === 0) return 'no change year over year'
  const abs = Math.abs(rounded)
  const unit = abs === 1 ? 'day' : 'days'
  return `${abs} ${unit} ${rounded > 0 ? 'longer' : 'shorter'} year over year`
}

/** Ratio (0.9522) to a one-decimal percent string ("95.2%"). */
export function formatRatioPct(n: number | null | undefined): string | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null
  return `${(n * 100).toFixed(1)}%`
}

/**
 * A year-over-year percent CHANGE, already in percent units in the cache column,
 * rendered at one decimal in words.
 *
 * The flat band is 0.05 absolute, the same band components/site/primitives/
 * PercentChange.tsx used on the KB page, so a figure that read as flat there
 * still reads as flat here. Below that band the honest sentence is "no change",
 * not a signed 0.0% that claims a direction the rounding invented.
 */
export function formatPercentDelta(n: number | null | undefined): string | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null
  const abs = Math.abs(n)
  if (abs < 0.05) return 'no change year over year'
  return `${n > 0 ? 'up' : 'down'} ${abs.toFixed(1)}% year over year`
}

/**
 * Whole dollars with comma grouping, no rounding to the nearest $1,000.
 *
 * lib/format/money.ts formatPrice rounds to the nearest thousand, which is the
 * brand rule for a LIST price display and wrong for a figure this page also
 * publishes: the region's trailing-12-month median sale price goes into the
 * Dataset JSON-LD as Math.round(medianSalePrice), so a $652,450 median rendered
 * through formatPrice would print $652,000 on screen beside $652,450 in the
 * markup. One number per fact, on the page and in the payload.
 */
export function formatWholeDollars(n: number | null | undefined): string | null {
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null
  return `$${Math.round(n).toLocaleString('en-US')}`
}

/** A count with comma grouping, or null when the count was never measured. */
export function formatCount(n: number | null | undefined): string | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null
  return n.toLocaleString('en-US')
}

/** Whole days with their unit ("34 days", "1 day"). */
export function formatDays(n: number | null | undefined): string | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null
  const rounded = Math.max(0, Math.round(n))
  return `${rounded.toLocaleString('en-US')} ${rounded === 1 ? 'day' : 'days'}`
}
