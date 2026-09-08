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
 * THE PROMISE says what the engine sends, and it lives IN EACH BINDER, not
 * here: ci:alert-capture-disclosure reads the file that calls the capture
 * action for a frequency sentence and an unsubscribe sentence, so the
 * disclosure stays where the capture is. This file supplies only the scope
 * phrase it names. The wording the binders share (the test beside this file
 * holds the three to one literal): the alert cron runs hourly (vercel.json)
 * and sends one email per alert per run with everything new in it
 * (app/actions/saved-search-alerts.ts), so the sentence is "every new
 * listing, by email", never "one email per listing". Price changes ride on the
 * same row: every row this capture writes takes the table's default event
 * toggles, and `price_change` is on (docs/DATABASE_SCHEMA_SNAPSHOT.md,
 * listing_alerts.events). Both directions are sent under "Price changes", so
 * the copy says changes, not drops.
 *
 * Formatting happens here, never in the barrel (components/site/v3/index.ts).
 */

import { formatCount } from '@/lib/format/count'

export type PlaceAlertsGeoType = 'city' | 'neighborhood'

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
}

export type PlaceAlertsCopy = {
  eyebrow: string
  count: string | null
  claim: string
  stickyClaim: string
  /** The scope the promise names: "Bend", or "Bend, Awbrey Butte included". */
  scopePhrase: string
  submitLabel: string
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

export function placeAlertsClaim(placeName: string, scopeName: string, n: number | null): string {
  if (n == null) return `New ${scopeName} listings, by email, as they come on the market.`
  return n === 1
    ? `house came on the market in ${placeName} in the last 30 days.`
    : `houses came on the market in ${placeName} in the last 30 days.`
}

export function placeAlertsStickyClaim(placeName: string, scopeName: string, n: number | null): string {
  if (n == null) return `New ${scopeName} listings by email`
  return n === 1 ? `house listed in ${placeName} in the last 30 days` : `houses listed in ${placeName} in the last 30 days`
}

/** What the promise names: the scope the filter really sends, with the place folded in when it is narrower. */
export function placeAlertsScope(placeName: string, scopeName: string): string {
  return scopeName === placeName ? scopeName : `${scopeName}, ${placeName} included`
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
    count: n == null ? null : formatCount(n),
    claim: placeAlertsClaim(input.placeName, input.scopeName, n),
    stickyClaim: placeAlertsStickyClaim(input.placeName, input.scopeName, n),
    scopePhrase: placeAlertsScope(input.placeName, input.scopeName),
    submitLabel: 'Email me each one',
    sent: {
      heading: `Set. New ${input.scopeName} listings land by email when they hit the market.`,
      body: 'Price changes on those homes come in the same email. Pause or unsubscribe from any alert email.',
    },
    source: n == null ? undefined : placeAlertsSource({ count: n, geoType: input.geoType, geoSlug: input.geoSlug }),
    stickyLabel: `${input.scopeName} listing alerts`,
  }
}
