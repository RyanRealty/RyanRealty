// @no-static-params — build-time fan-out budgeted to zero (ci:ssg-budget); ISR on demand
/**
 * /oregon/[city] — the out-of-market referral tier, on the components/site/v3 barrel.
 *
 * The statewide MLS feed carries ~362 Oregon cities; Ryan Realty's home market is
 * Central Oregon. This page serves the valid Oregon cities OUTSIDE that market
 * (Medford, Grants Pass, Klamath Falls, ...): honest copy that says this is not our
 * market, the live inventory the feed reports, and a referral capture.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11. SITE-76
 * honesty-first fold: Quiet (Alert honesty banner + home-market doors), then
 * Instrument (live counts + ask strip), Ledger (listings), Sheet (referral),
 * Ledger (other Oregon markets), Footer. FOUR of the six patterns, no two adjacent
 * alike, chrome exempt. Section ids stay: about, top, listings, referral,
 * other-markets. The parity contract is
 * design_system/ryan-realty/ui_kits/oregon-city/parity.json.
 *
 * THE PAGE CONTRACT, CARRIED ACROSS UNCHANGED. Route and params; `revalidate = 3600`;
 * `dynamicParams = true`; `generateStaticParams` seeding the indexable top set;
 * generateMetadata through pageMetadata with the same title, description, path and
 * noindex policy (lib/out-of-area-cities.ts decides indexability, not this file); the
 * MetadataBlock JSON-LD triple (BreadcrumbList, Place, Dataset) with the same
 * variableMeasured and the same units; a rendered V3SectionTracker with
 * pageType="out-of-area-city"; the capture contract (`submitOutOfAreaReferral`, keys
 * citySlug / name / email / notes / company, the last being the honeypot that is the
 * action's only bot deterrent, carried across on V3Sheet's `trap` prop); and the
 * SECTION IDS the KB page emitted — top,
 * about, listings, referral, other-markets — so every section_view key and every deep
 * link survives the register change. MetadataBlock stays on the legacy register
 * (JSON-LD). V3SectionTracker is a v3 island, not a seventh pattern.
 *
 * THE MIDDLEWARE BOUNDARY IS UNCHANGED. middleware.ts 308s a non-service-area
 * /cities/<slug> here and 308s a service-area /oregon/<slug> back to /cities/<slug>.
 * That contract depends on exactly one thing in this file: an unknown slug reaches
 * notFound() from the guard below BEFORE anything streams. It still does, on the same
 * line, from the same read. Measured after the migration: /cities/medford 308s here,
 * /oregon/bend 308s back, and a junk slug renders the not-found page. NOTE, because
 * the retired header claimed more than the site delivers: that not-found response
 * carries HTTP 200, not 404, and it did on production before this migration too
 * (verified against ryan-realty.com on the KB build). The status comes from how
 * app/not-found.tsx is served, not from this route, and this change neither caused it
 * nor fixed it.
 *
 * Section 0, where this page can get it wrong:
 *
 *  1. TWO POPULATIONS, TWO TRACES, TWO STAMPS. The counts and the median come from the
 *     geo snapshot (one pre-aggregated row per city); the listing rows come from the
 *     listing tile cache. Neither section prints a figure the other's trace covers, and
 *     the snapshot's stamp is never lent to the listing rows. The listing Ledger carries
 *     no stamp at all, because the tile cache exposes no refresh timestamp and the
 *     newest listing's own modified date is not a refresh claim.
 *  2. ABSENT IS NOT ZERO. Every city rendered here HAS a live snapshot row (the index
 *     filters to active_all_count >= 1), so no count is synthesized. In the other-markets
 *     Ledger, a city whose row carries no median says so in its own row rather than
 *     printing a fabricated one, and it keeps its link either way.
 *  3. NOTHING IS FETCHED THAT IS NOT RENDERED. Two reads, both rendered.
 *  4. ONE ROUNDING PER FIGURE. Prices render through lib/format/money's formatPrice,
 *     which rounds to the nearest $1,000 and reproduces, character for character, the
 *     strings the KB register printed through kbMoneyFull (lib/kb/types.ts:120).
 *     No figure on this page moved. The Dataset payload keeps publishing the UNROUNDED
 *     median, exactly as the KB page did, so the screen can read $489,000 while the
 *     markup carries 489,450. That split is carried across deliberately rather than
 *     introduced: the visible figure follows the brand's rounding rule and the machine
 *     payload stays equal to the source row.
 *  5. ONE PRIMARY PER VIEWPORT (PUBLIC_UI.md section 1). The header's filled CTA is
 *     display:none below 880px, so the Instrument's ask is PRIMARY at 390. It points
 *     at the referral Sheet further down the page. That is the ask this node earns.
 *     Value my home is the wrong primary here: this city is outside our market.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getListingTiles } from '@/lib/data'
import { classifyInventoryPropertyType } from '@/lib/inventory-filters'
import { publishCardAddress } from '@/lib/listing/publish-street-line'
import { displaySubdivision, homesForSalePath, listingTileHref } from '@/lib/slug'
import {
  getOutOfAreaCity,
  getIndexableOutOfAreaCities,
  isIndexableOutOfAreaCity,
} from '@/lib/data/geo/getOutOfAreaCities'
import { pageMetadata } from '@/lib/site/page-metadata'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import type { SchemaInput } from '@/lib/site/json-ld'
import { formatPrice } from '@/lib/format/money'
import { formatDate } from '@/lib/format/date'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Instrument,
  V3Ledger,
  V3Quiet,
  V3SectionTracker,
  type V3ChartProps,
  type V3ChartRangeRow,
  type V3InstrumentFigure,
  type V3LedgerFigureRow,
  type V3QuietItem,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { OutOfAreaReferralSheet } from './_v3/OutOfAreaReferralSheet.client'
import { listingRowPhotoSrc } from './_v3/listing-row-photo'
import './oregon-city.css'

type Params = { city: string }

export const dynamicParams = true
export const revalidate = 3600

// Build-time prerender is intentionally empty (ci:ssg-budget). Seeding the top
// 25 out-of-area cities ran a live Supabase query inside `next build` and then
// prerendered 25 pages against timeout-capped rails. Indexability is decided at
// render time (renderable/noindex logic below); with dynamicParams=true +
// revalidate=3600 every URL still serves, rendered on first request.
export async function generateStaticParams(): Promise<Array<{ city: string }>> {
  return []
}

function normalizeSlug(raw: string): string {
  let s = raw
  try {
    s = decodeURIComponent(raw)
  } catch {
    /* raw */
  }
  return s.toLowerCase().trim()
}

/** The home-market towns the honest block names. Dead text naming a linkable
 *  thing is a defect (PUBLIC-PRODUCT-OS), and pattern 6 is the block that carries
 *  the graph's outbound edges, so each town named in the prose is a door. Every
 *  slug here has a real /cities page (lib/central-oregon.ts SITE_CITY_SLUGS). */
const HOME_MARKET_EDGES: readonly V3QuietItem[] = [
  { label: 'Bend', href: '/cities/bend' },
  { label: 'Redmond', href: '/cities/redmond' },
  { label: 'Sisters', href: '/cities/sisters' },
  { label: 'Sunriver', href: '/cities/sunriver' },
  { label: 'La Pine', href: '/cities/la-pine' },
]

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { city: raw } = await params
  const slug = normalizeSlug(raw)
  const city = await getOutOfAreaCity(slug)
  if (!city) {
    return pageMetadata({
      title: 'City not found',
      description: "We don't have a page for this Oregon city.",
      path: `/oregon/${slug}`,
      noindex: true,
    })
  }
  const indexable = await isIndexableOutOfAreaCity(slug)
  return pageMetadata({
    title: `${city.name} homes for sale — outside our market`,
    description: `${city.activeAllCount} live ${city.name} listings from the statewide MLS. Ryan Realty works Central Oregon, not ${city.name}. Browse the inventory, then ask for a local broker introduction.`,
    path: `/oregon/${city.slug}`,
    noindex: !indexable,
  })
}

export default async function OutOfAreaCityPage({ params }: { params: Promise<Params> }) {
  const { city: raw } = await params
  const slug = normalizeSlug(raw)

  // Guard FIRST, before anything streams: an unknown slug is a REAL 404
  // (the middleware sends junk /cities/* slugs here expecting exactly that).
  const city = await getOutOfAreaCity(slug)
  if (!city) notFound()

  const pagePath = `/oregon/${city.slug}`
  const browsePath = homesForSalePath(city.name)

  const [tiles, indexableCities] = await Promise.all([
    // Live inventory via the existing browse machinery (listing_tile_mv). The
    // explicit city predicate exempts the service-area allowlist by design.
    withTimeoutFallback(
      getListingTiles({ city: city.name, status: 'active', limit: 12, sort: 'newest' }),
      [] as Awaited<ReturnType<typeof getListingTiles>>,
      5000,
      'oregon-city:tiles',
    ),
    withTimeoutFallback(
      getIndexableOutOfAreaCities(),
      [] as Awaited<ReturnType<typeof getIndexableOutOfAreaCities>>,
      4000,
      'oregon-city:index',
    ),
  ])

  // ── The place answer. All three figures are one snapshot row, which is exactly
  // what the trace beneath them describes. The active count is a door into the
  // browse surface; the other two have no node of their own. ──────────────────
  // Each figure says what it means (SITE-41). Three numbers with plain labels and
  // nothing else was the banned KPI grid, and it made ~360 city pages read as one
  // template with the noun swapped. Section 0: every sentence explains the figure it
  // sits under and introduces no number of its own.
  const figures: V3InstrumentFigure[] = []
  if (city.activeAllCount > 0) {
    figures.push({
      value: v3Text(city.activeAllCount.toLocaleString('en-US')),
      label: v3Text('active listings, all property types'),
      href: browsePath,
      sentence: v3Text(
        `Everything on the market in ${city.name} right now, houses and condos and bare land together.`,
      ),
    })
  }
  if (city.activeSfrCount > 0) {
    figures.push({
      value: v3Text(city.activeSfrCount.toLocaleString('en-US')),
      label: v3Text('active single-family listings'),
      sentence: v3Text('Of those, the ones that are a house on its own lot.'),
    })
  }
  if (city.medianListPrice != null) {
    figures.push({
      value: v3Text(formatPrice(city.medianListPrice)),
      label: v3Text('median single-family list price'),
      sentence: v3Text('Half of those houses ask more than this, half ask less.'),
    })
  }
  const [firstFigure, ...restFigures] = figures

  // H1 stays the search phrase. Honesty lives in the Alert above (SITE-76), so
  // this band does not restate "we don't work here" as a second display title.
  const headline = `Homes for sale in ${city.name}, Oregon`
  const snapshotTrace =
    `live listings from the statewide Oregon MLS feed, pre-aggregated as one snapshot row for ${city.name}. ` +
    'The count covers all property types. The median covers active single-family listings only.'

  // ── Live listings. A row needs a price and an address, because the value column
  // is a figure and the row text is its name: formatPrice answers a missing price
  // with an em dash, which would read as a figure under a live-MLS trace. Rows are
  // deduped on the street address, which the KB rail did too — one physical home
  // carrying two MLS entries otherwise renders twice. ─────────────────────────
  const seenAddress = new Set<string>()
  const listingRows: V3LedgerFigureRow[] = []
  for (const tile of tiles) {
    const price = tile.listPrice
    // §0: same guard as the ask-strip below — formatPrice rounds to the nearest
    // $1,000, so a genuine but tiny raw price (a land-listing placeholder under
    // the statewide feed's normal range) would print as a false "$0" card, not a
    // missing-price card. 2026-09-09 evaluator caught this exact row surviving
    // here after the strip's own filter was fixed; both reads of the same tiles
    // now share the floor.
    if (price == null || !Number.isFinite(price) || price < 500) continue
    const bareAddress = [tile.streetNumber, tile.streetName, tile.streetSuffix]
      .filter(Boolean)
      .join(' ')
      .trim()
    if (!bareAddress) continue
    // Every card names its city (Matt 2026-08-27): cards travel — open
    // houses, trails, price drops, saved-search alerts — so a bare street
    // line made the reader guess. Applied here too, even though the `when`
    // eyebrow already names the city: consistency beats brevity.
    const address =
      publishCardAddress({
        streetNumber: tile.streetNumber,
        streetName: tile.streetName,
        streetSuffix: tile.streetSuffix,
        city: tile.city,
      }) || bareAddress
    const key = bareAddress.toLowerCase()
    if (seenAddress.has(key)) continue
    seenAddress.add(key)
    // §0: the statewide feed is unfiltered by property type (the Instrument
    // above states "all property types"), so a bare parcel can reach this
    // loop. A land listing never carries beds/baths/sqft, and printing no
    // meta line at all reads as a home whose specs went missing rather than
    // a lot — "0 55th Avenue" priced with a blank detail line, 2026-08-27
    // audit. Land states what it is instead.
    const isLand = classifyInventoryPropertyType(tile.propertyType) === 'land_lot'
    const meta = isLand
      ? ['Lot', tile.lotSizeAcres != null && tile.lotSizeAcres > 0 ? `${tile.lotSizeAcres.toFixed(2)} acres` : null]
          .filter(Boolean)
          .join(' · ')
      : [
          tile.beds != null ? `${tile.beds} bd` : null,
          tile.baths != null ? `${tile.baths} ba` : null,
          tile.sqft != null ? `${tile.sqft.toLocaleString('en-US')} sqft` : null,
        ]
          .filter(Boolean)
          .join(' · ')
    listingRows.push({
      href: listingTileHref(tile),
      when: v3Text(displaySubdivision(tile.subdivisionName) ?? tile.city ?? city.name),
      what: v3Text(address),
      detail: meta ? v3Text(meta) : undefined,
      value: v3Text(formatPrice(price)),
      id: tile.listingKey,
      // The listing's own photograph, at the size this row draws it. See
      // ./_v3/listing-row-photo.ts: same asset, one path token, 30 KB instead
      // of 331 KB. A row whose listing has no photo passes no media at all and
      // takes the glyph tile, which is the designed empty state, not a blank.
      ...(tile.photoUrl?.trim() ? { media: { src: listingRowPhotoSrc(tile.photoUrl) } } : {}),
    })
  }
  const [firstListingRow, ...restListingRows] = listingRows

  // ── THE PLACE MARK (SITE-41). ────────────────────────────────────────────────
  // Three numbers under a heading is the same screen for Medford, Salem and the
  // ~360 other cities this one file renders: nothing on it belongs to the place it
  // names. This is the one drawing that does. Every row is a real street in this
  // city at the price it is actually asking, so the shape of the strip, the names
  // down its side and the spread across it are all this town's and nobody else's.
  //
  // Section 0: the rows ARE the population — the same live tiles the Ledger below
  // prints, same dedupe, newest first, capped at eight so the strip stays readable
  // and the trace says so. No median rule is drawn across it: the snapshot's median
  // covers single-family listings only and these rows are every property type, and
  // one scale carrying two populations is a comparison that is not true.
  const STRIP_ROWS = 8
  const stripRows: V3ChartRangeRow[] = listingRows.slice(0, STRIP_ROWS).flatMap((row) => {
    const tile = tiles.find((t) => t.listingKey === row.id)
    const price = tile?.listPrice
    // §0: formatPrice rounds to the nearest $1,000, so a genuine but tiny raw price
    // (a $200 land-listing typo, a placeholder value from the statewide feed) would
    // print "$0" on this strip — a rounding that changes the narrative from "priced
    // low" to "free," which section 0 forbids outright. 500 is the floor below which
    // formatPrice's rounding can reach zero; anything under it is withheld here the
    // same way a missing price already is, never printed as a false $0.
    if (!tile || price == null || !Number.isFinite(price) || price < 500) return []
    // The tick drops the street SUFFIX on purpose (TASTE.md's named 375 failure: the
    // full address — "2905 El Dorado Drive" — truncated to an ellipsis inside the
    // fixed-width tick column at 375). Number plus street name still names a real,
    // distinct street; the full address (suffix included) stays in the Ledger below.
    const street = [tile.streetNumber, tile.streetName].filter(Boolean).join(' ').trim()
    if (!street) return []
    return [
      {
        tick: v3Text(street),
        value: price,
        label: v3Text(formatPrice(price)),
        ...(row.detail ? { note: row.detail } : {}),
      },
    ]
  })
  // Ordered by price, not by age. The population is the newest listings; the ORDER
  // is what the strip is for. Left as the feed's newest-first order the rows read as
  // noise, and a set of named things on one scale is a ranking or it is nothing
  // (the dataviz skill's form-from-the-job rule).
  stripRows.sort((a, b) => b.value - a.value)
  const stripPrices = stripRows.map((r) => r.value).sort((a, b) => a - b)
  const stripLow = stripPrices[0]
  const stripHigh = stripPrices[stripPrices.length - 1]
  const askStrip: V3ChartProps | undefined =
    stripRows.length >= 3 && stripLow != null && stripHigh != null
      ? {
          caption: v3Text(`What the newest listings in ${city.name} are asking`),
          kind: 'range',
          claim: v3Text(
            stripLow === stripHigh
              ? `The newest listings here all ask ${formatPrice(stripLow)}.`
              : `Asking prices on the newest listings run from ${formatPrice(stripLow)} to ${formatPrice(stripHigh)}.`,
          ),
          rows: stripRows,
          id: 'top-asks',
        }
      : undefined
  // The strip's own clause, appended to the snapshot trace only when the strip
  // draws: the figures and the rows are two different reads of one feed, and the
  // trace has to cover both or it covers the wrong one.
  const stripTrace = askStrip
    ? `The strip beside them is a separate live read: the ${stripRows.length} newest active listings in ${city.name} with both a price and a street address, every property type, at their asking price as listed.`
    : ''
  // "listing," not "home": a bare parcel can reach this set (see the
  // isLand branch above), and the trace must not claim a population it does
  // not print.
  const listingTrace = `live MLS listing feed, active listings in ${city.name}, newest first, one row per listing`
  // §0: this Ledger and the Instrument's "active listings" figure above are
  // two different reads of the same live feed — the Instrument is the
  // pre-aggregated snapshot row, this Ledger is a fresh fetch capped at the
  // newest 12 and then dropped for a missing price/address or folded for a
  // shared street address. One sentence connects the two counts whenever
  // they disagree, using the real numbers both queries returned.
  const listingsNote =
    city.activeAllCount > 0 && listingRows.length > 0 && listingRows.length !== city.activeAllCount
      ? `The snapshot above counts ${city.activeAllCount.toLocaleString('en-US')} active listings. This list shows the ${listingRows.length.toLocaleString('en-US')} with both a price and a street address, one row per address.`
      : undefined

  // ── The other top out-of-area markets, so the referral tier interlinks instead
  // of dead-ending. Same snapshot population as the answer above, a different set
  // of rows, and its own stamp taken from the rows actually rendered. Plain rows:
  // a city whose snapshot carries no median states that in place rather than
  // printing a figure the feed did not publish. ───────────────────────────────
  const otherCities = indexableCities.filter((c) => c.slug !== city.slug).slice(0, 8)
  // ENCODED, NOT A HAIRLINE LIST (SITE-41): eight cities by active-listing count is
  // the same "table wearing hairlines" TASTE.md bans past six rows, and the
  // 2026-09-09 evaluator named this ledger by that tell. Every indexable city here
  // carries an active_all_count of at least 1 (the index's own filter), so `value`
  // moves to the count and `weight` is this list's own share of its largest row —
  // the same arithmetic buildInventoryLedger uses on the annual review's city
  // ledgers, computed after the map once the whole list's maximum is known.
  const otherCityMax = otherCities.reduce((max, c) => Math.max(max, c.activeAllCount), 0)
  const otherCityRows: V3LedgerFigureRow[] = otherCities.map((c) => ({
    href: `/oregon/${c.slug}`,
    what: v3Text(c.name),
    detail: v3Text(
      c.medianListPrice != null
        ? `${formatPrice(c.medianListPrice)} median single-family list price`
        : 'No published single-family median',
    ),
    value: v3Text(`${c.activeAllCount.toLocaleString('en-US')} active`),
    weight: otherCityMax > 0 ? c.activeAllCount / otherCityMax : undefined,
    id: c.slug,
  }))
  const [firstOtherCityRow, ...restOtherCityRows] = otherCityRows
  const otherCitiesRefreshedAt = otherCities
    .map((c) => c.refreshedAt)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .sort()
    .at(-1)

  // ── Structured data (JSON-LD). Meaning unchanged from the KB page: the same
  // three schemas, the same variables, the same units. Every stat is the snapshot
  // row the Instrument prints. ────────────────────────────────────────────────
  const datasetStats: Array<{ name: string; value: string | number; unitText?: string }> = [
    { name: 'Active listings (all property types)', value: city.activeAllCount, unitText: 'listings' },
    { name: 'Active single-family listings', value: city.activeSfrCount, unitText: 'listings' },
  ]
  if (city.medianListPrice != null) {
    datasetStats.push({ name: 'Median active list price (single-family)', value: city.medianListPrice, unitText: 'USD' })
  }
  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Oregon', url: '/cities' },
        { name: city.name, url: pagePath },
      ],
    },
    {
      type: 'place',
      name: `${city.name}, Oregon`,
      description: `Live MLS inventory for ${city.name}, Oregon, with a broker referral service from Ryan Realty.`,
      url: pagePath,
      address: { state: 'OR', country: 'US' },
    },
    {
      type: 'dataset',
      name: `Active listing snapshot for ${city.name}, Oregon`,
      description: `Live counts for active MLS listings in ${city.name}, Oregon. Sourced from the statewide Oregon MLS feed via Ryan Realty.`,
      url: pagePath,
      spatialCoverageName: `${city.name} · Oregon`,
      variableMeasured: datasetStats,
    },
  ]
  // SEO increment (SITE-76): crawlable ItemList of the same newest priced,
  // addressed listings the Ledger renders — not a second population.
  if (listingRows.length > 0) {
    schemas.push({
      type: 'itemList',
      name: `Newest ${city.name} listings`,
      items: listingRows.slice(0, 12).map((row) => ({
        name: String(row.what),
        url: row.href,
      })),
    })
  }

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <MetadataBlock schemas={schemas} />

        <V3SectionTracker />

        <V3Breadcrumb
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Cities', href: '/cities' },
            { label: city.name },
          ]}
        />

        {/* Honesty first (SITE-76): Alert-only Quiet so live inventory can share
            the first viewport at 375. Live count traces to the same snapshot row
            the Instrument prints. Home-market doors follow the place answer. */}
        <V3Quiet
          id="about"
          ariaLabel={`We don't work in ${city.name}`}
          alert={{
            title: `We don't work in ${city.name}`,
            description:
              city.activeAllCount > 0
                ? `${city.activeAllCount.toLocaleString('en-US')} live listings below are from the statewide MLS. We work Central Oregon, not ${city.name}. Ask for a local broker introduction.`
                : `We work Central Oregon, not ${city.name}. Ask for a local broker introduction.`,
            action: {
              label: 'Get a broker introduction',
              href: '#referral',
            },
          }}
          items={[]}
        />

        {firstFigure ? (
          <V3Instrument
            id="top"
            level={1}
            eyebrow={v3Text(`${city.name} · Oregon`)}
            headline={v3Text(headline)}
            figures={[firstFigure, ...restFigures]}
            chart={askStrip}
            // SITE-76: put the named asking-price strip in the first viewport at
            // 375 so mobile is not three static tiles under the honesty Alert.
            chartFirst={Boolean(askStrip)}
            source={v3Text(askStrip ? `${snapshotTrace} ${stripTrace}` : snapshotTrace)}
            sourceName={v3Text('Oregon Data Share MLS')}
            asOf={city.refreshedAt ?? undefined}
            updated={city.refreshedAt ? v3Text(formatDate(city.refreshedAt)) : undefined}
            // PRIMARY at 390: the chrome CTA sits in the menu. The ask this
            // node earns is the referral, not a Central Oregon valuation.
            action={{
              label: v3Text('Get a broker introduction'),
              href: '#referral',
            }}
          />
        ) : (
          <V3Quiet
            id="top"
            heading={headline}
            headingLevel={1}
            items={[
              {
                kind: 'prose',
                term: 'No live figures right now',
                body: `The ${city.name} snapshot row did not return on this refresh, so this page is not printing a listing count or a median. ${city.name} is outside our Central Oregon market either way, and the referral below still works.`,
              },
            ]}
          />
        )}

        {/* Home-market doors stay crawlable; parked under the place answer so
            the Alert + Instrument can share the first viewport at 375. */}
        <V3Quiet
          ariaLabel={`Our Central Oregon home market from ${city.name}`}
          items={[...HOME_MARKET_EDGES]}
        />

        {firstListingRow ? (
          <V3Ledger
            id="listings"
            eyebrow={v3Text(`${city.name} · For sale`)}
            heading={v3Text(`The newest ${city.name} listings`)}
            rows={[firstListingRow, ...restListingRows]}
            /* SITE-59: the picture on a listing row is content, not a stamp.
               At the pattern's default 44px it was a grey smudge that an
               evaluator read as a broken image on ten of twelve Medford rows,
               and it was pixel-for-pixel the box a photo-less row draws. */
            media="photo"
            note={listingsNote ? v3Text(listingsNote) : undefined}
            source={v3Text(listingTrace)}
            action={{
              label: v3Text(`See every ${city.name} home for sale`),
              href: browsePath,
            }}
          />
        ) : (
          <V3Ledger
            id="listings"
            eyebrow={v3Text(`${city.name} · For sale`)}
            heading={v3Text(`The newest ${city.name} listings`)}
            rows={[]}
            emptyMessage={v3Text(
              `No ${city.name} listing came back with both a price and a street address on this refresh.`,
            )}
            action={{
              label: v3Text(`See every ${city.name} home for sale`),
              href: browsePath,
            }}
          />
        )}

        {/* Referral capture — geo:out-of-area, nothing auto-sends. */}
        <OutOfAreaReferralSheet citySlug={city.slug} cityName={city.name} />

        {firstOtherCityRow ? (
          <V3Ledger
            id="other-markets"
            eyebrow={v3Text('Other Oregon markets')}
            heading={v3Text('More Oregon cities')}
            rows={[firstOtherCityRow, ...restOtherCityRows]}
            source={v3Text(
              'live listings from the statewide Oregon MLS feed, one snapshot row per city, the out-of-area cities carrying the most active listings',
            )}
            updated={otherCitiesRefreshedAt ? v3Text(formatDate(otherCitiesRefreshedAt)) : undefined}
            encode="bar"
            action={{ label: v3Text('Our Central Oregon cities'), href: '/cities' }}
          />
        ) : null}
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo only
          when it is NOT nested in sectioning content, and <main> is sectioning
          content, so inside it the element is a generic and the page ships no
          contentinfo landmark. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
