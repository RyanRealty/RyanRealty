/**
 * /communities/[slug] - the master-plan grain, on the components/site/v3
 * barrel. Tetherow is the exemplar, not a one-off. Opens Stage (owned place
 * photo) then one Field. No owned asset -> Instrument of belonging, then
 * Field. Amenities, membership, STR, and child plats are doors. Not a
 * neighborhood. Not a city stamp twin. Parity:
 * design_system/ryan-realty/ui_kits/community/parity.json.
 *
 * FIVE PATTERNS - Stage, Field, Instrument, Quiet, Sheet - under the
 * 2026-08-26 place-family exception (PUBLIC_UI.md §3, Matt), declared in
 * parity.json. A sixth stays a lock break, which is why the recorded
 * governing documents render as Quiet legal doors here (communityDocumentItems)
 * while the plat and neighborhood nodes mount the V3PlaceDocuments Ledger.
 *
 * THE PUBLIC NAME IS THE REGISTRY LABEL (Juniper Preserve, 2026-08-25):
 * `publicName = registryEntry?.label ?? community.name`. The slug stays
 * 'pronghorn' - a durable cache key (geo_snapshot_mv 'bend:pronghorn',
 * market_stats_cache geo_slug) - so the two disagree by design and every
 * visitor-facing string takes the label.
 *
 * NO IN-PAGE REDIRECT (2026-08-19): a redirect thrown after loading.tsx
 * flushed serves 200 with no Location header. Compound and wrong-city slugs
 * canonicalize in middleware via resolveCanonicalCommunityPath
 * (lib/routing/pre-render-hops.ts) BEFORE anything streams.
 *
 * THE MARKET SECTION IS THE LEFTOVER HUD (MARKET_TRUTH): leftoverHudKpis with
 * grain 'neighborhood' (market_pulse_live has no neighborhood rows; the
 * stats-cache closed figures are the alias-join under-count
 * lib/market/geo-grain-trust.ts documents), keyed by the bare community slug.
 * The hero count is hud.active; a missing cell is omitted; buildMarketFaq runs
 * UNCONDITIONALLY with source 'market-truth' so the Dataset/FAQPage JSON-LD
 * survives a miss at the cost of one figure, never the markup. The reverted
 * draft's resolveLivePair pulse/snapshot tiers and its stats-cache closed
 * Instrument predate that ruling and were corrected, not restored.
 *
 * THE MARKET QUESTION STAYS (Matt 2026-08-26, all five place grains): the
 * market Instrument's level-2 headline asks it whenever the verdict answers
 * it, with the answer as the note beneath - the Stage carries the H1.
 *
 * THE DATA INVARIANTS, preserved from both registers:
 *  1. ALIAS-AWARE RESORT LISTINGS. A resort's homes are MLS-tagged under many
 *     subdivision names (Widgi Creek 0 literal against a true 48), so the
 *     Field's set is resortTilesForSlug over the uncapped multi-city SFR pull,
 *     gated on the read's own .ok so a timeout cannot publish an empty resort.
 *  2. BOUNDARY RELIABILITY. Oversized stored hulls (Broken Top 11,496 acres
 *     against ~450 real) may not draw and may not drive a count; the county
 *     plat union, when one exists, always draws.
 *  3. ABSENT IS NOT ZERO. Every read is guarded; when all are silent the page
 *     says it has no live figures rather than publishing 0.
 *  4. ONE POPULATION PER FIGURE, NAMED. The Field caption counts ITS OWN
 *     listed set; the Instrument's "detached homes for sale" is the leftover
 *     membership count. Two counts, two labels, each under its own trace.
 *
 * Data ONLY through @/lib/data, @/app/actions/communities, and the in-repo
 * registries. No raw .from() calls.
 */

import { notFound } from 'next/navigation'
import { readCityOpenHouses, openHouseRows, OPEN_HOUSE_TRACE } from '@/lib/kb/place-open-houses'
import { getActivityFeedWithFallbackMulti } from '@/app/actions/activity-feed'
import { getRecentBlogPosts } from '@/lib/data'
import { buildActivityItems, buildArticlePosts } from '@/lib/kb/place-sections'
import { activityRows, articleRows } from '@/app/cities/[slug]/_v3/city-sections'
import type { Metadata } from 'next'
import { getCommunityBySlug, getCommunityListings } from '@/app/actions/communities'
import {
  getListingTiles,
  getGeoSnapshot,
  getGeoBoundaryMapData,
  getResortBoundaryGeoJSON,
  getResortCommunityBySlug,
  getBlogPostsBySlugs,
  getPriceHistory,
  getDetachedOverlays,
  cityDetachedSlug,
} from '@/lib/data'
import { getResortCommunityContent } from '@/lib/resort-community-content'
import { getCommunitySeoAbout } from '@/lib/community-seo-content'
import boundarySanityBaseline from '@/data/boundary-sanity-baseline.json' assert { type: 'json' }
import { GOLF_COURSES } from '@/data/golf/courses'
import { cityResorts, resortActiveSfrCounts, resortTilesForSlug } from '@/lib/kb/resort-active-counts'
import { fetchAllCityActiveSfr } from '@/lib/kb/city-active-sfr'
import { getDistrictForCity } from '@/data/co-schools'
import { getPlaceLinks } from '@/lib/place-links'
import { getAllResortCommunities } from '@/lib/data/communities/registry'
import { childAliasesOf } from '@/lib/communities/community-own-names'
import { getPlaceDocuments } from '@/lib/data/places/getPlaceDocuments'
import { getPlaceCharacter } from '@/lib/data/places/getPlaceCharacter'
import { EMPTY_PUBLIC_PACE, getPublicDetachedPace, publicPaceItems } from '@/lib/data/market-truth/public-pace'
import {
  getPublicDetachedMonthly,
  leftoverNeighborhoodOrCityMonthly,
} from '@/lib/data/market-truth/public-monthly'
import { EMPTY_PUBLIC_MIX, getPublicDetachedMix } from '@/lib/data/market-truth/public-mix'
import { getPublicPlaceSegments } from '@/lib/data/market-truth/public-segments'
import { getCoreChartSeries } from '@/lib/data/market/getCoreChartSeries'
import { canonicalCityCacheSlug } from '@/lib/market/city-cache-slug'
import { leftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { toPublicCoreChartSeries } from '@/lib/market/publish-public-chart-source'
import { isTrendSeriesTooSparse } from '@/lib/kb/place-sections'
import { buildYearSeries } from '@/lib/kb/year-series'
import { pageMetadata } from '@/lib/site/page-metadata'
import { valuationHref } from '@/lib/site/valuation-href'
import { withTimeoutFallback, withTimeoutFallbackResult } from '@/lib/with-timeout-fallback'
import { skippableRail } from '@/lib/build-phase'
import { buildMarketFaq, type MarketFaqInput } from '@/lib/site/market-faq'
import { marketVerdict, MOS_METHODOLOGY_CLAUSE, MOS_THRESHOLD_CLAUSE } from '@/lib/market/classify'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { zonedDateKey, formatDate } from '@/lib/format/date'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Field,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Instrument,
  V3Ledger,
  V3PlaceCharacter,
  V3PlacePropertyTypes,
  V3Quiet,
  V3SourceLine,
  V3Stage,
  V3SectionTracker,
  type V3ChartCardProps,
  type V3InstrumentFigure,
} from '@/components/site/v3'
import { PlaceFieldMap } from '@/app/central-oregon/_v3/PlaceFieldMap.client'
import { fieldMapPins } from '@/app/central-oregon/_v3/nearby-field-items'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import CommunityPageTracker from '@/components/community/CommunityPageTracker'
import { coreChartsCard } from '@/components/market/core-charts'
import { CommunityAlertSheet } from './_v3/CommunityAlertSheet.client'
import { buildCommunitySchemas, communityMetadataInput } from './_v3/community-metadata'
import {
  buildExploreEdges,
  communityDocumentItems,
  reconcileListedVsDetachedFaq,
  reconcilePlaceHoaFaq,
} from './_v3/community-figures'
import { buildPlaceKnowledge } from './_v3/place-knowledge'
import { measuredPlaceHoaInput } from './_v3/place-hoa-measured'
import { publishPlaceHoa } from '@/lib/market/publish-place-hoa'
import {
  belongingFigures,
  belongingHeadline,
  belongingTrace,
  communityFieldCaption,
  communityFieldItems,
  communityFieldTrace,
  communityLibraryHero,
  stagePoster,
  type CommunityFieldBranch,
} from './_v3/community-opening'
import { CommunityStage } from './_v3/CommunityStage'
import { resortQuietItems } from '../_v3/resort-doors'
import {
  leftoverMarketFigures,
  CITY_PACE_KEYS_ON_THE_HUD,
  placeMedianChart,
} from '@/app/cities/[slug]/_v3/city-sections'
import { buildPublicMixFigures } from '@/app/housing-market/[...slug]/_v3/geo-figures'

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  // Seed the curated resort-community set (finite, in-repo registry) so the
  // flagship pages get build-time SSG instead of cold-rendering every 60s.
  // Long-tail subdivision slugs still SSR on demand via dynamicParams below.
  return getAllResortCommunities().map((c) => ({ slug: c.slug }))
}
export const dynamicParams = true
export const revalidate = 60

type Props = { params: Promise<{ slug: string }> }

/** The most rows the in-boundary queries return. Named so the trace can say it. */
const BOUNDARY_ROW_CAP = 200

// Boundaries listed in the sanity baseline are oversized or un-corrected
// (broken-top is 11,496 acres against ~450 real), so anything keyed off the
// polygon - the in-boundary listings, the count, the drawn shape - is wrong:
// it swallows Tetherow and west Bend.
const UNRELIABLE_BOUNDARY_SLUGS = new Set(boundarySanityBaseline.allowed as string[])
function isBoundaryReliable(slug: string): boolean {
  return !UNRELIABLE_BOUNDARY_SLUGS.has(slug)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const community = await getCommunityBySlug(slug)
  if (!community) notFound()
  // Same rule as the page body: the registry label is the public name.
  const publicName = getResortCommunityBySlug(slug)?.label ?? community.name
  return pageMetadata(
    communityMetadataInput({
      slug,
      name: publicName,
      city: community.city,
      heroImageUrl: community.heroImageUrl,
    }),
  )
}

export default async function CommunityDetailPage({ params }: Props) {
  const { slug } = await params

  const community = await getCommunityBySlug(slug)
  if (!community) notFound()

  const cityName = community.city

  // RESTORED 2026-08-27, with the cap. The 2026-08-26 migration deleted this
  // page's activity feed, blog rail and open-house list and left a door to each
  // in the closing Quiet -- a door is not the section. All three are CITY-scoped
  // (a community has no feed of its own), which is exactly the D93 mislabel the
  // old KB page shipped: a city feed under the community's name. Each eyebrow
  // now names the city the data is actually scoped to.
  const [openHouses, communityActivity, communityBlog] = await Promise.all([
    readCityOpenHouses(cityName),
    getActivityFeedWithFallbackMulti({ cities: [cityName], limit: 8 }).catch(() => []),
    getRecentBlogPosts({ cityName, limit: 3 }).catch(() => []),
  ])
  const [firstOh, ...restOh] = openHouseRows(openHouses)
  const [firstAct, ...restAct] = activityRows(buildActivityItems(communityActivity, { staleNewAfterDays: 21 }))
  const [firstPost, ...restPost] = articleRows(buildArticlePosts(communityBlog))
  const citySlug = community.citySlug

  // Compound and wrong-city slugs canonicalize in middleware
  // (resolveCanonicalCommunityPath), so a slug that reaches this body is the
  // canonical one. resortMatch still resolves the registry entry for aliases.
  const subdivisionLc = community.subdivision.toLowerCase().trim()
  const resortMatch = cityResorts(citySlug).find(
    (r) =>
      r.slug === slug ||
      r.label.toLowerCase().trim() === subdivisionLc ||
      (r.subdivision_aliases ?? []).some((a) => a.toLowerCase().trim() === subdivisionLc),
  )
  const resortSlug = resortMatch?.slug ?? slug
  const registryEntry = getResortCommunityBySlug(resortSlug)
  const isResort = registryEntry?.is_resort === true || community.isResort
  const isResortInCity = Boolean(resortMatch)

  // CHILD aliases only, for the FAQ membership answer: the community's own
  // current and former names must not be in it, or the page answers that
  // Sunriver includes Sunriver and that Juniper Preserve includes Pronghorn.
  const childAliases = registryEntry
    ? childAliasesOf(registryEntry, registryEntry.subdivision_aliases)
    : []
  // The registry label is the public name; `community.name` is only the slug
  // read back through parseCommunitySlug. Juniper Preserve keeps slug
  // 'pronghorn' (a durable cache key), so the two disagree by design and every
  // visitor-facing string below takes the label. (§0)
  const publicName = registryEntry?.label ?? community.name

  // Community geo snapshot keys are stored as "city:subdivision" lowercase.
  // market_stats_cache + Market Truth neighborhood rows key the bare slug.
  const communityGeoKey = `${cityName.toLowerCase().trim()}:${community.subdivision.toLowerCase().trim()}`
  const neighborhoodSlug = slug

  const currentMonthKey = zonedDateKey(new Date()).slice(0, 7)
  const [
    snapshot,
    priceHist,
    boundaryRead,
    resortBoundary,
    citySfrRead,
    richContent,
    cityPriceHist,
    commCoreCharts,
    cityCoreCharts,
    publicPace,
    publicSegments,
    leftoverCityMonthly,
    leftoverNeighborhoodMonthly,
    publicMix,
    commOverlays,
    placeDocuments,
    placeCharacter,
  ] = await Promise.all([
    // Always-present community snapshot - the JSON-LD fallback stamp. (§0)
    withTimeoutFallback(getGeoSnapshot({ geoType: 'community', geoKey: communityGeoKey }), null, 3000, 'comm:snapshot'),
    withTimeoutFallback(getPriceHistory('neighborhood', neighborhoodSlug, 'monthly', 60), [], 4500, 'comm:priceHistory'),
    withTimeoutFallbackResult(getGeoBoundaryMapData({ geoType: 'neighborhood', geoSlug: neighborhoodSlug }), { polygon: null, pins: [] }, 4500, 'comm:boundary'),
    withTimeoutFallback(getResortBoundaryGeoJSON(slug), null, 4500, 'comm:resortBoundary'),
    // Uncapped active SFR tiles for EVERY MLS city this community lists under
    // (registry mls_cities): Caldera lists under Bend, BBR under its own name -
    // the registry-city-only pull rendered 0 of 31 real homes (2026-07-29).
    // Result-shaped: a timed-out fetch must not read as an empty resort. (§0)
    isResortInCity
      ? withTimeoutFallbackResult(
          Promise.all(
            [...new Set([cityName, ...(registryEntry?.mls_cities ?? [])])].map((c) => fetchAllCityActiveSfr(c)),
          ).then((sets) => sets.flat()),
          [], 9000, 'comm:citySfr',
        )
      : Promise.resolve({ value: [] as Awaited<ReturnType<typeof getListingTiles>>, ok: true }),
    // Curated amenity/golf/HOA JSON; null with no config, and the page then
    // shows fewer rows rather than inventing them. (§0)
    withTimeoutFallback(getResortCommunityContent(resortSlug), null, 2500, 'comm:content'),
    // Parent-city trend when this community's series is too thin. Relabeled. (§0)
    withTimeoutFallback(getPriceHistory('city', canonicalCityCacheSlug(citySlug), 'monthly', 60), [], 4500, 'comm:cityPriceHistory'),
    // Tabbed core-chart series - this community's own scope, plus the parent
    // city's as the sparse-community fallback, relabeled honestly when used. (§0)
    withTimeoutFallback(getCoreChartSeries({ geoType: 'neighborhood', geoSlug: neighborhoodSlug }), null, 4500, 'comm:coreCharts'),
    withTimeoutFallback(getCoreChartSeries({ geoType: 'city', geoSlug: canonicalCityCacheSlug(citySlug) }), null, 4500, 'comm:cityCoreCharts'),
    withTimeoutFallback(
      getPublicDetachedPace({ geoType: 'neighborhood', geoSlug: neighborhoodSlug }),
      EMPTY_PUBLIC_PACE,
      3000,
      'comm:publicPace',
    ),
    withTimeoutFallback(
      getPublicPlaceSegments({ geoType: 'neighborhood', geoSlug: neighborhoodSlug }),
      [],
      3000,
      'comm:publicSegments',
    ),
    withTimeoutFallback(
      getPublicDetachedMonthly({ geoType: 'city', geoSlug: citySlug, currentMonthKey }),
      [],
      4500,
      'comm:leftoverCityMonthly',
    ),
    withTimeoutFallback(
      getPublicDetachedMonthly({
        geoType: 'neighborhood',
        geoSlug: neighborhoodSlug,
        currentMonthKey,
      }),
      [],
      4500,
      'comm:leftoverNeighborhoodMonthly',
    ),
    withTimeoutFallback(
      getPublicDetachedMix({ geoType: 'neighborhood', geoSlug: neighborhoodSlug }),
      EMPTY_PUBLIC_MIX,
      3000,
      'comm:publicMix',
    ),
    withTimeoutFallback(
      getDetachedOverlays([{ geoType: 'neighborhood', geoSlug: neighborhoodSlug }]),
      new Map(),
      3000,
      'comm:detachedOverlay',
    ),
    withTimeoutFallback(getPlaceDocuments('community', slug), [], 4000, 'comm:documents'),
    // Build years + HOA, measured from member listings (PLACE_CONTENT_RULES
    // R1/R2/R3). geo_type 'neighborhood', like every other market read on this
    // page: boundaries holds no community polygons, so a resort community's
    // membership lives under its neighborhood boundary. Measured 2026-08-26:
    // community/sunriver has 0 member listings, neighborhood/sunriver 10,228.
    withTimeoutFallback(
      getPlaceCharacter('neighborhood', neighborhoodSlug),
      null,
      4000,
      'comm:character',
    ),
  ])
  const commMt = commOverlays.get(`neighborhood:${cityDetachedSlug(neighborhoodSlug)}`)
  const hud = leftoverHudKpis({
    grain: 'neighborhood',
    headlines: commMt?.headlines ?? null,
    inventory: commMt?.inventory ?? null,
    pace: publicPace,
  })

  // Amenity -> blog-post link cards (topic-cluster SEO): resolve the published
  // posts for any amenity carrying a blog_slug. Only published posts come back,
  // so an amenity pointing at a draft produces no dead door.
  const amenityBlogSlugs = (richContent?.amenities ?? [])
    .map((a) => a.blog_slug)
    .filter((s): s is string => Boolean(s))
  const amenityPosts =
    amenityBlogSlugs.length > 0
      ? await skippableRail(() => getBlogPostsBySlugs(amenityBlogSlugs), {}, 2500, 'comm:amenityPosts')
      : {}

  /* ── The ONE HOA figure this page prints (§0, D103 2026-08-27) ──────────── */
  // Resolved ONCE so the glance figure, the belonging knowledge row, and the
  // FAQ/Dataset cannot disagree: a measured median from member listings
  // (getPlaceCharacter) outranks the master assessment, which outranks the
  // registry estimate. The same instance feeds every call site below.
  const { measuredAnnual: hoaMeasuredAnnual, measuredBasis: hoaMeasuredBasis } =
    measuredPlaceHoaInput(placeCharacter)
  const resolvedHoa = publishPlaceHoa({
    measuredAnnual: hoaMeasuredAnnual,
    measuredBasis: hoaMeasuredBasis,
    masterAnnual: richContent?.hoaMasterAnnual,
    estimateAnnual: registryEntry?.hoa_annual_estimate,
    subEstimates: registryEntry?.sub_neighborhoods?.map((s) => s.hoa_annual_estimate),
  })

  /* ── Boundary reliability + the alias-aware listing set ─────────────────── */

  const boundaryReliable = isBoundaryReliable(slug)
  const boundaryMapData = boundaryRead.value
  const citySfrTiles = citySfrRead.ok ? citySfrRead.value : []
  const boundaryListingKeys = boundaryMapData.pins.map((p) => p.listingKey)

  // ALIAS-AWARE LISTINGS for a resort: the city's active SFR tiles matching
  // this resort's aliases - the SAME set the alias-aware counts use, so the
  // map, the list, and the count agree. (§0)
  const resortTiles = isResortInCity ? resortTilesForSlug(citySlug, resortSlug, citySfrTiles) : []
  const useResortTiles = resortTiles.length > 0

  // The community's own tiles. Resort -> alias-matched; reliable boundary ->
  // in-polygon; oversized -> the city pull narrowed by MLS subdivision name.
  // propertyType 'A' throughout: every label here says single-family (§0).
  let communityTiles: Awaited<ReturnType<typeof getListingTiles>> = useResortTiles
    ? resortTiles
    : boundaryReliable && boundaryListingKeys.length > 0
      ? await withTimeoutFallbackResult(
          getListingTiles({ listingKeys: boundaryListingKeys, status: 'active', propertyType: 'A', limit: BOUNDARY_ROW_CAP }),
          [],
          4500,
          'comm:tiles',
        ).then((r) => (r.ok ? r.value : []))
      : await withTimeoutFallbackResult(
          getListingTiles({ city: cityName, status: 'active', propertyType: 'A', limit: 1500 }),
          [],
          4500,
          'comm:tiles-fallback',
        ).then((r) => (r.ok ? r.value : []))
  const usedSubdivisionNarrowing = !useResortTiles && (!boundaryReliable || boundaryListingKeys.length === 0)
  if (usedSubdivisionNarrowing) {
    const subListingsRead = await withTimeoutFallbackResult(
      getCommunityListings(cityName, community.subdivision, BOUNDARY_ROW_CAP),
      [],
      4500,
      'comm:sub-listings',
    )
    const subListings = subListingsRead.ok ? subListingsRead.value : []
    const subKeys = new Set(subListings.map((r) => r.ListingKey).filter(Boolean) as string[])
    communityTiles = communityTiles.filter((t) => subKeys.has(t.listingKey))
  }

  // Alias-aware count map, gated on the read's own .ok (§0): a timed-out city
  // SFR fetch must not publish an alias count of 0.
  const haveCityTiles = citySfrRead.ok && isResortInCity && citySfrTiles.length > 0
  const resortSfrCounts = haveCityTiles ? resortActiveSfrCounts(citySlug, citySfrTiles) : new Map<string, number>()
  const aliasAwareCount = haveCityTiles ? resortSfrCounts.get(resortSlug) ?? null : null

  /* ── The market, off the ONE leftover pile ─────────────────────────────── */

  // §0 UNKNOWN IS NOT ZERO. The published count is leftover HUD.
  const activeCount: number | null = hud.active

  const mosRaw = hud.monthsSupply != null && hud.monthsSupply > 0 ? hud.monthsSupply : null
  const verdict = marketVerdict(mosRaw)
  const mosLabel = mosRaw != null ? formatMonthsOfSupply(mosRaw) : null
  const hasVerdict = verdict.kind !== 'unknown' && mosLabel != null
  const marketHeadline = hasVerdict
    ? `Is ${publicName} a buyer's or seller's market?`
    : `The ${publicName} market`
  const verdictSentence = hasVerdict
    ? `${publicName} has ${mosLabel} months of supply, which is a ${verdict.label}.`
    : null

  const leftoverStamp =
    commMt?.headlines?.computedAt ?? commMt?.inventory?.computedAt ?? snapshot?.refreshedAt ?? null

  const schoolDistrictInfo = getDistrictForCity(cityName)

  const marketFaqInput: MarketFaqInput = {
    grain: 'neighborhood',
    source: 'market-truth',
    // Same leftover HUD the page prints. Miss omits. Pulse DTP and cache DOM
    // do not fill.
    activeCount: hud.active,
    pulseActiveCount: hud.active,
    medianListPrice: hud.medianList,
    monthsOfSupply: mosRaw,
    medianDaysToPending: hud.daysToPending,
    medianDaysOnMarket: null,
    refreshedAt: leftoverStamp,
    soldCount12mo: publicPace.closedCount ?? null,
    subdivisionAliases: childAliases.length > 0 ? childAliases : null,
    // buildMarketFaq runs its own publishPlaceHoa(masterAnnual, estimateAnnual,
    // subEstimates) and master always beats estimate there, so threading the
    // page's ONE resolved annual (measured > master > estimate) through the
    // master channel guarantees the FAQ prints the same number resolvedHoa
    // does, regardless of which tier actually won. reconcilePlaceHoaFaq below
    // then fixes the ANSWER TEXT for the measured case, which needs its basis
    // named instead of the generic estimate phrasing. (§0, D103 2026-08-27)
    hoaMasterAnnual: resolvedHoa?.annual ?? richContent?.hoaMasterAnnual ?? null,
    hoaAnnualEstimate: registryEntry?.hoa_annual_estimate ?? null,
    hoaSubEstimates: registryEntry?.sub_neighborhoods?.map((s) => s.hoa_annual_estimate) ?? null,
    schoolDistrictName: schoolDistrictInfo?.district ?? null,
    schoolDistrictSlug: schoolDistrictInfo?.districtSlug ?? null,
  }
  const { faqs, datasetVariables, asOfIso, asOfLabel } = buildMarketFaq(publicName, marketFaqInput)

  const placeLinks = getPlaceLinks({
    type: 'community',
    slug: resortSlug,
    citySlug: citySlug || undefined,
  })
  const browseHref = placeLinks.browseUrl
  const communityMarketHref = placeLinks.marketUrl
  const cityReportHref = citySlug ? `/housing-market/${citySlug}` : '/housing-market'

  const figures: V3InstrumentFigure[] = leftoverMarketFigures(hud, {
    browse: browseHref,
    monthsOfSupply: '/months-of-supply',
  })
  for (const item of publicPaceItems(publicPace)) {
    if (CITY_PACE_KEYS_ON_THE_HUD.has(item.key)) continue
    figures.push({ value: v3Text(item.value), label: v3Text(item.label) })
  }
  for (const figure of buildPublicMixFigures(publicMix)) figures.push(figure)
  // PUBLIC_UI.md §3 / parity.json V3Instrument (D103, 2026-08-27): "Level 2 is
  // rolling 365 days of closed sales. Live inventory is the Field caption,
  // not the hero." leftoverMarketFigures, publicPaceItems, and
  // buildPublicMixFigures above build the SAME figure set as before; this
  // reorders it only — every rolling-window / closed-sale figure (the
  // "12 months" and "90 days" character stats, months of supply, sold count)
  // opens the Instrument, and every current-snapshot figure (median list
  // price, "for sale," "now," "30 days") - the Field's own caption - moves to
  // the end. No figure is dropped or relabeled.
  const isLiveInventoryFigure = (label: string): boolean =>
    label === 'median list price' ||
    label.includes('for sale') ||
    label.includes('now') ||
    label.includes('30 days')
  const orderedMarketFigures = [
    ...figures.filter((f) => !isLiveInventoryFigure(f.label)),
    ...figures.filter((f) => isLiveInventoryFigure(f.label)),
  ]
  const [firstMarketFigure, ...restMarketFigures] = orderedMarketFigures

  // City-fallback for a too-sparse community series; the caption names the
  // scope so a city trend can never read as this community's (§0).
  const communityCacheSparse = isTrendSeriesTooSparse(priceHist)
  const chartMonths = leftoverNeighborhoodOrCityMonthly({
    leftoverNeighborhood: leftoverNeighborhoodMonthly,
    leftoverCity: leftoverCityMonthly,
    neighborhoodCache: priceHist,
    cityCache: cityPriceHist,
    currentMonthKey,
    neighborhoodCacheSparse: communityCacheSparse,
  })
  const chartIsCityLevel = chartMonths.cityFallback
  const chartScope = chartIsCityLevel ? `${cityName} at city scope, not ${publicName}` : publicName
  const medianChart = placeMedianChart(
    buildYearSeries(chartMonths.months, 5),
    `Median close by month, ${chartMonths.leftoverUsed ? 'Market Truth leftover' : 'single-family'}, ${chartScope}`,
  )

  // Core-chart module scope mirrors the SAME sparse-community decision, and
  // toPublicCoreChartSeries strips table names from every series source.
  const coreChartsRaw = chartIsCityLevel ? cityCoreCharts : commCoreCharts
  const coreCharts = coreChartsRaw ? toPublicCoreChartSeries(coreChartsRaw) : null
  const trendsCard = coreChartsCard(
    coreCharts,
    publicName,
    chartIsCityLevel && cityName ? `${cityName} (city)` : undefined,
  )
  const marketCards: V3ChartCardProps[] = trendsCard ? [trendsCard] : []

  /* ── The Field ─────────────────────────────────────────────────────────── */

  const fieldBranch: CommunityFieldBranch = useResortTiles
    ? 'alias'
    : boundaryReliable && boundaryListingKeys.length > 0
      ? 'boundary'
      : 'subdivision-name'
  const fieldTiles = aliasAwareCount != null ? resortTiles : communityTiles
  const fieldItems = communityFieldItems(fieldTiles)
  const fieldCaption = communityFieldCaption({ placeName: publicName, count: fieldItems.length })
  const mapPins = fieldMapPins(fieldItems)

  // D103 (2026-08-27). The Field's listed set (every property type across the
  // community's named subdivisions) and the Dataset/FAQ's detached count (the
  // single-family subset the market figures measure) are two populations;
  // this names both from the page's own live numbers. Same fix for the HOA
  // answer: it must not print a different annual than resolvedHoa, and it
  // states the measured basis when that is the winning tier. Both act on the
  // SAME `faqs` array the visible closing Quiet block and the FAQPage
  // JSON-LD render, so reader and crawler see the identical reconciled text.
  const pageFaqs = reconcilePlaceHoaFaq(
    reconcileListedVsDetachedFaq(faqs, {
      placeName: publicName,
      listedCount: fieldItems.length,
      detachedCount: hud.active,
    }),
    resolvedHoa,
  )
  // The county plat union, when one exists, always draws; an unreliable stored
  // hull never does (invariant 2).
  const mapPolygon = resortBoundary ?? (boundaryReliable ? boundaryMapData.polygon : null)
  const hasMap = mapPins.length > 0 || Boolean(mapPolygon)

  /* ── The opening ───────────────────────────────────────────────────────── */

  const libraryHero = await withTimeoutFallback(communityLibraryHero(slug), null, 3000, 'comm:libraryHero')
  const posterSrc = stagePoster(slug, community.heroImageUrl, libraryHero)
  // Library / live still is the first fold. Area-guide clips stay off Stage.
  // They are click-to-play cuts, never a silent Stage loop (getAreaGuideVideo).
  const belongFigures = belongingFigures(richContent, placeCharacter)
  const [firstBelong, ...restBelong] = belongFigures

  /* ── The authored knowledge + the outbound edges ───────────────────────── */

  const seoAbout = getCommunitySeoAbout(slug)
  const aboutParagraphs: string[] =
    seoAbout ??
    (richContent?.aboutProse.length
      ? richContent.aboutProse
      : [community.description ?? registryEntry?.description ?? ''].filter((p): p is string => Boolean(p && p.trim())))

  const knowledgeItems = buildPlaceKnowledge({
    name: publicName,
    city: cityName,
    aboutParagraphs,
    content: richContent,
    registry: registryEntry ?? null,
    schoolDistrictName: schoolDistrictInfo?.district ?? null,
    schoolDistrictSlug: schoolDistrictInfo?.districtSlug ?? null,
    isResort,
    // Only the alias-aware branch builds the published listed set out of these
    // names, and the knowledge row must not claim otherwise.
    countIsAliasAware: aliasAwareCount != null,
    contactHref: `/contact?inquiryType=Buying&message=${encodeURIComponent(
      `I have questions about short-term rental rules in ${publicName}.`,
    )}`,
    amenityPosts,
    character: placeCharacter,
  })

  const exploreItems = buildExploreEdges({
    communityName: publicName,
    cityName,
    citySlug,
    browseHref,
    communityMarketHref,
    cityReportHref,
    pagePath: `/communities/${slug}`,
    faqs: pageFaqs,
    documentItems: communityDocumentItems(publicName, placeDocuments),
    golfCourses: GOLF_COURSES.filter((c) => c.communitySlug === slug),
    resortItems: resortQuietItems(),
  })
  // The valuation door carries ?from=/communities/<slug> - the seller lead's
  // stored source_url.
  exploreItems.push({ label: 'Value my home', href: valuationHref(`/communities/${slug}`) })

  const communitySchemas = buildCommunitySchemas({
    slug,
    name: publicName,
    cityName,
    citySlug,
    hasMap,
    centerLonLat: registryEntry?.center_lon_lat ?? null,
    datasetVariables,
    asOfIso,
    asOfLabel,
    faqs: pageFaqs,
  })

  const trail = [
    { label: 'Home', href: '/' },
    { label: 'Communities', href: '/communities' },
    ...(cityName ? [{ label: cityName, href: citySlug ? `/cities/${citySlug}` : '/cities' }] : []),
    { label: publicName },
  ]

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <CommunityPageTracker
          slug={slug}
          communityName={publicName}
          city={cityName}
          activeCount={activeCount}
          medianPrice={hud.medianList}
        />
        <V3SectionTracker />
        <MetadataBlock schemas={communitySchemas} />

        {/* Pattern 4, Stage - the owned place photo, when one exists
            (PUBLIC_UI §3 Master-plan). The Stage action is the first house. */}
        {posterSrc ? (
          <CommunityStage
            Stage={V3Stage}
            trail={trail}
            name={publicName}
            cityName={cityName}
            headline={belongingHeadline(publicName, richContent)}
            posterSrc={posterSrc}
            action={{
              label: fieldItems[0]?.title || `See ${publicName} houses`,
              href: fieldItems[0]?.href || '#homes',
            }}
          />
        ) : firstBelong ? (
          <>
            <V3Breadcrumb trail={trail} />
            <V3Instrument
              id="place"
              level={1}
              eyebrow={v3Text(`${publicName} · ${cityName}`)}
              headline={v3Text(belongingHeadline(publicName, richContent))}
              figures={[firstBelong, ...restBelong]}
              source={v3Text(belongingTrace(publicName))}
              action={{
                label: v3Text(`See ${publicName} houses`),
                href: '#homes',
                variant: 'ghost',
              }}
            />
          </>
        ) : (
          <>
            <V3Breadcrumb trail={trail} />
            <V3Quiet
              id="place"
              heading={belongingHeadline(publicName, richContent)}
              headingLevel={1}
              items={[{ label: `See ${publicName} houses`, href: '#homes' }]}
            />
          </>
        )}

        {/* Pattern 2, Field - the homes as a spatial surface: the alias-matched
            (or in-boundary) set, list and map one set, count as caption. */}
        <V3Field
          id="homes"
          ariaLabel={`Homes for sale in ${publicName}`}
          items={fieldItems}
          mapSlot={
            hasMap ? (
              <PlaceFieldMap
                pins={mapPins}
                boundary={mapPolygon ?? undefined}
                placeName={publicName}
                centerLonLat={registryEntry?.center_lon_lat ?? undefined}
              />
            ) : undefined
          }
          mapNote={fieldCaption ?? undefined}
          emptyMessage={
            citySfrRead.ok || !isResortInCity
              ? `No single-family home is listed for sale in ${publicName} right now.`
              : 'The listing feed did not answer on this refresh, so this frame is not claiming an inventory.'
          }
          footNote={
            fieldItems.length > 0
              ? `Listed here: ${publicName} homes. Map and list are the same set.`
              : undefined
          }
        />
        {fieldItems.length > 0 ? (
          <V3SourceLine source={communityFieldTrace(publicName, fieldBranch)} />
        ) : null}

        {/* Pattern 1, Instrument - the market question and the leftover pile. */}
        {firstMarketFigure ? (
          <V3Instrument
            id="market"
            level={2}
            eyebrow={v3Text(`${publicName} · The market`)}
            headline={v3Text(marketHeadline)}
            note={verdictSentence ? v3Text(verdictSentence) : undefined}
            figures={[firstMarketFigure, ...restMarketFigures]}
            source={v3Text(
              `regional MLS through Oregon Data Share, read through the Market Truth metric layer: ` +
                `detached single-family houses assigned to ${publicName} by boundary membership. ` +
                `Every figure names its own window; a figure the layer withheld is absent, not estimated.` +
                (mosLabel != null ? ` ${MOS_METHODOLOGY_CLAUSE} ${MOS_THRESHOLD_CLAUSE}` : ''),
            )}
            chart={medianChart}
            cards={marketCards}
            updated={leftoverStamp ? v3Text(formatDate(leftoverStamp)) : undefined}
            action={{
              label: v3Text(`Search ${publicName} homes`),
              href: browseHref,
              variant: 'primary',
            }}
          />
        ) : (
          <V3Quiet
            id="market"
            heading={`The ${publicName} market`}
            items={[
              {
                kind: 'prose',
                term: 'No live market figures right now',
                body: `The Market Truth metric layer published no figure for ${publicName} on this refresh, so this page is not printing a median, a supply figure, or a verdict.${fieldItems.length > 0 ? ' The homes above carry their own live list prices.' : ''}`,
              },
            ]}
          />
        )}

        {/* Pattern 6, Quiet - the authored knowledge: overview prose,
            at-a-glance, drive times, amenities, the course, membership,
            builders, schools, STR (D100 on the barrel). */}
        {knowledgeItems.length > 0 ? (
          <V3Quiet
            id="belonging"
            eyebrow={`${publicName} · Belonging`}
            heading={`Living in ${publicName}`}
            items={knowledgeItems}
          />
        ) : null}

        {/* Pattern 1 again, as ONE enumeration: one section per other property
            type this community holds. */}
        <V3PlacePropertyTypes placeName={publicName} citySlug={citySlug} rows={publicSegments} />

        {/* Pattern 6 - build years + HOA, measured (renders null when nothing
            is publishable). */}
        <V3PlaceCharacter placeName={publicName} character={placeCharacter} />

        {/* Pattern 5, Sheet. Same server action, same payload, same honeypot. */}
        <CommunityAlertSheet
          communityName={publicName}
          city={cityName}
          subdivision={community.subdivision}
        />

        {firstOh ? (
          <V3Ledger
            id="open-houses"
            eyebrow={v3Text(`This week · ${cityName}`)}
            heading={v3Text('Open houses you can walk through')}
            rows={[firstOh, ...restOh]}
            source={v3Text(OPEN_HOUSE_TRACE)}
            action={{ label: v3Text(`Every open house in ${cityName}`), href: `/open-houses/${citySlug}` }}
          />
        ) : null}

        {firstAct ? (
          <V3Ledger
            id="activity"
            eyebrow={v3Text(`Live · ${cityName}`)}
            heading={v3Text('Latest market activity')}
            rows={[firstAct, ...restAct]}
            source={v3Text(
              `live MLS through Oregon Data Share, new listings, price changes, pendings, and closings on ${cityName} homes`,
            )}
            action={{ label: v3Text('Full market pulse'), href: '/housing-market' }}
          />
        ) : null}

        {/* Pattern 6 - the FAQ answers, the recorded documents as legal doors,
            and every outbound edge. The freshness sentence carries the same
            clock the Dataset's dateModified publishes. */}
        <V3Quiet
          id="faq"
          eyebrow="Common questions"
          heading={`${publicName} real estate questions`}
          items={exploreItems}
          note={`Market figures on this page come from the regional MLS through Oregon Data Share.${
            asOfLabel ? ` Market data updated ${asOfLabel}.` : ''
          }`}
        />

        {firstPost ? (
          <V3Ledger
            id="guides"
            eyebrow={v3Text(`Reading · ${cityName}`)}
            heading={v3Text('Guides and market notes')}
            rows={[firstPost, ...restPost]}
            action={{ label: v3Text('Every guide'), href: '/blog' }}
          />
        ) : null}
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo
          only when it is NOT nested in sectioning content. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
