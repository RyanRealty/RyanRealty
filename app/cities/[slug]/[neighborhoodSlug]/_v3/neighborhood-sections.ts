/**
 * Route-local shaping for the v3 neighborhood node. Pure functions only: every
 * one takes rows the page already fetched and returns barrel-shaped props.
 *
 * WHY THIS FILE EXISTS. Two reasons, both mechanical. `ci:file-size-budget`
 * refuses any file under app/ or lib/ at 600 lines or more, and the page it
 * serves has to stay a readable list of sections rather than a wall of row
 * mapping. Nothing here fetches, and nothing here reaches outside the barrel.
 *
 * NOTHING HERE INVENTS A FIGURE. Every function returns only what its input
 * actually carried: a null field produces no figure, no row, and no sentence.
 * The rounding and currency rules stay in lib/format, so the string a visitor
 * reads is the string the caller's source trace covers (CLAUDE.md section 0).
 *
 * ONE POPULATION PER BUILDER. `liveFigures` reads the market_pulse_live row and
 * nothing else; `soldFigures` reads the market_stats_cache row and nothing else.
 * They are separate functions because they are separate populations with
 * separate traces and separate stamps, and a builder that could mix them is a
 * builder that eventually does.
 *
 * THE TRACES LIVE HERE TOO, next to the builders whose figures they cover, for
 * the reason app/subdivisions/[slug]/_v3/subdivision-traces.ts states: a source
 * sentence written at the render site drifts from the query that produced the
 * number. No sentence in this file contains a number.
 */
import {
  v3Text,
  type V3InstrumentFigure,
  type V3FieldItem,
  type V3LedgerFigureRow,
  type V3QuietItem,
} from '@/components/site/v3'
import { formatPrice } from '@/lib/format/money'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { listingDetailPath } from '@/lib/slug'
import type { ResortCommunityContent } from '@/lib/resort-community-content'

/**
 * `p_limit` inside getGeoBoundaryMapData's fetchPins. At the cap the true
 * in-boundary total is higher than the row count, so no count may be published
 * from a capped read.
 */
export const BOUNDARY_PIN_CAP = 200

/** How many in-boundary homes the Field lists. The KB split rail showed 24. */
export const FIELD_ROW_LIMIT = 24

/**
 * The short `$895K` form, for the character-constrained meta description ONLY.
 * Everything a visitor reads on the page uses formatPrice ($895,000), per the
 * brand rule. Carried across from the KB page unchanged.
 */
export function fmtK(n: number | null): string | null {
  return n != null ? `$${Math.round(n / 1000).toLocaleString()}K` : null
}

/**
 * A curated `seo_description` carrying a banned cliche (the live "charming" on
 * /cities/bend/old-bend) must never reach the SERP. Carried across from the KB
 * page unchanged, including the word list.
 */
export const BANNED_DESCRIPTION_RE =
  /\b(charming|stunning|nestled|boasts|pristine|breathtaking|must-see|hidden gem|luxurious|meticulously|gorgeous|immaculate)\b/i

/* -------------------------------------------------------------------------- */
/* The two boundary populations, and how they are named                        */
/* -------------------------------------------------------------------------- */

/**
 * Every figure on this page traces to one feed. This is how it is named, and it
 * is named on EVERY source line, including the one over the block that renders
 * individual listing records.
 */
const FEED = 'live MLS through Oregon Data Share'

/**
 * THE SUBTYPE IS THE WHOLE DIFFERENCE BETWEEN THIS PAGE'S TWO LIVE COUNTS, and
 * it is why they must never be spelled the same way.
 *
 * Verified live against the source 2026-08-12. `refresh_community_market_pulse()`
 * (migration 20260727180000_bl016_community_pulse_and_yearly.sql) computes
 * market_pulse_live.active_count off `listing_boundary_xref_mv` filtered
 * `property_type = 'A' AND (property_sub_type IS NULL OR property_sub_type =
 * 'Single Family Residence')`. The Field's set comes from the SAME recorded
 * polygon through listings_in_boundary, narrowed by getListingTiles to
 * `PropertyType = 'A'` and nothing further. PropertyType A is a BUCKET (repo
 * memory: property-type-A-is-a-bucket), so the second set also holds townhouses
 * and condominiums:
 *
 *   bend-southern-crossing, active: 2 Single Family Residence, 10 Townhouse,
 *                                   4 Condominium  ->  pulse 2, boundary set 16
 *   bend-old-bend,          active: 7 Single Family Residence, 1 Condominium
 *                                                    ->  pulse 7, boundary set 8
 *
 * Same geography, same feed, same status filter, different property population.
 * Both figures are true. Calling both of them "active single-family listings",
 * which is what this page did before, made one of them false in the H1, in the
 * visible Q&A, and in the FAQPage and Dataset markup.
 */
export const SFR_SUB_TYPE = 'Single Family Residence'

/** The subtypes PropertyType A holds, for the source line that names the bucket. */
export const A_BUCKET_PROSE = 'single-family homes, townhouses, and condominiums'

/**
 * The row-level home type, in plain words. A verbatim passthrough for anything
 * the feed reports that is not one of the three the A bucket actually carries in
 * Central Oregon, because renaming a value this file has never seen is how a row
 * ends up labelled as something it is not.
 */
const SUB_TYPE_LABEL: Readonly<Record<string, string>> = {
  [SFR_SUB_TYPE]: 'Single family',
  Townhouse: 'Townhouse',
  Condominium: 'Condo',
}

function subTypeLabel(raw: string | null | undefined): string | null {
  const value = raw?.trim()
  if (!value) return null
  return SUB_TYPE_LABEL[value] ?? value
}

/* -------------------------------------------------------------------------- */
/* Source traces                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The trace over the market_pulse_live figures. It covers EVERY figure that
 * block publishes, and it says so figure by figure, because the four do not
 * share a population:
 *
 *  - homes for sale + median list price: the active and coming-soon single-family
 *    listings inside the recorded polygon (the filter quoted above).
 *  - median days to pending: single-family sales that CLOSED in the last 90 days,
 *    resolved through the neighborhood_subdivisions alias join rather than the
 *    polygon. It is not measured on the active set the first sentence names,
 *    which is the gap this argument closes.
 *  - months of supply: that active count over the same closed series, which the
 *    canonical methodology clause states in full.
 *
 * IT IS THIS SHORT ON PURPOSE, AND THE LENGTH IS A LAYOUT FACT, NOT A STYLE ONE.
 * V3Instrument renders eyebrow, headline, figures, THIS LINE, then the action, in
 * that fixed order. At 390 the trace ran 18 lines and 337px, which put the page's
 * only filled seller CTA at y=892 on an 844px viewport: measured, the first
 * viewport carried zero visible filled controls, which is the exact defect the
 * ghost-to-primary repair was supposed to close (PUBLIC_UI.md section 1 counts
 * VISIBLE filled controls; migration-recipe.md addendum 2). Three sentences came
 * out, and NOT one of them covered a figure that prints:
 *
 *  - the forward reference to the boundary section. The Field's own source line
 *    already reconciles the two counts, standing next to the second one.
 *  - "publishes only when at least five of those closings carry the figure."
 *    That explains an ABSENCE, and this clause only renders when the figure is
 *    present. It is recorded in parity.json's dataLayer entry instead.
 *  - "The closings in that denominator are the same subdivision sales, over the
 *    last 180 days." MOS_METHODOLOGY_CLAUSE already states the denominator as
 *    closings over the last 6 months.
 *
 * Every population, filter, and window that backs a printed number is still here.
 * Adding a sentence to this function costs first-viewport pixels on a money
 * route, so anything added must cover a figure that ships.
 */
export function livePulseTrace(
  placeName: string,
  opts: { showDaysToPending: boolean; showMonthsOfSupply: boolean },
): string {
  if (opts.showMonthsOfSupply) {
    let trace = `${FEED}. Months of supply for single-family homes inside the recorded ${placeName} boundary.`
    if (opts.showDaysToPending) {
      trace += ` Median days to pending is single-family sales that closed in the last 90 days.`
    }
    return trace
  }
  if (opts.showDaysToPending) {
    return `${FEED}. Median days to pending is single-family sales that closed in the last 90 days under the subdivision names recorded for ${placeName}.`
  }
  return `${FEED}. Live single-family facts inside the recorded ${placeName} boundary.`
}

/**
 * The trace over the no-pulse branch. A different population from every other
 * block on the page: getNeighborhoodBySlug counts listing_tile_mv rows matched on
 * the neighborhood NAME and keeps every residential inventory type, so this
 * branch's figure is not the single-family subtype and does not claim to be.
 */
export function liveFallbackTrace(placeName: string, cityName: string, pulseRead: 'ok' | 'timeout'): string {
  return (
    `${FEED} through the live listing index, active residential listings whose recorded ` +
    `neighborhood is ${placeName}, ${cityName}. This branch counts every residential inventory ` +
    `type rather than the ${SFR_SUB_TYPE} subtype alone. ` +
    (pulseRead === 'ok'
      ? 'No market-pulse row is published for this neighborhood, so no days-to-pending and no months-of-supply figure is shown.'
      : 'The market row did not answer on this refresh, so no days-to-pending and no months-of-supply figure is shown.')
  )
}

/**
 * The trace over the Field, the block that renders individual MLS listing records
 * with address, price, beds, baths, and size. It names the feed first, for the
 * same reason MarketSources used to: a block displaying listing data has to say
 * whose listing data it is. It then reconciles itself to the figure above it, so
 * a reader who can see both numbers is told why they differ instead of left to
 * guess which one is wrong.
 */
export function fieldCountTrace(placeName: string): string {
  return (
    `${FEED}. Active listings inside the recorded ${placeName} boundary, PropertyType A, ` +
    `a bucket that holds ${A_BUCKET_PROSE}.`
  )
}

/* -------------------------------------------------------------------------- */
/* Instrument figures                                                          */
/* -------------------------------------------------------------------------- */

export type LivePulse = {
  activeCount: number
  medianListPrice: number | null
  medianDaysToPending: number | null
  monthsOfSupply: number | null
}

/**
 * Whether a pulse figure ships. Present and positive, nothing more, but it is a
 * FUNCTION because two places have to agree about it: liveFigures, which decides
 * whether the figure renders, and livePulseTrace, which decides whether to print
 * the argument covering it. A source line covering a figure that is not there is
 * noise. A figure with no coverage is the defect this repair closed.
 */
export function shipsFigure(value: number | null | undefined): boolean {
  return value != null && value > 0
}

/**
 * The live-inventory figures, every one off the SAME market_pulse_live row, so
 * the one trace and the one stamp the caller prints under them cover all of
 * them.
 *
 * THE COUNT LABEL SAYS SINGLE-FAMILY because the count IS single-family, and
 * because the block below it publishes a larger, correct number over the same
 * boundary. A figure reading "16 homes" under a headline figure reading "2 homes
 * for sale" is a contradiction the visitor can see; "2 single-family homes for
 * sale" over "16 active homes inside the boundary" is two facts. See SFR_SUB_TYPE.
 *
 * Pace only: months of supply first, then days to pending. Inventory and
 * median list price stay off this set. The array may be empty, and the page
 * then opens a Quiet instead of inventing a hero number.
 *
 * MONTHS OF SUPPLY GOES THROUGH formatMonthsOfSupply, THE ONE DISPLAY RULE, and
 * that is the whole reason this figure no longer has a suppression condition.
 * The earlier revision rounded to one decimal here and had the page withhold the
 * figure whenever the rounded form classified differently from the raw value, on
 * the stated ground that "there is no third number to print". That
 * premise was false: formatMonthsOfSupply IS the third number (4.02 prints 4.1,
 * 5.97 prints 5.9, so the printed figure never crosses a threshold the raw value
 * did not), and this same page was already printing it thirty rows below through
 * buildMarketFaq. The observable result at mos = 4.02 was an Instrument that
 * dropped the figure and a closing Q&A, off the same row, stating "4.1 months of
 * supply, which is a balanced market" — the page suppressing a number it was
 * simultaneously publishing.
 */
export function liveFigures(
  pulse: LivePulse,
  links: { browse: string; cityReport: string; monthsOfSupply: string },
): V3InstrumentFigure[] {
  const figures: V3InstrumentFigure[] = []
  if (shipsFigure(pulse.monthsOfSupply) && pulse.monthsOfSupply != null) {
    figures.push({
      value: v3Text(formatMonthsOfSupply(pulse.monthsOfSupply)),
      label: v3Text('months of supply'),
      href: links.monthsOfSupply,
    })
  }
  if (shipsFigure(pulse.medianDaysToPending) && pulse.medianDaysToPending != null) {
    figures.push({
      value: v3Text(String(Math.round(pulse.medianDaysToPending))),
      label: v3Text('median days to pending'),
      href: links.cityReport,
    })
  }
  return figures
}

/**
 * The no-pulse branch's figures, off getNeighborhoodBySlug's own read of
 * listing_tile_mv. A DIFFERENT population from liveFigures: every residential
 * inventory type, matched on the neighborhood name rather than the polygon. It
 * therefore gets its own label wording ("homes for sale", not "single-family
 * homes for sale"), its own trace (liveFallbackTrace), and no stamp, because
 * that read carries none.
 *
 * Median only when it ships. Empty when it does not. Inventory is not a hero.
 */
export function liveFallbackFigures(
  neighborhood: { activeCount: number; medianPrice: number | null },
  browseHref: string,
): V3InstrumentFigure[] {
  if (shipsFigure(neighborhood.medianPrice) && neighborhood.medianPrice != null) {
    return [
      {
        value: v3Text(formatPrice(neighborhood.medianPrice)),
        label: v3Text('median list price'),
        href: browseHref,
      },
    ]
  }
  return []
}

export type SoldStats = {
  medianSalePrice: number | null
  soldCount: number | null
  saleToListRatio: number | null
  medianDaysOnMarket: number | null
}

/**
 * The closed-sales figures, every one off the SAME market_stats_cache row.
 *
 * The sale-to-list normalization is carried across from the KB market HUD
 * unchanged: the column is stored as a ratio on some rows (0.9556) and as a
 * percent on others, so a value under 2 is multiplied by 100 and anything else
 * is already a percent. Units are stated on the figure, never assumed.
 *
 * No figure here is a door. Individual sold listings are VOW-only under ODS
 * rule 5-4 A.4, so there is no public sold surface to send a reader to, and a
 * figure that links to the wrong population is worse than one that links
 * nowhere.
 */
export function soldFigures(stats: SoldStats): V3InstrumentFigure[] {
  const figures: V3InstrumentFigure[] = []
  if (stats.medianSalePrice != null && stats.medianSalePrice > 0) {
    figures.push({
      value: v3Text(formatPrice(stats.medianSalePrice)),
      label: v3Text('median sale price'),
    })
  }
  if (stats.soldCount != null && stats.soldCount > 0) {
    figures.push({
      value: v3Text(stats.soldCount.toLocaleString('en-US')),
      label: v3Text('homes sold'),
    })
  }
  if (stats.saleToListRatio != null && stats.saleToListRatio > 0) {
    const pct = stats.saleToListRatio < 2 ? stats.saleToListRatio * 100 : stats.saleToListRatio
    figures.push({
      value: v3Text(`${pct.toFixed(1)}%`),
      label: v3Text('average sale to list'),
    })
  }
  if (stats.medianDaysOnMarket != null && stats.medianDaysOnMarket > 0) {
    figures.push({
      value: v3Text(`${Math.round(stats.medianDaysOnMarket)} days`),
      label: v3Text('median days on market'),
    })
  }
  return figures
}

/* -------------------------------------------------------------------------- */
/* Field rows                                                                  */
/* -------------------------------------------------------------------------- */

export type FieldTile = {
  listingKey: string | null
  listNumber: string | null
  listPrice: number | null
  beds: number | null
  baths: number | null
  sqft: number | null
  streetNumber: string | null
  streetName: string | null
  streetSuffix?: string | null
  city: string | null
  subdivisionName: string | null
  /**
   * The home type, straight off listing_tile_mv. Rendered on every row that has
   * one, because this set is the PropertyType A bucket and the single-family
   * figure above it is a strict narrowing of that bucket: a reader comparing the
   * two numbers can see, row by row, which homes the smaller figure left out.
   */
  propertySubType?: string | null
  lat: number | null
  lng: number | null
  photoUrl?: string | null
}

/**
 * In-boundary homes as Field rows, highest price first, capped at
 * FIELD_ROW_LIMIT. Highest-price-first and the 24-row cap are both carried
 * across from the KB rail this replaces.
 *
 * A tile with no listing key is dropped: the key is the row identity the
 * pin-to-row binding runs on, and it is also what listingDetailPath needs to
 * build a door. A tile with no price renders "Price on request" rather than an
 * empty column, because the Field's price is a visible column and a blank one
 * reads as free.
 *
 * The meta line ends with the home type when the feed reports one. That is not
 * decoration: this set is the PropertyType A bucket, the figure above it counts
 * only the Single Family Residence subtype, and the row-level type is what lets a
 * reader reconcile the two counts themselves.
 */
export function fieldItems(tiles: readonly FieldTile[]): V3FieldItem[] {
  return [...tiles]
    .filter((t) => Boolean(t.photoUrl?.trim()) && Boolean(t.listingKey?.trim()))
    .sort((a, b) => (b.listPrice ?? 0) - (a.listPrice ?? 0))
    .slice(0, FIELD_ROW_LIMIT)
    .flatMap((t) => {
      const key = t.listingKey?.trim()
      const photo = t.photoUrl?.trim()
      if (!key || !photo) return []
      const street = [t.streetNumber, t.streetName, t.streetSuffix].filter(Boolean).join(' ').trim()
      const meta = [
        t.beds != null ? `${t.beds} bd` : null,
        t.baths != null ? `${t.baths} ba` : null,
        t.sqft != null && t.sqft > 0 ? `${t.sqft.toLocaleString('en-US')} sqft` : null,
        subTypeLabel(t.propertySubType),
      ]
        .filter(Boolean)
        .join(' · ')
      return [
        {
          id: key,
          href: listingDetailPath(
            key,
            { streetNumber: t.streetNumber, streetName: t.streetName, city: t.city },
            { city: t.city, subdivision: t.subdivisionName },
            { mlsNumber: t.listNumber },
          ),
          priceLabel: t.listPrice != null && t.listPrice > 0 ? formatPrice(t.listPrice) : 'Price on request',
          title: street || t.subdivisionName?.trim() || 'Address withheld',
          meta: meta || undefined,
          photoSrc: photo,
          lat: t.lat,
          lng: t.lng,
        } satisfies V3FieldItem,
      ]
    })
}

/* -------------------------------------------------------------------------- */
/* Quiet content                                                               */
/* -------------------------------------------------------------------------- */

/** Cap so the About block stays a block and not a second page. */
const AMENITY_LIMIT = 8

/**
 * The verified depth block: the curated prose, the drive times, and the
 * amenities, from data/resort-community-{citySlug}-{neighborhoodSlug}.json.
 *
 * `fallbackProse` is the neighborhoods-table description, used ONLY when no
 * curated config exists. That is the same either/or the KB page ran (the rich
 * overview suppressed the plain About), stated here as one expression instead
 * of two components that had to agree.
 */
export function aboutItems(
  content: ResortCommunityContent | null,
  fallbackProse: string | null,
): V3QuietItem[] {
  const items: V3QuietItem[] = []

  const prose =
    content && content.aboutProse.length > 0
      ? content.aboutProse
      : (fallbackProse ?? '').trim()
        ? [(fallbackProse ?? '').trim()]
        : []
  if (prose.length > 0) items.push({ kind: 'prose', body: prose })

  const drives = (content?.driveTimes ?? []).filter(
    (d) => Number.isFinite(d.minutes) && d.minutes > 0 && d.destination?.trim(),
  )
  if (drives.length > 0) {
    items.push({
      kind: 'prose',
      term: 'Drive times',
      body: drives.map(
        (d) =>
          `${d.destination.trim()}, about ${Math.round(d.minutes)} minutes${d.note?.trim() ? ` (${d.note.trim()})` : ''}.`,
      ),
    })
  }

  for (const amenity of (content?.amenities ?? []).slice(0, AMENITY_LIMIT)) {
    const name = amenity.name?.trim()
    const body = [amenity.description?.trim(), amenity.access?.trim()].filter(
      (line): line is string => Boolean(line),
    )
    if (!name || body.length === 0) continue
    items.push({ kind: 'prose', term: name, body })
  }

  return items
}

/**
 * A labeled door, dropped when either half is missing. V3Quiet drops a nameless
 * or destination-less row itself, but building one here at all means the page
 * asserted an edge it could not honor, so the filter runs at the source.
 */
export function edge(label: string | null | undefined, href: string | null | undefined): V3QuietItem[] {
  const text = label?.trim()
  const to = href?.trim()
  if (!text || !to) return []
  return [{ label: text, href: to }]
}

/* -------------------------------------------------------------------------- */
/* Live activity rows                                                          */
/* -------------------------------------------------------------------------- */

/**
 * One MLS event on one listing. Optional everywhere the feed can come back
 * without the field, because a row missing its door or its address is dropped
 * rather than rendered as dead text.
 */
export type ActivityRow = {
  label?: string | null
  address?: string | null
  cityLine?: string | null
  price?: number | null
  imageUrl?: string | null
  href?: string | null
  whenLabel?: string | null
}

/**
 * Live MLS events as Ledger rows. The price is the figure, so the caller owes the
 * trace, and the trace has to name the scope the caller actually used — the
 * boundary set or the city's. Every row carries the listing's own photo, which is
 * the thumbnail contract this section has had since D93.
 */
export function neighborhoodActivityRows(items: readonly ActivityRow[]): V3LedgerFigureRow[] {
  return items.flatMap((item) => {
    const href = item.href?.trim()
    const address = item.address?.trim()
    if (!href || !address) return []
    const when = [item.label?.trim(), item.whenLabel?.trim()].filter(Boolean).join(' · ')
    const detail = item.cityLine?.trim()
    return [
      {
        id: `${href}-${item.label ?? ''}-${item.whenLabel ?? ''}`,
        href,
        when: v3Text(when || 'Update'),
        what: v3Text(address),
        ...(detail ? { detail: v3Text(detail) } : {}),
        value: v3Text(
          item.price != null && item.price > 0 ? formatPrice(item.price) : 'Price on request',
        ),
        ...(item.imageUrl?.trim() ? { media: { src: item.imageUrl.trim() } } : {}),
      },
    ]
  })
}
