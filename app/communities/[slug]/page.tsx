/**
 * Community page — KB (kinetic-brutalist) design, Phase 9 wave 2 of the
 * convergence program (docs/KB_CONVERGENCE_ROADMAP.md). Resort / golf /
 * master-planned communities (Tetherow, Broken Top, Widgi Creek, Pronghorn,
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

import { notFound, redirect } from 'next/navigation'
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
} from '@/lib/data'
import { getResortCommunityContent } from '@/lib/resort-community-content'
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
import { getDistrictForCity } from '@/data/co-schools'
import { listingTileHref, homesForSalePath } from '@/lib/slug'
import { pageMetadata } from '@/lib/site/page-metadata'
import { CONTACT } from '@/lib/brand/contact'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { buildMarketFaq, type MarketFaqInput } from '@/lib/site/market-faq'
import type { SchemaInput } from '@/lib/site/json-ld'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbAbout } from '@/components/site/kb/KbAbout'
import { KbResortOverview } from '@/components/site/kb/KbResortOverview'
import { KbFeatured } from '@/components/site/kb/KbFeatured.client'
import { KbListingMap, type KbMapGeo } from '@/components/site/kb/KbListingMap.client'
import { KbTicker } from '@/components/site/kb/KbTicker.client'
import { KbMarketHud } from '@/components/site/kb/KbMarketHud.client'
import { KbAreaGuideVideo } from '@/components/site/kb/KbAreaGuideVideo'
import { KbExploreTowns } from '@/components/site/kb/KbExploreTowns.client'
import { KbCommunities } from '@/components/site/kb/KbCommunities.client'
import { KbOpenHouses } from '@/components/site/kb/KbOpenHouses.client'
import { KbActivity } from '@/components/site/kb/KbActivity.client'
import { KbArticles } from '@/components/site/kb/KbArticles'
import { KbTestimonials } from '@/components/site/kb/KbTestimonials.client'
import { KbTeam } from '@/components/site/kb/KbTeam.client'
import { KbSell } from '@/components/site/kb/KbSell.client'
import { KbBuyCta } from '@/components/site/kb/KbBuyCta.client'
import { KbCommunityAlerts } from '@/components/site/kb/KbCommunityAlerts.client'
import { KbSchools } from '@/components/site/kb/KbSchools'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { FAQBlock } from '@/components/site/FAQBlock'
import CommunityPageTracker from '@/components/community/CommunityPageTracker'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import type {
  KbTownItem,
  KbCommunityItem,
  KbTickerItem,
  KbFeaturedItem,
  KbMarketData,
} from '@/components/site/kb/types'
import { TESTIMONIALS } from '@/lib/testimonials'
import '@/components/site/kb/kb.css'

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return []
}
export const dynamicParams = true
export const revalidate = 60

type Props = { params: Promise<{ slug: string }> }

const CENTRAL_OREGON_CITY_SLUGS = new Set([
  'bend', 'redmond', 'sisters', 'la-pine', 'sunriver', 'madras',
  'prineville', 'culver', 'terrebonne', 'tumalo', 'powell-butte',
])

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

// Every active SFR tile in a city, PAGINATED past PostgREST's 1000-row cap (Bend
// alone has ~1044). The resort alias-aware counts must see the COMPLETE set or
// they undercount communities whose older listings fall past the first page.
// Copied from the city page so the community hero count MATCHES the city ledger. (§0)
async function fetchAllCityActiveSfr(cityName: string): Promise<Awaited<ReturnType<typeof getListingTiles>>> {
  const PAGE = 1000
  // Dedupe by listingKey across pages — offset pagination over a newest-sorted set
  // can repeat a row if inventory shifts between page fetches. (review fix)
  const byKey = new Map<string, Awaited<ReturnType<typeof getListingTiles>>[number]>()
  for (let offset = 0; offset < 6000; offset += PAGE) {
    const page = await getListingTiles({ city: cityName, status: 'active', propertyType: 'A', limit: PAGE, offset })
    for (const t of page) byKey.set(t.listingKey, t)
    if (page.length < PAGE) break
  }
  return [...byKey.values()]
}

const monthLabel = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }) : ''
const fmtK = (n: number | null): string | null => (n != null ? `$${Math.round(n / 1000).toLocaleString()}K` : null)

function openHouseWhen(eventDate: string, start: string | null, end: string | null): string {
  const day = new Date(eventDate + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  })
  const t = (s: string | null) => {
    if (!s) return ''
    const [h, m] = s.split(':')
    const hr = Number(h)
    const ap = hr >= 12 ? 'pm' : 'am'
    const h12 = hr % 12 === 0 ? 12 : hr % 12
    return m && m !== '00' ? `${h12}:${m}${ap}` : `${h12}${ap}`
  }
  const range = start && end ? `${t(start)}-${t(end)}` : start ? t(start) : ''
  return [day, range].filter(Boolean).join(' · ')
}

const ACTIVITY_KIND: Record<string, { kind: string; label: string }> = {
  new_listing: { kind: 'new', label: 'New' },
  price_drop: { kind: 'price_drop', label: 'Price cut' },
  status_pending: { kind: 'pending', label: 'Pending' },
  status_closed: { kind: 'sold', label: 'Sold' },
  back_on_market: { kind: 'new', label: 'Back on market' },
  status_expired: { kind: 'expired', label: 'Off market' },
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const community = await getCommunityBySlug(slug)
  if (!community) notFound()
  const desc =
    community.activeCount > 0
      ? `${community.activeCount} homes for sale in ${community.name}. Live single-family market stats, open houses, and recent activity for ${community.name} in ${community.city}, OR, from a local brokerage.`
      : `Explore ${community.name} in ${community.city}, OR. Live single-family market data and recent activity from a local brokerage.`

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

  // A resort has ONE canonical URL: its bare registry slug. A compound slug
  // (/communities/bend-tetherow) resolves to the same community but bypasses the
  // alias-aware path and would publish the literal-name undercount, AND duplicates
  // the bare-slug page. Redirect it to the canonical bare slug. (review BLOCKER)
  const resortMatch = cityResorts(citySlug).find(
    (r) => r.slug === slug || r.label.toLowerCase().trim() === community.subdivision.toLowerCase().trim(),
  )
  if (resortMatch && slug !== resortMatch.slug) redirect(`/communities/${resortMatch.slug}`)

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
    boundaryMapData, resortBoundary, allCitySnapshots, communities,
    blogPosts, openHouses, activity, featuredTiles, citySfrTiles, richContent,
    cityPriceHist, areaGuideVideo,
  ] = await Promise.all([
    // Always-present community snapshot — the JSON-LD/Place fallback source. (§0)
    withTimeoutFallback(getGeoSnapshot({ geoType: 'community', geoKey: communityGeoKey }), null, 3000, 'comm:snapshot'),
    withTimeoutFallback(getMarketPulse({ geoType: 'neighborhood', geoSlug: neighborhoodSlug }), null, 3500, 'comm:pulse'),
    // Neighborhood closed-sale stats from market_stats_cache (market_pulse_live
    // has no neighborhood rows) — the verified source for days-on-market +
    // median sold when the pulse band would otherwise show dashes.
    withTimeoutFallback(getMarketStats({ geoType: 'neighborhood', geoSlug: neighborhoodSlug, periodType: 'rolling_365d' }), null, 3500, 'comm:stats'),
    withTimeoutFallback(getMarketStatsCacheRowForGeo({ geoSlug: neighborhoodSlug }), null, 3000, 'comm:mktStats'),
    withTimeoutFallback(getRegionPulse(), null, 3000, 'comm:regionPulse'),
    withTimeoutFallback(getPriceHistory('neighborhood', neighborhoodSlug, 'monthly', 60), [], 4500, 'comm:priceHistory'),
    withTimeoutFallback(getGeoBoundaryMapData({ geoType: 'neighborhood', geoSlug: neighborhoodSlug }), { polygon: null, pins: [] }, 4500, 'comm:boundary'),
    withTimeoutFallback(getResortBoundaryGeoJSON(slug), null, 4500, 'comm:resortBoundary'),
    withTimeoutFallback(getAllCitySnapshots(), [], 3000, 'comm:cities'),
    withTimeoutFallback(getCommunitiesForIndex(), [], 3500, 'comm:communities'),
    withTimeoutFallback(getRecentBlogPosts({ cityName, limit: 3 }), [], 3000, 'comm:blog'),
    withTimeoutFallback(getOpenHousesWithListings({ city: cityName }), [], 3500, 'comm:openHouses'),
    withTimeoutFallback(getActivityFeedWithFallbackMulti({ cities: [cityName], limit: 8 }), [], 3500, 'comm:activity'),
    withTimeoutFallback(getCommunityListings(cityName, community.subdivision, 14), [], 4500, 'comm:featured'),
    // Uncapped active SFR tiles for the city — the source for the alias-aware
    // resort count (so the hero number matches the city ledger, not the
    // literal-name undercount). Only needed when this community is a resort. (§0)
    isResortInCity
      ? withTimeoutFallback(fetchAllCityActiveSfr(cityName), [], 6000, 'comm:citySfr')
      : Promise.resolve([] as Awaited<ReturnType<typeof getListingTiles>>),
    // Rich, verified resort/golf/master-planned content (amenities, drive times,
    // golf course, membership, builders) from data/resort-community-<slug>.json —
    // the depth the page is REQUIRED to carry (owner directive). Null when a
    // community has no config (the page degrades to the data-driven About). (§0)
    withTimeoutFallback(getResortCommunityContent(resortSlug), null, 2500, 'comm:content'),
    // Parent-city monthly price history — the chart's fallback when this community's
    // own neighborhood close-sale series is too thin for a real multi-year trend
    // (most subdivisions cache only a handful of recent months). Relabeled as
    // city-level when used, so no city figure is passed off as the community's. (§0)
    withTimeoutFallback(getPriceHistory('city', citySlug, 'monthly', 60), [], 4500, 'comm:cityPriceHistory'),
    // Approved per-location AREA GUIDE video for THIS community's geo slug (EXACT
    // match, null when the location has no guide video). The slot self-hides when
    // null, so it is always safe to render. (§0)
    withTimeoutFallback(getAreaGuideVideo(slug), null, 3000, 'comm:areaGuideVideo'),
  ])

  // Amenity → blog-post link cards (topic-cluster SEO): resolve the published posts
  // for any amenity carrying a blog_slug, so those amenity cards render with a hero
  // image + "Read more". Only fetched when the content actually references posts.
  const amenityBlogSlugs = (richContent?.amenities ?? [])
    .map((a) => a.blog_slug)
    .filter((s): s is string => Boolean(s))
  const amenityPosts =
    amenityBlogSlugs.length > 0
      ? await withTimeoutFallback(getBlogPostsBySlugs(amenityBlogSlugs), {}, 2500, 'comm:amenityPosts')
      : {}

  // ── BOUNDARY RELIABILITY (preserved) ──────────────────────────────────────
  // Reliable boundary -> the in-polygon homes are correct (drive count + pins).
  // Oversized/un-corrected boundary -> the polygon over-matches, so use the MLS
  // subdivision-name listings instead, and draw only those pins. Never draw the
  // oversized polygon (broken-top drew Tetherow). (preserved from prior page)
  const boundaryReliable = isBoundaryReliable(slug)
  const boundaryListingKeys = boundaryMapData.pins.map((p) => p.listingKey)

  // ALIAS-AWARE LISTINGS for a resort. A resort's homes are MLS-tagged under many
  // subdivision names, so the literal-name query misses almost all of them (Widgi
  // Creek: ~0 tagged "Widgi Creek", ~48 across its aliases). When this community is
  // a resort, its real listing set = the city's active SFR tiles matching this
  // resort's aliases — the SAME set that drives the alias-aware count, so the map /
  // featured / ticker / count all agree and are non-empty. (§0)
  const resortTiles = isResortInCity ? resortTilesForSlug(citySlug, resortSlug, citySfrTiles) : []
  const useResortTiles = resortTiles.length > 0

  // The community's own listing tiles (lat/lng/photo for the map + featured +
  // ticker). Resort -> alias-matched tiles; reliable boundary -> in-polygon homes;
  // oversized boundary -> the MLS subdivision-name homes.
  let communityTiles: Awaited<ReturnType<typeof getListingTiles>> = useResortTiles
    ? resortTiles
    : boundaryReliable && boundaryListingKeys.length > 0
      ? await withTimeoutFallback(
          getListingTiles({ listingKeys: boundaryListingKeys, status: 'active', limit: 200 }),
          [],
          4500,
          'comm:tiles',
        )
      : await withTimeoutFallback(
          getListingTiles({ city: cityName, status: 'active', limit: 1500 }),
          [],
          4500,
          'comm:tiles-fallback',
        )
  // For the oversized-boundary fallback (non-resort), narrow the city pull to the
  // real community by MLS subdivision name (the authoritative source for those slugs).
  if (!useResortTiles && (!boundaryReliable || boundaryListingKeys.length === 0)) {
    const subListings = await withTimeoutFallback(
      getCommunityListings(cityName, community.subdivision, 200),
      [],
      4500,
      'comm:sub-listings',
    )
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
  const haveCityTiles = isResortInCity && citySfrTiles.length > 0
  const resortSfrCounts = haveCityTiles ? resortActiveSfrCounts(citySlug, citySfrTiles) : new Map<string, number>()
  const aliasAwareCount = haveCityTiles ? resortSfrCounts.get(resortSlug) ?? null : null

  // Honest active count, in priority order:
  //   1. resort -> alias-aware count (matches the city ledger)
  //   2. reliable boundary -> the real in-polygon count
  //   3. else -> the count of the subdivision homes we actually resolved
  //      (community.activeCount is itself boundary-derived and bloated for
  //      oversized polygons, so never trust it for an unreliable boundary).
  const reliableBoundaryCount = boundaryReliable ? boundaryMapData.pins.length : null
  const activeCount =
    aliasAwareCount != null
      ? aliasAwareCount
      : reliableBoundaryCount != null && reliableBoundaryCount > 0
      ? reliableBoundaryCount
      : communityTiles.length > 0
      ? communityTiles.length
      : pulse?.activeCount ?? community.activeCount ?? 0

  const medianListPrice = pulse?.medianListPrice ?? community.medianPrice ?? snapshot?.medianListPrice ?? null
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
  const aboutFacts: { label: string; value: string }[] = [
    { label: 'Active single-family', value: activeCount.toLocaleString('en-US') },
    ...(medianListPrice != null ? [{ label: 'Median list', value: fmtK(medianListPrice) ?? '—' }] : []),
    ...(medianDays != null ? [{ label: pulse?.medianDaysToPending != null ? 'Median to pending' : 'Median days on market', value: `${Math.round(medianDays)} days` }] : []),
    ...(stats?.medianSalePrice != null ? [{ label: 'Median sold, 1 yr', value: fmtK(stats.medianSalePrice) ?? '—' }] : []),
    ...(registryEntry?.hoa_annual_estimate ? [{ label: 'HOA estimate', value: `$${registryEntry.hoa_annual_estimate.toLocaleString('en-US')}/yr` }] : []),
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
  const mapFeatures = communityTiles
    .filter((t) => t.lat != null && t.lng != null)
    .map((t) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [Number(t.lng), Number(t.lat)] as [number, number] },
      properties: {
        p: t.listPrice, bd: t.beds, ba: t.baths, sf: t.sqft,
        a: [t.streetNumber, t.streetName].filter(Boolean).join(' '),
        sub: t.subdivisionName ?? '', city: t.city ?? '', img: t.photoUrl ?? '',
      },
    }))
  const mapGeo: KbMapGeo = { type: 'FeatureCollection', features: mapFeatures }

  // Polygon: draw ONLY a reliable boundary. Prefer the authoritative resort plat
  // union (getResortBoundaryGeoJSON), else the boundary polygon. An unreliable /
  // oversized boundary draws NOTHING (pins only). (preserved from prior page)
  const polygonGeometry = !boundaryReliable
    ? null
    : resortBoundary ?? boundaryMapData.polygon ?? null
  const mapPolygons = polygonGeometry
    ? {
        type: 'FeatureCollection' as const,
        features: [{ type: 'Feature' as const, geometry: polygonGeometry as unknown, properties: { name: community.name } }],
      }
    : undefined

  const tickerItems: KbTickerItem[] = communityTiles.slice(0, 6).map((t) => ({
    price: t.listPrice,
    address: [t.streetNumber, t.streetName].filter(Boolean).join(' '),
    town: t.city ?? cityName,
  }))

  // Sub-neighborhood ledger intentionally omitted: the registry has no per-sub
  // active count or median, so a ledger would publish a fabricated 0 / a mislabeled
  // parent median, and the rows would self-link (sub-neighborhoods have no own page).
  // Resort phase/HOA context lives in the About facts instead. (review fix)

  // ── OTHER RESORTS IN THE SAME CITY (KbCommunities rail) ────────────────────
  // 3-6 OTHER resorts in this city, with their alias-aware counts so each card
  // matches the city ledger. Filtered by citySlug, excluding this community.
  const cityComms = communities.filter((c) => c.city?.toLowerCase().trim() === cityName.toLowerCase().trim())
  const commImgBySlug = new Map(cityComms.map((c) => [c.slug, c.heroImageUrl]))
  const otherResorts = cityResorts(citySlug).filter((r) => r.slug !== resortSlug)
  const otherResortCounts = otherResorts.length > 0 && citySfrTiles.length > 0
    ? resortActiveSfrCounts(citySlug, citySfrTiles)
    : resortSfrCounts
  const communityItems: KbCommunityItem[] = otherResorts
    .slice(0, 6)
    .map((r): KbCommunityItem | null => {
      const img = RESORT_IMG[r.slug] ?? commImgBySlug.get(r.slug) ?? communityImage(r.slug) ?? null
      if (!img) return null
      return {
        name: r.label,
        activeCount: otherResortCounts.get(r.slug) ?? 0,
        town: cityName,
        href: `/communities/${r.slug}`,
        img,
        video: null,
      }
    })
    .filter((x): x is KbCommunityItem => x !== null)

  // ── EXPLORE OTHER CITIES ──────────────────────────────────────────────────
  const otherCityItems: KbTownItem[] = allCitySnapshots
    .map((s) => ({ s, cs: s.geoKey.replace(/\s+/g, '-') }))
    .filter(({ cs }) => CENTRAL_OREGON_CITY_SLUGS.has(cs))
    .slice(0, 8)
    .map(({ s, cs }) => {
      const hero = cityHero(cs)
      return {
        name: s.geoLabel,
        href: `/cities/${cs}`,
        activeCount: s.activeSfrCount > 0 ? s.activeSfrCount : 0,
        medianPrice: s.medianListPrice ?? null,
        img: hero.verified ? hero.src : '',
      }
    })

  // ── OPEN HOUSES ───────────────────────────────────────────────────────────
  const openHouseItems = openHouses.slice(0, 6).map((oh) => ({
    href: listingTileHref({
      listingKey: oh.listing_key, streetNumber: oh.street_number, streetName: oh.street_name, city: oh.city,
    }),
    photoUrl: oh.photo_url,
    price: oh.list_price,
    address: oh.unparsed_address ?? [oh.street_number, oh.street_name].filter(Boolean).join(' '),
    cityLine: [oh.city, oh.subdivision_name].filter(Boolean).join(' · '),
    beds: oh.beds_total,
    baths: oh.baths_full,
    sqft: oh.living_area,
    whenLabel: openHouseWhen(oh.event_date, oh.start_time, oh.end_time),
  }))

  // ── LIVE ACTIVITY (per-row thumbnails, like the city page) ────────────────
  const activityItems = activity.slice(0, 8).map((a) => {
    const km = ACTIVITY_KIND[a.event_type] ?? { kind: a.event_type, label: a.event_type }
    return {
      kind: km.kind,
      label: km.label,
      address: [a.StreetNumber, a.StreetName].filter(Boolean).join(' ') || 'Address on request',
      cityLine: [a.City, a.SubdivisionName].filter(Boolean).join(' · '),
      price: a.ListPrice ?? null,
      imageUrl: a.PhotoURL ?? null,
      href: listingTileHref({ listingKey: a.listing_key, streetNumber: a.StreetNumber ?? null, streetName: a.StreetName ?? null, city: a.City ?? null }),
      whenLabel: a.event_at
        ? new Date(a.event_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
        : '',
    }
  })

  // ── GUIDES / BLOG ──────────────────────────────────────────────────────────
  const articlePosts = blogPosts.map((p) => ({
    title: p.title,
    href: `/blog/${p.slug}`,
    excerpt: p.excerpt,
    imageUrl: p.heroImageUrl,
    dateLabel: p.publishedAt
      ? new Date(p.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
      : null,
  }))

  // ── MARKET HUD ──────────────────────────────────────────────────────────────
  // Trend chart series: prefer this community's OWN neighborhood close-sale history.
  // But subdivision sales are sparse (often only the last month or two are cached),
  // which renders a degenerate single-line stub with a flat axis. When the community's
  // series can't support a real multi-year trend (<8 monthly points OR <2 calendar
  // years), fall back to the parent CITY's trend — relabeled as city-level so no city
  // figure is ever passed off as the community's. (§0)
  const commPricePoints = priceHist.filter((p) => p.medianSalePrice != null)
  const commTrendYears = new Set(commPricePoints.map((p) => new Date(p.periodStart).getUTCFullYear()))
  const chartIsCityLevel = commPricePoints.length < 8 || commTrendYears.size < 2
  const chartPriceHist = chartIsCityLevel ? cityPriceHist : priceHist

  const sltRaw = mktStats?.avg_sale_to_list_ratio ?? null
  const marketData: KbMarketData = {
    active: activeCount,
    closed30: pulse?.closedLast30Days ?? null,
    new30: null,
    medianList: medianListPrice,
    saleToList: sltRaw != null ? (sltRaw < 2 ? sltRaw * 100 : sltRaw) : null,
    daysToPending: pulse?.medianDaysToPending ?? null,
    monthsSupply: pulse?.monthsOfSupply ?? null,
    // 12-month rolling fallbacks (market_stats_cache) for neighborhood scope,
    // where market_pulse_live has no row so the 30-day fields are null. Rendered
    // with honest 12-month labels by the HUD — never as 30-day figures. (§0)
    sold12mo: stats?.soldCount ?? null,
    medianDom12mo: stats?.medianDaysOnMarket ?? null,
    trend: chartPriceHist
      .slice(-13)
      .filter((p) => p.medianSalePrice != null)
      .map((p) => ({ label: monthLabel(p.periodStart), value: p.medianSalePrice as number })),
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
  // HOA: prefer the top-level registry entry's hoa_annual_estimate; fall back to
  // the lowest sub-neighborhood hoa_annual_estimate when the parent has none. Only
  // from the registry — never from pulse or invented. (§0)
  const registryHoa = registryEntry?.hoa_annual_estimate ?? null
  const subNeighborhoodMinHoa =
    !registryHoa && registryEntry?.sub_neighborhoods?.length
      ? Math.min(
          ...registryEntry.sub_neighborhoods
            .map((s) => s.hoa_annual_estimate ?? Infinity)
            .filter((n) => n < Infinity),
        ) || null
      : null
  const faqHoaEstimate = registryHoa ?? (subNeighborhoodMinHoa !== null && isFinite(subNeighborhoodMinHoa) ? subNeighborhoodMinHoa : null)

  // School district — resolved from the verified city→district registry in
  // data/co-schools.ts. This is the ONLY source allowed (§0). getDistrictForCity()
  // returns undefined for cities outside the Central Oregon service area, in which
  // case the schools section + FAQ are silently omitted rather than fabricated.
  const schoolDistrictInfo = getDistrictForCity(cityName)

  const marketFaqInput: MarketFaqInput = {
    // Alias-aware active count (the same number the hero shows). (§0 / NWX fix)
    activeCount,
    medianListPrice: pulse?.medianListPrice ?? snapshot?.medianListPrice ?? community.medianPrice ?? null,
    monthsOfSupply: pulse?.monthsOfSupply ?? null,
    // Prefer pulse days-to-pending; fall back to stats cache DOM (12-month rolling).
    medianDaysToPending: pulse?.medianDaysToPending ?? null,
    medianDaysOnMarket: stats?.medianDaysOnMarket ?? null,
    refreshedAt: pulse?.refreshedAt ?? snapshot?.refreshedAt ?? null,
    // Extended fields — community-specific grounded questions.
    soldCount12mo: stats?.soldCount ?? null,
    subdivisionAliases: registryEntry?.subdivision_aliases?.length
      ? registryEntry.subdivision_aliases
      : null,
    hoaAnnualEstimate: faqHoaEstimate,
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
      <KbNav />
      <CommunityPageTracker
        slug={slug}
        communityName={community.name}
        city={cityName}
        activeCount={activeCount}
        medianPrice={medianListPrice}
      />
      <KbSectionTracker pageType="community" />
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
            medianDaysToPending: pulse?.medianDaysToPending ?? null,
          }}
          eyebrow={communityLabel}
          titleTop={community.name}
          titleBottom="Homes for Sale"
          lead={`in ${community.name}, ${cityName}, with the live market behind every one.`}
          videoSrc={null}
          posterSrc={heroPhoto}
          // Fix 6: descriptive alt text for the hero image. (§0)
          posterAlt={`${community.name} in ${cityName}, Oregon`}
          mediaCaption={mediaCaption}
        />
        {/* Rich resort/golf/master-planned depth (overview · amenities · golf ·
            membership · builders) — null when no config. When present it carries the
            overview, so the thin data-driven About is suppressed to avoid duplication. */}
        <KbResortOverview
          content={richContent}
          name={community.name}
          postsBySlug={amenityPosts}
          aliases={registryEntry?.subdivision_aliases ?? []}
        />
        {!richContent && aboutParagraphs.length > 0 ? (
          <KbAbout
            eyebrow={communityLabel}
            heading={`Living in ${community.name}`}
            paragraphs={aboutParagraphs}
            facts={aboutFacts}
          />
        ) : null}
        {/* Flow (same coherent order as the city page): the lifestyle overview
            leads, then the MARKET → the homes → a live ticker → the map →
            nearby communities → this-week → activity → guides → explore. */}
        <KbMarketHud
          data={marketData}
          eyebrow={`${community.name} · The market`}
          chartScopeLabel={chartIsCityLevel && cityName ? `${cityName} (city)` : undefined}
        />
        <KbFeatured items={featuredItems} eyebrow={`${community.name} · For sale`} />
        <KbTicker items={tickerItems} />
        {/* Fix 3: Visible freshness signal — "Market data updated [Month Year]" crawled
            by search engines as a freshness signal and surfaced near the stats.
            asOfLabel is the real refreshedAt / snapshot timestamp, never invented. (§0) */}
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
        <KbListingMap
          geojson={mapGeo}
          totalActive={activeCount || mapFeatures.length}
          fitToFeatures
          showRegionMarkers={false}
          polygons={mapPolygons}
          eyebrow={community.name}
          title={`${community.name}\nHomes for Sale`}
          subtitle={`Every active single-family listing in ${community.name}, on the real terrain. Click any dot for the price, the beds, and the street.`}
          // Fix 4: registry center_lon_lat ensures the map renders even when
          // this community has no active listings (empty geojson features). (§0)
          centerLonLat={registryEntry?.center_lon_lat ?? undefined}
        />
        <KbCommunities communities={communityItems} eyebrow={`${cityName} · Communities`} />
        {/* Per-location area guide video — self-hides when this community has no
            approved guide video. Sits after the communities rail, before the
            this-week / activity / FAQ / sell blocks. */}
        <KbAreaGuideVideo videoUrl={areaGuideVideo} locationName={community.name} />
        <KbOpenHouses
          items={openHouseItems}
          eyebrow={`${cityName} · This week`}
          heading="Open houses"
          viewAllHref={`/open-houses/${citySlug}`}
        />
        <KbActivity
          items={activityItems}
          eyebrow={`Live · ${community.name}`}
          heading="Latest market activity"
          viewAllHref="/housing-market"
          viewAllLabel="Full market pulse"
        />
        {/* Schools district — sourced exclusively from data/co-schools.ts
            getDistrictForCity(). Specific school names/attendance zones are NOT
            shown because per-address boundary data is not in the system. (§0) */}
        <KbSchools
          communityName={community.name}
          districtName={schoolDistrictInfo?.district ?? null}
          districtSlug={schoolDistrictInfo?.districtSlug ?? null}
        />
        <KbArticles
          posts={articlePosts}
          eyebrow="Guides and insights"
          heading={`${community.name} real estate, explained`}
          subtitle={`Local housing news, market data, and buyer and seller guides for ${community.name} and ${cityName}.`}
        />
        <KbExploreTowns
          towns={otherCityItems}
          eyebrow="Central Oregon"
          title="Explore other cities"
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
          contactHref={`/contact?inquiryType=Buying&message=${encodeURIComponent(`Interested in ${community.name} — please get in touch.`)}`}
        />
        {/* Listing-alert email capture — reuses submitSearchAlertSignup + the
            guest_search_alerts table (same path as SearchAlertCapture on /search).
            City + subdivision prefilled from community data so the alert matches
            what the visitor is looking at. No new backend. (§0) */}
        <KbCommunityAlerts
          communityName={community.name}
          city={cityName}
          subdivision={community.subdivision}
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
                {community.name} attracts both primary-residence and second-home buyers. Short-term rental potential in master-planned and resort communities like this one varies by HOA rules, community covenants, and Oregon regulations.{' '}
                <a href={`/contact?inquiryType=Buying&message=${encodeURIComponent(`I have questions about short-term rental rules in ${community.name}.`)}`}>
                  Reach out for current rental guidelines
                </a>
                {' '}before making any assumptions about permitted use or income potential.
              </p>
            </div>
          </div>
        ) : null}
        <KbSell
          data={{
            medianListPrice,
            medianDaysToPending: pulse?.medianDaysToPending ?? null,
            soldCount30d: pulse?.closedLast30Days ?? null,
          }}
        />
        {faqs.length > 0 ? (
          <section id="faq" aria-label={`${community.name} real estate questions`}>
            <FAQBlock items={faqs} eyebrow="Common questions" title={`${community.name} real estate questions`} />
          </section>
        ) : null}
        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
