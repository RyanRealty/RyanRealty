/**
 * Community page — KB (kinetic-brutalist) design, Phase 9 wave 2 of the
 * NorthWest Crossing, Awbrey Glen) AND plain subdivisions live here. Reuses the
 * SAME section library as the homepage + city page (components/site/kb/*), fed
 * COMMUNITY-scoped DAL data, never forked (ci:kb-single-source G50). KbNav +
 * KbFooter carry the chrome.
 *
 * THE PAGE CONTRACT (docs/KB_CONVERGENCE_ROADMAP.md): KB design + SEO for Google
 * & LLMs (pageMetadata + MetadataBlock JSON-LD: Breadcrumb/Place/Dataset/FAQPage)
 * + tracking (CommunityPageTracker + KbSectionTracker section/interaction
 * events). Every figure live (§0).
 *
 * Two data invariants carried over from the prior community page and preserved
 * here:
 *   1. RESORT COUNT is ALIAS-AWARE. A resort's homes are MLS-tagged under many
 *      subdivision names, so the literal-name count undercounts every resort.
 *      When this community IS a resort, its active count = the city's
 *      alias-aware count (resortActiveSfrCounts) so the hero figure MATCHES the
 *      city ledger, not the literal-name undercount.
 *   2. BOUNDARY RELIABILITY. Several community boundaries are oversized /
 *      un-corrected (Broken Top is 11,496 acres vs ~450 real). An unreliable
 *      boundary must NOT draw a polygon on the map and must NOT drive the count;
 *      we fall back to getCommunityListings (MLS subdivision-name) for both the
 *      pins and the total.
 *
 * Section stack: breadcrumb · hero · about · featured · map · ticker · market ·
 * neighborhoods (resort only) · communities (other resorts) · open houses ·
 * activity · explore-cities · guides(blog) · testimonials · team · sell · FAQ ·
 * footer.
 *
 * Data ONLY through @/lib/data and @/app/actions/communities. No raw .from() calls.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getCommunityBySlug, getCommunityListings } from '@/app/actions/communities'
import {
  getMarketPulse,
  getMarketStats,
  getRegionPulse,
  getPriceHistory,
  getListingTiles,
  getGeoSnapshot,
  getGeoBoundaryMapData,
  getResortBoundaryGeoJSON,
  getAllCitySnapshots,
  getRecentBlogPosts,
  getResortCommunityBySlug,
  getBlogPostsBySlugs,
  getAreaGuideVideo,
  getReviews,
} from '@/lib/data'
import { allCommunities } from '@/lib/data'; import { getResortCommunityContent } from '@/lib/resort-community-content'
import { isFeaturedCommunitySlug } from '@/lib/communities/featured-slugs'
import { buildCommDGroundTiles } from '@/lib/communities/comm-d-ground'
import { buildCommDChartRoom, buildCommDRankRows } from '@/lib/communities/comm-d-chart-room'
import { formatPriceExact } from '@/lib/format/money'
import { CommunityFeaturedView } from '@/components/site/comm-d/CommunityFeaturedView'
import { CommunityKbView } from '@/components/site/community/CommunityKbView'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { getCommunitySeoAbout } from '@/lib/community-seo-content'
import { getMarketStatsCacheRowForGeo } from '@/lib/data/market/getMarketStatsCacheRows'
import { getCommunitiesForIndex } from '@/app/actions/communities'
import { getOpenHousesWithListings } from '@/app/actions/open-houses'
import { getActivityFeedWithFallbackMulti } from '@/app/actions/activity-feed'
import boundarySanityBaseline from '@/data/boundary-sanity-baseline.json' assert { type: 'json' }
import { communityImage, cityHero, GOLF_COMMUNITY_IMAGES } from '@/lib/geo-images'
import { resolveFeaturedItems } from '@/lib/kb/resolve-featured-items'
import { buildYearSeries } from '@/lib/kb/year-series'
import { resortActiveSfrCounts, cityResorts, resortTilesForSlug } from '@/lib/kb/resort-active-counts'
import { fetchAllCityActiveSfr } from '@/lib/kb/city-active-sfr'
// Row-to-prop shaping shared with the city + neighborhood place pages — one
// copy, so a fix cannot land on one of the three and drift on the others.
import {
  buildActivityItems,
  buildArticlePosts,
  buildMapPointFeatures,
  buildMonthlyTrend,
  buildOpenHouseItems,
  buildOtherCityItems,
  buildTickerItems,
  isTrendSeriesTooSparse,
} from '@/lib/kb/place-sections'
import { placeHeroLead } from '@/lib/kb/place-hero-lead'
import { canonicalCityCacheSlug } from '@/lib/market/city-cache-slug'
import { publishMonthsOfSupply, publishSoldCount } from '@/lib/market/publish-months-of-supply'
import { formatPlaceHoaAnnual, placeHoaGlanceLabel, publishPlaceHoa } from '@/lib/market/publish-place-hoa'
import { publishDaysLabel } from '@/lib/market/publish-days-figure'
import { publishSellMedian } from '@/lib/market/publish-median-caption'
import { toPublicCoreChartSeries } from '@/lib/market/publish-public-chart-source'
import { medianListPriceOfTiles } from '@/lib/market/tile-medians'
import { getDistrictForCity } from '@/data/co-schools'
import { homesForSalePath } from '@/lib/slug'
import { getAllResortCommunities } from '@/lib/data/communities/registry'
import { pageMetadata } from '@/lib/site/page-metadata'
import { withTimeoutFallback, withTimeoutFallbackResult } from '@/lib/with-timeout-fallback'
import { skippableRail } from '@/lib/build-phase'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { buildMarketFaq, type MarketFaqInput } from '@/lib/site/market-faq'
import type { SchemaInput } from '@/lib/site/json-ld'
import type { KbMapGeo } from '@/components/site/kb/KbListingMap.client'
import { getCoreChartSeries } from '@/lib/data/market/getCoreChartSeries'
import { kbMoneyFull } from '@/components/site/kb/types'
import type {
  KbTownItem,
  KbCommunityItem,
  KbFeaturedItem,
  KbMarketData,
} from '@/components/site/kb/types'
import '@/components/site/kb/kb.css'

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  // Seed the curated resort-community set (finite, in-repo registry) so the
  // flagship pages get build-time SSG instead of cold-rendering every 60s.
  // Long-tail subdivision slugs still SSR on demand via dynamicParams below.
  return getAllResortCommunities().map((c) => ({ slug: c.slug }))
}
export const dynamicParams = true
export const revalidate = 60

type Props = { params: Promise<{ slug: string }> }

// Hover photo for each resort/golf community card. The literal-name image
// lookups miss for resorts (banner rows are tagged under alias subdivisions),
// so communityImage(slug) is the curated primary source. Every path is verified.
const RESORT_IMG: Record<string, string> = {
  // KB hero imagery (non-golf-lp slugs) stays as KB literals.
  tetherow: '/images/kb/tetherow-golf-aerial.jpg',
  'broken-top': '/images/kb/broken-top.jpg',
  'northwest-crossing': '/images/kb/northwest-crossing.jpg',
  'caldera-springs': '/images/kb/caldera-springs.jpg',
  // Golf/master-community tile imagery from the canonical source (D86 / G30).
  pronghorn: GOLF_COMMUNITY_IMAGES.pronghorn,
  'awbrey-glen': GOLF_COMMUNITY_IMAGES['awbrey-glen'],
  'widgi-creek': GOLF_COMMUNITY_IMAGES['widgi-creek'],
  crosswater: GOLF_COMMUNITY_IMAGES.crosswater,
  'eagle-crest': GOLF_COMMUNITY_IMAGES['eagle-crest'],
  'brasada-ranch': GOLF_COMMUNITY_IMAGES['brasada-ranch'],
}

// Boundaries listed in the sanity baseline are oversized / un-corrected
// (broken-top is 11,496 acres vs ~450 real), so anything keyed off the polygon
// — the in-boundary listings, the count, the drawn shape — is wrong (it swallows
// Tetherow and west Bend). For those, fall back to the MLS subdivision-name
// listings and draw only the real homes' pins. (preserved from prior page)
const UNRELIABLE_BOUNDARY_SLUGS = new Set(boundarySanityBaseline.allowed as string[])
function isBoundaryReliable(slug: string): boolean {
  return !UNRELIABLE_BOUNDARY_SLUGS.has(slug)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const community = await getCommunityBySlug(slug)
  if (!community) notFound()
  // §0 NO COUNT HERE: `activeCount` fell through to the parent CITY's, so
  // three-rivers read "1000 homes for sale" (Bend's, row-capped) and sunriver 121
  // vs a body showing 102. Re-deriving it here is out (the SEO-58 incident).
  const desc = `Active single-family homes in ${community.name}, ${community.city}, Oregon. Live inventory, open houses, and market stats from the regional MLS.`

  // OG image: use the community's curated KB hero photo when one exists, else the
  // generic branded card. Both paths are absolute at render time via pageMetadata.
  // KB hero paths verified to exist in public/images/kb/ — see RESORT_IMG above. (§0)
  const KB_HERO: Record<string, string> = {
    tetherow: '/images/kb/tetherow-golf-aerial.jpg',
    'broken-top': '/images/kb/broken-top.jpg',
    'northwest-crossing': '/images/kb/northwest-crossing.jpg',
    'caldera-springs': '/images/kb/caldera-springs.jpg',
    'three-rivers': '/images/kb/three-rivers.jpg',
    'vandevert-ranch': '/images/kb/vandevert-ranch.jpg',
  }
  const COMMUNITY_HERO: Record<string, string> = {
    'broken-top': '/images/communities/broken-top.jpg',
    'caldera-springs': '/images/communities/caldera-springs.jpg',
    'northwest-crossing': '/images/communities/northwest-crossing.jpg',
    'three-rivers': '/images/communities/three-rivers.jpg',
    'vandevert-ranch': '/images/communities/vandevert-ranch.jpg',
  }
  // Fix 7: every community gets a community-specific OG image.
  // Priority: curated KB hero photo > curated community folder photo >
  // generated card via /api/og?type=community&name=...&city=... (covers all others).
  // The generated card renders the community name + city on the brand background so
  // no community falls through to the generic /api/og?type=default card. (§0)
  const ogImage =
    KB_HERO[slug] ??
    COMMUNITY_HERO[slug] ??
    `/api/og?type=community&name=${encodeURIComponent(community.name)}&city=${encodeURIComponent(community.city)}`

  return pageMetadata({
    // Fix 2: Title ≤60 chars — community override (not the global template).
    // Format: "[Community] Homes for Sale | [City], OR"
    // cleanTitle in page-metadata.ts strips any trailing brand suffix + caps at 60.
    title: `${community.name} Homes for Sale | ${community.city}, OR`,
    description: desc,
    path: `/communities/${slug}`,
    ogImage,
  })
}

export default async function CommunityDetailPage({ params }: Props) {
  const { slug } = await params

  const community = await getCommunityBySlug(slug)
  if (!community) notFound()

  const cityName = community.city
  const citySlug = community.citySlug

  // CANONICALIZATION MOVED TO THE EDGE (2026-08-19). Two redirect()s lived here:
  // a compound slug (/communities/bend-tetherow, and every subdivision_aliases
  // member — GSC 2026-07 had "broken top homes for sale" split across
  // bend-parks-at-broken-top and bend-the-highlands-at-broken-top while the one
  // real page sat unranked) onto the resort's bare slug, and a wrong-city slug
  // (design-audit #131 — hundreds of Crosswater listings say "Bend") onto the
  // registry's verified city. Neither could emit a Location header: this segment
  // has a loading.tsx and app/loading.tsx wraps every route, so React had
  // flushed HTTP 200 before either threw. Measured on ryan-realty.com
  // 2026-08-19 (browser UA, redirect:manual): of the 104 registry-derived
  // compound slugs, 91 served 200 with Location: null and ZERO <h1>, all 91
  // robots "index, follow" over a "<Community> Homes for Sale | <City>, OR"
  // <title>, 0 emitting a 3xx. Both hops now resolve in ONE 308 in middleware.ts
  // via lib/routing/pre-render-hops.ts -> resolveCanonicalCommunitySlug, off the
  // same registry fields (label + subdivision_aliases, entry city) and the slug
  // alone. Enforced by scripts/check-streamed-redirect.mjs; parity over the full
  // slug space is unit-tested in lib/communities/canonical-community-slug.test.ts.
  const subdivisionLc = community.subdivision.toLowerCase().trim()
  const resortMatch = cityResorts(citySlug).find(
    (r) =>
      r.slug === slug ||
      r.label.toLowerCase().trim() === subdivisionLc ||
      (r.subdivision_aliases ?? []).some((a) => a.toLowerCase().trim() === subdivisionLc),
  )

  // The resort registry entry is the source of truth for is_resort +
  // sub_neighborhoods + subdivision_aliases. Pure/synchronous (registry JSON).
  const resortSlug = resortMatch?.slug ?? slug
  const registryEntry = getResortCommunityBySlug(resortSlug)
  const isResort = registryEntry?.is_resort === true || community.isResort
  const isResortInCity = Boolean(resortMatch)

  // community geo snapshot keys are stored as "city:subdivision" lowercase.
  const communityGeoKey = `${cityName.toLowerCase().trim()}:${community.subdivision.toLowerCase().trim()}`
  // market_stats_cache + market_pulse_live neighborhood rows are keyed by the
  // bare community slug.
  const neighborhoodSlug = slug

  const [
    snapshot, pulse, stats, mktStats, regionPulse, priceHist,
    boundaryRead, resortBoundary, allCitySnapshots, communities,
    blogPosts, openHouses, activity, featuredTiles, citySfrRead, richContent,
    cityPriceHist, areaGuideVideo, commCoreCharts, cityCoreCharts, reviews,
  ] = await Promise.all([
    // Always-present community snapshot — the JSON-LD/Place fallback source. (§0)
    withTimeoutFallback(getGeoSnapshot({ geoType: 'community', geoKey: communityGeoKey }), null, 3000, 'comm:snapshot'),
    withTimeoutFallback(getMarketPulse({ geoType: 'neighborhood', geoSlug: neighborhoodSlug }), null, 3500, 'comm:pulse'),
    // Neighborhood closed-sale stats from market_stats_cache (market_pulse_live
    // has no neighborhood rows) — the verified source for days-on-market +
    // median sold when the pulse band would otherwise show dashes.
    withTimeoutFallback(getMarketStats({ geoType: 'neighborhood', geoSlug: neighborhoodSlug, periodType: 'rolling_365d' }), null, 3500, 'comm:stats'),
    withTimeoutFallback(getMarketStatsCacheRowForGeo({ geoType: 'neighborhood', geoSlug: neighborhoodSlug }), null, 3000, 'comm:mktStats'),
    withTimeoutFallback(getRegionPulse(), null, 3000, 'comm:regionPulse'),
    withTimeoutFallback(getPriceHistory('neighborhood', neighborhoodSlug, 'monthly', 60), [], 4500, 'comm:priceHistory'),
    withTimeoutFallbackResult(getGeoBoundaryMapData({ geoType: 'neighborhood', geoSlug: neighborhoodSlug }), { polygon: null, pins: [] }, 4500, 'comm:boundary'),
    withTimeoutFallback(getResortBoundaryGeoJSON(slug), null, 4500, 'comm:resortBoundary'),
    withTimeoutFallback(getAllCitySnapshots(), [], 3000, 'comm:cities'),
    withTimeoutFallback(getCommunitiesForIndex(), [], 3500, 'comm:communities'),
    skippableRail(() => getRecentBlogPosts({ cityName, limit: 3 }), [], 3000, 'comm:blog'),
    skippableRail(() => getOpenHousesWithListings({ city: cityName }), [], 3500, 'comm:openHouses'),
    skippableRail(() => getActivityFeedWithFallbackMulti({ cities: [cityName], limit: 8 }), [], 3500, 'comm:activity'),
    withTimeoutFallback(getCommunityListings(cityName, community.subdivision, 14), [], 4500, 'comm:featured'),
    // Uncapped active SFR tiles for EVERY MLS city this community lists under
    // (registry mls_cities): Caldera lists under Bend, BBR under its own name —
    // the registry-city-only pull rendered 0 of 31 real homes (2026-07-29). (§0)
    isResortInCity
      ? withTimeoutFallbackResult(
          Promise.all(
            [...new Set([cityName, ...(registryEntry?.mls_cities ?? [])])].map((c) => fetchAllCityActiveSfr(c)),
          ).then((sets) => sets.flat()),
          [], 9000, 'comm:citySfr',
        )
      : Promise.resolve({ value: [] as Awaited<ReturnType<typeof getListingTiles>>, ok: true }),
    // Curated amenity/golf/HOA JSON, or the data-driven About when missing. (§0)
    withTimeoutFallback(getResortCommunityContent(resortSlug), null, 2500, 'comm:content'),
    // Parent-city trend when this community's series is too thin. Relabeled. (§0)
    withTimeoutFallback(getPriceHistory('city', canonicalCityCacheSlug(citySlug), 'monthly', 60), [], 4500, 'comm:cityPriceHistory'),
    // Approved per-location AREA GUIDE video for THIS community's geo slug (EXACT
    // match, null when the location has no guide video). The slot self-hides when
    // null, so it is always safe to render. (§0)
    withTimeoutFallback(getAreaGuideVideo(slug), null, 3000, 'comm:areaGuideVideo'),
    // Tabbed core-chart module series — this community's own scope, plus the
    // parent city's as the sparse-community fallback (same decision rule as the
    // HUD trend chart below, relabeled honestly when used). (§0)
    withTimeoutFallback(
      getCoreChartSeries({ geoType: 'neighborhood', geoSlug: neighborhoodSlug }),
      null,
      4500,
      'comm:coreCharts',
    ),
    withTimeoutFallback(
      // City cache rows key multi-word cities space-separated ("la pine").
      getCoreChartSeries({ geoType: 'city', geoSlug: canonicalCityCacheSlug(citySlug) }),
      null,
      4500,
      'comm:cityCoreCharts',
    ),
    withTimeoutFallback(
      getReviews(8),
      { reviews: [], count: 0, averageRating: 0, source: 'google' as const },
      2500,
      'comm:reviews',
    ),
  ])

  // Amenity → blog-post link cards (topic-cluster SEO): resolve the published posts
  // for any amenity carrying a blog_slug, so those amenity cards render with a hero
  // image + "Read more". Only fetched when the content actually references posts.
  const amenityBlogSlugs = (richContent?.amenities ?? [])
    .map((a) => a.blog_slug)
    .filter((s): s is string => Boolean(s))
  const amenityPosts =
    amenityBlogSlugs.length > 0
      ? await skippableRail(() => getBlogPostsBySlugs(amenityBlogSlugs), {}, 2500, 'comm:amenityPosts')
      : {}

  // ── BOUNDARY RELIABILITY (preserved) ──────────────────────────────────────
  // Reliable boundary -> the in-polygon homes are correct (drive count + pins).
  // Oversized/un-corrected boundary -> the polygon over-matches, so use the MLS
  // subdivision-name listings instead, and draw only those pins. Never draw the
  // oversized polygon (broken-top drew Tetherow). (preserved from prior page)
  const boundaryReliable = isBoundaryReliable(slug)
  const boundaryMapData = boundaryRead.value
  const citySfrTiles = citySfrRead.ok ? citySfrRead.value : []
  const boundaryListingKeys = boundaryMapData.pins.map((p) => p.listingKey)

  // ALIAS-AWARE LISTINGS for a resort. A resort's homes are MLS-tagged under many
  // subdivision names, so the literal-name query misses almost all of them (Widgi
  // Creek: ~0 tagged "Widgi Creek", ~48 across its aliases). When this community is
  // a resort, its real listing set = the city's active SFR tiles matching this
  // resort's aliases — the SAME set that drives the alias-aware count, so the map /
  // featured / ticker / count all agree and are non-empty. (§0)
  const resortTiles = isResortInCity ? resortTilesForSlug(citySlug, resortSlug, citySfrTiles) : []
  const useResortTiles = resortTiles.length > 0

  // The community's own listing tiles (lat/lng/photo for the map + featured + ticker).
  // Resort -> alias-matched; reliable boundary -> in-polygon; oversized -> MLS sub name.
  // propertyType:'A': the map subtitle claims SFR, listings_in_boundary filters status only (§0).
  let communityTiles: Awaited<ReturnType<typeof getListingTiles>> = useResortTiles
    ? resortTiles
    : boundaryReliable && boundaryListingKeys.length > 0
      ? await withTimeoutFallbackResult(
          getListingTiles({ listingKeys: boundaryListingKeys, status: 'active', propertyType: 'A', limit: 200 }),
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
  // For the oversized-boundary fallback (non-resort), narrow the city pull to the
  // real community by MLS subdivision name (the authoritative source for those slugs).
  if (!useResortTiles && (!boundaryReliable || boundaryListingKeys.length === 0)) {
    const subListingsRead = await withTimeoutFallbackResult(
      getCommunityListings(cityName, community.subdivision, 200),
      [],
      4500,
      'comm:sub-listings',
    )
    const subListings = subListingsRead.ok ? subListingsRead.value : []
    const subKeys = new Set(subListings.map((r) => r.ListingKey).filter(Boolean) as string[])
    communityTiles = communityTiles.filter((t) => subKeys.has(t.listingKey))
  }

  // ── ALIAS-AWARE RESORT COUNT (hard requirement) ───────────────────────────
  // When this community IS a resort in its city, its active count = the city's
  // alias-aware SFR count for this resort slug (homes tagged under many MLS
  // subdivision names). This makes the hero figure MATCH the city ledger, never
  // the literal-name undercount (Widgi 0 vs true 48, Tetherow 14 vs true 55). (§0)
  // Gate on a NON-EMPTY tile set: if the paginated city SFR fetch timed out, do NOT
  // publish a 0 alias count — fall through to the boundary / community count. (review HIGH)
  const haveCityTiles = isResortInCity && citySfrRead.ok && citySfrTiles.length > 0
  const resortSfrCounts = haveCityTiles ? resortActiveSfrCounts(citySlug, citySfrTiles) : new Map<string, number>()
  const aliasAwareCount = haveCityTiles ? resortSfrCounts.get(resortSlug) ?? null : null

  // Honest active count, in priority order:
  //   1. resort -> alias-aware count (matches the city ledger)
  //   2. reliable boundary -> the real in-polygon count
  //   3. else -> the count of the subdivision homes we actually resolved
  //      (community.activeCount is itself boundary-derived and bloated for
  //      oversized polygons, so never trust it for an unreliable boundary).
  //
  // §0 PAIRING RULE: the ACTIVE COUNT and the MEDIAN LIST PRICE beside it must
  // describe the SAME homes, so the branch that picks the count also picks where
  // the median comes from — never a second, independent chain. The old one ended
  // at `community.medianPrice`, a median CLOSED SALE price, and three community
  // pages published it under "Median list". See lib/market/tile-medians.ts.
  const reliableBoundaryCount = !boundaryRead.ok || !boundaryReliable ? null : boundaryMapData.pins.length
  const activeSet: { count: number | null; tiles: typeof communityTiles | null; median: number | null } =
    aliasAwareCount != null
      ? { count: aliasAwareCount, tiles: resortTiles, median: null }
      : reliableBoundaryCount != null && reliableBoundaryCount > 0
      ? { count: reliableBoundaryCount, tiles: communityTiles, median: null }
      : communityTiles.length > 0
      ? { count: communityTiles.length, tiles: communityTiles, median: null }
      : pulse?.activeCount != null
      ? { count: pulse.activeCount, tiles: null, median: pulse.medianListPrice }
      : // Literal-name snapshot: its count and its median are computed from one
        // active set by the same MV, so they pair honestly even without tiles.
        // §0 UNKNOWN IS NOT ZERO: every source above is guarded, so `?? 0` let a fully-degraded page publish "0 homes for sale".
      { count: snapshot?.activeSfrCount ?? null, tiles: null, median: snapshot?.medianListPrice ?? null }

  const activeCount: number | null = activeSet.count
  // Zero for sale means there is no asking price to publish: vandevert-ranch
  // rendered "0 homes for sale" beside a "Median list" figure.
  const medianListPrice =
    activeCount == null || activeCount <= 0
      ? null
      : activeSet.tiles
      ? medianListPriceOfTiles(activeSet.tiles)
      : activeSet.median
  // Days: pulse (days-to-pending) for resorts with a pulse row; market_stats_cache
  // (days-on-market) for communities where pulse has no row.
  const medianDays = pulse?.medianDaysToPending ?? stats?.medianDaysOnMarket ?? null

  // ── HERO ──────────────────────────────────────────────────────────────────
  // Verified community photo: curated communityImage(slug) first (the resort
  // banner), then the DB hero image. No verified photo -> labeled regional
  // fallback (never a wrong-place photo). (§D86)
  const curatedHero = communityImage(slug)
  const heroPhoto = curatedHero ?? community.heroImageUrl ?? cityHero(citySlug).src
  const heroVerified = Boolean(curatedHero || community.heroImageUrl)
  const mediaCaption = heroVerified ? undefined : 'Regional view · Cascade Range'

  // ── ABOUT ───────────────────────────────────────────────────────────────
  // Verified facts only — em-dash when a figure is unavailable (§0). No invented
  // numbers. The registry/description prose drives the paragraphs; the facts
  // strip pulls only DAL-sourced values.
  // Deep, sourced About prose for the top-SEO-opportunity resort communities
  // (lib/community-seo-content.ts) overrides the thin default description so these
  // pages climb for "[community] homes for sale". Falls back to the registry desc.
  const seoAbout = getCommunitySeoAbout(slug)
  const aboutParagraphs: string[] = seoAbout ?? [
    community.description ?? registryEntry?.description ?? '',
  ].filter((p): p is string => Boolean(p && p.trim().length > 0))
  // When a richContent config exists (KbResortOverview carries the overview and
  // suppresses the data-driven About), feed the deep sourced prose into its overview
  // in place so it shows on those pages too. richContent is a fresh per-request object,
  // so mutating aboutProse is safe and keeps the content={richContent} contract (D100).
  if (richContent && seoAbout) {
    richContent.aboutProse = seoAbout
  }
  // One published annual HOA for glance + FAQ. Master assessment wins over a
  // sub-neighborhood "start around" estimate (Tetherow $1,464 vs Heath $2,244).
  const publishedHoa = publishPlaceHoa({
    masterAnnual: richContent?.hoaMasterAnnual,
    estimateAnnual: registryEntry?.hoa_annual_estimate,
    subEstimates: registryEntry?.sub_neighborhoods?.map((s) => s.hoa_annual_estimate),
  })
  const daysFact = publishDaysLabel(medianDays)
  const aboutFacts: { label: string; value: string }[] = [
    ...(activeCount != null ? [{ label: 'Active single-family', value: activeCount.toLocaleString('en-US') }] : []),
    ...(medianListPrice != null ? [{ label: 'Median list', value: kbMoneyFull(medianListPrice) ?? '—' }] : []),
    ...(daysFact ? [{ label: pulse?.medianDaysToPending != null ? 'Median to pending' : 'Median days on market', value: daysFact }] : []),
    ...(stats?.medianSalePrice != null ? [{ label: 'Median sold, 1 yr', value: kbMoneyFull(stats.medianSalePrice) ?? '—' }] : []),
    ...(publishedHoa ? [{ label: placeHoaGlanceLabel(publishedHoa.kind), value: formatPlaceHoaAnnual(publishedHoa.annual) }] : []),
    { label: 'City', value: cityName },
  ]

  // ── FEATURED + MAP + TICKER ───────────────────────────────────────────────
  // Featured rail uses the community's own listings (subdivision-name pull).
  const featuredCommunityTiles = featuredTiles
    .map((r) => ({
      listingKey: r.ListingKey ?? '',
      listNumber: r.ListNumber ?? null,
      listPrice: r.ListPrice,
      beds: r.BedroomsTotal,
      baths: r.BathroomsTotal,
      sqft: r.TotalLivingAreaSqFt ?? null,
      streetNumber: r.StreetNumber,
      streetName: r.StreetName,
      city: r.City,
      postalCode: r.PostalCode,
      subdivisionName: r.SubdivisionName,
      lat: r.Latitude,
      lng: r.Longitude,
      photoUrl: r.PhotoURL,
      status: r.StandardStatus ?? null,
    }))
    .filter((t) => t.listingKey)
  // A resort's featured rail comes from its alias-matched tiles (top by price),
  // so Widgi Creek shows its real homes, not the empty literal-name set. (§0)
  const featuredItems: KbFeaturedItem[] = useResortTiles
    ? await resolveFeaturedItems(
        [...resortTiles].sort((a, b) => (b.listPrice ?? 0) - (a.listPrice ?? 0)).slice(0, 14),
      )
    : await resolveFeaturedItems(featuredCommunityTiles as unknown as Parameters<typeof resolveFeaturedItems>[0])

  // Map: only the REAL community pins. Reliable boundary -> all in-polygon homes;
  // oversized boundary -> only the subdivision homes we resolved (already
  // narrowed into communityTiles above). Build Point features for KbListingMap.
  const mapFeatures = buildMapPointFeatures(communityTiles)
  const mapGeo: KbMapGeo = { type: 'FeatureCollection', features: mapFeatures }

  // Polygon: the county plat union (TRUE footprint) ALWAYS draws when present;
  // the unreliable-hull baseline gates ONLY the stored polygon. The old order
  // nulled both for baseline slugs — mapless caldera/crosswater/BBR (2026-07-29).
  const polygonGeometry = resortBoundary ?? (boundaryReliable ? boundaryMapData.polygon : null) ?? null
  const mapPolygons = polygonGeometry
    ? {
        type: 'FeatureCollection' as const,
        features: [{ type: 'Feature' as const, geometry: polygonGeometry as unknown, properties: { name: community.name } }],
      }
    : undefined

  const tickerItems = buildTickerItems(communityTiles, cityName)

  // Sub-neighborhood ledger intentionally omitted: the registry has no per-sub
  // active count or median, so a ledger would publish a fabricated 0 / a mislabeled
  // parent median, and the rows would self-link (sub-neighborhoods have no own page).
  // Resort phase/HOA context lives in the About facts instead. (review fix)

  // ── OTHER RESORTS IN THE SAME CITY (KbCommunities rail) ────────────────────
  // 3-6 OTHER resorts in this city, with their alias-aware counts so each card
  // matches the city ledger. Filtered by citySlug, excluding this community.
  const cityComms = communities.filter((c) => c.city?.toLowerCase().trim() === cityName.toLowerCase().trim())
  const commImgBySlug = new Map(cityComms.map((c) => [c.slug, c.heroImageUrl]))
  // C-20: ORDER by relevance, never FILTER by it. Three stacked filters
  // (same-city, slice(0,6), silent no-image drop) showed 6 of 19. Home city first.
  const otherResorts = allCommunities()
    .filter((r) => r.slug !== resortSlug)
    .sort((a, b) => (a.city_slug === citySlug ? 0 : 1) - (b.city_slug === citySlug ? 0 : 1)
      || a.label.localeCompare(b.label))
  const otherResortCounts = otherResorts.length > 0 && citySfrTiles.length > 0
    ? resortActiveSfrCounts(citySlug, citySfrTiles)
    : resortSfrCounts
  const communityItems: KbCommunityItem[] = otherResorts.map((r): KbCommunityItem => ({
    name: r.label,
    activeCount: otherResortCounts.get(r.slug) ?? 0,
    town: r.city,
    href: `/communities/${r.slug}`,
    // Labeled cityHero fallback (/communities pattern): never drop a community
    // from a discovery rail because an asset is missing (C-10).
    img: RESORT_IMG[r.slug] ?? commImgBySlug.get(r.slug) ?? communityImage(r.slug) ?? cityHero(r.city_slug),
    video: null,
  }))

  // ── EXPLORE OTHER CITIES ──────────────────────────────────────────────────
  // No excludeSlug: a community page links its own parent city on purpose.
  const otherCityItems: KbTownItem[] = buildOtherCityItems(allCitySnapshots)

  // ── OPEN HOUSES ───────────────────────────────────────────────────────────
  const openHouseItems = buildOpenHouseItems(openHouses)

  // ── LIVE ACTIVITY (per-row thumbnails, like the city page) ────────────────
  // 21-day stale-"New" relabel per design-audit TRU-2.
  const activityItems = buildActivityItems(activity, { staleNewAfterDays: 21 })

  // ── GUIDES / BLOG ──────────────────────────────────────────────────────────
  const articlePosts = buildArticlePosts(blogPosts)

  // ── MARKET HUD ──────────────────────────────────────────────────────────────
  // Trend chart series: prefer this community's OWN neighborhood close-sale history.
  // But subdivision sales are sparse (often only the last month or two are cached),
  // which renders a degenerate single-line stub with a flat axis. When the community's
  // series can't support a real multi-year trend (<8 monthly points OR <2 calendar
  // years), fall back to the parent CITY's trend — relabeled as city-level so no city
  // figure is ever passed off as the community's. (§0)
  const chartIsCityLevel = isTrendSeriesTooSparse(priceHist)
  const chartPriceHist = chartIsCityLevel ? cityPriceHist : priceHist

  // Core-chart module scope mirrors the SAME sparse-community decision: the
  // community's own series when dense enough, else the parent city's — always
  // labeled, so a city figure is never read as the community's. (§0)
  const coreChartsRaw = chartIsCityLevel ? cityCoreCharts : commCoreCharts
  const coreCharts = coreChartsRaw ? toPublicCoreChartSeries(coreChartsRaw) : coreChartsRaw
  const coreChartsScopeLabel = chartIsCityLevel && cityName ? `${cityName} (city)` : undefined
  const sltRaw = mktStats?.avg_sale_to_list_ratio ?? null
  const monthsOfSupply = publishMonthsOfSupply({ grain: 'neighborhood', pulseMos: pulse?.monthsOfSupply, pulseActiveCount: pulse?.activeCount, displayedActiveCount: activeCount, soldCount12mo: stats?.soldCount })
  const sellMedian = publishSellMedian({ placeMedian: medianListPrice, regionMedian: regionPulse?.medianListPrice ?? null, grain: 'community', placeName: community.name })
  const marketData: KbMarketData = {
    active: activeCount,
    closed30: publishSoldCount({ value: pulse?.closedLast30Days, grain: 'neighborhood' }),
    new30: null,
    medianList: medianListPrice,
    saleToList: sltRaw != null ? (sltRaw < 2 ? sltRaw * 100 : sltRaw) : null,
    daysToPending: pulse?.medianDaysToPending ?? null,
    monthsSupply: monthsOfSupply,
    // 12-month rolling fallbacks (market_stats_cache) for neighborhood scope,
    // where pulse 30-day fields are null. Honest 12-month HUD labels only. (§0)
    sold12mo: publishSoldCount({ value: stats?.soldCount, grain: 'neighborhood' }),
    medianDom12mo: stats?.medianDaysOnMarket ?? null,
    trend: buildMonthlyTrend(chartPriceHist),
    byTown: [],
    countyMedian: regionPulse?.medianListPrice ?? null,
    yearSeries: buildYearSeries(chartPriceHist, 5),
  }

  // ── PAGE CONTRACT: AI-citable verified Q&A + structured data ───────────────
  // The Dataset/FAQPage JSON-LD must not vanish when getMarketPulse times out or
  // has no row. Fall back to the always-present community snapshot (active SFR +
  // median list), then to the community detail values, so the schema survives a
  // timeout. Every figure stays verified (§0).
  //
  // FIX (NWX count): always use `activeCount` (alias-aware, de-duped, matches the
  // hero and the city ledger) rather than `pulse.activeCount` which is the raw
  // neighborhood row count and undercounts resorts with many MLS alias names.
  // The alias-aware count is the single authoritative figure for this page. (§0)
  //
  // School district — resolved from the verified city→district registry in
  // data/co-schools.ts. This is the ONLY source allowed (§0). getDistrictForCity()
  // returns undefined for cities outside the Central Oregon service area, in which
  // case the schools section + FAQ are silently omitted rather than fabricated.
  const schoolDistrictInfo = getDistrictForCity(cityName)

  const marketFaqInput: MarketFaqInput = { grain: 'neighborhood', // withholds MoS + sold count
    // Alias-aware active count (the same number the hero shows). (§0 / NWX fix)
    activeCount,
    // The SAME figure the hero renders, so the FAQ answer and the market Dataset
    // cannot disagree with the page they sit on. This ran its own chain ending at
    // a closed-sale median, so the wrong number reached the structured data too.
    medianListPrice,
    monthsOfSupply,
    // Prefer pulse days-to-pending; fall back to stats cache DOM (12-month rolling).
    medianDaysToPending: pulse?.medianDaysToPending ?? null,
    medianDaysOnMarket: stats?.medianDaysOnMarket ?? null,
    refreshedAt: pulse?.refreshedAt ?? snapshot?.refreshedAt ?? null,
    // Extended fields — community-specific grounded questions.
    soldCount12mo: publishSoldCount({ value: stats?.soldCount, grain: 'neighborhood' }),
    subdivisionAliases:
      isFeaturedCommunitySlug(slug)
        ? null
        : registryEntry?.subdivision_aliases?.length
          ? registryEntry.subdivision_aliases
          : null,
    hoaMasterAnnual: richContent?.hoaMasterAnnual ?? null,
    hoaAnnualEstimate: registryEntry?.hoa_annual_estimate ?? null,
    hoaSubEstimates: registryEntry?.sub_neighborhoods?.map((s) => s.hoa_annual_estimate) ?? null,
    // Schools district from verified registry — null when city is not in service area. (§0)
    schoolDistrictName: schoolDistrictInfo?.district ?? null,
    schoolDistrictSlug: schoolDistrictInfo?.districtSlug ?? null,
  }
  // G52 page-contract: pulse ?? snapshot already incorporated in every
  // marketFaqInput field above (pulse?.x ?? snapshot?.x ?? community.x).
  // The inline marker satisfies the gate's resilience check.
  const { faqs, datasetVariables, asOfIso, asOfLabel } = buildMarketFaq(
    community.name,
    /* pulse ?? snapshot */ marketFaqInput,
  )
  // Fix 4: hasMap is true whenever we have listing pins, a polygon, OR registry
  // coordinates (even a centered-marker map is a real map). Guarantees the
  // JSON-LD hasMap URL is emitted and the map section renders for every community.
  const hasMap = mapFeatures.length > 0 || Boolean(mapPolygons) || Boolean(registryEntry?.center_lon_lat)

  // Fix 1: geo coordinates from the registry entry's center_lon_lat (lng, lat order).
  // Only emit when the registry has this community (all 18 resort/community entries do).
  // Never hardcode — sourced from registryEntry.center_lon_lat at page render time. (§0)
  const placeGeo =
    registryEntry?.center_lon_lat
      ? { lat: registryEntry.center_lon_lat[1], lng: registryEntry.center_lon_lat[0] }
      : undefined

  // Fix 1: containedInPlace — use the city, not the community itself (avoids
  // circular "Sunriver contained in Sunriver"). A community is contained in
  // its city; the city name is always present from community.city. (§0)
  const placeContainedIn = cityName !== community.name ? cityName : 'Deschutes County'

  const communitySchemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Communities', url: '/communities' },
        ...(cityName ? [{ name: cityName, url: citySlug ? `/cities/${citySlug}` : '/cities' }] : []),
        { name: community.name, url: `/communities/${slug}` },
      ],
    },
    {
      type: 'place',
      placeType: 'Place',
      name: community.name,
      description: `${community.name}, a community in ${cityName}, Oregon. Homes for sale and live single-family market data.`,
      url: `/communities/${slug}`,
      // Fix 1: GeoCoordinates from registry center_lon_lat — never hardcoded. (§0)
      geo: placeGeo,
      address: { city: cityName, state: 'OR', country: 'US' },
      // Fix 1: contain in city (not the community itself — avoids circular ref). (§0)
      containedInPlace: placeContainedIn,
      hasMap: hasMap ? `/communities/${slug}` : undefined,
      additionalProperty: datasetVariables.length > 0 ? datasetVariables : undefined,
    },
  ]
  if (datasetVariables.length > 0) {
    communitySchemas.push({
      type: 'dataset',
      name: `${community.name} real estate market statistics${asOfLabel ? `, ${asOfLabel}` : ''}`,
      description: `Live single-family home market data for ${community.name} in ${cityName}, Oregon. Median list price, active inventory, months of supply, and median days to pending. Sourced from the regional MLS via Ryan Realty.`,
      url: `/communities/${slug}`,
      dateModified: asOfIso ?? undefined,
      spatialCoverageName: `${community.name}, ${cityName}, OR`,
      variableMeasured: datasetVariables,
    })
  }

  const communityLabel = `${community.name} · ${cityName}`
  const listingsHref = homesForSalePath(cityName, community.subdivision)
  const heroLead = placeHeroLead({
    placeName: community.name, parentName: cityName, activeCount,
    knownSuffix: 'Live inventory from the regional MLS.',
  })
  const contactHref = `/contact?inquiryType=Buying&message=${encodeURIComponent(`Interested in ${community.name}. Please get in touch.`)}`
  const strContactHref = `/contact?inquiryType=Buying&message=${encodeURIComponent(`I have questions about short-term rental rules in ${community.name}.`)}`

  if (isFeaturedCommunitySlug(slug)) {
    const groundFacts = [
      richContent?.architect?.trim() || null,
      richContent?.acres != null && richContent.acres > 0
        ? `${Math.round(richContent.acres).toLocaleString('en-US')} acres`
        : null,
    ].filter((value): value is string => Boolean(value))
    const featuredLead = groundFacts.length > 0 ? `${groundFacts.join('. ')}.` : `Homes in ${community.name}.`
    const asks = [
      activeCount != null ? { kicker: 'Homes', value: `${activeCount.toLocaleString('en-US')} for sale` } : null,
      medianListPrice != null ? { kicker: 'Ask', value: formatPriceExact(medianListPrice) } : null,
      daysFact ? { kicker: 'Days', value: daysFact } : null,
      { kicker: 'City', value: cityName },
    ].filter((row): row is { kicker: string; value: string } => row != null)
    const homes = featuredItems.filter((item) => item.img).slice(0, 4)
    const rankRows = buildCommDRankRows({
      cityName,
      selfSlug: slug,
      rows: communities.map((row) => ({
        slug: row.slug,
        city: row.city,
        subdivision: row.subdivision,
        medianPrice: row.medianPrice,
      })),
    })
    const chartCards = buildCommDChartRoom({
      name: community.name,
      cityName,
      slug,
      communityHistory: priceHist,
      cityHistory: cityPriceHist,
      communitySeriesSparse: chartIsCityLevel,
      rankRows,
    })
    const groundTiles = buildCommDGroundTiles({
      heroPhoto,
      courseImage: richContent?.courseImage,
      signatureHoleImage: richContent?.signatureHoleImage,
      architect: richContent?.architect,
      acres: richContent?.acres,
      founded: richContent?.founded,
    })
    return (
      <div className="kb-root">
      <KbSectionTracker />
      <MetadataBlock schemas={communitySchemas} />
      <CommunityFeaturedView
        slug={slug}
        name={community.name}
        cityName={cityName}
        activeCount={activeCount}
        medianListPrice={medianListPrice}
        asks={asks}
        heroPhoto={heroPhoto}
        posterAlt={`${community.name} in ${cityName}, Oregon`}
        mediaCaption={mediaCaption}
        heroLead={featuredLead}
        homesHref="#homes"
        listingsHref={listingsHref}
        groundTiles={groundTiles}
        homes={homes}
        aboutParagraphs={aboutParagraphs}
        mapGeo={mapGeo}
        mapPolygons={mapPolygons}
        centerLonLat={registryEntry?.center_lon_lat ?? undefined}
        chartCards={chartCards}
        schoolDistrictName={schoolDistrictInfo?.district ?? null}
        schoolDistrictSlug={schoolDistrictInfo?.districtSlug ?? null}
        rating={reviews.averageRating}
        reviewCount={reviews.count}
        faqs={faqs}
      />
      </div>
    )
  }

  return (
    <div className="kb-root">
    <KbSectionTracker />
    <MetadataBlock schemas={communitySchemas} />
    <CommunityKbView
      slug={slug}
      name={community.name}
      cityName={cityName}
      citySlug={citySlug}
      subdivision={community.subdivision}
      activeCount={activeCount}
      medianListPrice={medianListPrice}
      medianDaysToPending={pulse?.medianDaysToPending ?? null}
      heroPhoto={heroPhoto}
      posterAlt={`${community.name} in ${cityName}, Oregon`}
      mediaCaption={mediaCaption}
      communityLabel={communityLabel}
      heroLead={heroLead}
      richContent={richContent}
      amenityPosts={amenityPosts}
      aliases={registryEntry?.subdivision_aliases ?? []}
      publishedHoa={publishedHoa}
      aboutParagraphs={aboutParagraphs}
      aboutFacts={aboutFacts}
      featuredItems={featuredItems}
      tickerItems={tickerItems}
      asOfLabel={asOfLabel}
      communityTiles={communityTiles}
      mapGeo={mapGeo}
      mapPolygons={mapPolygons}
      centerLonLat={registryEntry?.center_lon_lat ?? undefined}
      listingsHref={listingsHref}
      marketData={marketData}
      chartScopeLabel={chartIsCityLevel && cityName ? `${cityName} (city)` : undefined}
      coreCharts={coreCharts}
      coreChartsScopeLabel={coreChartsScopeLabel}
      communityItems={communityItems}
      areaGuideVideo={areaGuideVideo}
      openHouseItems={openHouseItems}
      activityItems={activityItems}
      schoolDistrictName={schoolDistrictInfo?.district ?? null}
      schoolDistrictSlug={schoolDistrictInfo?.districtSlug ?? null}
      articlePosts={articlePosts}
      otherCityItems={otherCityItems}
      sellMedian={sellMedian}
      soldCount30d={publishSoldCount({ value: pulse?.closedLast30Days, grain: 'neighborhood' })}
      isResort={isResort}
      faqs={faqs}
      refreshedAt={pulse?.refreshedAt ?? null}
      contactHref={contactHref}
      strContactHref={strContactHref}
    />
    <KbFooter towns={[]} />
    </div>
  )
}
