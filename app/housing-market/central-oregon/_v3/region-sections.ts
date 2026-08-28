/**
 * Route-local section builders for /housing-market/central-oregon.
 *
 * WHY THIS FILE EXISTS: the route crossed the ci:file-size-budget floor (600 LOC) as
 * a NEW file, which is a hard fail, and the gate's own instruction is to split rather
 * than re-baseline. The seam is the same one app/housing-market/annual-review/_v3
 * uses: the page owns the reads, the one months-of-supply derivation, the JSON-LD,
 * and the JSX, and this module owns the pure turn from a DAL row into barrel-ready
 * props. Nothing here fetches, reads the clock, or classifies anything.
 *
 * The three rules the page's own header states, held here at the sites they touch:
 *
 *  - ABSENT IS NOT ZERO (CLAUDE.md section 0). A covered city that cannot be sourced
 *    comes back in `footnotes` with the reason read off its OWN data, never rendered
 *    as "0 active" under a live-MLS source line.
 *  - ONE STAMP PER TRACE. Each Ledger's freshness stamp is computed from the rows
 *    that Ledger renders, so one query's figures never carry another query's clock.
 *  - THE STRING ON SCREEN IS FINISHED HERE. Every value returned is already through
 *    lib/format, because the barrel never formats and never rounds.
 */

import type { BlogPostCard, MarketPulseSnapshot } from '@/lib/data'
import type { CoMarketAnnualRow } from '@/lib/data/analytics/getCoMarketAnnual'
import { formatPriceExact } from '@/lib/format/money'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { formatDate } from '@/lib/format/date'
import { listingsBrowsePath } from '@/lib/slug'
import {
  v3Text,
  type V3LedgerFigureRow,
  type V3LedgerPlainRow,
  type V3QuietItem,
} from '@/components/site/v3'
import { namePulseCityRemainder, pulseCityHrefSlug } from '@/lib/market/pulse-city-remainder'
import { CITY_LABELS, CITY_SLUG, HISTORY_PATH, volumeLabel } from './region-constants'

/** A covered city that earned no row, with the reason read off its own data. */
export type CityFootnote = { label: string; fact: string; slug?: string }

export type CityLedger = {
  rows: V3LedgerFigureRow[]
  /** The newest updated_at among the returned city rows, or undefined. */
  stamp: string | undefined
  footnotes: CityFootnote[]
}

/**
 * The cities Ledger.
 *
 * A city earns a row when the live query returned one AND that row carries a median
 * list price, because the Ledger's value column is a figure and a figure this page
 * cannot source is a figure it does not print. Cities the query did not return keep
 * their link in the page's closing Quiet block instead.
 *
 * D9 leftover: each city is a door into its own report. A line through cities
 * invents a sequence. V3Chart is a trend atom, so this Ledger stays type.
 *
 * The three footnote cases are not the same claim: no row came back at all, a row
 * came back with nothing active, or a row came back active but with no median. The
 * KB page rendered Tumalo as "0 active" under a live-MLS source line.
 *
 * The stamp comes from the returned city rows, not from the region row, which
 * refreshes on its own schedule.
 */
export function buildCityLedger(
  snapshots: MarketPulseSnapshot[],
  options?: { regionActive?: number | null },
): CityLedger {
  const byLabel = new Map(snapshots.map((s) => [s.geo_label, s]))
  const rows: V3LedgerFigureRow[] = []
  const rowed = new Set<string>()

  for (const label of CITY_LABELS) {
    const slug = CITY_SLUG[label]
    const snapshot = byLabel.get(label)
    if (!slug || !snapshot || snapshot.median_list_price == null || snapshot.active_count == null) continue
    rowed.add(label)
    rows.push({
      href: `/housing-market/${slug}`,
      when: v3Text(`${snapshot.active_count.toLocaleString('en-US')} for sale`),
      what: v3Text(label),
      detail:
        snapshot.months_of_supply != null
          ? v3Text(`${formatMonthsOfSupply(snapshot.months_of_supply)} months of supply`)
          : undefined,
      value: v3Text(formatPriceExact(snapshot.median_list_price)),
      id: slug,
    })
  }
  rows.sort((a, b) => String(a.what).localeCompare(String(b.what)))

  const footnotes: CityFootnote[] = CITY_LABELS.filter(
    (label) => CITY_SLUG[label] !== undefined && !rowed.has(label),
  ).map((label) => {
    const snapshot = byLabel.get(label)
    const slug = CITY_SLUG[label]
    if (!snapshot) {
      return { label, slug, fact: `${label} returned no market row in the latest sync` }
    }
    if (snapshot.active_count == null) {
      return { label, slug, fact: `${label} has no published active single-family count` }
    }
    if (snapshot.active_count === 0) {
      return { label, slug, fact: `${label} shows no active single-family listings` }
    }
    return {
      label,
      slug,
      fact: `${label} shows ${snapshot.active_count.toLocaleString('en-US')} active with no published median`,
    }
  })
  const remainder = namePulseCityRemainder({
    regionActive: options?.regionActive,
    displayedLabels: CITY_LABELS,
    allCities: snapshots.map((s) => ({
      label: s.geo_label,
      active: s.active_count,
      slug: pulseCityHrefSlug(s.geo_slug || s.geo_label),
    })),
  })
  for (const city of remainder.omitted) {
    footnotes.push({
      label: city.label,
      slug: city.slug,
      fact: `${city.label} has ${city.active.toLocaleString('en-US')} active single-family listings not in the table above`,
    })
  }
  for (const fact of remainder.facts.filter((line) => !line.startsWith('Also in the leftover regional count'))) {
    footnotes.push({ label: 'Outside city rows', fact })
  }

  const stamp = snapshots
    .map((s) => s.updated_at)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .sort()
    .at(-1)

  return { rows, stamp, footnotes }
}

export type ClosedLedger = {
  rows: V3LedgerFigureRow[]
  /** Present only when every year in the window came from a mart row. */
  stamp: string | undefined
}

/**
 * Closed sales by calendar year: closed MLS sales, all property types, service-area
 * cities. A different population from the pulse, so its figures, its trace, and its
 * stamp stay together and never borrow the pulse's. Newest first, because the latest
 * full year is the one the visitor came for; every row is a door into the closed-sales
 * explorer, which reads `year`.
 *
 * D9 leftover: each year is a door into the explorer. A closed-count chart
 * would live under an Instrument, and that Instrument would sit next to the
 * pace Instrument, two of a kind. Keep as Ledger. buildClosedCountChart
 * exists when a later lease splits the rhythm. Do not flatten the years
 * to a figure.
 *
 * Only a mart row carries a real computed_at. A missing year is missing; this
 * Ledger does not invent a stamp from the request clock.
 */
export function buildClosedLedger(series: CoMarketAnnualRow[]): ClosedLedger {
  const years = series
    .filter((row) => row.year > 0 && row.soldCount > 0 && row.totalVolume > 0)
    .sort((a, b) => b.year - a.year)

  const rows: V3LedgerFigureRow[] = years.map((row) => ({
    href: `${HISTORY_PATH}?year=${row.year}`,
    when: v3Text(String(row.year)),
    what: v3Text(`${row.soldCount.toLocaleString('en-US')} closed sales`),
    detail:
      row.medianClose != null && row.medianClose > 0
        ? v3Text(`median close ${formatPriceExact(row.medianClose)}`)
        : undefined,
    value: v3Text(volumeLabel(row.totalVolume)),
    id: String(row.year),
  }))

  const stamp = years.every((row) => row.source === 'mart')
    ? years
        .map((row) => row.computedAt)
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .sort()
        .at(-1)
    : undefined

  return { rows, stamp }
}

/**
 * Guides. Plain rows, no value column, so the Ledger carries no source line: a blog
 * post is not a figure. A row with no title is DROPPED rather than handed to v3Text,
 * which throws by design on an empty string. `title` is the one DB-sourced string on
 * this page that reaches the barrel, getRecentBlogPosts filters only on status and
 * published_at, and one blank title would otherwise take the whole render down.
 */
export function buildGuideRows(posts: BlogPostCard[]): V3LedgerPlainRow[] {
  const rows: V3LedgerPlainRow[] = []
  for (const post of posts) {
    const title = post.title?.trim()
    const slug = post.slug?.trim()
    if (!title || !slug) continue
    const excerpt = post.excerpt?.trim()
    rows.push({
      href: `/blog/${slug}`,
      when: v3Text(post.publishedAt ? formatDate(post.publishedAt) : 'Guide'),
      what: v3Text(title),
      detail: excerpt ? v3Text(excerpt) : undefined,
      id: slug,
    })
  }
  return rows
}

/**
 * The closing Quiet's outbound edges: every internal link the KB region page carried
 * through its footer rail, the Oregon Data Share citation MarketSources used to render,
 * and any covered city the cities Ledger could not source, each still linked to its
 * own report with the reason stated from its own data.
 *
 * NO VALUATION DOOR (2026-08-27 single-ask consolidation, parity.json
 * market-report-region openDefects item 3). This page previously rendered three asks
 * (RegionInquirySheet, the hero's "Value my home" primary, and this edge set's own
 * "Sell your home" and "Value my home" links). RegionInquirySheet, the on-page
 * inquiry form, is now the page's one ask. The other three doors are removed rather
 * than left pointing at the same destination as a form the reader has not left the
 * page to reach.
 */
export function buildExploreItems(footnotes: readonly CityFootnote[]): V3QuietItem[] {
  const items: V3QuietItem[] = [
    { label: 'Central Oregon housing market hub', href: '/housing-market' },
    { label: 'Closed sales explorer', href: HISTORY_PATH },
    { label: 'Market report index', href: '/housing-market/reports' },
    { label: 'All Central Oregon cities', href: '/cities' },
    { label: 'Communities and neighborhoods', href: '/communities' },
    { label: 'Browse homes for sale', href: listingsBrowsePath() },
    { label: 'Open houses this week', href: '/open-houses' },
    { label: 'Recent price drops', href: '/price-drops' },
    { label: 'Buying and selling guides', href: '/blog' },
    { label: 'Oregon Data Share', href: 'https://www.oregondatashare.com' },
  ]
  if (footnotes.length > 0) {
    items.push({
      kind: 'prose',
      term: 'Cities not in the table above',
      body: `${footnotes.map((city) => city.fact).join('. ')}.`,
    })
    for (const city of footnotes) {
      const slug = city.slug ?? CITY_SLUG[city.label]
      if (!slug) continue
      items.push({
        label: `${city.label} market report`,
        href: `/housing-market/${slug}`,
      })
    }
  }
  return items
}
