/**
 * Row shaping for the city node's PLACE LEDGERS — the neighborhood ledger, the
 * communities rail, the golf and master-planned ledger, the other-cities ledger,
 * the live activity ledger, and the city guides.
 *
 * WHY THIS FILE EXISTS. Two reasons, both mechanical, the same two
 * app/cities/[slug]/[neighborhoodSlug]/_v3/neighborhood-sections.ts states:
 * ci:file-size-budget refuses any file under app/ or lib/ at 600 lines, and the
 * route has to stay a readable list of sections. Nothing here fetches. Nothing
 * here reaches outside the v3 barrel.
 *
 * WHY THE ROW TYPES ARE DECLARED HERE AND NOT IMPORTED FROM components/site/kb/types.
 * They are plain data shapes, but importing one puts a KB module specifier on a
 * page the P9 roll just took off that register, which ci:public-ui counts as
 * register debt on this exact page. The shapes below are the same fields under
 * route-local names, so the page owes nothing to the old register.
 *
 * NOTHING HERE INVENTS A FIGURE, AND UNKNOWN IS NEVER ZERO (CLAUDE.md section 0).
 * Every builder comes in two forms: a FIGURE form for when the count read
 * succeeded, and a PLAIN form for when it did not. The plain form drops the value
 * column entirely rather than printing a zero the page cannot vouch for, and the
 * two forms are separate functions because V3Ledger's props union will not let one
 * list hold both — which is the type system enforcing exactly this rule.
 */

import {
  v3Text,
  type V3InstrumentFigure,
  type V3LedgerFigureRow,
  type V3LedgerPlainRow,
  type V3QuietItem,
} from '@/components/site/v3'
import { MOS_METHODOLOGY_CLAUSE, MOS_THRESHOLD_CLAUSE } from '@/lib/market/classify'
import { formatPrice } from '@/lib/format/money'

/**
 * A place that has its own node: a neighborhood, a golf or master-planned
 * community, a city. `activeCount` is null when the count could not be measured
 * on this render, which is a different fact from zero and renders differently.
 * `img` is '' when no verified photo exists for the place — never a stand-in.
 */
export type CityPlaceItem = {
  name: string
  href: string
  activeCount: number | null
  medianPrice: number | null
  img: string
}

/**
 * A community in the marquee rail. Everything a place carries, plus the town it
 * sits in and the silent Area Guide clip when one is published for it.
 */
export type CityCommunityItem = CityPlaceItem & {
  town: string
  video: { url: string; embedType: 'iframe' | 'video-tag' } | null
}

/** A live-feed row: one MLS event on one listing. */
export type CityActivityItem = {
  label?: string | null
  address?: string | null
  cityLine?: string | null
  price: number | null
  imageUrl?: string | null
  /** Absent when the feed row carried no listing key, in which case there is no
   *  door and the row is dropped rather than rendered as dead text. */
  href?: string | null
  whenLabel?: string | null
}

/** A published guide. */
export type CityArticleItem = {
  title: string
  href: string
  excerpt?: string | null
  imageUrl?: string | null
  dateLabel?: string | null
}

/** The median line under a place name, or nothing when there is no median. */
function medianDetail(medianPrice: number | null): string | null {
  return medianPrice != null && medianPrice > 0 ? `${formatPrice(medianPrice)} median list` : null
}

/** A row's photo, only when the caller resolved a verified one. */
function media(img: string): { src: string } | undefined {
  return img.trim() ? { src: img.trim() } : undefined
}

/**
 * Place rows WITH their live active count in the value column. The caller must
 * pass a trace to V3Ledger; the props union makes that a compile error otherwise.
 * A place whose count is null is still listed — its node is still reachable — and
 * its value column reads as unmeasured rather than as zero.
 */
export function placeFigureRows(
  items: readonly CityPlaceItem[],
  kindLabel: string,
): V3LedgerFigureRow[] {
  return items.flatMap((item) => {
    const name = item.name?.trim()
    const href = item.href?.trim()
    if (!name || !href) return []
    const detail = medianDetail(item.medianPrice)
    return [
      {
        id: href,
        href,
        when: v3Text(kindLabel),
        what: v3Text(name),
        ...(detail ? { detail: v3Text(detail) } : {}),
        value: v3Text(
          item.activeCount != null ? `${item.activeCount.toLocaleString('en-US')} active` : 'not measured',
        ),
        ...(media(item.img) ? { media: media(item.img) } : {}),
      },
    ]
  })
}

/**
 * The same rows with NO value column, for the branch where the count read
 * degraded. The places are still doors; only the unverifiable figure is withheld.
 */
export function placePlainRows(
  items: readonly CityPlaceItem[],
  kindLabel: string,
): V3LedgerPlainRow[] {
  return items.flatMap((item) => {
    const name = item.name?.trim()
    const href = item.href?.trim()
    if (!name || !href) return []
    const detail = medianDetail(item.medianPrice)
    return [
      {
        id: href,
        href,
        when: v3Text(kindLabel),
        what: v3Text(name),
        ...(detail ? { detail: v3Text(detail) } : {}),
        ...(media(item.img) ? { media: media(item.img) } : {}),
      },
    ]
  })
}

/**
 * The communities rail as rows. The rail's own ordering is applied by the caller
 * (marquee and video cards first, then by active count), so this only shapes.
 * The clip is not played here — V3Ledger renders the poster frame, and the
 * community's own node is where the clip plays — but a community that HAS one is
 * marked, because that is why it leads the list.
 */
export function communityRows(items: readonly CityCommunityItem[]): V3LedgerFigureRow[] {
  return items.flatMap((item) => {
    const name = item.name?.trim()
    const href = item.href?.trim()
    if (!name || !href) return []
    return [
      {
        id: href,
        href,
        when: v3Text(item.video ? `${item.town} · Area guide` : item.town),
        what: v3Text(name),
        value: v3Text(
          item.activeCount != null ? `${item.activeCount.toLocaleString('en-US')} active` : 'not measured',
        ),
        ...(media(item.img) ? { media: media(item.img) } : {}),
      },
    ]
  })
}

/**
 * Live MLS events as rows. The price is the figure, so the caller owes the trace.
 * Every row carries the listing's own photo, which is what makes the feed
 * scannable — the thumbnail contract this section has had since D93.
 */
export function activityRows(items: readonly CityActivityItem[]): V3LedgerFigureRow[] {
  return items.flatMap((item) => {
    const href = item.href?.trim()
    const address = item.address?.trim()
    if (!href || !address) return []
    const when = [item.label?.trim(), item.whenLabel?.trim()].filter(Boolean).join(' · ')
    const detail = item.cityLine?.trim()
    return [
      {
        id: `${href}-${item.label}-${item.whenLabel}`,
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

/** Published guides as rows. No figures, so no trace is owed. */
export function articleRows(items: readonly CityArticleItem[]): V3LedgerPlainRow[] {
  return items.flatMap((item) => {
    const title = item.title?.trim()
    const href = item.href?.trim()
    if (!title || !href) return []
    const detail = item.excerpt?.trim()
    return [
      {
        id: href,
        href,
        when: v3Text(item.dateLabel?.trim() || 'Guide'),
        what: v3Text(title),
        ...(detail ? { detail: v3Text(detail) } : {}),
        ...(item.imageUrl?.trim() ? { media: { src: item.imageUrl.trim() } } : {}),
      },
    ]
  })
}

/**
 * The Instrument's three figures, every one off the SAME market_pulse_live row, so
 * the one trace and the one stamp the caller prints under them cover all three, and
 * every one a door. Homes for sale is NOT among them: that is the Field's count, so
 * the page states inventory once.
 *
 * `monthsOfSupplyLabel` arrives already rendered by lib/format/months-of-supply from
 * the RAW stored value the caller also handed marketVerdict, which is what keeps the
 * printed digits from crossing a threshold the raw value does not cross.
 */
export function marketFigures(
  pulse: {
    medianListPrice: number | null
    medianDaysToPending: number | null
  } | null,
  monthsOfSupplyLabel: string | null,
  links: { marketReport: string; monthsOfSupply: string },
): V3InstrumentFigure[] {
  const figures: V3InstrumentFigure[] = []
  if (pulse?.medianListPrice != null && pulse.medianListPrice > 0) {
    figures.push({
      value: v3Text(formatPrice(pulse.medianListPrice)),
      label: v3Text('median list price'),
      href: links.marketReport,
    })
  }
  if (monthsOfSupplyLabel != null) {
    figures.push({
      value: v3Text(monthsOfSupplyLabel),
      label: v3Text('months of supply'),
      href: links.monthsOfSupply,
    })
  }
  // THE DIGITS THE FAQ PUBLISHES, NOT A SECOND ROUNDING OF THEM. buildMarketFaq
  // interpolates this field raw ("took a median of 20.5 days to go pending") into the
  // visible answer, the FAQPage JSON-LD, and the Median Days to Pending dataset
  // variable. Math.round here printed 21 in the Instrument beside all three — verified
  // live on /cities/redmond 2026-08-12, stored median_days_to_pending 20.50. One
  // statistic, two numbers, one page. The guard is `> 0` for the same reason the other
  // two figures carry it: it is buildMarketFaq's own condition, so the Instrument
  // cannot print a figure the shared builder declined to answer (invariant 2).
  if (pulse?.medianDaysToPending != null && pulse.medianDaysToPending > 0) {
    figures.push({
      value: v3Text(String(pulse.medianDaysToPending)),
      label: v3Text('median days to pending'),
      href: links.marketReport,
    })
  }
  return figures
}

/**
 * The About block: the hand-written city description where one exists, then the
 * city's own PLACE FACTS. No market data and NO FIGURES — a number belongs in an
 * Instrument with its source line, which is V3Quiet's own contract. A city with
 * neither a description nor quick facts returns nothing and the block does not
 * render, rather than generated filler.
 */
export function cityAboutItems(
  description: string | null | undefined,
  quickFacts: {
    population?: string
    county?: string
    elevation?: string
    schoolDistrict?: string
    nearestAirport?: string
  } | null,
): V3QuietItem[] {
  const items: V3QuietItem[] = []
  const prose = description?.trim()
  if (prose) items.push({ kind: 'prose', body: prose })
  const facts: Array<[string, string | undefined]> = [
    ['Population', quickFacts?.population],
    ['County', quickFacts?.county ? `${quickFacts.county} County` : undefined],
    ['Elevation', quickFacts?.elevation],
    ['School district', quickFacts?.schoolDistrict],
    ['Nearest commercial airport', quickFacts?.nearestAirport],
  ]
  for (const [term, body] of facts) {
    if (body?.trim()) items.push({ kind: 'prose', term, body: body.trim() })
  }
  return items
}

/* -------------------------------------------------------------------------- */
/* Source traces + closing edges                                              */
/* -------------------------------------------------------------------------- */

/**
 * The traces live here, next to the builders whose figures they cover, for the reason
 * app/cities/[slug]/[neighborhoodSlug]/_v3/neighborhood-sections.ts states: a source
 * sentence written at the render site drifts from the query that produced the number.
 * No sentence in this file contains a number.
 */
const FEED = 'live MLS through Oregon Data Share'

/** The trace over the Instrument's market_pulse_live figures. */
export function cityMarketTrace(cityName: string): string {
  return (
    `${FEED}, single-family homes inside the ${cityName} city boundary. ` +
    `${MOS_METHODOLOGY_CLAUSE} ${MOS_THRESHOLD_CLAUSE}`
  )
}

/** The trace over every place ledger's active-count column. */
export const PLACE_COUNT_TRACE = `${FEED}, active single-family listings, counted per place`

/** The trace over the live activity ledger's price column. */
export function cityActivityTrace(cityName: string): string {
  return `${FEED}, new listings, price changes, pendings, and closings on ${cityName} homes`
}

/**
 * THE INVENTORY COUNT, with whichever row supplied it and that row's own stamp. The
 * fallback branch cannot claim more than it proves: getGeoSnapshot overlays the live
 * city market row onto the MV row for every city, so the count and the stamp printed
 * there may already be the market row's. The only negative claim available is about
 * THIS PAGE'S OWN market read, which is the read that is null in that branch.
 */
export function cityInventory(
  cityName: string,
  pulse: { activeCount: number; refreshedAt: string | null } | null,
  snapshot: { activeSfrCount: number; refreshedAt: string | null },
): { count: number; source: string; updatedAt: string | null } {
  return pulse
    ? {
        count: pulse.activeCount,
        source: `${FEED}, the 15-minute market row for ${cityName}: active and coming-soon single-family homes inside the city boundary`,
        updatedAt: pulse.refreshedAt,
      }
    : {
        count: snapshot.activeSfrCount,
        source: `${FEED}, single-family homes in the ${cityName} geo snapshot, with the live city market row applied over it wherever the data layer matched one. This page's own market read did not return on this refresh, so no median, supply figure, or verdict is printed above`,
        updatedAt: snapshot.refreshedAt,
      }
}

/**
 * THE STATED ABSENCE, for the render where the Instrument has no figure to print.
 *
 * The sentence is derived from THIS PAGE'S OWN MARKET READ, never from the figure
 * array. Keying it on the figures published a false negative: market_pulse_live holds
 * live city rows that RETURN carrying nulls (verified 2026-08-12 — geo_type 'city',
 * geo_slug 'warm springs', property_type 'A': active_count 0 with median_list_price,
 * months_of_supply and median_days_to_pending all null), and on that render the page
 * said "the market row did not return" directly above a Field printing its count under
 * "the 15-minute market row for Warm Springs". One page, two contradictory claims about
 * one read.
 *
 * It also states no count of its own. The inventory figure is printed once, in the
 * Field, under the Field's trace; restating it here would put a number in a Quiet with
 * nothing to sit under it (invariant 4). The block points at that source line instead.
 *
 * The closing clause about the rows is conditional for the same reason: with no row
 * below, "the homes below carry their own live list prices" describes homes that are
 * not there.
 */
export function marketAbsenceItems(
  cityName: string,
  pulseReturned: boolean,
  hasRows: boolean,
): V3QuietItem[] {
  const tail = hasRows ? ' The homes above carry their own live list prices.' : ''
  const body = pulseReturned
    ? `The ${cityName} market row returned on this refresh carrying no median list price, no months-of-supply figure, and no days-to-pending figure, so this page prints no verdict.${tail}`
    : `The ${cityName} market row did not return on this refresh, so this page is not printing a median, a supply figure, or a verdict.${tail}`
  return [{ kind: 'prose', term: 'No live market figures right now', body }]
}

/**
 * Caption beside the Field. The count is the listed set, never a pulse figure
 * from a different filter. Months of supply and the verdict use the same raw
 * value the Instrument classifies. Absent MoS is omitted, never written as zero.
 */
export function cityFieldCaption(input: {
  cityName: string
  count: number
  mosLabel: string | null
  verdictKind: 'sellers' | 'balanced' | 'buyers' | 'unknown'
  verdictLabel: string
}): string | null {
  if (input.count <= 0) return null
  const homes = `${input.count.toLocaleString('en-US')} ${input.count === 1 ? 'home' : 'homes'} in ${input.cityName}`
  if (input.verdictKind === 'unknown' || input.mosLabel == null) return homes
  return `${homes} · ${input.mosLabel} months of supply · a ${input.verdictLabel}`
}

/** Trace over the Field's listed set. No borrowed pulse stamp. */
export function cityFieldTrace(cityName: string): string {
  return (
    `${FEED}, every active home in the residential bucket (single family, townhome, and condominium) ` +
    `with a ${cityName} address, a list price, and a street on this page. The count is this set`
  )
}

export function cityFieldEmptyMessage(cityName: string, tilesReturned: number): string {
  return tilesReturned === 0
    ? `The active listing feed returned no ${cityName} home in the residential bucket (single family, townhome, and condominium) on this refresh.`
    : `Every active ${cityName} listing this refresh returned was missing a list price or a street address, so none of them is shown as a row.`
}

/**
 * The closing edges the ledgers above do not already carry, plus the outbound MLS and
 * Census citations MarketSources used to render. Census only when the page actually
 * renders a population figure - never link padding.
 *
 * `links.valuation` arrives from lib/site/valuation-href.ts, the one builder for a
 * valuation link on a content surface. It carries `?from=<this route>`, which the
 * seller flow stores as the lead's source_url; a bare /sell#get-value records the
 * valuation page as its own origin and the city that produced the lead is lost.
 */
export function cityExploreItems(
  cityName: string,
  slug: string,
  links: { browse: string; valuation: string },
  hasPopulation: boolean,
): V3QuietItem[] {
  const items: V3QuietItem[] = [
    { label: `See every ${cityName} home for sale`, href: links.browse },
    { label: `${cityName} market report`, href: `/housing-market/${slug}` },
    { label: `Open houses in ${cityName}`, href: `/open-houses/${slug}` },
    { label: 'Every Central Oregon city', href: '/cities' },
    { label: 'Value my home', href: links.valuation },
    { label: 'Oregon Data Share', href: 'https://www.oregondatashare.com' },
  ]
  if (hasPopulation) items.push({ label: 'U.S. Census Bureau', href: 'https://www.census.gov' })
  return items
}
