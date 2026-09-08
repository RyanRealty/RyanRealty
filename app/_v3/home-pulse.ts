/**
 * The homepage's live read — the band that sits under the hero search.
 *
 * WHERE IT CAME FROM (site queue SITE-12). "Central Oregon right now" — the
 * region's for-sale, under-contract and just-sold counts — lived inside the
 * Homes dropdown, where it was true, sourced, and seen by whoever opened a
 * menu. It now sits on the page, under the search, carrying the moment it was
 * read. The Homes menu no longer publishes it, so the region's counts exist in
 * exactly one place on the site.
 *
 * NOTHING NEW IS FETCHED. `buildPlaceAtlas` for the region scope is the same
 * cached call the chrome already made on every render (same scope key, same
 * day key, `unstable_cache` for the listings window), so moving the strip onto
 * the page costs one cache hit, not a second walk of the feed.
 *
 * SECTION 0. Every figure here is a COUNT OF ROWS the DAL returned in this
 * render — no derivation from a prior deliverable, no remembered number. The
 * one derived figure, the under-contract share, is computed from those two
 * counts and its arithmetic is printed in the trace. Verified 2026-09-08
 * against `getAtlasTiles({ cities: [] })`: 5,751 rows read — 3,284 Active, 44
 * Active Under Contract, 868 Pending, 1,555 Closed inside the 90-day window, of
 * which 462 closed inside 30 days.
 *
 * WHAT IT WILL NOT DO. If the read comes back with no dots at all, the band
 * does not render. A count of zero listings across Central Oregon is not a fact
 * about the market, it is a fact about the read, and §0 says a figure that
 * cannot be verified does not ship.
 */
import 'server-only'

import { buildPlaceAtlas } from '@/lib/atlas/build-place-atlas'
import { ATLAS_PULSE_WINDOW_DAYS, ATLAS_HEAT_WINDOW_DAYS, isAtlasPulseSold } from '@/lib/atlas/sales-heat'
import { buildDotField } from '@/lib/geo/dot-field'
import { publishRegionalSearchHref } from '@/lib/search/publish-regional-search-href'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { v3Text, type V3PulseProps, type V3PulseReading } from '@/components/site/v3'

/** The section id on the homepage, and the stem of the band's control ids. */
export const HOME_PULSE_ID = 'right-now'

/** Long enough for a cold atlas walk; the population is cached for 15 minutes after. */
const READ_MS = 8000

/** Every listing gets a mark. The cap only exists so a freak population cannot
 *  put a megabyte of path data in the document. */
const MARK_CAP = 4000

/** The frame the marks are projected into. 15rem at the root size, so one unit
 *  is one device pixel on a desktop render and the dots need no scaling. */
const FIELD_WIDTH = 240

export type HomePulseCounts = {
  forSale: number
  pending: number
  sold: number
}

export type HomePulseInput = {
  counts: HomePulseCounts
  /** The on-market and recently-closed dots, as the atlas built them. */
  dots: readonly { lat: number; lng: number; s: string; soldAgo?: number | null }[]
  /** When the population was read, already formatted: "Sep 8, 2026, 7:03 AM". */
  stamp: string
  /** Closes inside the read window, for the trace. */
  closedInWindow: number
}

const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'] as const

function n(value: number): string {
  return value.toLocaleString('en-US')
}

/**
 * The claim, derived from the two counts it names and never from a memory.
 *
 * "One in five" is a rounding, so the direction is stated rather than implied:
 * the share is compared to the fraction it was rounded to, and the sentence
 * says `More than` or `Nearly` accordingly. A share that lands exactly on the
 * fraction gets neither word. The exact percentage is in the trace.
 */
export function pulseClaim(forSale: number, pending: number): string {
  const onMarket = forSale + pending
  if (onMarket <= 0 || pending <= 0) {
    return `${n(forSale)} listings are on the market across Central Oregon right now.`
  }
  const share = pending / onMarket
  const denominator = Math.min(9, Math.max(2, Math.round(1 / share)))
  const word = ONES[denominator]
  const rounded = 1 / denominator
  const lead =
    Math.abs(share - rounded) < 0.0005
      ? 'One in'
      : share > rounded
        ? 'More than one in'
        : 'Nearly one in'
  return `${lead} ${word} listings on the Central Oregon market is already under contract.`
}

/** The §0 trace: every table, every filter, every window, and the arithmetic. */
export function pulseTrace(input: HomePulseInput): string {
  const { forSale, pending, sold } = input.counts
  const onMarket = forSale + pending
  const share = onMarket > 0 ? ((pending / onMarket) * 100).toFixed(1) : '0.0'
  return [
    `One read of the regional MLS feed through Oregon Data Share, taken at the moment above.`,
    `For sale and under contract are listing_tile_mv rows with a recorded coordinate in the Central Oregon service-area cities: standard_status Active gives ${n(forSale)}, Pending and Active Under Contract together give ${n(pending)}, over ${n(onMarket)} on-market rows.`,
    `Sold is the listings table — StandardStatus Closed, ClosePrice at or above $1,000, a recorded coordinate, the same cities — read over the last ${ATLAS_HEAT_WINDOW_DAYS} days (${n(input.closedInWindow)} closes) and filtered to the ${ATLAS_PULSE_WINDOW_DAYS} days before the read, which is ${n(sold)}.`,
    `Under contract as a share of the market is ${n(pending)} ÷ ${n(onMarket)} = ${share}%.`,
    `Every listing in each count is plotted at its own coordinate; marks coincide where houses sit close together.`,
    `Coming Soon is never counted on a public surface.`,
  ].join(' ')
}

/**
 * The band's props, composed from one read. Pure — every figure is formatted
 * here so the primitive prints and never computes (check-public-v3 rule 3).
 */
export function composeHomePulse(input: HomePulseInput): V3PulseProps | null {
  const { forSale, pending, sold } = input.counts
  if (forSale + pending + sold <= 0) return null
  if (!input.stamp.trim()) return null

  const active = input.dots.filter((d) => d.s === 'active')
  const under = input.dots.filter((d) => d.s === 'pending')
  const closed = input.dots.filter((d) => isAtlasPulseSold(d))

  const field = buildDotField(
    [
      { key: 'active', points: active },
      { key: 'pending', points: under },
      { key: 'sold', points: closed },
    ],
    { width: FIELD_WIDTH, cap: MARK_CAP },
  )
  const pathOf = (key: string) => field?.paths.find((p) => p.key === key)?.d

  const largest = Math.max(forSale, pending, sold, 1)
  const readings: V3PulseReading[] = [
    {
      key: 'active',
      figure: n(forSale),
      label: 'listings for sale',
      share: forSale / largest,
      definition:
        'Active listings of every property type the regional MLS carries — houses, condos, land, everything — across the Central Oregon cities and communities we cover.',
      path: pathOf('active'),
      href: publishRegionalSearchHref(),
      hrefLabel: 'Browse them',
    },
    {
      key: 'pending',
      figure: n(pending),
      label: 'under contract',
      share: pending / largest,
      definition:
        'Listings with an accepted offer that have not closed yet: pending and active under contract, read from the same feed at the same moment.',
      path: pathOf('pending'),
      href: '/homes-for-sale?view=list&status=Pending',
      hrefLabel: 'See what is spoken for',
    },
    {
      key: 'sold',
      figure: n(sold),
      label: `sold in the last ${ATLAS_PULSE_WINDOW_DAYS} days`,
      share: sold / largest,
      definition:
        'Sales that recorded a closing in the last 30 days, in the same cities. These are finished deals at the price they actually brought, not asking prices.',
      path: pathOf('sold'),
      href: '/homes-for-sale?view=list&status=Sold',
      hrefLabel: 'See the closes',
    },
  ]

  return {
    id: HOME_PULSE_ID,
    claim: v3Text(pulseClaim(forSale, pending)),
    readings,
    field: field ? { w: field.w, h: field.h } : undefined,
    plotCaption: 'Every listing, where it sits',
    fieldAlt: `Central Oregon with every listing plotted at its own coordinate: ${n(forSale)} for sale, ${n(pending)} under contract, and ${n(sold)} sold in the last ${ATLAS_PULSE_WINDOW_DAYS} days.`,
    note: `Read ${input.stamp}`,
    source: pulseTrace(input),
  }
}

/** The region scope the chrome already reads, so this is the same cache entry. */
const REGION_SCOPE = { cities: [] as string[], label: 'Central Oregon' }

/** The band for `/`, or null when the read gave nothing worth publishing. */
export async function loadHomePulse(): Promise<V3PulseProps | null> {
  const atlas = await withTimeoutFallback(
    buildPlaceAtlas(REGION_SCOPE).catch(() => null),
    null,
    READ_MS,
    'home pulse atlas',
  )
  if (!atlas || atlas.dots.length === 0) return null
  return composeHomePulse({
    counts: { forSale: atlas.counts.forSale, pending: atlas.counts.pending, sold: atlas.counts.sold },
    dots: atlas.dots,
    stamp: atlas.stamp,
    closedInWindow: atlas.dots.filter((d) => d.s === 'sold').length,
  })
}
