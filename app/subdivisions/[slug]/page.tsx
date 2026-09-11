// @no-static-params — build-time fan-out budgeted to zero (ci:ssg-budget); ISR on demand
/**
 * /subdivisions/[slug] — the plat grain, on the components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md §3. First screen is
 * H1 the plat name + living atlas + PlaceSplitView, the same composition as
 * city / neighborhood / community. Atlas is the inventory graphic. The atlas
 * ring is this place (self). Do not cage that screen in V3Stage or V3Field.
 * Never say "plat" in visitor copy. Giant 0 is forbidden on a timed-out read.
 * Schools sit after the Split when the MLS modal actually publishes. Section
 * order is the parity contract at
 * design_system/ryan-realty/ui_kits/subdivision/parity.json.
 *
 * THE RHYTHM RULE AND CONDITIONAL SECTIONS, DECLARED RATHER THAN HIDDEN. Four
 * of this page's sections render only when their data exists, and no ordering
 * of four independent conditionals over four patterns can guarantee "no two
 * adjacent sections share a pattern" for every combination. The order below is
 * correct when the data is present and degrades to at worst one repeated pair;
 * the alternative is dropping a section the data supports, which §0 forbids.
 *
 * NO-404 CONTRACT. For each incoming slug the page tries the resolution paths
 * in order and renders when ANY succeeds:
 *   1. GIS boundary — getGeoBoundaryMapData geoType='subdivision' returns a polygon.
 *   2. Registry alias — data/resort-communities.json subdivision_aliases holds a
 *      match (slugify(alias) === slug).
 *   3. Active listings — getPlatPublicInventory (REGISTRY plats only) or, for a
 *      plain recorded plat, a direct SFR + PUBLIC_ACTIVE tile read on the
 *      slug's MLS SubdivisionName (path 3b in loadSubdivisionCore).
 * The refusal fires ONLY when every path is empty AND every read succeeded.
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
 * tracker, force-dynamic rendering (see the route-config comment), dynamicParams
 * true, generateStaticParams returning [], and maxDuration 60. MetadataBlock stays on the legacy register: JSON-LD is not
 * visual language and ci:ai-structured-data pins this route to it by name.
 *
 * FIVE POPULATIONS, FIVE TRACES (CLAUDE.md §0). Every sentence that describes
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
 *   5. The plat's LIFETIME closed count and its year series — the
 *      subdivision_plat_closed_mv union, attributed by the sale's coordinates
 *      falling inside the recorded plat polygon and by the MLS name, counted
 *      once either way (SITE-24). Populations 3 and 4 are name joins, so they
 *      are EMPTY for every sub-plat of a resort — every home inside Golf Homes
 *      At Tetherow is filed under "Tetherow" — and this is the only one of the
 *      five such a page can state anything from. It is counts only; a
 *      closed-price statistic at plat grain stays withheld.
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
import { getAreaGuideVideo, getBoundaryGeoJSON, getGeoBoundaryMapData, getListingTiles, getMarketStats } from '@/lib/data'
import { areaGuideRow } from '@/app/cities/[slug]/_v3/city-sections'
import { areaGuideLookupSlugs, areaGuideVideoSchema } from '@/lib/site/area-guide-schema'
import { cityStagePoster, placeLibraryHero } from '@/app/cities/[slug]/_v3/city-opening'
import {
  placeCostChart,
  platRecentClosedCount,
  TOO_FEW_SALES_LINE,
} from '@/app/cities/[slug]/_v3/place-graphics'
import { communityImage } from '@/lib/geo-images'
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
import { getPlatClosedCount } from '@/lib/data/subdivisions/getPlatClosedCounts'
import { getPlatUnsoldOutcome } from '@/lib/data/subdivisions/getPlatUnsoldOutcomes'
import { getDetachedOverlays } from '@/lib/data/market-truth/getSellBendMarket'
import { publishPlatUnsold } from '@/lib/site/publish-plat-unsold'
import { getPlatBoundaryCity } from '@/lib/data/subdivisions/getPlatBoundaryCity'
import { platPageTitle } from './_v3/plat-title'
import { platCaption } from './_v3/plat-caption'
import './_v3/plat-opening.css'
import './_v3/plat-fold.css'
import { SubdivisionAlertsStrip } from './_v3/SubdivisionAlertSheet.client'
import { platNewCount30dFromTiles } from './_v3/plat-fold-figures'
import { buildPlaceAlertTypes } from '@/lib/site/place-alerts'
import { publishStreetLine } from '@/lib/listing/publish-street-line'
import { getSubdivisionSalesHistory } from '@/lib/data/subdivisions/getSubdivisionSalesHistory'
import { getSubdivisionSchools } from '@/lib/data/subdivisions/getSubdivisionSchools'
import { getPlaceDocuments } from '@/lib/data/places/getPlaceDocuments'
import { getPlaceCharacter } from '@/lib/data/places/getPlaceCharacter'
import { publishPlatDisplayName } from '@/lib/market/publish-plat-display-name'
import { publishPlaceFace } from '@/lib/market/publish-place-face'
import { publishPlatFigures } from '@/lib/market/publish-plat-figures'
import { pageMetadata } from '@/lib/site/page-metadata'
import { answersFaqItems, buildPlaceAnswers } from '@/lib/site/place-answers'
import { valuationHref } from '@/lib/site/valuation-href'
import { subdivisionPageTrail } from '@/lib/site/place-trail'
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
  V3Ledger,
  V3Answers,
  V3PlaceCharacter,
  V3SectionTracker,
  V3SourceLine,
  V3Button,
  type V3InstrumentFigure,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { V3Atlas, V3Quiet, type AtlasRegion } from '@/components/site/v3'
import { getTaxlotsInBoundary, getTaxlotsNear, TAXLOT_DISCLAIMER } from '@/lib/data'
import { buildPlaceAtlas, EMPTY_PLACE_ATLAS } from '@/lib/atlas/build-place-atlas'
import { PlaceAreaHero } from '@/components/place/PlaceAreaHero'
import { PlaceTypeSlider } from '@/components/place/PlaceTypeSlider'
import { PlaceSplitView } from '@/components/search/PlaceSplitView'
import {
  placeTypeCoverPhotos,
  publishPlaceTypeCards,
} from '@/lib/place/publish-place-type-cards'
import { loadPlaceTypeCoverPhotos } from '@/lib/place/load-place-type-covers'
import { getPublicPlaceSegments } from '@/lib/data/market-truth/public-segments'
import { overlaysFromRegions } from '@/lib/place/child-rings'
import { SubdivisionSalesHistory } from './SubdivisionSalesHistory'
import { SubdivisionSchools } from './SubdivisionSchools'
import { SubdivisionDocuments } from './SubdivisionDocuments'
import { SubdivisionMarketCharts } from './_v3/SubdivisionMarketCharts'
import { buildSubdivisionEdges } from './_v3/subdivision-edges'
import { platClosedYearChart, platStatsFigures, subdivisionSalesChart } from './_v3/subdivision-figures'
import { resolveRegistryAlias, slugToTitle } from './_v3/subdivision-registry'
import { boundsFromListingPins, hasRealPlatPolygon, toSplitListing } from './_v3/subdivision-split'
import {
  homesLedgerTrace,
  PERIOD_LABEL,
  platCountsTrace,
  platInventoryTrace,
  platLifetimeClosedTrace,
  platStatsTrace,
  PLAT_FEED,
  salesHistoryTrace,
  type PlatScope,
} from './_v3/subdivision-traces'
import { basemapForFrame, basemapForRegions, bboxOfGeometry } from '@/lib/geo/basemap-source'
import { outerRings } from '@/lib/geo/project-svg'
import {
  ATLAS_FRAME_PAD,
  bboxOfPoints,
  platFrame,
  platGround,
} from './_v3/plat-ground'
import { platListingPhoto, platOpeningPhoto } from './_v3/plat-opening-image'
import {
  footprintProvenance,
  getSubdivisionFootprint,
  type PlatFootprint,
} from '@/lib/data/subdivisions/getSubdivisionFootprint'
import { getPlatFootprintTaxlots } from '@/lib/data/subdivisions/getPlatFootprintTaxlots'

export const dynamicParams = true
// ISR ON DEMAND (SITE-29, 2026-09-09). This route was `force-dynamic` from
// 2026-09-01 as the fix for the fleet's oldest silent 500: PlaceSplitView read
// the visitor's session during server render, so under `revalidate` every
// runtime request attempted a static render, cookies() threw
// DYNAMIC_SERVER_USAGE, and every /subdivisions/* URL served a 500 from
// 2026-07-15 to 2026-09-01. Both reads are gone: the session moved behind
// the client (use-viewer-listing-state, 2026-09-01) and the page no longer
// awaits searchParams (the split view is a static shell whose URL filters
// apply after mount). The render tree now reads NO request state, which is
// the condition `revalidate` needs: the first hit renders and caches, later
// hits are served from the cache and refreshed every 60s. Held by the
// structural test in components/search/__tests__/static-shell-url-params.
export const revalidate = 60
// Worst-case first render chains sequential timeout-capped stages, above
// Vercel's 15s default function cap.
export const maxDuration = 60

// Build-time prerender is intentionally empty (ci:ssg-budget). The ~100 alias
// pages each chain sequential timeout-capped Supabase stages; prerendering them
// was the largest single cost of `next build` on Vercel and, when queries timed
// out under build concurrency, baked empty rails into the deployed HTML. With
// dynamicParams=true and force-dynamic rendering every URL still serves.
export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return []
}

type Props = {
  params: Promise<{ slug: string }>
}

/**
 * The plat's parent city, derived from the plat's OWN in-boundary listings —
 * the modal city among them, claimed only on a strict majority. Data, never a
 * guess (§0). Shared by generateMetadata and the body so a noindexed plat's
 * title names its real city instead of falling back to "Central Oregon"
 * (SITE-25).
 */
function derivePlatCity(
  tiles: ReadonlyArray<{ city?: string | null; citySlug?: string | null }>,
): { city: string; citySlug: string | null } | null {
  const counts = new Map<string, { citySlug: string | null; n: number }>()
  for (const t of tiles) {
    if (!t.city) continue
    const cur = counts.get(t.city) ?? { citySlug: t.citySlug ?? null, n: 0 }
    cur.n += 1
    if (!cur.citySlug && t.citySlug) cur.citySlug = t.citySlug
    counts.set(t.city, cur)
  }
  const modal = [...counts.entries()].sort((a, b) => b[1].n - a[1].n)[0]
  const total = [...counts.values()].reduce((s, v) => s + v.n, 0)
  if (!modal || total === 0 || modal[1].n / total <= 0.5) return null
  return { city: modal[0], citySlug: modal[1].citySlug }
}

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
// Metadata — same two branches; the city now has a third source (SITE-25).
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
  //
  // A plat below the indexability bar has no entry, and resolving the city ONLY
  // from the indexable set is what titled every noindexed plat "| Central
  // Oregon" while its own listings named a real city. The boundary read the
  // route already performs (cache()d, so this costs nothing) is the third
  // source: the modal city of the plat's own in-boundary listings.
  //
  // The fourth source is the county plat tree itself (SITE-25 follow-up): a
  // plat with no listing on record — courtyard-garages-at-broken-top, a garage
  // tract with zero sales inside it — has no listing-derived city at all, but
  // its polygon sits inside a neighborhood polygon inside the Bend city polygon.
  const indexableEntry = (await getIndexableSubdivisions()).find((s) => s.slug === slug)
  const cityName =
    registryMatch?.city ??
    titleCaseSlug(indexableEntry?.citySlug) ??
    derivePlatCity((await loadSubdivisionCore(slug)).mapTiles)?.city ??
    (await getPlatBoundaryCity(slug))?.city ??
    null
  return pageMetadata({
    title: platPageTitle(name, cityName),
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

  // PATH 3b — plain recorded plats. getPlatPublicInventory serves REGISTRY
  // plats only (getRegistryPlatPublicInventory), so the docblock's third
  // resolution path could never rescue a DB-only plat: one with live SFR
  // homes but no polygon and no alias refused as "No subdivision at this
  // address" while its neighborhood card advertised the active (Pettigrew
  // Place, 2026-09-01). Query the MLS name directly — the slug's only real
  // transform is spaces→hyphens, so hyphens→spaces inverts it for every
  // unpunctuated name; a name that does not round-trip (its own hyphen,
  // an ampersand) simply is not rescued, which refuses rather than guesses.
  // Same population as every other path: SFR, PUBLIC_ACTIVE.
  let nameTilesRead: { value: Awaited<ReturnType<typeof getListingTiles>>; ok: boolean } | null = null
  if (!hasBoundary && !registryMatch && mapTiles.length === 0) {
    nameTilesRead = await withTimeoutFallbackResult(
      getListingTiles({
        subdivision: slug.replace(/-/g, ' '),
        propertySubType: 'Single Family Residence',
        status: 'active',
        limit: 250,
      }),
      [],
      4500,
      'sub:name-tiles',
    )
    if (nameTilesRead.ok && nameTilesRead.value.length > 0) mapTiles = nameTilesRead.value
  }

  /* THE RECORDED FOOTPRINT, WHEN THE EXACT SLUG MISSED (SITE-56).
     The MLS files a COARSER name than the county records a plat under, so
     `boundary_geojson` at this slug finds nothing for a fifth of the class
     while the polygons sit in the same table under longer names. Measured
     2026-09-09 over the 1,087 distinct SubdivisionName values on the 3,572
     active single-family listings: 175 exact, 208 more whose recorded PHASES
     carry the name, 74 more whose own homes already name the plat they were
     classified into. Diamond Bar Ranch is the founding case — four recorded
     plats, one listing already stamped 'Diamond Bar Ranch Phase 1', and a page
     that opened on cream over a collapsed frame because the county never filed
     a plat called exactly that.

     Read ONLY when the exact slug missed, and after the tiles, because the
     third resolution path is the `boundary_subdivision` the tiles carry. */
  const footprintRead = hasBoundary
    ? null
    : await withTimeoutFallbackResult(
        getSubdivisionFootprint({
          slug,
          memberNames: mapTiles.map((t) => t.boundarySubdivision),
        }),
        null,
        4500,
        'sub:footprint',
      )
  const footprint: PlatFootprint | null = footprintRead?.ok ? footprintRead.value : null

  // REFUSAL, not notFound(): under the streamed shell a throw ships a hollow
  // 200 with no <h1> — see SubdivisionUnavailable.tsx. Refuse only when all
  // resolution paths are empty AND every read actually answered (§0: unknown
  // is not empty — a degraded read must not delete a real plat). The recorded
  // footprint is a fourth path: a plat whose phases are on file is a real
  // place whether or not one of its homes happens to be for sale today.
  const hasListings = mapTiles.length > 0
  const refused =
    !hasBoundary &&
    !registryMatch &&
    !hasListings &&
    footprint == null &&
    inventoryRead.ok &&
    boundaryRead.ok &&
    (footprintRead == null || footprintRead.ok) &&
    (nameTilesRead == null || nameTilesRead.ok)

  return { boundaryRead, inventoryRead, mtCounts, boundary, footprint, inventory, hasBoundary, registryMatch, inventoryOk, countedKeys, mapTiles, refused }
})

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function SubdivisionPage({ params }: Props) {
  const { slug } = await params

  const { inventoryRead, mtCounts, boundary, footprint, inventory, hasBoundary, registryMatch, mapTiles, refused } =
    await loadSubdivisionCore(slug)
  if (refused) return <SubdivisionUnavailable />

  // ── NAME AND CITY ────────────────────────────────────────────────────────
  const displayName = publishSubdivisionPageName(slug, registryMatch)
  // Parent city for plain GIS plats (W2.4 parent cross-link): the MODAL city
  // among the plat's own in-boundary listings, already fetched — derived from
  // data, never guessed (§0). Claimed only when a strict majority agrees.
  const derivedPlatCity = derivePlatCity(mapTiles)
  // Fourth source, the county plat tree (see generateMetadata). Cached per
  // slug, so the head and the body read it once.
  //
  // READ UNCONDITIONALLY SINCE SITE-47, and the CITY PRECEDENCE IS UNCHANGED.
  // The walk is also the only source for the NEIGHBORHOOD between this plat and
  // its city — the container the opening's sentence names on a city plat — and
  // that fact is wanted whether or not a listing-derived city already answered.
  // It is a cached walk of at most five single-row reads per slug, and it stays
  // BEHIND registry and listing-derived city, so no page's title or breadcrumb
  // moves because of this line.
  const boundaryCity = await withTimeoutFallback(
    getPlatBoundaryCity(slug),
    null,
    2500,
    'sub:boundaryCity',
  )
  const cityName = registryMatch?.city ?? derivedPlatCity?.city ?? boundaryCity?.city ?? 'Central Oregon'
  const citySlug = registryMatch?.citySlug ?? derivedPlatCity?.citySlug ?? boundaryCity?.citySlug ?? null
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
      ? // The PUBLISHED name, not the raw MLS alias. The alias capitalises every
        // word, so the traces under the figures read "Ridge At Eagle Crest" while
        // the H1 above them read "Ridge at Eagle Crest" — one place, two spellings,
        // on one page (evaluator, 2026-09-08). The trace still names the MLS
        // SUBDIVISION NAME as the membership rule; only its casing is the page's.
        { kind: 'registry', subdivisionName: displayName, city: registryMatch.city }
      : { kind: 'pins', displayName }

  /* THE POLYGON THIS PAGE DRAWS (SITE-56). The exact-slug row when the county
     filed one under this page's own name, and otherwise the recorded FOOTPRINT
     — its phases unioned into one shape, or the plats its own homes were
     classified into. Both come out of public.boundaries through PostGIS; the
     page never joins geometry itself, and never hulls pins into a fake plat.
     What the shape IS travels with it as a sentence (footprintProvenance) and
     is printed under the map, because a drawn boundary is a claim (§0). */
  const platPolygon = boundary.polygon ?? footprint?.geometry ?? null
  const footprintNote = footprint ? footprintProvenance(footprint, displayName) : null
  // Split listings are the counted plat inventory, not a viewport fetch.
  // Seed a ring only when GIS actually stored a usable polygon. Ridge has
  // none historically — pin bbox is the camera, never a convex hull.
  const seedRing = hasRealPlatPolygon(platPolygon)
  // The living map, scoped to the plat: every listing inside its recorded
  // polygon. Needs a real polygon and a known city (the read is city-scoped).
  // A plat the county never filed has no polygon, and the page used to render
  // a map with no outline, no dots and the sentence a failed read prints —
  // three of the four Redmond plats measured in production (evaluator round
  // five, SUBDIVISION-CHART-7). Nothing had failed: there is no boundary. The
  // map is then framed by the plat's own listings, the same counted set the
  // rest of the page uses, selected by key.
  // Something to map: a recorded polygon, or listings we can frame. With
  // neither, the section is omitted rather than rendering the sentence a
  // failed read prints — a plat with no boundary and no listings has nothing
  // to draw, and nothing failed.
  const canMapAtlas = placeCity != null && (Boolean(seedRing && platPolygon) || mapTiles.length > 0)
  /* THE FRAME, WITH A REAL SPAN (SITE-56). A single home has no extent, and
     framing the map by the dots' own extent collapsed the projection: the
     stage shipped viewBox="0 0 1000 NaN" and every road path read
     "MInfinity -Infinity", so the frame sampled flat cream at nine points
     (/subdivisions/diamond-bar-ranch, lane server, 2026-09-09). The frame is
     the plat's footprint when it has one and the box holding its homes when it
     does not, widened on a ladder until the compiled TIGER basemap actually
     draws the streets around it — see ./_v3/plat-ground.ts. */
  const platHomePoints = mapTiles
    .filter((t) => t.lat != null && t.lng != null)
    .map((t) => ({ lat: t.lat as number, lng: t.lng as number }))
  const frame = platFrame(
    (platPolygon ? bboxOfGeometry(platPolygon) : null) ?? bboxOfPoints(platHomePoints),
  )
  // The lots inside the plat: what a plat actually is. Capped, simplified
  // server-side, and only where the county has a recorded boundary to clip to.
  // No `hasBoundary` gate: the page reads its boundary as geo_type
  // 'subdivision', and a registry community like Tetherow files its polygon
  // under 'neighborhood', so the gate was false on exactly the plats with the
  // most lots. The RPC finds the row by slug and returns nothing when there is
  // none, which is the same answer at one indexed query.
  /* A PLAT THE COUNTY NEVER FILED STILL HAS LOTS (SITE-56). With no polygon to
     clip to, the parcels come from a RADIUS around the plat's own homes — the
     lot fabric they stand in. They are NOT a boundary and the source line says
     so in as many words; without them the map of an unrecorded plat is a dozen
     marks on empty cream (measured at /subdivisions/willowbrook, 2026-09-09:
     the frame sampled one colour at nine points). */
  const nearLotsCentre = !seedRing && frame ? frame : null
  const nearLotsRadiusM = nearLotsCentre
    ? Math.min(1500, Math.round(nearLotsCentre.latSpanDeg * (1 + 2 * ATLAS_FRAME_PAD) * 111_320 * 0.6))
    : 0
  const platLots = await withTimeoutFallback(
        (footprint && footprint.source !== 'exact'
          ? // The footprint has no boundaries row of its own: clip to each
            // recorded part instead (SITE-56).
            getPlatFootprintTaxlots({ partSlugs: footprint.partSlugs, maxLots: 320 })
          : nearLotsCentre
            ? getTaxlotsNear({
                lat: (nearLotsCentre.bbox.minLat + nearLotsCentre.bbox.maxLat) / 2,
                lng: (nearLotsCentre.bbox.minLon + nearLotsCentre.bbox.maxLon) / 2,
                radiusMeters: nearLotsRadiusM,
                maxLots: 320,
              })
            : getTaxlotsInBoundary({ geoType: null, geoSlug: slug, maxLots: 320 })
        ).catch((err) => {
          // Fail-open, but never silent: a lot line must not break a page, and
          // an empty parcel layer that nobody logged is how this shipped
          // drawing nothing for a day.
          console.error('[subdivision] plat lots failed', { slug, err })
          return []
        }),
    [],
    8000,
    'sub:taxlots',
  )
  /* THE DOTS. Inside the recorded polygon when there is one — what a visitor
     means by "in Diamond Bar Ranch" — and the MLS-filed set when there is not.
     A polygon that keeps NOTHING while the page holds homes is a scope this
     map cannot draw (the homes' MLS city and the polygon can disagree), so it
     falls back to the filed set rather than shipping an outline with no marks
     inside it; buildPlaceAtlas says which population it drew either way. */
  const atlasScope = seedRing && platPolygon
    ? { cities: [placeCity as string], boundary: platPolygon, label: displayName }
    : { cities: [placeCity as string], label: displayName, listingKeys: mapTiles.map((t) => t.listingKey) }
  let atlas = canMapAtlas && placeCity != null
    ? await withTimeoutFallback(buildPlaceAtlas(atlasScope), null, 6000, 'sub:atlas')
    : null
  if (atlas && atlas.dots.length === 0 && mapTiles.length > 0 && 'boundary' in atlasScope) {
    atlas = await withTimeoutFallback(
      buildPlaceAtlas({
        cities: [placeCity as string],
        label: displayName,
        listingKeys: mapTiles.map((t) => t.listingKey),
      }),
      atlas,
      6000,
      'sub:atlas-filed',
    )
  }
  /* THE TOWN, WHEN THE PLAT HAS NO SHAPE OF ITS OWN (SITE-56). A map of a
     dozen marks on empty ground does not tell a reader where they are: the
     silhouette of the city does, and it is the same recorded polygon
     /cities/{slug} draws. Only on the unrecorded path — a plat with its own
     outline is its own subject and does not want a second shape under it. */
  const cityRegionPolygon =
    !seedRing && citySlug
      ? await withTimeoutFallback(
          getBoundaryGeoJSON({ geoType: 'city', geoSlug: citySlug }),
          null,
          3000,
          'sub:cityRegion',
        )
      : null
  const atlasRegions: AtlasRegion[] =
    seedRing && platPolygon
      ? [{ id: `subdivision:${slug}`, kind: 'town', kindLabel: 'Subdivision', name: displayName, href: `/subdivisions/${slug}`, geometry: platPolygon }]
      : cityRegionPolygon && citySlug && placeCity
        ? [{ id: `city:${citySlug}`, kind: 'town', kindLabel: 'City', name: placeCity, href: `/cities/${citySlug}`, geometry: cityRegionPolygon }]
        : []
  const splitListings = mapTiles.map(toSplitListing)
  const pinBounds = boundsFromListingPins(mapTiles)
  const hasMap =
    seedRing || splitListings.some((row) => row.Latitude != null && row.Longitude != null)

  // ── THE REST OF THE READS. Every one of them reaches the screen. ─────────
  const [
    salesHistory,
    subdivisionStats,
    subdivisionSchools,
    placeDocuments,
    placeCharacter,
    publicSegments,
    platClosed,
    platUnsold,
  ] = await Promise.all([
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
      withTimeoutFallback(
        getPublicPlaceSegments({ geoType: 'neighborhood', geoSlug: slug }),
        [],
        3000,
        'sub:publicSegments',
      ),
      // POPULATION 5 (SITE-24): the plat's lifetime closed count, attributed by
      // point-in-polygon first and by MLS name second, unioned. It is the same
      // read the indexability gate makes, off the same 6h cache, so the figure
      // the page prints and the verdict the robots tag publishes can never
      // disagree. null on a miss — the figure is then absent, never a zero.
      withTimeoutFallback(getPlatClosedCount(slug), null, 4500, 'sub:platClosed'),
      // POPULATION 6 (SITE-55): the other half of the same question. The plat's
      // twelve-month DID-NOT-SELL aggregate, attributed the same two ways the
      // closed count is, from public.subdivision_plat_unsold_mv. null is the
      // clean case — the MV writes a row only where something came off unsold —
      // and the publisher says so in words rather than hiding the section.
      withTimeoutFallback(getPlatUnsoldOutcome(slug), null, 4500, 'sub:platUnsold'),
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
  const typeCovers = placeCity
    ? await withTimeoutFallback(
        loadPlaceTypeCoverPhotos({ city: placeCity, subdivision: displayName }),
        {},
        4500,
        'sub:typeThumbs',
      )
    : {}
  const typeCards = publishPlaceTypeCards({
    browsePath: placeCity ? subdivisionListingsPath(placeCity, displayName) : '/homes-for-sale',
    placeName: displayName,
    sfrCount: activeCount,
    sfrMedian: platFigures.medianListPrice,
    sfrMos: null,
    segments: publicSegments,
    covers: { ...placeTypeCoverPhotos(splitListings), ...typeCovers },
  })
  const headline = displayName
  const platLibraryHeroUrl = await withTimeoutFallback(
    placeLibraryHero('subdivision', slug),
    null,
    3000,
    'sub:libraryHero',
  )
  /* THE PLAT OPENS ON A PHOTOGRAPH, AND SAYS WHOSE IT IS (SITE-08 pass 2).
     A plat's own still is a dedicated image or a geo-strict library hero, and
     for most of the 3,213 recorded plats there is neither: /subdivisions/
     ridge-at-eagle-crest opened on cream type above a hairline map and nothing
     else, which the evaluator called the thinnest of the three place classes
     and scored accordingly.

     The honest photograph a plat with no still of its own can carry is the
     RESORT IT SITS INSIDE — Ridge At Eagle Crest is in Eagle Crest, the
     registry says so, and the page already links that overview from its
     breadcrumb and its doors. It is used only when the plat is registered to a
     resort, and it is CAPTIONED with the resort's name, so nothing on the page
     implies the frame was taken on this plat. Never a city photo, never
     another plat's, never a listing photo standing in for a place (§0 applies
     to a picture that makes a claim exactly as it applies to a number).

     SITE-56 CONTINUES THE LADDER PAST THE RESORT, because the two rungs above
     leave most of the class on cream — Matt, reading the page the expired CMA
     links: "There's no map on the diamond bar sub page and no photo." Rung 3
     is one of the plat's OWN HOMES, captioned with that listing's address so
     nothing implies the frame is of the subdivision; rung 4 is the plat's own
     GROUND, drawn from the same public-domain TIGER geometry the Atlas draws,
     captioned as a drawing. The refusal above is unchanged and still absolute:
     never a city photograph, never another plat's, and never a listing
     photograph standing in for the place UNNAMED. See ./_v3/plat-opening-image.ts. */
  const platOwnPoster = cityStagePoster(communityImage(slug), platLibraryHeroUrl)
  const resortPoster = platOwnPoster ? null : resortSlug ? communityImage(resortSlug) : null
  /* The opening's drawn ground: the plat's own frame, its recorded outline when
     it has one, and its homes as marks. Built only when the rungs above have
     nothing, so a plat with a photograph pays nothing for it. */
  const platGroundSrc =
    platOwnPoster || resortPoster || frame == null
      ? null
      : (platGround({
          // The box a reader sees, not the box the Atlas is handed: the homes
          // sit inside the padded frame, and the hero must not crop them.
          frame: frame.visibleBbox,
          rings: platPolygon ? outerRings(platPolygon) : [],
          homes: platHomePoints,
        })?.src ?? null)
  const openingPhoto = platOpeningPhoto({
    ownPosterSrc: platOwnPoster,
    resortPosterSrc: resortPoster,
    resortLabel,
    listingPhoto: platListingPhoto(mapTiles),
    groundSrc: platGroundSrc,
  })
  const stagePosterSrc = openingPhoto?.src ?? null

  // THE DOOR BEHIND THE FIGURE, PUBLISHED NOT ASSEMBLED. publishPlaceBrowseHref
  // returns null for anything that resolves to the unfiltered regional index, so
  // a plat whose browse path cannot be built loses the LINK rather than sending
  // a visitor to every home in Central Oregon under a plat's name (founding case
  // /subdivisions/ridge-at-eagle-crest, fleet 70b9cdad).
  const browseHref = publishPlaceBrowseHref(subdivisionListingsPath(cityName, displayName))

  /* THE OPENING'S SENTENCE (SITE-47). One authored sentence per SETTING, from
     ./_v3/plat-caption.ts — not the interpolated fragment
     "${resortLabel}, the resort ${displayName} sits inside." that the taste
     table of 2026-09-08 named as a template, and not only on the plats that
     borrowed a resort photograph: three of the four plats measured on this
     route rendered no caption at all, so the H1 sat directly on the Atlas
     headline and the class opened on two display lines and nothing else.

     §0, AND THE COUNT IS THE PAGE'S OWN. `captionActive` is the number this
     page RENDERS, on whichever resolution path found it — the counted set on a
     registry plat, the in-boundary single-family tiles PlaceSplitView lists on
     a recorded plat. Both are covered by the opening's own source chip
     (homesLedgerTrace) and both are the set the browse door opens, so the
     sentence, the chip, the door and the list cannot disagree. Positive only:
     a short read leaves the same empty array an empty plat leaves, and the
     composer drops the clause rather than publishing a zero. */
  const captionActive = activeCount ?? (mapTiles.length > 0 ? mapTiles.length : null)
  const posterCaption = platCaption({
    displayName,
    resortLabel,
    neighborhoodLabel: boundaryCity?.neighborhood?.label ?? null,
    cityName: placeCity,
    // WHAT THE OPENING FRAME IS, when it is not a photograph of this place:
    // the resort it borrowed, one of its own homes, or its own drawn ground.
    // The caption names it before it says anything else (§0 applies to a
    // picture that makes a claim exactly as it applies to a number).
    photograph:
      openingPhoto == null || openingPhoto.kind === 'own'
        ? null
        : openingPhoto.kind === 'resort'
          ? { kind: 'resort' as const, label: openingPhoto.resortLabel }
          : openingPhoto.kind === 'listing'
            ? { kind: 'listing' as const, address: openingPhoto.address }
            : { kind: 'ground' as const },
    activeForSale: captionActive,
    // The same median the market Instrument prints, formatted the same way, so
    // one figure is not spelled two ways on one page.
    medianAsking:
      platFigures.medianListPrice != null ? formatPriceExact(platFigures.medianListPrice) : null,
  })

  /* THE NEXT ACTION, IN THE FOLD (SITE-47). Neither captured viewport held a
     door on a page whose job is lead generation: the browse path, the broker
     and the market report were all in the closing Quiet, thousands of pixels
     down. One primary — the homes, which is what the reader came for and what
     the sentence above just counted — and one ghost to a person. Real anchors,
     no registration wall, no dollar figure for a typed address (Matt's
     rulings). When the browse path cannot be published the broker door is the
     primary rather than a second-choice ghost. */
  /* THE PRIMARY DOOR CARRIES NO COUNT, AND THAT IS §0, NOT RESTRAINT. Measured
     on the lane server 2026-09-09: this page counts 14 single-family actives in
     Ridge at Eagle Crest and its browse destination
     /homes-for-sale/redmond/ridge-at-eagle-crest answers "99 homes for sale,
     all types"; Park Addition is 3 here and 4 there. A door reading "See all 14
     homes for sale" would be a figure this page cannot reconcile with the page
     it opens. "Every home for sale" is what the destination actually holds —
     its own heading is "Homes for sale in {Name}" — so the label describes the
     door instead of counting through it. The count stays where its trace is. */
  const platDoors: Array<{ label: string; href: string }> = [
    ...(browseHref ? [{ label: 'See every home for sale', href: browseHref }] : []),
    { label: 'Talk to a broker', href: '/contact' },
  ]

  // SITE-86 honesty: REGISTRY §4 — subdivision grain publishes counts only.
  // MOS / months-of-supply / verdict stay off this grain (no active/(closed/12)
  // under a 6-month MOS clause). Alerts use THIS plat's 30-day house count.
  const inventoryKeySet =
    inventory?.listingKeys && inventory.listingKeys.length > 0
      ? new Set(inventory.listingKeys)
      : null
  const platNew30d = platNewCount30dFromTiles(mapTiles, inventoryKeySet)
  const nowMs = Date.now()
  const recentHouseListings = mapTiles
    .filter((t) => {
      if (inventoryKeySet && inventoryKeySet.size > 0 && !inventoryKeySet.has(t.listingKey)) return false
      if (t.propertyType != null && t.propertyType !== 'A') return false
      if (
        t.propertySubType != null &&
        t.propertySubType !== '' &&
        t.propertySubType !== 'Single Family Residence'
      ) {
        return false
      }
      if (!t.onMarketDate || !t.photoUrl) return false
      const ts = Date.parse(t.onMarketDate)
      return Number.isFinite(ts) && ts >= nowMs - 30 * 86_400_000
    })
    .slice(0, 4)
    .map((t) => {
      const title =
        publishStreetLine({
          streetNumber: t.streetNumber,
          streetName: t.streetName,
          streetSuffix: t.streetSuffix,
        }) || displayName
      return {
        href: t.listNumber
          ? `/homes-for-sale/listing/${t.listNumber}`
          : browseHref ?? `/subdivisions/${slug}`,
        photoSrc: t.photoUrl as string,
        title,
        price: t.listPrice != null ? formatPriceExact(t.listPrice) : null,
        beds: t.beds ?? null,
        baths: t.baths ?? null,
        sqft: t.sqft ?? null,
      }
    })
  const alertTypes = buildPlaceAlertTypes({
    placeName: displayName,
    scopeName: displayName,
    geoType: 'neighborhood',
    geoSlug: slug,
    leftoverHouses30d: platNew30d,
    matchNames: [displayName],
    buckets: [
      {
        key: 'houses',
        label: 'Houses',
        noun: { one: 'house', many: 'houses' },
        newCount30d: platNew30d,
        source: 'listing_tile_mv',
        listings: recentHouseListings,
      },
    ],
  })

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
  // POPULATION 5. The one figure on this page a sub-plat of a resort can
  // actually answer: every home inside Ridge At Broken Top is listed under
  // "Broken Top", so the name-joined populations above are empty for it while
  // the recorded plat has a real sale history. §0: printed only when the read
  // answered with a real count — a miss is absent, never a zero.
  const lifetimeClosed = platClosed && platClosed.closedCount > 0 ? platClosed.closedCount : null
  if (lifetimeClosed != null) {
    marketFigures.push({
      value: v3Text(String(lifetimeClosed)),
      label: v3Text('homes sold here, all time'),
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
  const closedN = platRecentClosedCount(salesHistory)
  const nameJoinChart = placeCostChart(closedN, salesChart)
  /* THE SERIES A SUB-PLAT CAN HAVE (SITE-24). `nameJoinChart` is the MLS
     SubdivisionName join, and it is empty for every sub-plat of a resort: those
     homes are filed under "Tetherow" or "Broken Top", so this section printed
     "Too few recent sales here to chart." over plats holding 107 and 110 closed
     sales on their own recorded boundaries.

     THE NAME JOIN STILL WINS WHERE IT WORKS, and the fallback is deliberate
     rather than a preference: the yearly Ledger below this section prints the
     name-joined counts, so drawing the boundary series ABOVE a table of the
     name-joined ones would put two populations under one heading — the exact
     defect 3f34bf65 removed from this page. The boundary series appears only
     where the name join produced nothing, where there is no second population
     to disagree with. */
  const soldChart = nameJoinChart ?? platClosedYearChart(displayName, platClosed?.closedByYear)

  // ONE SENTENCE PER POPULATION THAT ACTUALLY REACHED THE PAGE, and the sentences
  // are joined rather than concatenated: each trace is written to follow the word
  // "Source", so the second and third would otherwise open a sentence in lower
  // case in the middle of the line.
  const marketClauses = [
    platFigures.medianListPrice != null ? platInventoryTrace(platScope) : null,
    // THE DRAWING GETS A CLAUSE TOO, and which clause depends on which join
    // produced it. The chart carried no sentence at all before SITE-24, which
    // was survivable while there was only one possible series; with two, a
    // section whose line is the boundary series under a sentence describing the
    // MLS-name series would be §0 rule 5 exactly backwards. The name-joined
    // chart and the yearly Ledger below share one population and one sentence;
    // the boundary chart shares the lifetime count's.
    nameJoinChart ? salesHistoryTrace(displayName) : null,
    lifetimeClosed != null ? platLifetimeClosedTrace(displayName) : null,
    countFigures.length > 0 ? platCountsTrace(displayName) : null,
    cacheFigures.length > 0 ? platStatsTrace(displayName, cityName, statsPeriodLabel) : null,
  ].filter((clause): clause is string => clause !== null)
  const marketTrace = marketClauses
    .map((clause, i) => (i === 0 ? clause : `${clause.charAt(0).toUpperCase()}${clause.slice(1)}`))
    .join(' ')

  // ── WHAT DID NOT SELL, AND THE MARKET THE PLAT SITS IN (SITE-55) ────────
  // Matt: "show them exactly what's going on there, including homes that sold
  // and didn't sell… and then in the broader picture of the neighborhood or
  // community within which that subdivision resides. That's the full loop."
  //
  // The failed half is an AGGREGATE and never a list of addresses: Oregon MLS
  // policy holds that Withdrawn, Expired and Cancelled listings may not be
  // actively marketed (docs/MASTER_SPEC.md §3.8), so a public roll-call of the
  // homes that did not sell is Matt's ruling to make, not this page's. The
  // count, the days they ran and the cut they took first are market reporting,
  // the same class of figure as months of supply.
  const unsoldRead = publishPlatUnsold({
    placeName: displayName,
    outcome: platUnsold,
    windowEnd: platUnsold?.windowEnd ?? null,
  })

  // The wider market: the parent place, with ITS own figure, and a REAL anchor
  // in the served HTML (the atlas-link finding on SITE-30). A neighborhood
  // parent is preferred over the city because it is the nearer ring; the
  // community/resort takes precedence over both when the plat sits in one,
  // because that is the market a resort buyer compares against.
  const widerPlace: { label: string; href: string; geoType: 'city' | 'neighborhood' } | null =
    resortSlug && resortLabel
      ? { label: resortLabel, href: `/communities/${resortSlug}`, geoType: 'neighborhood' }
      : boundaryCity?.neighborhood?.label && boundaryCity.neighborhood.slug && citySlug
        ? {
            label: boundaryCity.neighborhood.label,
            href: `/cities/${citySlug}/${boundaryCity.neighborhood.slug}`,
            geoType: 'neighborhood',
          }
        : citySlug
          ? { label: cityName, href: `/cities/${citySlug}`, geoType: 'city' }
          : null

  const widerOverlay = widerPlace
    ? (
        await withTimeoutFallback(
          getDetachedOverlays([{ geoType: widerPlace.geoType, geoSlug: widerPlace.href.split('/').pop() ?? '' }]),
          new Map(),
          3500,
          'sub:widerOverlay',
        )
      ).get(`${widerPlace.geoType}:${widerPlace.href.split('/').pop() ?? ''}`) ?? null
    : null

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
  // The approved area guide for this place. A plat carries a recording suffix
  // (phase, unit, no); the guide is cut for the named place, so the phase
  // resolves to its parent and never to a different place (areaGuideLookupSlugs).
  const areaGuideVideo = await withTimeoutFallback(
    getAreaGuideVideo(areaGuideLookupSlugs(slug)),
    null,
    3000,
    'plat:areaGuide',
  )
  // SITE-52: this Ledger's own heading is "{displayName} area guide", so the
  // row's 'Area guide' when would repeat it — drop it, unlike the mixed
  // guides-and-news Ledger on the city and neighborhood nodes where the same
  // row sits beside dated blog rows and the label still differentiates.
  const [firstGuide, ...restGuide] = areaGuideRow(displayName, areaGuideVideo).map((row) => ({
    ...row,
    when: undefined,
  }))

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
  const platGuideSchema = areaGuideVideoSchema(displayName, `/subdivisions/${slug}`, areaGuideVideo)
  if (platGuideSchema) schemas.push(platGuideSchema)

  /* ── The cited Q&A, and this route's FIRST FAQPage (SITE-08) ─────────────
     The plat node answered nothing in a reader's own words: it drew a map, a
     list, a market band and a year table, and left every question a person
     types unanswered and unindexed. This closes it with the same primitive the
     neighborhood and community grains use, on the same figures this page is
     ALLOWED to publish and no others.

     WHAT THE PLAT GRAIN MAY SAY, AND WHY THE SET IS SHORT. REGISTRY §4:
     a subdivision publishes counts and individual sales, never a price
     statistic — 515 of 680 Bend plats never reach ten detached sales in 36
     months, and the yearly series is an MLS SubdivisionName join rather than
     place membership. So a closed median, a year-over-year of it, and a
     sale-to-list ratio (a ratio of two prices, on the same thin join) all stay
     off. Months of supply stays off too: lib/market/geo-grain-trust.ts refuses
     this grain's closed attribution, so the verdict question is ASKED and
     answered with the refusal and the count behind it, which is the honest
     version. What publishes: the live list median of the plat's own actives,
     days on market from the plat's own cache row, the active count, and the
     yearly closed counts the sales-history Ledger already prints.

     THE LATEST COMPLETE YEAR, not the running one. The current calendar year is
     a partial window and comparing it to a full one is not a year (the same
     rule subdivisionSalesChart applies to its own current-year bar). */
  const nowYear = new Date().getUTCFullYear()
  const completeYears = salesHistory
    .filter((row) => row.year < nowYear && row.closedCount > 0)
    .sort((a, b) => b.year - a.year)
  const lastCompleteYear = completeYears[0]
  /* THE YEAR BEFORE, FROM THE SAME READ (SITE-08 pass 2). The plat grain is the
     only one of the three that publishes a per-year closed count, so it is the
     only one whose count row can draw a second run of marks and let the reader
     see the change as a length. It has to be the immediately preceding year and
     it has to come out of this same salesHistory array — a count from another
     query under the same drawing would be two populations wearing one form. */
  const priorCompleteYear =
    lastCompleteYear && completeYears[1]?.year === lastCompleteYear.year - 1 ? completeYears[1] : null
  /* THE BOUNDARY SERIES ANSWERING THE SAME QUESTION (SITE-24). Same shape, same
     rules — latest COMPLETE year, and a comparison run only when it is the year
     immediately before it and came out of this same map. Used only where the
     name join produced nothing, so the two populations never appear together. */
  const boundaryYears = platClosed?.closedByYear ?? {}
  const boundaryComplete = Object.entries(boundaryYears)
    .map(([year, count]) => ({ year: Number(year), closedCount: Number(count) }))
    .filter((row) => row.year < nowYear && row.closedCount > 0)
    .sort((a, b) => b.year - a.year)
  const boundaryLast = boundaryComplete[0]
  const boundaryPrior =
    boundaryLast && boundaryComplete[1]?.year === boundaryLast.year - 1 ? boundaryComplete[1] : null
  const platBoundaryYears = boundaryLast
    ? {
        count: boundaryLast.closedCount,
        windowLabel: `in ${boundaryLast.year}`,
        // EVERY PROPERTY TYPE, and the noun has to say so. The page's own
        // population is single-family (getPlatPublicInventory is SFR), but the
        // boundary count is not filtered on type at all, and Golf Homes At
        // Tetherow is a townhome plat — "7 single-family homes closed" would be
        // §0 rule 5 in one word.
        populationLabel: 'homes',
        trace: platLifetimeClosedTrace(displayName),
        priorWindow: boundaryPrior
          ? { count: boundaryPrior.closedCount, label: `in ${boundaryPrior.year}` }
          : null,
      }
    : null
  const { answers: platAnswers, traces: platAnswerTraces, sourceKey: platSourceKey } = buildPlaceAnswers({
    placeName: displayName,
    cityName: placeCity,
    figures: {
      // Withheld at this grain, deliberately and visibly (see the note above).
      monthsOfSupply: null,
      saleToOriginal: null,
      cashShare: null,
      daysToPending: null,
      medianSalePrice: null,
      // FOUR POPULATIONS, FOUR TRACES (_v3/subdivision-traces.ts). The default
      // clause below covers the statistics-cache row only; the yearly counts
      // and the live list median name their own, because one clause covering
      // all three is false for two of them.
      activeCount,
      activeCountTrace: homesLedgerTrace(platScope),
      closedCount: lastCompleteYear
        ? {
            count: lastCompleteYear.closedCount,
            windowLabel: `in ${lastCompleteYear.year}`,
            trace: salesHistoryTrace(displayName),
            priorWindow: priorCompleteYear
              ? { count: priorCompleteYear.closedCount, label: `in ${priorCompleteYear.year}` }
              : null,
          }
        : // THE SAME QUESTION, OFF THE BOUNDARY SERIES, when the name join has
          // no year to answer it with (SITE-24). A sub-plat's sales are all
          // filed under the resort's MLS name, so `salesHistory` is empty for it
          // and this page could not ask "is it a buyer's or seller's market"
          // at all — not even to refuse it, which is the answer the grain owes.
          // Its own trace travels with it, because it is a different population
          // from the one salesHistoryTrace describes.
          platBoundaryYears,
      // POPULATION 5 (SITE-24). The boundary question, and on a sub-plat of a
      // resort the ONLY question on this page that has an answer: every row
      // above is name-joined and a sub-plat's sales all carry the resort's MLS
      // name. Golf Homes At Tetherow shipped this section with a single row —
      // the valuation ask — under a heading promising answers with the number.
      // §0: printed only when the read answered; a miss is absent, not a zero.
      lifetimeClosedCount:
        lifetimeClosed != null
          ? { count: lifetimeClosed, trace: platLifetimeClosedTrace(displayName) }
          : null,
      daysOnMarket:
        subdivisionStats?.medianDaysOnMarket != null && subdivisionStats.medianDaysOnMarket > 0
          ? {
              days: subdivisionStats.medianDaysOnMarket,
              windowLabel: statsPeriodLabel ? statsPeriodLabel.toLowerCase() : 'year to date',
            }
          : null,
      medianListPrice: platFigures.medianListPrice,
      medianListPriceTrace: platInventoryTrace(platScope),
    },
    sourceTrace: platStatsTrace(displayName, cityName, statsPeriodLabel || PERIOD_LABEL.ytd),
    // The audit handle, so all three place grains expose one (evaluator,
    // 2026-09-08: two of three did). It names the PLAT rather than a table,
    // and deliberately so — this section's figures come from three different
    // queries (the sales-history RPC, the statistics cache, the live counted
    // set), each of which carries its own trace on its own row. One table name
    // here would claim a single source for a section that has three; the plat
    // key is the one handle all three queries share.
    sourceKey: `subdivision:${slug}`,
    asOfLabel: subdivisionStats?.refreshedAt ? formatDate(subdivisionStats.refreshedAt) : null,
    valueAsk: { href: valuationHref(`/subdivisions/${slug}`), onPage: false },
  })
  const platFaqs = answersFaqItems(platAnswers)
  // Derived FROM the rendered rows, never beside them.
  if (platFaqs.length > 0) schemas.push({ type: 'faqPage', items: platFaqs })
  if (process.env.NODE_ENV !== 'production') {
    for (const line of platAnswerTraces) console.log(`[plat:${slug}] ${line}`)
  }

  const inventorySource = homesLedgerTrace(platScope)
  const splitCity = placeCity ?? undefined
  const splitSubdivision = registryMatch?.canonicalName ?? displayName
  const placeQuery = splitCity ? `${displayName} ${splitCity} Oregon` : `${displayName} Oregon`

  // The read may not have completed: render the Atlas anyway, with its
  // honest sentence, instead of deleting the section (pass five, R7).
  const atlasView = atlas ?? EMPTY_PLACE_ATLAS
  // SITE-86: fold Atlas marks match the counted SFR face (city layout lock).
  const foldAtlasDots = atlasView.dots.filter((d) => d.t === 'house')
  const foldAtlasTypes = atlasView.types.filter((t) => t.key === 'house')
  const foldHouseCount = activeCount ?? (foldAtlasDots.length > 0 ? foldAtlasDots.length : null)
  const atlasClaimText =
    foldHouseCount != null && foldHouseCount > 0
      ? `${foldHouseCount} homes for sale in ${displayName} right now. Drag the price scrubber to narrow the map.`
      : `Homes for sale in ${displayName}. Drag the price scrubber to narrow the map.`
  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <MetadataBlock schemas={schemas} />
        <V3SectionTracker />

        <div
          id="overview"
          className={
            stagePosterSrc
              ? 'place-opening place-opening--media place-opening--plat'
              : 'place-opening place-opening--plat'
          }
        >
          {/* SITE-86: shortened photograph for place still + H1. MOS moves into
              the fold figure so Atlas owns the drawing, not a portal hero card. */}
          <PlaceAreaHero posterSrc={stagePosterSrc} />
          {stagePosterSrc ? <div className="place-opening__scrim" aria-hidden="true" /> : null}
          <V3Breadcrumb
            trail={subdivisionPageTrail(
              citySlug && placeCity ? { label: cityName, slug: citySlug } : null,
              resortSlug ? { label: resortLabel ?? displayName, slug: resortSlug } : null,
              displayName,
            )}
            tone={stagePosterSrc ? 'on-media' : 'surface'}
          />
          <div className="place-opening__copy">
            <V3Heading level={1} size="field" onMedia={Boolean(stagePosterSrc)}>
              {headline}
            </V3Heading>
            {posterCaption ? <p className="place-opening__caption">{posterCaption}</p> : null}
          </div>
        </div>

        {/* SITE-86: drawing + figure in the first viewport. Atlas is the drawing
            (type toggles + price scrubber). MOS two-bar + alerts/V3Number are
            the figure. Source chip sits under the figure it supports — never
            mount="hero" at H1 weight. Doors sit after the stage so the short
            photograph does not clip the primary ask. */}
        {canMapAtlas ? (
          <div className="plat-fold">
            <div className="plat-fold__stage">
              <div className="plat-fold__drawing">
                <V3Atlas
                  id="atlas"
                  headingLevel={2}
                  headline={v3Text(`${displayName} right now`)}
                  headlineTone="eyebrow"
                  claimText={atlasClaimText}
                  keyPlacement="dock"
                  sourceName={PLAT_FEED}
                  dots={foldAtlasDots.length > 0 ? foldAtlasDots : atlasView.dots}
                  regions={atlasRegions}
                  {...(frame ? { frame: frame.geometry } : {})}
                  basemap={
                    frame
                      ? basemapForFrame({ bbox: frame.bbox, pad: ATLAS_FRAME_PAD })
                      : basemapForRegions(atlasRegions, {
                          dots: foldAtlasDots.length > 0 ? foldAtlasDots : atlasView.dots,
                          fit: atlasRegions.length > 0 ? 'regions' : 'dots',
                        })
                  }
                  parcels={platLots.map((lot) => ({
                    id: lot.taxlot,
                    subject: false,
                    geometry: lot.geometry,
                  }))}
                  types={foldAtlasTypes.length > 0 ? foldAtlasTypes : atlasView.types}
                  events={atlasView.events}
                  source={[
                    foldAtlasDots.length > 0
                      ? `Detached single-family (Houses) active and pending marks inside the recorded ${displayName} boundary, from the same Oregon Data Share listing tiles the map draws. Price scrubber filters this set.`
                      : atlasView.source,
                    footprintNote,
                    platLots.length > 0 && nearLotsCentre
                      ? `The lot lines are every parcel within ${Math.round(nearLotsRadiusM)} m of these homes, not a boundary of ${displayName}: the county recorded no plat under this name.`
                      : null,
                    platLots.length > 0 ? TAXLOT_DISCLAIMER : null,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  stamp={atlasView.stamp}
                  incomplete={!atlasView.complete}
                  {...(frame == null && atlasRegions.length === 0 ? { fit: 'dots' as const } : {})}
                />
              </div>
              <aside className="plat-fold__figure">
                {/* SITE-86 SEO: crawlable doors at the top of the figure so they
                    land in the first viewport (not under the H1, not below the ask). */}
                <p className="place-opening__caption place-opening__caption--doors plat-fold__seo-doors">
                  {browseHref ? <a href={browseHref}>{displayName} homes for sale</a> : null}
                  {browseHref && citySlug ? ' · ' : null}
                  {citySlug ? <a href={`/cities/${citySlug}`}>{cityName} real estate</a> : null}
                  {(browseHref || citySlug) && canMapAtlas ? ' · ' : null}
                  {canMapAtlas ? <a href="#atlas">Map of {displayName}</a> : null}
                  {resortSlug ? (
                    <>
                      {' · '}
                      <a href={`/communities/${resortSlug}`}>{resortLabel ?? 'Resort'} overview</a>
                    </>
                  ) : null}
                </p>
                <SubdivisionAlertsStrip
                  id="alerts"
                  placeName={displayName}
                  city={cityName}
                  subdivision={displayName}
                  geoSlug={slug}
                  newCount30d={platNew30d}
                  updatedAt={inventory?.readAt ?? null}
                  browseHref={browseHref ?? `/subdivisions/${slug}`}
                  types={alertTypes}
                />
                <div className="plat-opening__doors plat-fold__doors">
                  {platDoors.map((door, i) => (
                    <V3Button key={door.href} href={door.href} variant={i === 0 ? 'primary' : 'ghost'}>
                      {door.label}
                    </V3Button>
                  ))}
                </div>
                <V3SourceLine
                  source={inventorySource}
                  asOf={inventory?.readAt ?? null}
                  sourceName={PLAT_FEED}
                />
              </aside>
            </div>
          </div>
        ) : (
          <>
            <div className="plat-opening__doors">
              {platDoors.map((door, i) => (
                <V3Button key={door.href} href={door.href} variant={i === 0 ? 'primary' : 'ghost'}>
                  {door.label}
                </V3Button>
              ))}
            </div>
            <V3SourceLine source={inventorySource} asOf={inventory?.readAt ?? null} sourceName={PLAT_FEED} />
          </>
        )}

        <PlaceTypeSlider cards={typeCards} label={`${displayName} property types`} />

        {/* THE SECTION SAYS WHAT IT IS, AND IT IS NOT A MAP (SITE-56).
            It opened on "Search the map" over "Every home on the market AROUND
            {name}", with a sentence saying the counts follow the map view —
            three claims about a map that has not been in this section since
            2026-09-03, when PlaceSplitView was set `listOnly` and the Atlas
            above became the page's map ("Google Field and the place Split
            canvas are off: the atlas is the map", c75222a9). Measured on the
            lane server 2026-09-09: zero requests to maps.googleapis.com from
            this route and no .gm-style node in #homes. What the section
            actually holds is this plat's own counted homes, filterable — so
            that is what it now says, and the count cannot disagree with the
            Atlas above because it is the same set. */}
        <div id="homes">
          <V3Quiet
            id="homes-head"
            eyebrow={v3Text('Every home, filtered')}
            headingLevel={2}
            heading={v3Text(`Every home for sale in ${displayName}`)}
            items={[
              {
                kind: 'prose' as const,
                body: `The same homes the map above marks, with price, beds and property type on the filters. Sold and pending homes are counted on the market section further down, not here.`,
              },
            ]}
          />
          <PlaceSplitView
            city={splitCity}
            subdivision={splitSubdivision}
            boundaryGeojson={seedRing ? platPolygon : null}
            overlayBoundaries={overlaysFromRegions(atlasRegions.slice(1))}
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

        {/* Pattern 1, Instrument — the plat's own market, one population.

            THE CHART IS OPTIONAL HERE; THE FIGURES ARE NOT. Until SITE-24 the
            no-chart case rendered a V3Quiet carrying only "Too few recent sales
            here to chart." and DROPPED every figure with it. On a sub-plat of a
            resort that was a §0 reconciliation failure the moment the polygon
            join landed: Golf Homes At Tetherow has 107 closed sales on its
            recorded plat, and the page said too-few-sales and printed none of
            them, because the yearly series behind the chart is name-joined and
            a sub-plat's sales are all recorded under "Tetherow". The chart
            refusal is still true and still printed — it moves into the note
            slot, one sentence above the figures — and the figures survive. */}
        {firstPlatFigure ? (
          <V3Instrument
            id="market-report"
            level={2}
            eyebrow={v3Text(
              statsPeriodLabel ? `${displayName} · ${statsPeriodLabel}` : `${displayName} · Sold`,
            )}
            headline={v3Text(`What sold in ${displayName}`)}
            figures={[firstPlatFigure, ...restPlatFigures]}
            chartFirst
            foldAfter={0}
            source={v3Text(marketTrace)}
            updated={
              subdivisionStats?.refreshedAt
                ? v3Text(formatDate(subdivisionStats.refreshedAt))
                : undefined
            }
            {...(soldChart
              ? { chart: soldChart }
              : { note: v3Text(TOO_FEW_SALES_LINE) })}
          />
        ) : null}

        {/* Pattern 3, Quiet — the other half of the market question, and the
            ring the plat sits inside (SITE-55). A Quiet between the Instrument
            above and the sales table below, so no two adjacent sections share a
            pattern. The figure carries its own §0 trace; the wider-market door
            is a real anchor in the served HTML, not a client-side jump. */}
        {unsoldRead.measured ? (
        <V3Quiet
          id="outcomes"
          // THE EYEBROW DOES NOT REPEAT THE HEADING. The heading right under it
          // already reads "What did not sell in Golf Homes at Tetherow", so the
          // plat name in the eyebrow bought nothing and cost a line: at 375 it
          // wrapped and orphaned the single word "SELL" (2026-09-09 evaluator).
          // The same rule SITE-52 applied to the Ledger's `when`.
          eyebrow="What did not sell"
          heading={
            unsoldRead.clean
              ? `Everything that came off the market in ${displayName} sold`
              : `What did not sell in ${displayName}`
          }
          headingLevel={2}
          items={[
            // NO STANDALONE FIGURE CELL HERE (2026-09-09, the merge evaluator).
            // Two things were wrong with it. It printed the count a second
            // time — the sentence already opens "One home came off the market
            // in X without selling" — and, worse, it was the THIRD
            // eyebrow-heading-bignumber-source cell in a row once main's plat
            // opening landed on the same page: "the two halves each reached
            // for the same primitive, and stacked together the repetition is
            // visible in a way it wasn't when each half was judged alone."
            // The count stays in the sentence, where it reads, and the §0
            // trace moves to the section's own source line below.
            {
              kind: 'prose' as const,
              body: unsoldRead.sentence,
              // The trace sits under the sentence that carries the number, not
              // at the section's foot. At the foot it landed directly beneath
              // the wider-market door's own citation and the two read as one
              // duplicated component ("two bare SOURCE rows touching each
              // other", the merge evaluator, 2026-09-09).
              source: unsoldRead.source,
              sourceName: 'Central Oregon MLS, this plat',
              ...(platUnsold?.windowEnd ? { updatedAt: platUnsold.windowEnd } : {}),
            },
            // The clean case used to restate the trace as a prose row headed
            // "How this is counted", because the zero had no figure to hang a
            // source line on. The section carries `source` now, so both cases
            // trace the same way and neither prints the method twice.

            ...(widerPlace
              ? [
                  {
                    label: `${widerPlace.label}, the wider market ${displayName} sits in`,
                    href: widerPlace.href,
                    lead: true,
                    mark: 'market' as const,
                    // A FACT, NOT A FLOURISH. Two separate evaluators called
                    // the old copy filler by name — "connective filler between
                    // two stronger ideas" and "adds nothing the FAQ rows below
                    // it don't already do". The active count is already inside
                    // the door figure's own trace, so printing it here is the
                    // same sourced number said out loud rather than a new one.
                    detail: widerOverlay?.headlines
                      ? `${widerOverlay.headlines.activeCount.toLocaleString('en-US')} homes for sale across ${widerPlace.label} right now.`
                      : widerPlace.geoType === 'city'
                        ? `Every neighborhood and every plat in the city, on one page.`
                        : `The ring around this plat, with its own inventory and its own pace.`,
                    ...(widerOverlay?.headlines
                      ? {
                          figure: {
                            value: widerOverlay.headlines.mosLabel,
                            unit: `months of supply · ${widerOverlay.headlines.verdictLabel.toLowerCase()}`,
                            source:
                              `Market Truth region row for ${widerPlace.label} (market_metric, detached segment): ` +
                              `${widerOverlay.headlines.activeCount.toLocaleString('en-US')} active against the closed pace, ` +
                              `complete through ${widerOverlay.headlines.completeThrough}. Months of supply is active listings over the last six months of closings divided by six.`,
                            sourceName: `Central Oregon MLS, ${widerPlace.label}`,
                            updatedAt: widerOverlay.headlines.computedAt,
                          },
                        }
                      : widerOverlay?.inventory
                        ? {
                            figure: {
                              value: widerOverlay.inventory.activeCount.toLocaleString('en-US'),
                              unit: 'homes for sale there now',
                              source:
                                `Market Truth row for ${widerPlace.label} (market_metric, detached segment, active count), ` +
                                `read ${widerOverlay.inventory.computedAt}. Months of supply is withheld at this grain: the sample is under the floor.`,
                              sourceName: `Central Oregon MLS, ${widerPlace.label}`,
                              updatedAt: widerOverlay.inventory.computedAt,
                            },
                          }
                        : {}),
                  },
                ]
              : []),
          ]}
        />
        ) : null}

        {/* Pattern 3, Ledger — one row per calendar year, every row a door, with
            the approved chart-room cards inside the same market section. */}
        <SubdivisionSalesHistory
          displayName={displayName}
          history={salesHistory}
          cityName={cityName}
          chart={soldChart && firstPlatFigure ? undefined : soldChart}
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

        {/* The area guide, one row, a door to the Ryan Realty YouTube channel
            (or the file when a cut is not uploaded). Pattern 3, Ledger. */}
        {firstGuide ? (
          <V3Ledger
            id="guides"
            layout="magazine"
            eyebrow={v3Text(`${displayName} · Video`)}
            heading={v3Text(`${displayName} area guide`)}
            rows={[firstGuide, ...restGuide]}
          />
        ) : null}

        {/* Pattern 3, Ledger — recorded instruments, every row a door. */}
        <SubdivisionDocuments displayName={displayName} documents={placeDocuments} />

        {/* Pattern 8, Answers — the questions a person types about this plat,
            each carrying the one figure it is about and that figure's own
            trace, and the same array feeding this route's FAQPage JSON-LD.
            Closes the page after a Ledger, so no two adjacent sections share a
            pattern. */}
        <V3Answers
          id="faq"
          eyebrow={`${displayName} · By the numbers`}
          heading={`${displayName} questions, answered with the number`}
          questions={platAnswers}
          sourceKey={platSourceKey}
          doors={[
            ...(browseHref ? [{ label: `Every home for sale in ${displayName}`, href: browseHref }] : []),
            ...(resortSlug
              ? [{ label: `${resortLabel ?? displayName} overview`, href: `/communities/${resortSlug}` }]
              : citySlug
                ? [{ label: `${cityName} overview`, href: `/cities/${citySlug}` }]
                : []),
            { label: 'How we get our numbers', href: '/how-we-get-our-numbers' },
          ]}
          note={`Each answer carries the one figure it is about and where that figure came from. A statistic this plat is too small to state honestly is left out rather than estimated.`}
        />

        {/* Pattern 1 again, as ONE enumeration: a section per other property
            type the plat holds. The registry withholds price and months of
            supply below neighbourhood grain, so a plat supplies counts alone,
            and a type with no counts never reaches the component. */}


      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo
          only when it is NOT nested in sectioning content, and <main> is
          sectioning content, so inside it the element is a generic and the page
          ships no contentinfo landmark. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
