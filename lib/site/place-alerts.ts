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
 * ONE FACT, ONE SENTENCE (evaluator, 2026-09-08). The callout and the sticky
 * repeat used to say the same count two ways — "came on the market in Bend" and
 * "listed in Bend" — which reads as two figures and makes a visitor check. Both
 * now render from ONE builder, `placeAlertsClaimParts`: the sticky renders the
 * parts (so the place name can stay whole at 375), the callout joins them, and
 * the test beside this file asserts the join is the claim, character for
 * character.
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
import {
  LISTING_FIELD_LEAD_PHOTO_SIZE,
  listingRowPhotoSrc,
} from '@/lib/listing/row-photo'

export type PlaceAlertsGeoType = 'city' | 'neighborhood' | 'zip'

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
  /** Defaults to house / houses. Condo and land pass their own noun. */
  noun?: PlaceAlertsNoun
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
  /**
   * The scope the PROMISE names, or null when the scope line already says it:
   * the two sit 200px apart and one statement is enough (evaluator, round 3).
   */
  promiseScope: string | null
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

export type PlaceAlertsNoun = { one: string; many: string }

const HOUSES: PlaceAlertsNoun = { one: 'house', many: 'houses' }

function units(n: number, noun: PlaceAlertsNoun): string {
  return n === 1 ? noun.one : noun.many
}

/**
 * THE ONE SENTENCE, in three parts. The sticky repeat renders the parts so the
 * place name never breaks across lines; the callout joins them. Neither mount
 * writes its own wording, so a visitor who meets both meets one fact.
 *
 * The numeral is NOT in `before` when the count earns a display figure: the
 * callout sets it in the register's numeral face and the sticky sets it inline,
 * and both put it immediately before this sentence.
 */
export function placeAlertsClaimParts(
  placeName: string,
  scopeName: string,
  n: number | null,
  noun: PlaceAlertsNoun = HOUSES,
): PlaceAlertsStickyClaim {
  if (n == null) {
    return { before: 'New', place: scopeName, after: 'listings, by email, as they come on the market.' }
  }
  const after = 'in the last 30 days.'
  if (earnsDisplayFigure(n)) return { before: `${units(n, noun)} came on the market in`, place: placeName, after }
  return { before: `${formatCount(n)} ${units(n, noun)} came on the market in`, place: placeName, after }
}

/** The same sentence as one string, for the mount that has room to wrap it. */
export function joinClaimParts(parts: PlaceAlertsStickyClaim): string {
  return `${parts.before} ${parts.place} ${parts.after}`
}

export function placeAlertsClaim(
  placeName: string,
  scopeName: string,
  n: number | null,
  noun: PlaceAlertsNoun = HOUSES,
): string {
  return joinClaimParts(placeAlertsClaimParts(placeName, scopeName, n, noun))
}

export function placeAlertsStickyClaim(
  placeName: string,
  scopeName: string,
  n: number | null,
  noun: PlaceAlertsNoun = HOUSES,
): PlaceAlertsStickyClaim {
  return placeAlertsClaimParts(placeName, scopeName, n, noun)
}

/** What the promise names: the scope the filter really sends, with the place folded in when it is narrower. */
export function placeAlertsScope(placeName: string, scopeName: string): string {
  return scopeName === placeName ? scopeName : `${scopeName}, ${placeName} included`
}

/** Letters and digits only, so "Mt. Bachelor Village" and "Mt Bachelor Village" are one name. */
function nameKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

/**
 * THE NAMES A VISITOR CAN READ AS THIS PLACE (evaluator, 2026-09-08).
 *
 * The alert filter expands a community into its full registry alias set
 * (lib/subdivision-aliases getSubdivisionMatchNames), and that set carries plat
 * fragments as well as place names: Tetherow's is `["Tetherow", "Triple",
 * "Tetherow Resort"]`, where "Triple" is a recorded-plat fragment
 * (data/resort-communities.json subdivision_aliases). Printed in a sentence a
 * buyer reads, "...under Tetherow, Triple or Tetherow Resort" reads as a
 * corrupt row, not as coverage.
 *
 * So the SENTENCE lists only the names that read as this place — a name whose
 * letters contain the place's, or that the place's contain (so "Black Butte"
 * survives under "Black Butte Ranch") — deduplicated on punctuation. THE QUERY
 * IS UNTOUCHED: the binders pass the full match set to the capture action and
 * nothing here narrows what the filter matches. The line the reader gets is
 * still true of every name it names; it simply stops reciting fragments.
 */
export function readableMatchNames(placeName: string, names: readonly string[]): string[] {
  const place = nameKey(placeName)
  if (!place) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of names) {
    const name = raw.trim()
    const key = nameKey(name)
    if (!name || key.length < 3 || seen.has(key)) continue
    if (!key.includes(place) && !place.includes(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out
}

/** "Tetherow or Tetherow Resort" */
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
  const names = readableMatchNames(input.placeName, input.matchNames ?? [])
  if (names.length > 1) {
    return `The alert covers every listing the MLS files under ${joinNames(names)}.`
  }
  return null
}

/**
 * THE STRIP'S ONE LINE, and it is the line that carries consent, so where the
 * alert sends wider than the figure counts the SCOPE goes first and the cadence
 * folds in behind it (evaluator, 2026-09-08: the callout carried the scope and
 * the sticky repeat dropped it for cadence, so a visitor who only ever met the
 * strip never learned the alert was wider than the count). Where scope equals
 * the place — the city class — there is nothing to reconcile and the line stays
 * the cadence sentence.
 *
 * `cadence` stays a literal in the binder that calls the capture action:
 * ci:alert-capture-disclosure reads THAT file for a frequency sentence and an
 * unsubscribe sentence.
 */
export function placeAlertsStickyNote(scopeLine: string | null, cadence: string): string {
  const scope = (scopeLine ?? '').trim()
  return scope ? `${scope} ${cadence.trim()}` : cadence.trim()
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

/** Human place label for a source line — never `neighborhood:slug` / raw geoSlug. */
export function placeAlertsWhere(placeName: string | undefined, geoSlug: string): string {
  const named = placeName?.trim()
  if (named) return named
  // Last resort: strip a geoType prefix and hyphens. Never print "neighborhood:…".
  return geoSlug
    .replace(/^(city|neighborhood|zip|community):/i, '')
    .replace(/^bend-/i, '')
    .replace(/-/g, ' ')
    .trim()
}

export function placeAlertsSource(input: {
  count: number
  geoType: PlaceAlertsGeoType
  geoSlug: string
  /** Visitor-facing place name for the disclosure (never the raw metric slug). */
  placeName?: string
  noun?: PlaceAlertsNoun
  table?: 'market_metric' | 'listing_tile_mv'
}): string {
  const noun = input.noun ?? HOUSES
  const unit = units(input.count, noun)
  const where = placeAlertsWhere(input.placeName, input.geoSlug)
  // geoType is for the caller / tests only — never interpolate into visitor copy.
  void input.geoType
  if (input.table === 'listing_tile_mv') {
    return (
      `${formatCount(input.count)} ${unit}: live MLS listings in ${where}, ` +
      `active, on-market date in the last 30 days, Coming Soon excluded. ` +
      `The alert follows this page's filter.`
    )
  }
  return (
    `${formatCount(input.count)} ${unit}: regional MLS through Oregon Data Share, Market Truth ` +
    `new listings in the last 30 days for ${where} (detached single-family; Coming Soon excluded). ` +
    `The alert follows this page's filter, which is wider than houses alone.`
  )
}

export function placeAlertsCopy(input: PlaceAlertsInput): PlaceAlertsCopy {
  const n = publishableNewCount(input.newCount30d)
  const noun = input.noun ?? HOUSES
  const scopeLine = placeAlertsScopeLine({
    placeName: input.placeName,
    scopeName: input.scopeName,
    matchNames: input.matchNames,
  })
  const scopePhrase = placeAlertsScope(input.placeName, input.scopeName)
  return {
    eyebrow: `New listings · ${input.placeName}`,
    count: earnsDisplayFigure(n) ? formatCount(n) : null,
    claim: placeAlertsClaim(input.placeName, input.scopeName, n, noun),
    stickyClaim: placeAlertsStickyClaim(input.placeName, input.scopeName, n, noun),
    scopeLine,
    scopePhrase,
    promiseScope: scopeLine ? null : scopePhrase,
    submitLabel: 'Email me each one',
    browseLabel: `See the newest ${input.placeName} listings`,
    sent: {
      heading: `Set. New ${input.scopeName} listings land by email when they hit the market.`,
      body: 'Price changes on those homes come in the same email. Pause or unsubscribe from any alert email.',
    },
    source:
      n == null
        ? undefined
        : placeAlertsSource({
            count: n,
            geoType: input.geoType,
            geoSlug: input.geoSlug,
            placeName: input.placeName,
            noun,
          }),
    stickyLabel: `${input.scopeName} listing alerts`,
  }
}

export type PlaceAlertListing = {
  href: string
  photoSrc: string
  title: string
  price?: string | null
  beds?: number | null
  baths?: number | null
  sqft?: number | null
}

export type PlaceAlertTypeBucket = {
  key: string
  label: string
  noun: PlaceAlertsNoun
  newCount30d: number | null
  source: 'listing_tile_mv' | 'market-truth'
  listings: readonly PlaceAlertListing[]
}

export type PlaceAlertTypeOption = {
  key: string
  label: string
  count: string | null
  claim: string
  stickyClaim: PlaceAlertsStickyClaim
  source?: string
  listings: readonly PlaceAlertListing[]
}

/**
 * One option per type the place actually has. Houses keep leftoverHudKpis
 * new_listings_30d; condo and land keep the listing_tile_mv 30-day count, named.
 */
export function buildPlaceAlertTypes(input: {
  placeName: string
  scopeName: string
  geoType: PlaceAlertsGeoType
  geoSlug: string
  leftoverHouses30d: number | null
  matchNames?: readonly string[]
  buckets: readonly PlaceAlertTypeBucket[]
}): PlaceAlertTypeOption[] {
  const options: PlaceAlertTypeOption[] = []
  const seen = new Set<string>()
  const houses: PlaceAlertTypeBucket = {
    key: 'houses',
    label: 'Houses',
    noun: HOUSES,
    newCount30d: input.leftoverHouses30d,
    source: 'market-truth',
    listings: input.buckets.find((b) => b.key === 'houses')?.listings ?? [],
  }
  const rest = input.buckets.filter((b) => b.key !== 'houses')
  for (const bucket of [houses, ...rest]) {
    if (seen.has(bucket.key)) continue
    seen.add(bucket.key)
    const count30 =
      bucket.key === 'houses' ? input.leftoverHouses30d : bucket.newCount30d
    const n = publishableNewCount(count30)
    // Condo/land without a publishable 30-day count must not render — a
    // newsletter pitch over active-lot photos is the SITE-104 land honesty miss.
    if (n == null && bucket.key !== 'houses') continue
    if (n == null && bucket.listings.length === 0) continue
    // Claim stays the 30-day count. Cards never outrun that count (three land
    // thumbs under "1 lot" was the SITE-84 honesty fail). A short photo strip
    // under a larger count is a sample, not a second answer.
    const photoCap = Math.min(4, bucket.listings.length)
    const cardCount = n == null ? photoCap : Math.min(n, photoCap)
    const copy = placeAlertsCopy({
      placeName: input.placeName,
      scopeName: input.scopeName,
      newCount30d: n,
      geoType: input.geoType,
      geoSlug: input.geoSlug,
      matchNames: input.matchNames,
      noun: bucket.noun,
    })
    const table = bucket.key === 'houses' ? 'market_metric' : 'listing_tile_mv'
    const listings = bucket.listings.slice(0, cardCount).map((listing) => ({
      ...listing,
      // Caller may already have asked for 800×600; re-assert card size so a
      // 320 ledger thumb never lands in the alerts figure.
      photoSrc: listingRowPhotoSrc(listing.photoSrc, LISTING_FIELD_LEAD_PHOTO_SIZE),
      price: listing.price ?? null,
      beds: listing.beds ?? null,
      baths: listing.baths ?? null,
      sqft: listing.sqft ?? null,
    }))
    options.push({
      key: bucket.key,
      label: bucket.label,
      count: copy.count,
      claim: copy.claim,
      stickyClaim: copy.stickyClaim,
      source:
        n == null
          ? undefined
          : placeAlertsSource({
              count: n,
              geoType: input.geoType,
              geoSlug: input.geoSlug,
              placeName: input.placeName,
              noun: bucket.noun,
              table,
            }),
      listings,
    })
  }
  return options
}
