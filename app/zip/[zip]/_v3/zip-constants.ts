/**
 * Route-local constants and pure helpers for /zip/[zip].
 *
 * They live beside the route rather than in lib/ because nothing else in the
 * codebase consumes them, and they live outside page.tsx so the route file stays
 * under the ci:file-size-budget floor.
 *
 * NOTHING HERE CHANGED IN THE V3 MIGRATION except what is stated:
 *  - CANONICAL_ZIPS keeps its ten members AND its order. generateStaticParams
 *    maps over it, and the closing Ledger lists the other nine in the same
 *    order the KB page listed them, so neither the prerendered param set nor
 *    the on-page order moved.
 *  - ZIP_AREA and ZIP_CITY_NAME are verified geography facts, carried verbatim.
 *  - ZIP_CITY_SLUG came BACK on 2026-08-26. The v3 migration's first cut deleted
 *    it, because the only reader was the KB HUD's parent-city price-history
 *    chart and that chart was a city series relabeled at ZIP scope. What reads
 *    it now is a different thing: getPublicDetachedMonthly at geoType 'zip',
 *    with the parent city's own leftover months as the documented fallback when
 *    the ZIP series is sparse. The fallback is LABELED as the city's on screen
 *    (chartScopeLabel), so the key addresses a series this page is allowed to
 *    print, not one it has to disclaim.
 *
 * ZIP_CITY_NAME is not decoration: it is the `city` value in the listing-alert
 * capture payload, which is part of that form's contract.
 *
 * ADDED 2026-08-12, after the migration: `neighborhoodName`, the one place that
 * decides whether a feed value is a place name a visitor can read. See its own
 * docblock for why the Ledger cannot print `SubdivisionName` raw.
 *
 * MOVED HERE 2026-08-12 from page.tsx, unchanged: isFigure, numeric, tileTitle,
 * tileMeta, zipSearchHref. They are pure, they were already route-local, and the
 * route file has to stay under the ci:file-size-budget floor. Moving them is the
 * sanctioned answer to that gate. Re-baselining it is not.
 */

import type { ListingTile } from '@/lib/data'
import type { KbYearSeries } from '@/lib/kb/year-series'
import {
  v3Text,
  V3_CHART_CATEGORY_SLOTS,
  type V3ChartPoint,
  type V3ChartProps,
  type V3ChartSeries,
  type V3FieldItem,
} from '@/components/site/v3'
import { formatPrice, formatPriceCompact } from '@/lib/format/money'
import { moneyTicks, monthTicks, yoyClaim } from '@/lib/charts/ticks'
import { publishListingShareKind } from '@/lib/listing/publish-listing-share'
import { displaySubdivision, listingTileHref } from '@/lib/slug'
import { publishCardAddress } from '@/lib/listing/publish-street-line'

/** Month ticks for the year overlay, in the order a calendar year runs. */
const MONTH_TICK = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

/**
 * The canonical ZIP codes Ryan Realty serves. `dynamicParams = false` on the
 * route keeps it strict, so a ZIP outside this set 404s instead of prerendering
 * an empty page.
 */
export const CANONICAL_ZIPS = new Set([
  '97701',
  '97702',
  '97703', // Bend
  '97756', // Redmond
  '97759', // Sisters
  '97739', // La Pine
  '97707', // Sunriver
  '97741', // Madras
  '97754', // Prineville
  '97760', // Terrebonne
])

/** Service-area label for each ZIP. Verified geography facts. */
export const ZIP_AREA: Record<string, string> = {
  '97701': 'Bend NE',
  '97702': 'Bend SE',
  '97703': 'Bend West',
  '97707': 'Sunriver',
  '97739': 'La Pine',
  '97741': 'Madras',
  '97754': 'Prineville',
  '97756': 'Redmond',
  '97759': 'Sisters',
  '97760': 'Terrebonne',
}

/**
 * Parent city for each ZIP, in the form the CRM and the alert filters use.
 * Carried through the migration because it is a field value in the capture
 * payload, not a display string.
 */
export const ZIP_CITY_NAME: Record<string, string> = {
  '97701': 'Bend',
  '97702': 'Bend',
  '97703': 'Bend',
  '97707': 'Sunriver',
  '97739': 'La Pine',
  '97741': 'Madras',
  '97754': 'Prineville',
  '97756': 'Redmond',
  '97759': 'Sisters',
  '97760': 'Terrebonne',
}

/**
 * Parent city SLUG for each ZIP, in the hyphen-free form the market cache and
 * the Market Truth monthly reads are keyed by. Separate from ZIP_CITY_NAME
 * because that one is a display string AND a capture-payload field value; this
 * one is a query key and nothing else.
 */
export const ZIP_CITY_SLUG: Record<string, string> = {
  '97701': 'bend',
  '97702': 'bend',
  '97703': 'bend',
  '97707': 'sunriver',
  '97739': 'la pine',
  '97741': 'madras',
  '97754': 'prineville',
  '97756': 'redmond',
  '97759': 'sisters',
  '97760': 'terrebonne',
}

/**
 * MLS subdivision values that name no neighborhood. A tile carrying one of them
 * is counted in the ZIP total and excluded from the neighborhood breakdown,
 * never rendered as a place.
 */
export const SUBDIVISION_NOISE = new Set(['', 'n/a', 'none', 'unknown', 'other'])

/**
 * `Crr` is how this feed writes Crooked River Ranch, the large planned community
 * inside ZIP 97760 (Terrebonne). The equivalence is not invented here: it is the
 * one this repo already records and queries by — lib/data/geo/report-cities.ts
 * resolves the community as "Terrebonne + SubdivisionName ~ 'Crooked River Ranch'
 * / 'Crr%'", and data/resort-communities.json carries the slug
 * crooked-river-ranch under the label Crooked River Ranch, city Terrebonne.
 *
 * Only the ABBREVIATION is expanded. Whatever the feed appended stays verbatim,
 * so `Crr 2` reads "Crooked River Ranch 2" the way the same feed writes
 * "Parkside Place Phase 1" — the plat token is the feed's, not this file's.
 * Matches `Crr` only when no letter follows it, so a real name beginning with
 * those three letters is never rewritten.
 */
const CRR_ABBREVIATION = /^crr(?![a-z])/i

/**
 * The name a group is published under, or null when the feed's value is not a
 * name at all.
 *
 * THIS EXISTS BECAUSE THE LEDGER'S ROWS ARE PLACES A VISITOR READS. The value
 * in `SubdivisionName` is a feed field, and on this ZIP set it holds three
 * different kinds of thing: real neighborhood names ("Ranch at the Canyons"),
 * plat codes that are not names ("Crr3_C"), and one abbreviation used for a
 * community the site publishes in full elsewhere ("Crr"). Rendering the field
 * raw published all three as place names, so /zip/97760 listed `Crr3_C` as a
 * neighborhood with a median beside it.
 *
 *  1. `displaySubdivision` first, the same normalizer the tile rows already run,
 *     so a masked private value (`***`) or `na` / `n/a.` cannot reach the page
 *     through the Ledger after being dropped from the tiles.
 *  2. The noise set, which adds the values that ARE spelled but name nothing.
 *  3. An underscore means the value is a field code rather than a name — no
 *     spelled place name in this feed contains one. Those listings stay counted
 *     in the ZIP total above and are not grouped, which the section says.
 *  4. The documented abbreviation is expanded (see CRR_ABBREVIATION).
 *
 * The DOOR is unaffected: the caller keeps grouping and linking by the raw feed
 * value, so a row's count and its destination's count stay the same number.
 */
export function neighborhoodName(raw: string | null | undefined): string | null {
  const clean = displaySubdivision(raw)
  if (!clean) return null
  if (SUBDIVISION_NOISE.has(clean.toLowerCase())) return null
  if (clean.includes('_')) return null
  if (!CRR_ABBREVIATION.test(clean)) return clean
  const rest = clean.slice(3).trim()
  return rest ? `Crooked River Ranch ${rest}` : 'Crooked River Ranch'
}

/** The route param, reduced to the five digits the canonical set is keyed by. */
export function normalizeZip(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 5)
}

/**
 * The median of a set of numbers, or null for an empty set. Null is the honest
 * answer for "no values": a median of nothing is not zero, and the page prints
 * no figure it cannot source (CLAUDE.md section 0).
 */
export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

/**
 * A figure the page may print: a real number at or above its floor. A price of 0
 * and a null price are the same fact here, which is that the feed reported none.
 */
export function isFigure(n: number | null | undefined, floor = 0): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= floor
}

/** The printable subset of a column of feed values. */
export function numeric(values: Array<number | null | undefined>, floor = 0): number[] {
  return values.filter((n): n is number => isFigure(n, floor))
}

/** The address as the feed reports it, or the best name the tile still carries. */
export function tileTitle(tile: ListingTile, fallback: string): string {
  // Every card names its city (Matt 2026-08-27): cards travel — open houses,
  // trails, price drops, saved-search alerts — so a bare street line made
  // the reader guess. publishCardAddress appends ", City" when one resolves.
  const address = publishCardAddress({
    streetNumber: tile.streetNumber,
    streetName: tile.streetName,
    streetSuffix: tile.streetSuffix,
    city: tile.city,
  })
  if (address) return address
  return displaySubdivision(tile.subdivisionName) ?? tile.city?.trim() ?? fallback
}

/**
 * THE DOOR BEHIND A FIGURE. Section 0 does not stop at the number: a count that
 * is also a link makes a claim the destination has to honor, and a click that
 * lands on a different population is the same reconciliation failure as a wrong
 * number, discovered one click later.
 *
 * Every figure on the page is computed from ONE population — active,
 * PropertyType 'A', postalCode = this ZIP — so every door out of a figure
 * carries that population in the three params below. None is decoration:
 *
 *  - `postalCode` is the real searchListingsAll filter, and it is the same
 *    filter this page's alert payload already sends (ZipAlertsSheet). The KB
 *    page hung `?keywords=<zip>` on its subdivision CTA, and keywords is NOT
 *    this filter: it is free text, so the ZIP never scopes the result set.
 *  - `propertyType=A` is this page's scope. Without it the door over-answers,
 *    because a ZIP also holds land, manufactured, and income rows: 97756
 *    replies 474 against this page's 392, 97754 replies 405 against its 217.
 *  - `view=list` is what makes the destination's count comparable at all. The
 *    default split view defaults its city to Bend (app/search/page.tsx) and
 *    counts only what the map viewport holds. Both are wrong under a figure:
 *    the Bend default empties every non-Bend ZIP, and the viewport clip
 *    answered 241 against 97703's 256. The list view applies no default city
 *    and counts the whole filter.
 *
 * Verified against production 2026-08-12, count for count: the destination's
 * result count equals the figure printed beside the link, for all ten canonical
 * ZIPs and for each of the eight neighborhood rows on 97703.
 */
export function zipSearchHref(zip: string, subdivision?: string): string {
  const params = new URLSearchParams({ postalCode: zip, propertyType: 'A' })
  if (subdivision) params.set('subdivision', subdivision)
  params.set('view', 'list')
  return `/homes-for-sale?${params.toString()}`
}

/** Beds, baths, size, and the neighborhood, in the order a buyer scans them. */
export function tileMeta(tile: ListingTile): string | undefined {
  // A fractional-interest ask never prints unlabelled (section 0, the Camp
  // Sherman rule; 2026-08-27 audit: 38 rows on /zip/97702 rendered a $3,000
  // share as a $3,000 home). The share kind rides the meta line, exactly as
  // the community and homepage Fields already do.
  const shareKind = publishListingShareKind({
    propertySubType: tile.propertySubType,
    subdivisionName: tile.subdivisionName,
    city: tile.city,
    listNumber: tile.listNumber,
  })
  const parts = [
    tile.beds != null ? `${tile.beds} bd` : '',
    tile.baths != null ? `${tile.baths} ba` : '',
    tile.sqft ? `${tile.sqft.toLocaleString('en-US')} sq ft` : '',
    displaySubdivision(tile.subdivisionName) ?? '',
    shareKind ?? '',
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : undefined
}

/** Caption beside the ZIP Field. The count is the listed set. No MoS at ZIP scope. */
/** Rows and pins the phone can actually use (2026-08-27 mobile audit: 382
 * rows and 382 unclustered markers were unreadable at 390px). The caption
 * states BOTH the real total and the cap, neighborhood-branch style. */
export const ZIP_FIELD_PREVIEW = 24

export function zipFieldCaption(zip: string, total: number, shown: number): string | null {
  if (total <= 0) return null
  // "listings", not "homes" (2026-08-27 audit): the set includes
  // fractional-interest rows, where the price buys a share of a dwelling. Each
  // such row is labelled on its own meta line; the caption names the honest
  // population for all of them.
  const totalLabel = `${total.toLocaleString('en-US')} active single-family ${total === 1 ? 'listing' : 'listings'} in ${zip}`
  if (shown >= total) return totalLabel
  return `${totalLabel} · the ${shown.toLocaleString('en-US')} highest-priced below`
}

/**
 * Every tile is a row so the list, the map, and the caption count one set.
 * Photographs pass through when the tile has one. A missing photo does not drop the home.
 */
export function zipFieldItems(tiles: readonly ListingTile[], zip: string): V3FieldItem[] {
  return [...tiles]
    .filter((tile) => isFigure(tile.listPrice, 1))
    .sort((a, b) => (b.listPrice ?? 0) - (a.listPrice ?? 0))
    .map((tile) => {
      const photo = tile.photoUrl?.trim()
      return {
        id: tile.listingKey,
        href: listingTileHref(tile),
        priceLabel: formatPrice(tile.listPrice),
        title: tileTitle(tile, `ZIP ${zip}`),
        meta: tileMeta(tile),
        lat: tile.lat,
        lng: tile.lng,
        ...(photo ? { photoSrc: photo } : {}),
      }
    })
}

/* -------------------------------------------------------------------------- */
/* The median-close overlay                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The year overlay under the market Instrument's figures (D9: a trend lives
 * under the big answer, never as a seventh pattern).
 *
 * WHY THIS IS NOT buildCityMedianChart. The Market family's shared builder
 * slices to the newest THREE calendar years, which was written when the atom
 * kept three categorical hues apart. V3_CHART_CATEGORY_SLOTS is 5, and the KB
 * chart this replaces drew FOUR years on every ZIP page ("4 years shown"), so
 * borrowing the three-year slice would have dropped a whole year of published
 * medians on the way across. The cap here is the atom's own constant, so the
 * two cannot drift: whatever the atom can keep apart is what this draws.
 *
 * A year needs two or more finite months to be a line — one point is not a
 * trend, and drawing it as one would invent a direction the data never had.
 */
export function zipMedianChart(
  years: readonly KbYearSeries[],
  caption: string,
): V3ChartProps | undefined {
  const overlay: V3ChartSeries[] = []
  for (const year of years.slice(-V3_CHART_CATEGORY_SLOTS)) {
    const points: V3ChartPoint[] = []
    for (const row of year.points) {
      const tick = MONTH_TICK[row.m - 1]
      if (!tick) continue
      if (!Number.isFinite(row.value) || row.value <= 0) continue
      const label = formatPriceCompact(row.value)
      if (!label || label === '—') continue
      points.push({ value: row.value, tick: v3Text(tick), label: v3Text(label), at: row.m })
    }
    if (points.length < 2) continue
    overlay.push({ name: v3Text(String(year.year)), points })
  }
  if (overlay.length === 0) return undefined
  // Same three helpers the place family calls (placeMedianChart), so the ZIP
  // node and the city node round one series the same way and write the same
  // sentence about it.
  const claim = yoyClaim({ metric: 'Median sale price', unit: 'money', series: overlay })
  const yTicks = moneyTicks(overlay)
  return {
    caption: v3Text(caption),
    ...(claim ? { claim: v3Text(claim) } : {}),
    series: overlay,
    overlay: 'yoy',
    emphasize: 'last',
    ...(yTicks.length ? { yTicks } : {}),
    xTicks: monthTicks(MONTH_TICK),
  }
}

/**
 * The leftover pace items this page prints, minus the three that would render
 * a second copy of a figure the market Instrument already carries above them:
 *
 *   pending  is the Instrument's "pending · now"          (hud.pending)
 *   sto      is the Instrument's "sale to list"           (hud.saleToList)
 *   closed   is the Instrument's "sold · 12 months"       (hud.sold12mo)
 *
 * Every other item stays, including `medClose` and the year-over-year line,
 * which nothing else on this page publishes. Dropping a duplicate is not the
 * same as dropping a figure: each of the three is still on the page once, with
 * the label the KB HUD gave it.
 */
export const ZIP_PACE_KEYS_ON_THE_HUD = new Set(['pending', 'sto', 'closed'])
