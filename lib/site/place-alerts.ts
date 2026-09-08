/**
 * The copy and the trace for the place-page alerts strip (site queue SITE-04,
 * Matt 2026-09-07). One builder for city, neighborhood and community, so the
 * three routes say the same thing the same way, and so the sentence a visitor
 * reads is tested against the figure it carries.
 *
 * THE FIGURE. `newCount30d` is Market Truth `new_listings_30d` at the page's
 * own grain, the same row the page's other market figures read
 * (lib/data/market-truth/public-pace.ts). Its SQL counts distinct listings with
 * PropertyType 'A' and property_sub_type 'Single Family Residence' whose
 * on-market date falls in the last 30 days, Coming Soon excluded, canceled and
 * withdrawn counted because they did come to market
 * (scripts/sql/compute_market_metrics_hud_windows_shadow.sql, new_30). So the
 * claim says HOUSES, not listings: the alert filter (`propertyType: 'A'`, or a
 * community's subdivision) is wider than the count, and a sentence that named
 * the wider set with the narrower number would be the wrong kind of round.
 *
 * THE DISPLAY NUMERAL EARNS ITS PLACE (evaluator, 2026-09-08). A count is the
 * spectacle only when the count is the news: 148 in Bend is a headline, 2 in
 * Tetherow is an anti-sell as a giant Amboqia figure. Below
 * PLACE_ALERTS_FIGURE_MIN the sentence leads and carries the digit at heading
 * weight, the same form the withheld path takes; the numeral is reserved for
 * counts at or above it.
 *
 * THE PROMISE says what the engine sends, and it lives IN EACH BINDER, not
 * here: ci:alert-capture-disclosure reads the file that calls the capture
 * action for a frequency sentence and an unsubscribe sentence, so the
 * disclosure stays where the capture is. This file supplies only the scope
 * phrase it names, and the scope LINE under the claim so the figure and the
 * offer agree at a glance (a neighborhood figure beside a city-wide alert; a
 * community figure beside an alert the MLS files under several names). The
 * wording the binders share (the test beside this file holds the three to one
 * literal): the alert cron runs hourly (vercel.json) and sends one email per
 * alert per run with everything new in it (app/actions/saved-search-alerts.ts),
 * so the sentence is "every new listing, by email", never "one email per
 * listing". Price changes ride on the same row: every row this capture writes
 * takes the table's default event toggles, and `price_change` is on
 * (docs/DATABASE_SCHEMA_SNAPSHOT.md, listing_alerts.events). Both directions
 * are sent under "Price changes", so the copy says changes, not drops.
 *
 * Formatting happens here, never in the barrel (components/site/v3/index.ts).
 */

import { formatCount } from '@/lib/format/count'

export type PlaceAlertsGeoType = 'city' | 'neighborhood'

/**
 * The smallest count that renders as a display numeral. Below it the digit is
 * inline in the sentence. Ten: two digits is where a figure starts to read as a
 * volume rather than a handful, and every Bend-grain count is far above it while
 * every resort community this month sits below it (Tetherow 2, Brasada Ranch 3
 * on 2026-09-08).
 */
export const PLACE_ALERTS_FIGURE_MIN = 10

export type PlaceAlertsInput = {
  /** The place the visitor is standing in. Named in the claim. */
  placeName: string
  /** The scope the alert filter really sends: the city on a neighborhood page. */
  scopeName: string
  /** Market Truth new_listings_30d for this grain, or null when withheld. */
  newCount30d: number | null
  /** The metric row the count was read under, for the trace. */
  geoType: PlaceAlertsGeoType
  geoSlug: string
  /**
   * The MLS subdivision names the alert filter really matches, when the scope
   * is a community: the registry alias set the search expands the filter into
   * (lib/subdivision-aliases getSubdivisionMatchNames, matched exactly and
   * case-insensitively on subdivision_lower). Empty or one name adds no line.
   */
  matchNames?: readonly string[]
}

/** The strip's one line, in parts so the place name can stay whole at 375. */
export type PlaceAlertsStickyClaim = { before: string; place: string; after: string }

export type PlaceAlertsCopy = {
  eyebrow: string
  /** The display numeral, only when the count earns it; null otherwise. */
  count: string | null
  /** The sentence after the numeral, or the whole claim when there is no numeral. */
  claim: string
  stickyClaim: PlaceAlertsStickyClaim
  /** The one line under the claim that reconciles the figure with the offer, or null. */
  scopeLine: string | null
  /** The scope the promise names: "Bend", or "Bend, Awbrey Butte included". */
  scopePhrase: string
  submitLabel: string
  browseLabel: string
  sent: { heading: string; body: string }
  source: string | undefined
  stickyLabel: string
}

/** The count is a figure only when it is a real positive count; 0 and null both mean "no figure". */
export function publishableNewCount(newCount30d: number | null | undefined): number | null {
  if (newCount30d == null || !Number.isFinite(newCount30d)) return null
  const n = Math.round(newCount30d)
  return n > 0 ? n : null
}

/** True when the count renders as the display numeral rather than inline in the sentence. */
export function earnsDisplayFigure(n: number | null): n is number {
  return n != null && n >= PLACE_ALERTS_FIGURE_MIN
}

function houses(n: number): string {
  return n === 1 ? 'house' : 'houses'
}

export function placeAlertsClaim(placeName: string, scopeName: string, n: number | null): string {
  if (n == null) return `New ${scopeName} listings, by email, as they come on the market.`
  const tail = `came on the market in ${placeName} in the last 30 days.`
  if (earnsDisplayFigure(n)) return `${houses(n)} ${tail}`
  return `${formatCount(n)} ${houses(n)} ${tail}`
}

export function placeAlertsStickyClaim(placeName: string, scopeName: string, n: number | null): PlaceAlertsStickyClaim {
  if (n == null) return { before: 'New', place: scopeName, after: 'listings by email' }
  if (earnsDisplayFigure(n)) return { before: `${houses(n)} listed in`, place: placeName, after: 'in the last 30 days' }
  return { before: `${formatCount(n)} ${houses(n)} listed in`, place: placeName, after: 'in the last 30 days' }
}

/** What the promise names: the scope the filter really sends, with the place folded in when it is narrower. */
export function placeAlertsScope(placeName: string, scopeName: string): string {
  return scopeName === placeName ? scopeName : `${scopeName}, ${placeName} included`
}

/** "Tetherow, Triple or Tetherow Resort" */
export function joinNames(names: readonly string[]): string {
  const list = names.map((s) => s.trim()).filter(Boolean)
  if (list.length <= 1) return list[0] ?? ''
  return `${list.slice(0, -1).join(', ')} or ${list[list.length - 1]}`
}

/**
 * The line under the claim that makes the figure and the offer agree at a
 * glance. A neighborhood counts itself while its alert sends the city; a
 * community counts itself while its alert sends every MLS name the registry
 * files it under. Same-scope places with one name need no line.
 */
export function placeAlertsScopeLine(input: {
  placeName: string
  scopeName: string
  matchNames?: readonly string[]
}): string | null {
  if (input.scopeName !== input.placeName) {
    return `The alert covers all of ${input.scopeName}, ${input.placeName} included.`
  }
  const names = (input.matchNames ?? []).map((s) => s.trim()).filter(Boolean)
  if (names.length > 1) {
    return `The alert covers every listing the MLS files under ${joinNames(names)}.`
  }
  return null
}

/**
 * The newest-first search for the place: the browse path the page already
 * links, with the sort the search surfaces read (`sort=newest`, the same
 * default PlaceSplitView and savedFiltersToAdvanced fall back to).
 */
export function newestFirstHref(browseHref: string): string {
  const href = browseHref.trim()
  if (!href) return href
  if (/[?&]sort=/.test(href)) return href
  return `${href}${href.includes('?') ? '&' : '?'}sort=newest`
}

export function placeAlertsSource(input: {
  count: number
  geoType: PlaceAlertsGeoType
  geoSlug: string
}): string {
  return (
    `${formatCount(input.count)} houses: regional MLS through Oregon Data Share, read through the Market Truth ` +
    `metric layer (stat new_listings_30d, ${input.geoType}:${input.geoSlug}, detached single-family houses whose ` +
    `on-market date falls in the last 30 days, Coming Soon excluded). The alert follows this page's filter, ` +
    `which is wider than houses alone.`
  )
}

export function placeAlertsCopy(input: PlaceAlertsInput): PlaceAlertsCopy {
  const n = publishableNewCount(input.newCount30d)
  return {
    eyebrow: `New listings · ${input.placeName}`,
    count: earnsDisplayFigure(n) ? formatCount(n) : null,
    claim: placeAlertsClaim(input.placeName, input.scopeName, n),
    stickyClaim: placeAlertsStickyClaim(input.placeName, input.scopeName, n),
    scopeLine: placeAlertsScopeLine({
      placeName: input.placeName,
      scopeName: input.scopeName,
      matchNames: input.matchNames,
    }),
    scopePhrase: placeAlertsScope(input.placeName, input.scopeName),
    submitLabel: 'Email me each one',
    browseLabel: `See the newest ${input.placeName} listings`,
    sent: {
      heading: `Set. New ${input.scopeName} listings land by email when they hit the market.`,
      body: 'Price changes on those homes come in the same email. Pause or unsubscribe from any alert email.',
    },
    source: n == null ? undefined : placeAlertsSource({ count: n, geoType: input.geoType, geoSlug: input.geoSlug }),
    stickyLabel: `${input.scopeName} listing alerts`,
  }
}
