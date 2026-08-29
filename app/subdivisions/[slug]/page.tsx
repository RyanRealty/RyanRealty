// @no-static-params — build-time fan-out budgeted to zero (ci:ssg-budget); ISR on demand
/**
 * /subdivisions/[slug] — the plat grain, on the components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md §3. First screen is
 * H1 "{Name} homes for sale" + plat-inventory PlaceFaceStrip + PlaceSplitView.
 * Do not cage that screen in V3Stage or V3Field. Never say "plat" in visitor
 * copy. Giant 0 is forbidden on a timed-out read. Schools sit after the Split
 * when the MLS modal actually publishes. Section order is the parity contract
 * at design_system/ryan-realty/ui_kits/subdivision/parity.json.
 *
 * THE RHYTHM RULE AND CONDITIONAL SECTIONS, DECLARED RATHER THAN HIDDEN. Four
 * of this page's sections render only when their data exists, and no ordering
 * of four independent conditionals over four patterns can guarantee "no two
 * adjacent sections share a pattern" for every combination. The order below is
 * correct when the data is present and degrades to at worst one repeated pair;
 * the alternative is dropping a section the data supports, which §0 forbids.
 *
 * NO-404 CONTRACT, CARRIED ACROSS UNCHANGED. For each incoming slug the page
 * tries three resolution paths in order and renders when ANY succeeds:
 *   1. GIS boundary — getGeoBoundaryMapData geoType='subdivision' returns a polygon.
 *   2. Registry alias — data/resort-communities.json subdivision_aliases holds a
 *      match (slugify(alias) === slug).
 *   3. Active listings — getPlatPublicInventory finds SFR + PUBLIC_ACTIVE homes
 *      filed under that MLS SubdivisionName in the parent city.
 * notFound fires ONLY when all three return empty AND both reads succeeded.
 *
 * THE REDIRECT IS NOT HERE, AND MUST NOT COME BACK. middleware.ts runs
 * resolveSubdivisionAreaRedirect(slug) on every /subdivisions/<slug> request
 * before render (lib/routing/pre-render-hops.ts), so a marketing-area slug has
 * already been 308-ed and can never reach this component. A page-body
 * permanentRedirect could not set a Location header anyway — this segment
 * renders inside the Suspense boundary app/loading.tsx opens, so React has
 * already flushed HTTP 200. Enforced by scripts/check-streamed-redirect.mjs.
 *
 * THE PAGE CONTRACT, CARRIED ACROSS UNCHANGED: generateMetadata through
 * pageMetadata with the same title, description, path and indexability rule
 * (one cached getIndexableSubdivisions read serves both the robots policy and
 * the plat's real city, so a non-registry plat titles itself with a city that
 * exists instead of "Central Oregon, Oregon"), MetadataBlock JSON-LD
 * (BreadcrumbList + Place, same payloads, same hasMap condition), the section
 * tracker, revalidate 60, dynamicParams true, generateStaticParams returning [],
 * and maxDuration 60. MetadataBlock stays on the legacy register: JSON-LD is not
 * visual language and ci:ai-structured-data pins this route to it by name.
 *
 * FOUR POPULATIONS, FOUR TRACES (CLAUDE.md §0). Every sentence that describes
 * one lives in _v3/subdivision-traces.ts, and no section prints a figure its own
 * trace does not cover:
 *   1. The plat's active count and the homes — getPlatPublicInventory, the
 *      recorded-plat SFR + PUBLIC_ACTIVE set. Do NOT fall back to a capped
 *      featured fetch or an unfiltered pin count: those were the 12 / 14 / 26
 *      split on Ridge At Eagle Crest (2026-08-16). A measured empty must not
 *      revive townhouses.
 *   2. The Market Truth recorded-plat counts — getSubdivisionCounts, detached
 *      membership, with the other property types as their own enumeration.
 *   3. The plat's own closed statistics — market_stats_cache at geoType
 *      'subdivision', periodType 'ytd' (pinned by ci:subdivision-stats-integrity).
 *   4. The yearly closed aggregates — the get_subdivision_sales_history RPC.
 *      ODS rule 5-4 A.4: aggregates only, never an individual sold address.
 *
 * ABSENT IS NOT ZERO. A boundary or inventory read that times out leaves the
 * same empty array a genuinely empty plat leaves, so activeCount is null in that
 * case and the homes section says it has no count rather than publishing a zero
 * under a live-MLS trace.
 *
 * THE PARENT PULSE IS NOT ON THIS PAGE, AND MUST NOT COME BACK. A registry plat
 * has no market_pulse_live row of its own. City and community pulse are OTHER
 * geographies, and printing one under "homes for sale in {plat}" attributed
 * Redmond's pending days to Ridge At Eagle Crest — the founding case behind
 * lib/market/publish-plat-figures.ts and ci:publish-plat-figures (2026-08-16).
 * publishPlatFigures is the whole rule: the counted set's own median may
 * publish; days-to-pending and 30-day sold WITHHOLD rather than borrow. The KB
 * page's parent-market band and fetchSubdivMarketExtras went with that fix and
 * are not restored here.
 *
 * DELETIONS THIS MIGRATION MAKES, AND WHERE THE INFORMATION WENT:
 *   KbHero              — the plat's homes open the page. The count, the median
 *                         list and the days figure are figures on the market
 *                         Instrument, each under its own trace.
 *   KbFeatured          — the homes Ledger, or the Field when the plat has four
 *                         or more pins.
 *   PlaceMapListSplit / KbListingMap — the same Google map, in the Field's map
 *                         slot, bound to the list both ways, with the recorded
 *                         plat boundary drawn on it.
 *   VideoTourRail       — a plat with in-area video tours flags them on the
 *                         listing rows themselves ("Video tour" in the row's
 *                         meta line), which is the same information attached to
 *                         the home it describes instead of a second rail.
 *   PublicSubdivisionCounts — its detached counts are figures on the market
 *                         Instrument and its extras are the property-type run.
 *   SubdivisionExploreTail (KbExploreTowns + KbSell + the explore sections) —
 *                         every edge it carried is an item in the closing Quiet,
 *                         built by _v3/subdivision-edges.ts.
 *   SmoothScrollProvider, KbFooter, KbBreadcrumb, KbSectionTracker — chrome.
 *
 * Data ONLY through @/lib/data and @/app/actions. No raw .from().
 */

import { cache } from 'react'
import type { Metadata } from 'next'
import { SubdivisionUnavailable, SUBDIVISION_UNAVAILABLE_METADATA } from './SubdivisionUnavailable'
import { subdivisionListingsPath } from '@/lib/slug'
import { publishPlaceBrowseHref } from '@/lib/search/publish-place-browse-href'
import { getGeoBoundaryMapData, getListingTiles, getMarketStats } from '@/lib/data'
import { getPlatPublicInventory } from '@/lib/data/geo/plat-public-inventory'
import {
  EMPTY_SUBDIVISION_COUNTS,
  getSubdivisionCounts,
  subdivisionCountItems,
} from '@/lib/data/market-truth/subdivision-counts'
import {
  lifestyleForCentroid,
  mapCentroid,
  peerPlatsForResort,
  subdivisionPlaceContext,
} from '@/lib/explore/subdivision-page-extras'
import { getIndexableSubdivisions } from '@/lib/data/subdivisions/getIndexableSubdivisions'
import { getSubdivisionSalesHistory } from '@/lib/data/subdivisions/getSubdivisionSalesHistory'
import { getSubdivisionSchools } from '@/lib/data/subdivisions/getSubdivisionSchools'
import { getPlaceDocuments } from '@/lib/data/places/getPlaceDocuments'
import { getPlaceCharacter } from '@/lib/data/places/getPlaceCharacter'
import { publishPlatDisplayName } from '@/lib/market/publish-plat-display-name'
import { publishPlaceFace } from '@/lib/market/publish-place-face'
import { publishPlatFigures } from '@/lib/market/publish-plat-figures'
import { pageMetadata } from '@/lib/site/page-metadata'
import { withTimeoutFallback, withTimeoutFallbackResult } from '@/lib/with-timeout-fallback'
import { formatDate } from '@/lib/format/date'
import { formatPriceExact } from '@/lib/format/money'
import type { SchemaInput } from '@/lib/site/json-ld'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Heading,
  V3Instrument,
  V3PlaceCharacter,
  V3PlacePropertyTypes,
  V3SectionTracker,
  V3SourceLine,
  type V3InstrumentFigure,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { PlaceFaceStrip } from '@/components/place/PlaceFaceStrip'
import { PlaceSplitView } from '@/components/search/PlaceSplitView'
import { SubdivisionSalesHistory } from './SubdivisionSalesHistory'
import { SubdivisionSchools } from './SubdivisionSchools'
import { SubdivisionDocuments } from './SubdivisionDocuments'
import { SubdivisionMarketCharts } from './_v3/SubdivisionMarketCharts'
import { buildSubdivisionEdges } from './_v3/subdivision-edges'
import { platStatsFigures, subdivisionSalesChart } from './_v3/subdivision-figures'
import { resolveRegistryAlias, slugToTitle } from './_v3/subdivision-registry'
import { boundsFromListingPins, hasRealPlatPolygon, toSplitListing } from './_v3/subdivision-split'
import {
  homesLedgerTrace,
  PERIOD_LABEL,
  platCountsTrace,
  platInventoryTrace,
  platStatsTrace,
  type PlatScope,
} from './_v3/subdivision-traces'

export const dynamicParams = true
export const revalidate = 60
// Worst-case first render chains sequential timeout-capped stages, above
// Vercel's 15s default function cap.
export const maxDuration = 60

// Build-time prerender is intentionally empty (ci:ssg-budget). The ~100 alias
// pages each chain sequential timeout-capped Supabase stages; prerendering them
// was the largest single cost of `next build` on Vercel and, when queries timed
// out under build concurrency, baked empty rails into the deployed HTML. With
// dynamicParams=true and revalidate=60 every URL still serves.
export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return []
}

type Props = { params: Promise<{ slug: string }> }

/** Title-case a slug for display, null in / null out. */
function titleCaseSlug(slug: string | null | undefined): string | null {
  return slug ? slugToTitle(slug) : null
}

/** Visitor plat name. The MLS alias stays the ingest key; Triple → Triple Knot. */
function publishSubdivisionPageName(slug: string, registryMatch: { canonicalName: string } | null): string {
  const raw = registryMatch?.canonicalName ?? slugToTitle(slug)
  return publishPlatDisplayName(raw) ?? raw
}

// ---------------------------------------------------------------------------
// Metadata — unchanged, both branches
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  // The refusal owns its metadata: noindex, honest title, no canonical.
  if ((await loadSubdivisionCore(slug)).refused) return SUBDIVISION_UNAVAILABLE_METADATA
  const registryMatch = resolveRegistryAlias(slug)
  const name = publishSubdivisionPageName(slug, registryMatch)
  // Indexability threshold (W2.1): a plat earns index,follow only with a GIS
  // polygon AND at least SUBDIVISION_INDEX_MIN_LIFETIME_SALES lifetime closed
  // sales — the same set the sitemap submits and llms.txt enumerates. Below the
  // bar the page still renders, it just carries noindex.
  //
  // The same cached set carries each plat's citySlug (the city contributing the
  // most closed sales), so the title gets a REAL city from one read. §0: when
  // the city is genuinely unknown the page says nothing about it rather than
  // naming a place that does not exist.
  const indexableEntry = (await getIndexableSubdivisions()).find((s) => s.slug === slug)
  const cityName = registryMatch?.city ?? titleCaseSlug(indexableEntry?.citySlug)
  return pageMetadata({
    title: cityName
      ? `Homes for Sale in ${name} | ${cityName}, Oregon`
      : `Homes for Sale in ${name} | Central Oregon`,
    description: cityName
      ? `Active homes in ${name}, a subdivision in ${cityName}. Boundary map and live MLS listings.`
      : `Active homes in ${name}, a Central Oregon subdivision. Boundary map and live MLS listings.`,
    path: `/subdivisions/${slug}`,
    noindex: indexableEntry == null,
  })
}

// ---------------------------------------------------------------------------
// The shared resolution. React cache() dedups it between generateMetadata and
// the body, so the refusal verdict and the reads are computed once per request
// — the same architecture as resolveSubdivisionRoute before the v3 rebuild.
// ---------------------------------------------------------------------------
const loadSubdivisionCore = cache(async (slug: string) => {
  const [boundaryRead, inventoryRead, mtCounts] = await Promise.all([
    withTimeoutFallbackResult(
      getGeoBoundaryMapData({ geoType: 'subdivision', geoSlug: slug }),
      { polygon: null, pins: [] },
      4500,
      'sub:boundary',
    ),
    withTimeoutFallbackResult(getPlatPublicInventory(slug), null, 4500, 'sub:inventory'),
    withTimeoutFallback(getSubdivisionCounts(slug), EMPTY_SUBDIVISION_COUNTS, 3500, 'sub:mtCounts'),
  ])
  const boundary = boundaryRead.value
  const inventory = inventoryRead.ok ? inventoryRead.value : null
  const hasBoundary = Boolean(boundary.polygon)
  const registryMatch = resolveRegistryAlias(slug)

  // THE COUNTED SET. Same payload as the /subdivisions index tiles.
  const inventoryOk = inventory != null
  const countedKeys = inventoryOk ? inventory.listingKeys : []
  const boundaryListingKeys = inventoryOk ? countedKeys : boundary.pins.map((p) => p.listingKey)

  let mapTiles: Awaited<ReturnType<typeof getListingTiles>> = []
  if (boundaryListingKeys.length > 0) {
    const mapTilesRead = await withTimeoutFallbackResult(
      getListingTiles({
        listingKeys: boundaryListingKeys,
        status: 'active',
        propertyType: 'A',
        limit: 250,
      }),
      [],
      4500,
      inventoryOk ? 'sub:inventory-tiles' : 'sub:map-pins',
    )
    mapTiles = mapTilesRead.ok ? mapTilesRead.value : []
  }
  if (inventoryOk) {
    const allowed = new Set(countedKeys)
    mapTiles = mapTiles.filter((t) => allowed.has(t.listingKey))
  }

  // REFUSAL, not notFound(): under the streamed shell a throw ships a hollow
  // 200 with no <h1> — see SubdivisionUnavailable.tsx. Refuse only when all
  // three paths are empty AND both reads actually answered (§0: unknown is not
  // empty — a degraded read must not delete a real plat).
  const hasListings = mapTiles.length > 0
  const refused =
    !hasBoundary && !registryMatch && !hasListings && inventoryRead.ok && boundaryRead.ok

  return { boundaryRead, inventoryRead, mtCounts, boundary, inventory, hasBoundary, registryMatch, inventoryOk, countedKeys, mapTiles, refused }
})

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function SubdivisionPage({ params }: Props) {
  const { slug } = await params

  const { inventoryRead, mtCounts, boundary, inventory, hasBoundary, registryMatch, mapTiles, refused } =
    await loadSubdivisionCore(slug)
  if (refused) return <SubdivisionUnavailable />

  // ── NAME AND CITY ────────────────────────────────────────────────────────
  const displayName = publishSubdivisionPageName(slug, registryMatch)
  // Parent city for plain GIS plats (W2.4 parent cross-link): the MODAL city
  // among the plat's own in-boundary listings, already fetched — derived from
  // data, never guessed (§0). Claimed only when a strict majority agrees.
  const tileCityCounts = new Map<string, { citySlug: string | null; n: number }>()
  for (const t of mapTiles) {
    if (!t.city) continue
    const cur = tileCityCounts.get(t.city) ?? { citySlug: t.citySlug ?? null, n: 0 }
    cur.n += 1
    if (!cur.citySlug && t.citySlug) cur.citySlug = t.citySlug
    tileCityCounts.set(t.city, cur)
  }
  const modalTileCity = [...tileCityCounts.entries()].sort((a, b) => b[1].n - a[1].n)[0]
  const tileTotal = [...tileCityCounts.values()].reduce((s, v) => s + v.n, 0)
  const derivedPlatCity =
    modalTileCity && tileTotal > 0 && modalTileCity[1].n / tileTotal > 0.5
      ? { city: modalTileCity[0], citySlug: modalTileCity[1].citySlug }
      : null
  const cityName = registryMatch?.city ?? derivedPlatCity?.city ?? 'Central Oregon'
  const citySlug = registryMatch?.citySlug ?? derivedPlatCity?.citySlug ?? null
  const resortLabel = registryMatch?.resortLabel ?? null
  const resortSlug = registryMatch?.resortSlug ?? null
  const placeCity = cityName === 'Central Oregon' ? null : cityName

  // §0 UNKNOWN IS NOT ZERO. The inventory read is the only source for this
  // count; a read that did not answer leaves null, and null suppresses the claim
  // rather than publishing a zero under a live-MLS trace.
  const activeCount: number | null = inventory?.activeCount ?? null

  const platScope: PlatScope = hasBoundary
    ? { kind: 'boundary', displayName }
    : registryMatch
      ? { kind: 'registry', subdivisionName: registryMatch.canonicalName, city: registryMatch.city }
      : { kind: 'pins', displayName }

  // Split listings are the counted plat inventory, not a viewport fetch.
  // Seed a ring only when GIS actually stored a usable polygon. Ridge has
  // none historically — pin bbox is the camera, never a convex hull.
  const seedRing = hasRealPlatPolygon(boundary.polygon)
  const splitListings = mapTiles.map(toSplitListing)
  const pinBounds = boundsFromListingPins(mapTiles)
  const hasMap =
    seedRing || splitListings.some((row) => row.Latitude != null && row.Longitude != null)

  // ── THE REST OF THE READS. Every one of them reaches the screen. ─────────
  const [salesHistory, subdivisionStats, subdivisionSchools, placeDocuments, placeCharacter] =
    await Promise.all([
      withTimeoutFallback(getSubdivisionSalesHistory(slug), [], 4500, 'sub:sales-history'),
      withTimeoutFallback(
        getMarketStats({ geoType: 'subdivision', geoSlug: slug, periodType: 'ytd' }),
        null,
        4500,
        'sub:market-stats',
      ),
      registryMatch
        ? withTimeoutFallback(
            getSubdivisionSchools(registryMatch.city, registryMatch.canonicalName),
            [],
            4500,
            'sub:schools',
          )
        : Promise.resolve([]),
      withTimeoutFallback(getPlaceDocuments('subdivision', slug), [], 4500, 'sub:documents'),
      // Build years and HOA, measured from this plat's own member listings
      // (PLACE_CONTENT_RULES R1/R2/R3).
      withTimeoutFallback(getPlaceCharacter('subdivision', slug), null, 4500, 'sub:character'),
    ])

  // ── THE MARKET BAND READS ONE POPULATION AT A TIME ──────────────────────
  // THE PARENT PULSE IS NOT ONE OF THEM, AND MUST NOT COME BACK. A registry
  // plat has no market_pulse_live row; city and community pulse are other
  // geographies, and printing one next to "homes for sale in {plat}"
  // attributes Redmond's pending days to Ridge At Eagle Crest — the founding
  // case behind lib/market/publish-plat-figures.ts and ci:publish-plat-figures.
  // publishPlatFigures is the whole rule: the counted set's median may publish,
  // days-to-pending and 30-day sold withhold rather than borrow.
  const platFigures = publishPlatFigures({ platMedianListPrice: inventory?.medianListPrice })
  const face = publishPlaceFace({
    grain: 'subdivision',
    hud: null,
    active: activeCount,
    medianList: platFigures.medianListPrice,
  })

  // THE DOOR BEHIND THE FIGURE, PUBLISHED NOT ASSEMBLED. publishPlaceBrowseHref
  // returns null for anything that resolves to the unfiltered regional index, so
  // a plat whose browse path cannot be built loses the LINK rather than sending
  // a visitor to every home in Central Oregon under a plat's name (founding case
  // /subdivisions/ridge-at-eagle-crest, fleet 70b9cdad).
  const browseHref = publishPlaceBrowseHref(subdivisionListingsPath(cityName, displayName))

  const marketFigures: V3InstrumentFigure[] = []
  if (platFigures.medianListPrice != null) {
    marketFigures.push({
      value: v3Text(formatPriceExact(platFigures.medianListPrice)),
      label: v3Text('median list price'),
      ...(browseHref ? { href: browseHref } : {}),
    })
  }
  // Both of these are null by construction, and the two lines exist so the
  // withholding is visible in the file rather than implied by an absence.
  // A plat pulse would make them numbers; nothing else may.
  if (platFigures.medianDaysToPending != null) {
    marketFigures.push({
      value: v3Text(String(platFigures.medianDaysToPending)),
      label: v3Text('median days to pending'),
    })
  }
  if (platFigures.soldCount30d != null) {
    marketFigures.push({
      value: v3Text(String(platFigures.soldCount30d)),
      label: v3Text('closed in the last 30 days'),
    })
  }
  // The Market Truth recorded-plat counts, then the plat's own cache row. Each
  // figure keeps the label its own layer gave it, so nothing is relabeled on
  // the way onto the page.
  const countFigures: V3InstrumentFigure[] = subdivisionCountItems(mtCounts).map((item) => ({
    value: v3Text(item.value),
    label: v3Text(item.label),
  }))
  const cacheFigures = platStatsFigures(subdivisionStats)
  marketFigures.push(...countFigures, ...cacheFigures)

  const statsPeriodLabel = subdivisionStats ? PERIOD_LABEL[subdivisionStats.periodType] : ''
  const [firstPlatFigure, ...restPlatFigures] = marketFigures
  const salesChart = subdivisionSalesChart(displayName, salesHistory)

  // ONE SENTENCE PER POPULATION THAT ACTUALLY REACHED THE PAGE, and the sentences
  // are joined rather than concatenated: each trace is written to follow the word
  // "Source", so the second and third would otherwise open a sentence in lower
  // case in the middle of the line.
  const marketClauses = [
    platFigures.medianListPrice != null ? platInventoryTrace(platScope) : null,
    countFigures.length > 0 ? platCountsTrace(displayName) : null,
    cacheFigures.length > 0 ? platStatsTrace(displayName, cityName, statsPeriodLabel) : null,
  ].filter((clause): clause is string => clause !== null)
  const marketTrace = marketClauses
    .map((clause, i) => (i === 0 ? clause : `${clause.charAt(0).toUpperCase()}${clause.slice(1)}`))
    .join(' ')

  // ── THE CLOSING BLOCK'S OUTBOUND EDGES ───────────────────────────────────
  const edges = buildSubdivisionEdges({
    displayName,
    cityName,
    citySlug,
    resortLabel,
    resortSlug,
    placeContext: subdivisionPlaceContext({ cityName, citySlug, displayName, slug }),
    lifestyleItems: lifestyleForCentroid(mapCentroid(mapTiles)),
    peerPlats: peerPlatsForResort(resortSlug, slug),
    browseHref,
    marketHref: citySlug ? `/housing-market/${citySlug}/${slug}` : '/housing-market',
    pagePath: `/subdivisions/${slug}`,
  })

  // ── JSON-LD. Same types, same payloads, same hasMap condition. ───────────
  const placeDescription = placeCity
    ? `Homes for sale in ${displayName}, a subdivision in ${placeCity}, with a boundary map and live listings.`
    : `Homes for sale in ${displayName}, a subdivision in Central Oregon, with a boundary map and live listings.`
  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Communities', url: '/communities' },
        ...(resortSlug
          ? [{ name: resortLabel ?? displayName, url: `/communities/${resortSlug}` }]
          : citySlug
            ? [{ name: cityName, url: `/cities/${citySlug}` }]
            : []),
        { name: displayName, url: `/subdivisions/${slug}` },
      ],
    },
    {
      type: 'place',
      placeType: 'Place',
      name: displayName,
      description: placeDescription,
      url: `/subdivisions/${slug}`,
      address: placeCity ? { city: placeCity, state: 'OR', country: 'US' } : undefined,
      containedInPlace: placeCity ?? undefined,
      hasMap: hasMap ? `/subdivisions/${slug}` : undefined,
    },
  ]

  const inventorySource = homesLedgerTrace(platScope)
  const splitCity = placeCity ?? undefined
  const splitSubdivision = registryMatch?.canonicalName ?? displayName
  const placeQuery = splitCity ? `${displayName} ${splitCity} Oregon` : `${displayName} Oregon`

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <MetadataBlock schemas={schemas} />
        <V3SectionTracker />

        <V3Breadcrumb
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Communities', href: '/communities' },
            ...(resortSlug
              ? [{ label: resortLabel ?? displayName, href: `/communities/${resortSlug}` }]
              : citySlug
                ? [{ label: cityName, href: `/cities/${citySlug}` }]
                : []),
            { label: displayName },
          ]}
        />

        <div id="overview" className="place-opening">
          <V3Heading level={1} size="field">
            {`${displayName} homes for sale`}
          </V3Heading>
          <PlaceFaceStrip stats={face.stats} />
          <V3SourceLine source={inventorySource} />
        </div>

        <div id="homes">
          <PlaceSplitView
            city={splitCity}
            subdivision={splitSubdivision}
            boundaryGeojson={seedRing ? boundary.polygon : null}
            seedRing={seedRing}
            placeQuery={placeQuery}
            listings={splitListings}
            totalCount={activeCount ?? splitListings.length}
            bounds={seedRing ? undefined : pinBounds ?? undefined}
            degraded={!inventoryRead.ok}
          />
        </div>

        {/* Pattern 6, Quiet — the assigned schools and every outbound edge this
            page carries. ci:subdivision-stats-integrity requires this component
            by name. */}
        <SubdivisionSchools displayName={displayName} schools={subdivisionSchools} edges={edges} />

        {/* Pattern 1, Instrument — the plat's own market, one population. */}
        {firstPlatFigure ? (
          <V3Instrument
            id="market-report"
            level={2}
            eyebrow={v3Text(
              statsPeriodLabel ? `${displayName} · ${statsPeriodLabel}` : `${displayName} · Market`,
            )}
            headline={v3Text(`${displayName} on record`)}
            figures={[firstPlatFigure, ...restPlatFigures]}
            source={v3Text(marketTrace)}
            updated={
              subdivisionStats?.refreshedAt
                ? v3Text(formatDate(subdivisionStats.refreshedAt))
                : undefined
            }
            chart={salesChart}
          />
        ) : null}

        {/* Pattern 3, Ledger — one row per calendar year, every row a door, with
            the approved chart-room cards inside the same market section. */}
        <SubdivisionSalesHistory
          displayName={displayName}
          history={salesHistory}
          cityName={cityName}
          chart={firstPlatFigure ? undefined : salesChart}
          charts={
            <SubdivisionMarketCharts
              slug={slug}
              platName={displayName}
              citySlug={citySlug}
              cityName={cityName}
              resortSlug={resortSlug}
              history={salesHistory}
            />
          }
        />

        {/* Pattern 6, Quiet — build years and HOA as sentences, because
            PLACE_CONTENT_RULES R1-R3 forbid publishing them as bare figures. */}
        <V3PlaceCharacter placeName={displayName} character={placeCharacter} />

        {/* Pattern 3, Ledger — recorded instruments, every row a door. */}
        <SubdivisionDocuments displayName={displayName} documents={placeDocuments} />

        {/* Pattern 1 again, as ONE enumeration: a section per other property
            type the plat holds. The registry withholds price and months of
            supply below neighbourhood grain, so a plat supplies counts alone,
            and a type with no counts never reaches the component. */}
        <V3PlacePropertyTypes
          placeName={displayName}
          citySlug={citySlug}
          rows={mtCounts.extras}
        />

      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo
          only when it is NOT nested in sectioning content, and <main> is
          sectioning content, so inside it the element is a generic and the page
          ships no contentinfo landmark. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
