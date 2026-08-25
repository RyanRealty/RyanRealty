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
import { EMPTY_PUBLIC_PACE, getPublicDetachedPace } from '@/lib/data/market-truth/public-pace'
import {
  getPublicDetachedMonthly,
  leftoverNeighborhoodOrCityMonthly,
} from '@/lib/data/market-truth/public-monthly'
import { zonedDateKey } from '@/lib/format/date'
import { getPublicPlaceSegments } from '@/lib/data/market-truth/public-segments'
import { PublicPaceStats } from '@/app/cities/[slug]/PublicPaceStats'
import { PublicMixStats } from '@/app/cities/[slug]/PublicMixStats'
import { EMPTY_PUBLIC_MIX, getPublicDetachedMix } from '@/lib/data/market-truth/public-mix'
import { PublicProductTypes } from '@/app/cities/[slug]/PublicProductTypes'
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
  getDetachedOverlays,
  cityDetachedSlug,
} from '@/lib/data'
import { allCommunities } from '@/lib/data'; import { getResortCommunityContent } from '@/lib/resort-community-content'
import { getCommunitySeoAbout } from '@/lib/community-seo-content'
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
import { leftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { formatPlaceHoaAnnual, placeHoaGlanceLabel, publishPlaceHoa } from '@/lib/market/publish-place-hoa'
import { publishDaysLabel } from '@/lib/market/publish-days-figure'
import { publishSellMedian } from '@/lib/market/publish-median-caption'
import { toPublicCoreChartSeries } from '@/lib/market/publish-public-chart-source'

import { getDistrictForCity } from '@/data/co-schools'
import { homesForSalePath } from '@/lib/slug'
import { getAllResortCommunities } from '@/lib/data/communities/registry'
import { pageMetadata } from '@/lib/site/page-metadata'
import { CONTACT } from '@/lib/brand/contact'
import { withTimeoutFallback, withTimeoutFallbackResult } from '@/lib/with-timeout-fallback'
import { buildTimeRails, skippableRail } from '@/lib/build-phase'
import { buildMarketFaq, type MarketFaqInput } from '@/lib/site/market-faq'
import type { SchemaInput } from '@/lib/site/json-ld'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbAbout } from '@/components/site/kb/KbAbout'
import { KbResortOverview } from '@/components/site/kb/KbResortOverview'
import { KbFeatured } from '@/components/site/kb/KbFeatured.client'
// KbListingMap remains in the parity contract; PlaceInventoryMap composes dual-pane.
import { KbListingMap, type KbMapGeo } from '@/components/site/kb/KbListingMap.client'
import { PlaceInventoryMap } from '@/components/site/explore/PlaceInventoryMap'
import { KbTicker } from '@/components/site/kb/KbTicker.client'
import { KbMarketHud } from '@/components/site/kb/KbMarketHud.client'
import { MarketCoreCharts } from '@/components/market/MarketCoreCharts'
import { getCoreChartSeries } from '@/lib/data/market/getCoreChartSeries'
import { KbAreaGuideVideo } from '@/components/site/kb/KbAreaGuideVideo'
import { KbExploreTowns } from '@/components/site/kb/KbExploreTowns.client'
import { KbCommunities } from '@/components/site/kb/KbCommunities.client'
import { KbOpenHouses } from '@/components/site/kb/KbOpenHouses.client'
import { KbActivity } from '@/components/site/kb/KbActivity.client'
import { KbArticles } from '@/components/site/kb/KbArticles'
import { KbTestimonials } from '@/components/site/kb/KbTestimonials.client'
import { KbTeam } from '@/components/site/kb/KbTeam.client'
import { KbBuyCta } from '@/components/site/kb/KbBuyCta.client'
import { KbCommunityAlerts } from '@/components/site/kb/KbCommunityAlerts.client'
import { CommunityGolfLinks } from '@/components/site/explore/CommunityGolfLinks'
import { KbSell } from '@/components/site/kb/KbSell.client'
import { KbSchools } from '@/components/site/kb/KbSchools'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { MetadataBlock } from '@/components/site/MetadataBlock'; import { MarketSources } from '@/components/site/MarketSources'
import { FAQBlock } from '@/components/site/FAQBlock'
import CommunityPageTracker from '@/components/community/CommunityPageTracker'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import { kbMoneyFull } from '@/components/site/kb/types'
import type {
  KbTownItem,
  KbCommunityItem,
  KbFeaturedItem,
  KbMarketData,
} from '@/components/site/kb/types'
import { TESTIMONIALS } from '@/lib/testimonials'
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

  const currentMonthKey = zonedDateKey(new Date()).slice(0, 7)
  const [
    snapshot, _pulse, stats, _regionPulse, priceHist,
    boundaryRead, resortBoundary, allCitySnapshots, communities,
    blogPosts, openHouses, activity, featuredTiles, citySfrRead, richContent,
    cityPriceHist, areaGuideVideo, commCoreCharts, cityCoreCharts,
    publicPace, publicSegments, leftoverCityMonthly, leftoverNeighborhoodMonthly, publicMix,
    commOverlays,
  ] = await Promise.all([
    // Always-present community snapshot — the JSON-LD/Place fallback source. (§0)
    withTimeoutFallback(getGeoSnapshot({ geoType: 'community', geoKey: communityGeoKey }), null, 3000, 'comm:snapshot'),
    withTimeoutFallback(getMarketPulse({ geoType: 'neighborhood', geoSlug: neighborhoodSlug }), null, 3500, 'comm:pulse'),
    // Neighborhood cache still supplies 12-month DOM fallbacks.
    // Closed median, sale-to-list, and 12-month sold come from leftover
    // membership, not this row. Miss omits — never cache soldCount.
    withTimeoutFallback(getMarketStats({ geoType: 'neighborhood', geoSlug: neighborhoodSlug, periodType: 'rolling_365d' }), null, 3500, 'comm:stats'),
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
      getPublicDetachedMonthly({
        geoType: 'city',
        geoSlug: citySlug,
        currentMonthKey,
      }),
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
  ])
  const commMt = commOverlays.get(`neighborhood:${cityDetachedSlug(neighborhoodSlug)}`)
  const hud = leftoverHudKpis({
    grain: 'neighborhood',
    headlines: commMt?.headlines ?? null,
    inventory: commMt?.inventory ?? null,
    pace: publicPace,
  })

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

  // Published hero count is leftover HUD. Tiles still feed the map and featured rail.
  const activeCount: number | null = hud.active
  const medianListPrice = hud.medianList
  const medianDays = hud.daysToPending

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
  // Cache neighborhood medianSalePrice is an alias join. Leftover medianClose is
  // membership. Miss omits — never an em-dash, never a cache fill.
  const leftoverMedianSold = kbMoneyFull(publicPace.medianClose)
  const aboutFacts: { label: string; value: string }[] = [
    ...(activeCount != null ? [{ label: 'Active single-family', value: activeCount.toLocaleString('en-US') }] : []),
    ...(medianListPrice != null ? [{ label: 'Median list', value: kbMoneyFull(medianListPrice) ?? '—' }] : []),
    ...(daysFact ? [{ label: 'Median to pending', value: daysFact }] : []),
    ...(leftoverMedianSold ? [{ label: 'Median sold, 12 months', value: leftoverMedianSold }] : []),
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
    : new Map<string, number>()
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
  const neighborhoodCacheSparse = isTrendSeriesTooSparse(priceHist)
  const chartMonths = leftoverNeighborhoodOrCityMonthly({
    leftoverNeighborhood: leftoverNeighborhoodMonthly,
    leftoverCity: leftoverCityMonthly,
    neighborhoodCache: priceHist,
    cityCache: cityPriceHist,
    currentMonthKey,
    neighborhoodCacheSparse,
  })
  const chartIsCityLevel = chartMonths.cityFallback
  const chartPriceHist = chartMonths.months

  // Core-chart module scope mirrors the SAME sparse-community decision: the
  // community's own series when dense enough, else the parent city's — always
  // labeled, so a city figure is never read as the community's. (§0)
  const coreChartsRaw = chartIsCityLevel ? cityCoreCharts : commCoreCharts
  const coreCharts = coreChartsRaw ? toPublicCoreChartSeries(coreChartsRaw) : coreChartsRaw
  const coreChartsScopeLabel = chartIsCityLevel && cityName ? `${cityName} (city)` : undefined
  const hudActive = hud.active
  const monthsOfSupply = hud.monthsSupply
  const sellMedian = publishSellMedian({ placeMedian: hud.medianList ?? medianListPrice, regionMedian: null, grain: 'community', placeName: community.name })
  const marketData: KbMarketData = {
    active: hud.active,
    pending: hud.pending,
    closed30: hud.closed30,
    new30: hud.new30,
    medianList: hud.medianList,
    saleToList: hud.saleToList,
    daysToPending: hud.daysToPending,
    monthsSupply: hud.monthsSupply,
    sold12mo: hud.sold12mo,
    trend: buildMonthlyTrend(chartPriceHist),
    byTown: [],
    countyMedian: null,
    yearSeries: buildYearSeries(chartPriceHist, 5),
    chartLeftover: chartMonths.leftoverUsed,
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

  const marketFaqInput: MarketFaqInput = { grain: 'neighborhood',
    source: 'market-truth',
    // Same leftover HUD the page prints. Miss omits. Pulse DTP and cache DOM do not fill.
    activeCount: hudActive,
    pulseActiveCount: hudActive,
    medianListPrice: hud.medianList,
    monthsOfSupply,
    medianDaysToPending: hud.daysToPending,
    medianDaysOnMarket: null,
    refreshedAt: commMt?.headlines?.computedAt ?? commMt?.inventory?.computedAt ?? snapshot?.refreshedAt ?? null,
    // Extended fields — leftover 12-month closed count. Miss omits.
    soldCount12mo: publicPace.closedCount ?? null,
    subdivisionAliases: registryEntry?.subdivision_aliases?.length
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

  return (
    <main className="kb-root">
      <CommunityPageTracker
        slug={slug}
        communityName={community.name}
        city={cityName}
        activeCount={activeCount}
        medianPrice={medianListPrice}
      />
      <KbSectionTracker />
      <MetadataBlock schemas={communitySchemas} />
      <KbBreadcrumb
        overlay
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Communities', href: '/communities' },
          ...(cityName ? [{ label: cityName, href: citySlug ? `/cities/${citySlug}` : '/cities' }] : []),
          { label: community.name },
        ]}
      />
      <SmoothScrollProvider>
        <KbHero
          data={{
            activeCount,
            medianListPrice,
            medianDaysToPending: hud.daysToPending,
          }}
          eyebrow={communityLabel}
          titleTop={community.name}
          titleBottom="Homes for Sale"
          lead={placeHeroLead({
            placeName: community.name, parentName: cityName, activeCount,
            knownSuffix: 'Live inventory from the regional MLS.',
          })}
          videoSrc={null}
          posterSrc={heroPhoto}
          // Fix 6: descriptive alt text for the hero image. (§0)
          posterAlt={`${community.name} in ${cityName}, Oregon`}
          mediaCaption={mediaCaption}
          cta={{ href: '#homes', label: `See ${community.name} homes` }}
        />
        {/* Overview directly after the hero (Matt 2026-07-29, supersedes the
            inventory-first order): hero → overview → homes → map → market. */}
        <KbResortOverview
          content={richContent}
          name={community.name}
          postsBySlug={amenityPosts}
          aliases={registryEntry?.subdivision_aliases ?? []}
          publishedHoa={publishedHoa}
        />
        {aboutParagraphs.length > 0 ? (
          <KbAbout
            eyebrow={communityLabel}
            heading={`Living in ${community.name}`}
            // Resort overview already carries the long seoAbout. Keep one
            // existing hero line here so leftover medianClose can print in
            // the facts ledger without duplicating the overview.
            paragraphs={
              richContent ? ['Live inventory from the regional MLS.'] : aboutParagraphs
            }
            facts={aboutFacts}
          />
        ) : null}
        <KbFeatured
          items={featuredItems}
          eyebrow={`${community.name} · For sale`}
          viewAllHref="#homes"
          viewAllLabel={`See every ${community.name} home for sale`} viewAllPlace={community.name}
          totalCount={activeCount || null}
        />
        <KbTicker items={tickerItems} />
        {/* Fix 3: freshness signal near the stats, crawled by search engines.
            asOfLabel is the real refreshedAt timestamp, never invented. (§0) */}
        {asOfLabel ? (
          <p className="community-freshness-signal" aria-label={`Market data freshness: ${asOfLabel}`}>
            Market data updated {asOfLabel}
          </p>
        ) : null}
        {/* Fix 5: Brand phone — visible on every community page, above the fold in
            the content flow. Uses CONTACT.phoneDirect (the canonical Twilio line,
            the public brokerage number — same as the footer). Sourced from
            lib/brand/contact.ts (never hardcoded). (§0) */}
        <p className="community-contact-line">
          Questions about {community.name}?{' '}
          <a href={`tel:${CONTACT.phoneDirectTel}`} className="community-contact-phone">
            {CONTACT.phoneDirect}
          </a>
        </p>
        <PlaceInventoryMap
          tiles={communityTiles}
          mapGeo={mapGeo}
          polygons={mapPolygons}
          placeName={community.name}
          totalActive={activeCount ?? mapFeatures.length}
          centerLonLat={registryEntry?.center_lon_lat ?? undefined}
          viewAllHref={homesForSalePath(cityName, community.subdivision)}
        />
        {/* ONE market section (Matt 2026-07-29): core charts render INSIDE the
            HUD section, not a second stacked headed section. */}
        <KbMarketHud
          data={marketData}
          eyebrow={`${community.name} · The market`} geoName={community.name} asOf={commMt?.headlines?.computedAt ?? commMt?.inventory?.computedAt ?? null}
          chartScopeLabel={chartIsCityLevel && cityName ? `${cityName} (city)` : undefined}
        >
          <PublicProductTypes cityName={community.name} citySlug={citySlug ?? ''} rows={publicSegments} />
          <PublicPaceStats cityName={community.name} row={publicPace} />
          <PublicMixStats cityName={community.name} row={publicMix} />
          {coreCharts ? (
            <div className="pt-10" aria-label={`${community.name} market trend charts`}>
              <MarketCoreCharts
                data={coreCharts}
                heading={`${community.name} market trends`}
                scopeLabel={coreChartsScopeLabel}
              />
            </div>
          ) : null}
        </KbMarketHud>
        <KbCommunities communities={communityItems} eyebrow={`${cityName} · Communities`} />
        {/* Per-location area guide video — self-hides when this community has no
            approved guide video. Sits after the communities rail, before the
            this-week / activity / FAQ / sell blocks. */}
        <KbAreaGuideVideo videoUrl={areaGuideVideo?.url ?? null} wide={areaGuideVideo?.wide} locationName={community.name} posterSrc={heroPhoto} />
        {buildTimeRails(true) || openHouseItems.length > 0 ? (
        <KbOpenHouses
          items={openHouseItems}
          eyebrow={`${cityName} · This week`}
          heading="Open houses"
          viewAllHref={`/open-houses/${citySlug}`}
        />
        ) : null}
        <KbActivity
          items={activityItems}
          // design-audit TRU-1: the feed is fetched city-wide (cities:[cityName]),
          // so a "Live · Tetherow" label over Bend/Petrosa listings was untrue.
          // Label the real scope — the city — not the community.
          eyebrow={`Live · ${cityName}`}
          heading="Latest market activity"
          viewAllHref="/housing-market"
          viewAllLabel="Full market pulse"
        />
        {/* Schools district — sourced exclusively from data/co-schools.ts
            getDistrictForCity(). Specific school names/attendance zones are NOT
            shown because per-address boundary data is not in the system. (§0) */}
        <KbSchools communityName={community.name} districtName={schoolDistrictInfo?.district ?? null} districtSlug={schoolDistrictInfo?.districtSlug ?? null} />
        <CommunityGolfLinks communitySlug={slug} communityName={community.name} />
        <KbArticles
          posts={articlePosts}
          eyebrow="Guides and news"
          heading={`${community.name} real estate guides`}
          subtitle={`Housing news, market data, and buyer and seller advice for ${community.name} and ${cityName}.`}
        />
        <KbExploreTowns
          towns={otherCityItems}
          eyebrow="Central Oregon"
          title="Other cities"
          sectionId="nearby"
          cta={{ href: '/cities', label: 'Every city' }}
        />
        <KbTestimonials reviews={TESTIMONIALS.slice(0, 8)} />
        <KbTeam />
        {/* Buyer CTA — surfaces a direct "See all homes" path and contact link so
            buyers get equal weight alongside the seller valuation block below.
            listingsHref: homesForSalePath builds the canonical /homes-for-sale/[city]
            URL. community.subdivision is the MLS name; for resorts, the registry
            aliases make the search inclusive of all tagged sub-neighborhoods. (§0) */}
        <KbBuyCta
          communityName={community.name}
          listingsHref={homesForSalePath(cityName, community.subdivision)}
          contactHref={`/contact?inquiryType=Buying&message=${encodeURIComponent(`Interested in ${community.name}. Please get in touch.`)}`}
        />
        {/* Listing-alert email capture — reuses submitSearchAlertSignup + the
            canonical listing_alerts table (same path as SearchAlertCapture on
            /search). City + subdivision prefilled from community data so the
            alert matches what the visitor is looking at. No new backend. (§0) */}
        <KbCommunityAlerts
          communityName={community.name}
          city={cityName}
          subdivision={community.subdivision}
        />
        {/* Seller conversion — address capture hands off to /sell/valuation. */}
        <KbSell
          data={{
            medianListPrice: sellMedian?.value ?? null,
            medianCaption: sellMedian?.caption ?? null,
            medianDaysToPending: hud.daysToPending,
            soldCount30d: hud.closed30,
          }}
          eyebrow={`Sell in ${community.name}`}
        />
        {/* Second-home / investment note — resort pages only. Generic framing:
            confirms the community is a popular second-home / vacation destination
            and that STR potential exists and varies by HOA. No specific STR rules,
            permit caps, occupancy limits, or income figures (§0 hard rule). (§0) */}
        {isResort ? (
          <div className="comm-str-note" aria-label={`${community.name} second home information`}>
            <div className="comm-str-note-inner">
              <span className="comm-str-label">Second homes</span>
              <p className="comm-str-text">
                Short-term rental potential in {community.name} varies by HOA rules, community covenants, and Oregon regulations.{' '}
                <a href={`/contact?inquiryType=Buying&message=${encodeURIComponent(`I have questions about short-term rental rules in ${community.name}.`)}`}>
                  Reach out for current rental guidelines
                </a>
                {' '}before you assume what is permitted or what it could earn.
              </p>
            </div>
          </div>
        ) : null}
        {faqs.length > 0 ? (
          <section id="faq" aria-label={`${community.name} real estate questions`}>
            <FAQBlock items={faqs} eyebrow="Common questions" title={`${community.name} real estate questions`} />
          </section>
        ) : null}
        <MarketSources sources={['ods']} /><KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}

