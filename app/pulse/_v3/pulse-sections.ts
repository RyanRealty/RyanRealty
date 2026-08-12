/**
 * /pulse - the route-local constants, traces, and section builders.
 *
 * WHY THIS FILE EXISTS. app/pulse/page.tsx crossed the 600-line floor
 * (ci:file-size-budget) once the section-0 reasoning behind each trace was written
 * down where the next agent reads it. Re-baselining the budget was not an option -
 * a gate you widen to fit your diff is a gate that stops meaning anything - so the
 * page keeps the reads, the one derivation, and the render, and everything that is
 * pure moves here. Nothing changed shape on the way over: every string, guard, and
 * ordering below is byte-for-byte what the page computed inline.
 *
 * THE TRACES ARE THE POINT, NOT THE LEFTOVERS. Two of these figures are narrower
 * than their labels and the traces say so, because the alternative is a licensed
 * broker's page publishing a number under a population it does not belong to:
 *
 *   - `new_count_7d` counts homes whose OnMarketDate falls in the last 7 days AND
 *     whose status is still Active or Coming Soon. A home listed five days ago that
 *     went pending yesterday is not in it, so the figure understates true 7-day
 *     new-listing volume by whatever share already went under contract.
 *   - `median_days_to_pending` is blank below five closings THAT CARRY A RECORDED
 *     list-to-pending time, not below five closings. A city with twenty closings of
 *     which three record a pending date also shows a blank, so the looser wording
 *     would state a reason for the empty cell that is not the operative one.
 *
 * Both verified against the live refresh_market_pulse() body on 2026-08-12
 * (supabase/migrations/20260526140535_refresh_market_pulse_advisory_lock.sql lines
 * 128-137 for the 7-day filter, 192-194 for the suppression, 212-223 for the
 * active-DOM population).
 */

import {
  type PulseCitySnapshot,
  type PulseEventType,
  type PulseRegionSnapshot,
} from '@/app/actions/pulse-feed'
import { SITE_CITY_SLUGS, citySlugForScope } from '@/lib/central-oregon'
import { marketVerdict, MOS_METHODOLOGY_CLAUSE, MOS_THRESHOLD_CLAUSE } from '@/lib/market/classify'
import { formatPrice } from '@/lib/format/money'
import { listingsBrowsePath } from '@/lib/slug'
import { valuationHref } from '@/lib/site/valuation-href'
import { v3Text, type V3InstrumentFigure, type V3LedgerFigureRow } from '@/components/site/v3'

/**
 * The live event list, and the door the two event-count figures open. The id is the
 * KB page's own section id, kept so the `section_view` analytics dimension does not
 * change under the tracker. It also avoids the four-letter fragment of "feed" that a
 * leading hash turns into a valid four-digit hex color, which ci:design-tokens reads
 * as an off-brand literal. That is a real finding on a real regex, not a false one.
 */
export const FEED_ANCHOR = '#pulse-feed'

/**
 * The same list with the island's own event-type filter already applied, which is
 * what makes a count figure a door onto the population it names instead of onto an
 * unfiltered mix. The query key and the values are the island's
 * (components/pulse/PulseFeed.tsx `types`), and the page reads the same key so the
 * server's first page matches the chips the island lights up.
 */
export function feedFilterHref(type: PulseEventType): string {
  return `/pulse?types=${type}${FEED_ANCHOR}`
}

/** The Central Oregon region report, where the inventory figures are broken out. */
export const REGION_REPORT_PATH = '/housing-market/central-oregon'

/** This route, as the origin path every valuation door on it carries. */
export const PAGE_PATH = '/pulse'

/**
 * The valuation door, both places this page opens one. One builder, one destination,
 * one origin stamp - see the page header. Built once here so the Sheet's push and the
 * closing Quiet's crawlable edge cannot drift apart.
 */
export const VALUATION_HREF = valuationHref(PAGE_PATH)

/** Cities with a verified /cities/<slug> page (lib/central-oregon.ts owns the set). */
const CITY_PAGE_SLUGS = new Set(SITE_CITY_SLUGS)

/**
 * The island's event types, as strings the page can validate a URL against.
 * `satisfies` binds the list to the exported union, so a value that is not a real
 * event type fails to compile rather than reaching the query as a silent no-op.
 */
export const FEED_EVENT_TYPES = [
  'new_listing',
  'price_drop',
  'status_pending',
  'status_closed',
  'back_on_market',
] as const satisfies readonly PulseEventType[]

export type PulseSearchParams = {
  types?: string | string[]
  cities?: string | string[]
}

/** A repeated or comma-joined query value, as the island writes it. */
export function csvParam(value: string | string[] | undefined): string[] {
  if (value == null) return []
  const raw = Array.isArray(value) ? value : [value]
  return raw
    .flatMap((entry) => entry.split(','))
    .map((entry) => entry.trim())
    .filter(Boolean)
}

/**
 * What this page lets the feed island publish about a market row.
 *
 * `market_health_label` is the composite health-score bucket (Cold/Cool/Warm/Hot/Very
 * Hot). MarketSnapshotCard renders it as the card's badge, which is the slot a reader
 * reads as the verdict, and it carries no source line inside the island. This page
 * publishes ONE verdict, from months of supply, so the field is replaced with that
 * verdict rather than left to a second metric. `months_of_supply` is dropped unless it
 * is above 0 for the same reason the headline guards it: a stored zero is not an
 * inventory reading, and the card would otherwise classify it as a seller's market.
 */
export function pageVerdictSnapshot<T extends PulseCitySnapshot>(snapshot: T): T {
  const mos =
    snapshot.months_of_supply != null && snapshot.months_of_supply > 0
      ? snapshot.months_of_supply
      : null
  const verdict = marketVerdict(mos)
  return {
    ...snapshot,
    months_of_supply: mos,
    market_health_label: verdict.kind === 'unknown' ? null : verdict.label,
  }
}

/**
 * The opening Instrument's trace, covering the four INVENTORY figures it prints and
 * nothing else. Each population is named where the figure is printed, and the two MOS
 * clauses carry the formula and the thresholds the headline verdict is read against.
 */
export const MARKET_TRACE =
  'live MLS through Oregon Data Share, single-family homes across the Central Oregon region. ' +
  'Homes for sale counts active and coming-soon listings at the refresh stamped here. ' +
  'Median days on market is their age together with listings under contract, so it is ' +
  'inventory age, not days to pending. Median list price spans all of those plus the pending ones. ' +
  MOS_METHODOLOGY_CLAUSE +
  ' ' +
  MOS_THRESHOLD_CLAUSE

/**
 * The activity Instrument's trace, covering the two EVENT counts and nothing else. Both
 * are narrower than their labels read, and the sentence says so rather than leaving the
 * reader to assume the obvious meaning (see the file header).
 */
export const ACTIVITY_TRACE =
  'live MLS through Oregon Data Share, single-family homes across the Central Oregon region, ' +
  'the same market row and the same refresh as the figures at the top of this page. ' +
  'New listings counts homes that came on market in the last 7 days and are still active or ' +
  'coming soon, so one that has already gone under contract is not in it. Sold counts closings ' +
  'from the last 30 days. Each figure opens the feed filtered to that event, which lists the ' +
  'most recent of them rather than the counted window.'

/**
 * Names every Ledger column, because the pattern renders no column header and an
 * unnamed figure is whatever the reader assumes it is. A bare `$750,000` in the value
 * column is a median sale, an average, or a list price depending on who is reading.
 */
export const CITY_NOTE =
  'One row per city: median days on market, homes for sale, median days to pending, ' +
  'and median list price.'

/** The city Ledger's trace, at the same standard the Instrument holds. */
export const CITY_TRACE =
  'live MLS through Oregon Data Share, single-family homes, one row per city, ordered by inventory. ' +
  'Homes for sale counts active and coming-soon listings. Days on market is the median age of those ' +
  'listings together with the ones under contract, so it is inventory age, not days to pending. ' +
  'Median list price spans all of them plus the pending ones. Days to pending is a different ' +
  'population: the median list-to-pending time among homes that closed in the last 90 days, and a ' +
  'city with fewer than five of those closings carrying a recorded list-to-pending time shows no ' +
  'figure for it.'

/**
 * The four INVENTORY figures, in reading order. Every one is a door: dead text naming a
 * linkable thing is a defect in this program. All four come from the one
 * market_pulse_live region row MARKET_TRACE describes.
 *
 * `mosDisplay` arrives as a STRING, already through lib/format/months-of-supply.ts,
 * because the page owns the one derivation: classify the raw value, and let the one
 * boundary-safe formatter decide the digits. Taking a number here would put the
 * rounding back at the call site, which is what printed 4.0 under a "balanced market"
 * headline beside a threshold sentence reading "4 months of supply or less is a
 * seller's market" on the surfaces this rule was written for.
 */
export function buildMarketFigures(
  regionSnapshot: PulseRegionSnapshot | null,
  mosDisplay: string | null
): V3InstrumentFigure[] {
  const figures: V3InstrumentFigure[] = []
  if (regionSnapshot != null) {
    figures.push({
      value: v3Text(regionSnapshot.active_count.toLocaleString('en-US')),
      label: v3Text('homes for sale'),
      href: listingsBrowsePath(),
    })
  }
  if (regionSnapshot?.median_list_price != null) {
    figures.push({
      value: v3Text(formatPrice(regionSnapshot.median_list_price)),
      label: v3Text('median list price'),
      href: REGION_REPORT_PATH,
    })
  }
  if (mosDisplay != null) {
    figures.push({
      value: v3Text(mosDisplay),
      label: v3Text('months of supply'),
      href: '/months-of-supply',
    })
  }
  if (regionSnapshot?.median_active_dom != null) {
    // Unsold inventory age, NOT days to pending. The two are different populations
    // and differ by a factor of three on this region row, so the label says which.
    figures.push({
      value: v3Text(String(Math.round(regionSnapshot.median_active_dom))),
      label: v3Text('median days on market, active'),
      href: REGION_REPORT_PATH,
    })
  }
  return figures
}

/**
 * The two EVENT counts, which are a different population from the four above and now sit
 * in their own section beside the feed they count. Both open that feed already filtered
 * to the event they count, so the figure is a door onto the population it names rather
 * than onto an unfiltered mix of price drops, pendings, and solds.
 *
 * They come from the SAME market_pulse_live row as the inventory figures, which is why
 * ACTIVITY_TRACE says so and why the page stamps both sections from that row's
 * `updated_at`. One read, one clock, two traces, each covering exactly what its own
 * section prints.
 */
export function buildActivityFigures(
  regionSnapshot: PulseRegionSnapshot | null
): V3InstrumentFigure[] {
  if (regionSnapshot == null) return []
  return [
    {
      value: v3Text(regionSnapshot.new_count_7d.toLocaleString('en-US')),
      label: v3Text('new listings, last 7 days'),
      href: feedFilterHref('new_listing'),
    },
    {
      value: v3Text(regionSnapshot.sold_count_30d.toLocaleString('en-US')),
      label: v3Text('sold, last 30 days'),
      href: feedFilterHref('status_closed'),
    },
  ]
}

/**
 * City rows, plus the labels that earned one.
 *
 * A city earns a row when the live query returned it with a median list price AND a
 * median days on market AND it has a verified city page, because a Ledger row is a door
 * and a figure this page cannot source is a figure it does not print. Days to pending is
 * optional: refresh_market_pulse leaves it null below five closings that carry a recorded
 * list-to-pending time, and CITY_TRACE states that rather than filling the cell in.
 */
export function buildCityRows(citySnapshots: readonly PulseCitySnapshot[]): {
  rows: V3LedgerFigureRow[]
  rowed: Set<string>
} {
  const rows: V3LedgerFigureRow[] = []
  const rowed = new Set<string>()
  for (const snapshot of citySnapshots) {
    const label = snapshot.geo_label?.trim()
    if (!label) continue
    const slug = citySlugForScope(label)
    if (!CITY_PAGE_SLUGS.has(slug)) continue
    if (snapshot.median_list_price == null || snapshot.median_active_dom == null) continue
    rowed.add(label)
    const forSale = `${snapshot.active_count.toLocaleString('en-US')} for sale`
    rows.push({
      href: `/cities/${slug}`,
      when: v3Text(`${Math.round(snapshot.median_active_dom)} days on market`),
      what: v3Text(label),
      detail: v3Text(
        snapshot.median_days_to_pending != null
          ? `${forSale} · ${Math.round(snapshot.median_days_to_pending)} days to pending`
          : forSale
      ),
      value: v3Text(formatPrice(snapshot.median_list_price)),
      id: slug,
    })
  }
  return { rows, rowed }
}

/**
 * A covered city with no row still gets its fact stated, from its own data. Four cases
 * and they are not the same claim: the query returned nothing for it (which includes a
 * row with zero active listings, because getPulseCitySnapshots filters those out before
 * this page sees them), it returned a row with no median, it returned a row with no
 * days-on-market figure, or it returned real inventory but has no city page to open.
 * ABSENT IS NOT ZERO - none of the four prints a fabricated 0 under a live-MLS trace.
 */
export function buildCityFootnotes(
  defaultCities: readonly string[],
  citySnapshots: readonly PulseCitySnapshot[],
  rowed: ReadonlySet<string>
): string[] {
  const byLabel = new Map(citySnapshots.map((snapshot) => [snapshot.geo_label, snapshot]))
  return defaultCities
    .filter((label) => !rowed.has(label))
    .map((label) => {
      const snapshot = byLabel.get(label)
      if (!snapshot) return `${label} returned no active single-family row in the latest sync`
      const active = snapshot.active_count.toLocaleString('en-US')
      if (snapshot.median_list_price == null) {
        return `${label} shows ${active} active with no published median list price`
      }
      if (snapshot.median_active_dom == null) {
        return `${label} shows ${active} active with no published days-on-market figure`
      }
      return `${label} shows ${active} active and has no city page`
    })
}

/**
 * The Ledger's own freshness stamp, taken from the city rows themselves rather than
 * borrowed from the region row, which refreshes on its own schedule.
 */
export function cityRefreshStamp(citySnapshots: readonly PulseCitySnapshot[]): string | undefined {
  return citySnapshots
    .map((snapshot) => snapshot.updated_at)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .sort()
    .at(-1)
}
