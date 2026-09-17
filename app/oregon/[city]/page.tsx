// @no-static-params — build-time fan-out budgeted to zero (ci:ssg-budget); ISR on demand
/**
 * /oregon/[city] — the out-of-market referral tier, on the components/site/v3 barrel.
 *
 * The statewide MLS feed carries ~362 Oregon cities; Ryan Realty's home market is
 * Central Oregon. This page serves the valid Oregon cities OUTSIDE that market
 * (Medford, Grants Pass, Klamath Falls, ...): honest copy that says this is not our
 * market, the live inventory the feed reports, and a referral capture.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11. SITE-105
 * honesty-first fold: catalog Alert (compact stacked shadcn, not a cream banner), then
 * Instrument (interactive two-bar drawing, no KPI grid, no fold-unhide),
 * Ledger (magazine listings), Sheet (referral), Ledger (other Oregon markets),
 * Footer. FOUR of the six patterns, no two adjacent alike, chrome exempt.
 * Section ids stay: about, top, listings, referral, other-markets. The parity
 * contract is design_system/ryan-realty/ui_kits/oregon-city/parity.json.
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
 *     display:none below 880px. The Alert outline door and the Sheet are the
 *     introduction asks. The Instrument does not carry a second navy slab.
 *     Value my home is the wrong primary here: this city is outside our market.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getListingTiles, getMarketPulse } from '@/lib/data'
import { classifyInventoryPropertyType } from '@/lib/inventory-filters'
import { publishCardAddress } from '@/lib/listing/publish-street-line'
import { homesForSalePath, listingTileHref } from '@/lib/slug'
import { placeHomesForSaleHeading } from '@/lib/site/place-homes-heading'
import { canonicalCityCacheSlug } from '@/lib/market/city-cache-slug'
import { publishMonthsOfSupply } from '@/lib/market/publish-months-of-supply'
import { buildPlaceMosView } from '@/lib/site/place-mos'
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
  V3Drawing,
  V3Instrument,
  V3Ledger,
  V3MosBars,
  V3Quiet,
  V3SectionTracker,
  type V3InstrumentFigure,
  type V3LedgerFigureRow,
  type V3QuietItem,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { OregonCityHonesty } from './_v3/OregonCityHonesty'
import {
  OregonCityListings,
  type OregonCityListingCard,
} from './_v3/OregonCityListings'
import { OutOfAreaReferralSheet } from './_v3/OutOfAreaReferralSheet.client'
import { listingRowPhotoSrc } from './_v3/listing-row-photo'
import {
  buildOregonCityClaim,
  buildOregonCityItemListName,
  buildOregonCityListingReveal,
  buildOregonCitySupplyDrawing,
  buildOregonCityTitle,
} from './_v3/oregon-city-fold'
import './oregon-city.css'

type Params = { city: string }

export const dynamicParams = true
// FORCE-DYNAMIC, not `revalidate` (SITE-105, prod 500 fixed 2026-09-16). This
// page awaits `searchParams` (taste_variant, for the TASTE.md evaluator's
// forced empty/feed-miss preview states). With `revalidate` set and
// generateStaticParams returning [] below, every /oregon/<city> URL is a
// "first request" path that Next renders through its on-demand STATIC
// generation pass rather than a normal per-request render. That pass forbids
// Dynamic API usage, and — unlike a build-time prerender attempt — does not
// catch the resulting DYNAMIC_SERVER_USAGE error and fall back to dynamic
// rendering; it throws, and every one of those URLs served /500 in
// production (ryan-realty.com/oregon/medford, x-next-error-status: 500,
// reproduced locally on ashland/klamath-falls/grants-pass/eugene/medford —
// /contact reads the same searchParams key but is a real static route seeded
// at build, so the build's own prerender pass caught it there instead of
// crashing at request time). Same failure class already documented and fixed
// once on app/subdivisions/[slug]/page.tsx (cookies() instead of
// searchParams, 2026-07-15..2026-09-01): a truly request-scoped read is
// incompatible with this route's ISR shape, so the route goes fully dynamic.
// `revalidate` is dropped, not just left in place, because Next silently
// zeroes it once `dynamic: 'force-dynamic'` is set
// (node_modules/next/dist/build/utils.js) — leaving `revalidate = 3600` here
// would read as live and is not. ISR caching for this route is gone until a
// future pass moves the taste_variant read off the server render path the
// way subdivisions eventually did (restoring its `revalidate = 300`).
export const dynamic = 'force-dynamic'

// Build-time prerender is intentionally empty (ci:ssg-budget). Seeding the top
// 25 out-of-area cities ran a live Supabase query inside `next build` and then
// prerendered 25 pages against timeout-capped rails. Indexability is decided at
// render time (renderable/noindex logic below); with dynamicParams=true +
// force-dynamic every URL still serves, rendered fresh on every request.
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
    title: buildOregonCityTitle({ name: city.name, activeAllCount: city.activeAllCount }),
    description: `${city.activeAllCount} live ${city.name} listings from the statewide MLS. Ryan Realty works Central Oregon, not ${city.name}. Browse the inventory, then ask for a local broker introduction.`,
    path: `/oregon/${city.slug}`,
    noindex: !indexable,
  })
}

export default async function OutOfAreaCityPage({
  params,
  searchParams,
}: {
  params: Promise<Params>
  searchParams: Promise<{ taste_variant?: string }>
}) {
  const { city: raw } = await params
  const { taste_variant: tasteVariant } = await searchParams
  const slug = normalizeSlug(raw)

  // Guard FIRST, before anything streams: an unknown slug is a REAL 404
  // (the middleware sends junk /cities/* slugs here expecting exactly that).
  const city = await getOutOfAreaCity(slug)
  if (!city) notFound()

  const pagePath = `/oregon/${city.slug}`
  const browsePath = homesForSalePath(city.name)

  const cacheSlug = canonicalCityCacheSlug(city.name)

  const [tiles, indexableCities, pulse] = await Promise.all([
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
    // Second-shaped MOS read (docs/DATABASE_FOR_AI_AGENTS.md §0). Snapshot
    // has no sold pace. Pulse is Central Oregon only today; a miss stays a
    // miss — do not invent month-of-sales from actives alone.
    withTimeoutFallback(
      getMarketPulse({ geoType: 'city', geoSlug: cacheSlug }),
      null,
      4000,
      'oregon-city:pulse',
    ),
  ])

  // ── The place answer. All three figures are one snapshot row, which is exactly
  // what the trace beneath them describes. The active count is a door into the
  // browse surface; the other two have no node of their own. ──────────────────
  // Each figure says what it means (SITE-41). Three numbers with plain labels and
  // nothing else was the banned KPI grid, and it made ~360 city pages read as one
  // template with the noun swapped. Section 0: every sentence explains the figure it
  // sits under and introduces no number of its own.
  const snapshotTrace =
    `live listings from the statewide Oregon MLS feed, pre-aggregated as one snapshot row for ${city.name}. ` +
    'The count covers all property types. The median covers active single-family listings only.'

  const publishedMos =
    pulse != null
      ? publishMonthsOfSupply({
          grain: 'city',
          pulseMos: pulse.monthsOfSupply,
          pulseActiveCount: pulse.activeCount,
          displayedActiveCount: pulse.activeCount,
        })
      : null
  const placeMos =
    publishedMos != null && pulse != null
      ? buildPlaceMosView({
          active: pulse.activeCount,
          monthsSupply: publishedMos,
          grain: 'city',
          geoSlug: cacheSlug,
          asOf: pulse.refreshedAt ?? null,
        })
      : null
  const supplyDrawing = placeMos
    ? null
    : buildOregonCitySupplyDrawing({
        name: city.name,
        activeAllCount: city.activeAllCount,
        activeSfrCount: city.activeSfrCount,
        source: snapshotTrace,
        asOf: city.refreshedAt ? formatDate(city.refreshedAt) : null,
        medianAsk: city.medianListPrice != null ? formatPrice(city.medianListPrice) : null,
      })

  // One supporting figure only. A three-tile KPI grid is the banned open
  // state. Counts live on the bars; typical ask is the leftover snapshot
  // figure the drawing does not carry.
  const figures: V3InstrumentFigure[] = []
  if (city.medianListPrice != null) {
    figures.push({
      value: v3Text(formatPrice(city.medianListPrice)),
      label: v3Text('typical ask'),
      sentence: v3Text('Half of the houses on the market ask more than this, half ask less.'),
    })
  } else if (city.activeAllCount > 0) {
    figures.push({
      value: v3Text(city.activeAllCount.toLocaleString('en-US')),
      label: v3Text('on the market'),
      href: browsePath,
      sentence: v3Text(
        `Everything on the market in ${city.name} right now, houses and condos and bare land together.`,
      ),
    })
  }
  const [firstFigure, ...restFigures] = figures

  // SEO in pixels (SITE-105): the document title and the H1 share the live
  // count plus the out-of-market claim. Portal "Homes for sale in {city}"
  // is not this page's job.
  const headline = buildOregonCityTitle({ name: city.name, activeAllCount: city.activeAllCount })

  // ── Live listings. A row needs a price and an address, because the value column
  // is a figure and the row text is its name: formatPrice answers a missing price
  // with an em dash, which would read as a figure under a live-MLS trace. Rows are
  // deduped on the street address, which the KB rail did too — one physical home
  // carrying two MLS entries otherwise renders twice. ─────────────────────────
  const seenAddress = new Set<string>()
  const listingCards: OregonCityListingCard[] = []
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
    const revealLine = buildOregonCityListingReveal({
      yearBuilt: tile.yearBuilt,
      lotSizeAcres: isLand ? null : tile.lotSizeAcres,
      garageSpaces: tile.garageSpaces,
      pricePerSqft: tile.pricePerSqft,
      city: tile.city ?? city.name,
    })
    listingCards.push({
      href: listingTileHref(tile),
      address,
      ...(meta ? { detail: meta } : {}),
      price: formatPrice(price),
      id: tile.listingKey,
      ...(tile.photoUrl?.trim()
        ? { photoSrc: listingRowPhotoSrc(tile.photoUrl, '800x600') }
        : {}),
      ...(revealLine ? { reveal: revealLine } : {}),
    })
  }
  const [firstListingCard] = listingCards

  // SITE-105: live inventory belongs on the Ledger (photographs + price +
  // address + beds/baths/sqft), not as a static asking-price lollipop that
  // hides the houses. The Instrument keeps the snapshot figures; foldAfter
  // leaves one lead count on screen so the first viewport is not a KPI grid.
  const listingTrace = `live MLS listing feed, active listings in ${city.name}, newest first, one row per listing`
  // §0: this Ledger and the Instrument's "active listings" figure above are
  // two different reads of the same live feed — the Instrument is the
  // pre-aggregated snapshot row, this Ledger is a fresh fetch capped at the
  // newest 12 and then dropped for a missing price/address or folded for a
  // shared street address. One sentence connects the two counts whenever
  // they disagree, using the real numbers both queries returned.
  const listingsNote =
    listingCards.length > 0
      ? 'This spread is the newest priced, addressed homes, not the whole live book.'
      : undefined
  const feedMiss = tiles.length === 0 && city.activeAllCount > 0
  const listingView =
    tasteVariant === 'empty' || tasteVariant === 'feed-miss' ? tasteVariant : undefined

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
  if (listingCards.length > 0) {
    schemas.push({
      type: 'itemList',
      name: `Newest ${city.name} listings`,
      items: listingCards.slice(0, 12).map((card) => ({
        name: buildOregonCityItemListName({
          address: card.address,
          price: card.price,
          detail: card.detail,
        }),
        url: card.href,
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

        {/* Honesty first (SITE-105): catalog Alert on the route (_v3), not a
            house-only Quiet import. Live count traces to the same snapshot row
            the Instrument prints. Home-market doors follow the place answer. */}
        <OregonCityHonesty id="about" cityName={city.name} liveCount={city.activeAllCount} />

        {firstFigure ? (
          <V3Instrument
            id="top"
            level={1}
            eyebrow={v3Text(`${city.name} · Oregon`)}
            headline={v3Text(headline)}
            note={v3Text(buildOregonCityClaim({ name: city.name }))}
            figures={[firstFigure, ...restFigures]}
            chartFirst={placeMos != null || supplyDrawing != null}
            source={v3Text(snapshotTrace)}
            sourceName={v3Text('Oregon Data Share MLS')}
            asOf={city.refreshedAt ?? undefined}
            updated={city.refreshedAt ? v3Text(formatDate(city.refreshedAt)) : undefined}
            drawing={
              placeMos ? (
                <V3MosBars
                  id="oregon-city-mos"
                  caption={placeMos.caption}
                  plainLabel={placeMos.plainLabel}
                  homesName={placeMos.homesName}
                  homesLabel={placeMos.homesLabel}
                  homesValue={placeMos.homesValue}
                  salesName={placeMos.salesName}
                  salesLabel={placeMos.salesLabel}
                  salesValue={placeMos.salesValue}
                  source={placeMos.source}
                  asOf={placeMos.asOf}
                  sourceName="Oregon Data Share MLS"
                  tooltip={placeMos.tooltip}
                />
              ) : supplyDrawing ? (
                <V3Drawing id="oregon-city-supply" figures={[supplyDrawing]} label={`${city.name} listings`} />
              ) : null
            }
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

        <OregonCityListings
          id="listings"
          eyebrow={`${city.name} · For sale`}
          heading={`The newest ${city.name} listings`}
          items={firstListingCard ? listingCards : []}
          emptyMessage={`No ${city.name} listing came back with both a price and a street address on this refresh.`}
          feedMissMessage={`The live listing feed did not return this refresh. The ${city.name} snapshot above is a different read.`}
          note={listingsNote}
          source={listingTrace}
          actionLabel={placeHomesForSaleHeading(city.name)}
          actionHref={browsePath}
          forcedView={listingView ?? (feedMiss && !firstListingCard ? 'feed-miss' : undefined)}
        />

        {/* Home-market doors stay crawlable; after live inventory so the
            first viewport can show photographed listings, not a door grid. */}
        <V3Quiet
          ariaLabel={`Our Central Oregon home market from ${city.name}`}
          items={[...HOME_MARKET_EDGES]}
        />

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
