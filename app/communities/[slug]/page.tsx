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
} from '@/lib/data'
import { getResortCommunityContent } from '@/lib/resort-community-content'
import { getMarketStatsCacheRowForGeo } from '@/lib/data/market/getMarketStatsCacheRows'
import { getCommunitiesForIndex } from '@/app/actions/communities'
import { getOpenHousesWithListings } from '@/app/actions/open-houses'
import { getActivityFeedWithFallbackMulti } from '@/app/actions/activity-feed'
import boundarySanityBaseline from '@/data/boundary-sanity-baseline.json' assert { type: 'json' }
import { communityImage, cityHero } from '@/lib/geo-images'
import { resolveFeaturedItems } from '@/lib/kb/resolve-featured-items'
import { buildYearSeries } from '@/lib/kb/year-series'
import { resortActiveSfrCounts, cityResorts, resortTilesForSlug } from '@/lib/kb/resort-active-counts'
import { listingTileHref } from '@/lib/slug'
import { pageMetadata } from '@/lib/site/page-metadata'
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
import { KbExploreTowns } from '@/components/site/kb/KbExploreTowns.client'
import { KbCommunities } from '@/components/site/kb/KbCommunities.client'
import { KbOpenHouses } from '@/components/site/kb/KbOpenHouses.client'
import { KbActivity } from '@/components/site/kb/KbActivity.client'
import { KbArticles } from '@/components/site/kb/KbArticles'
import { KbTestimonials } from '@/components/site/kb/KbTestimonials.client'
import { KbTeam } from '@/components/site/kb/KbTeam.client'
import { KbSell } from '@/components/site/kb/KbSell.client'
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
  tetherow: '/images/kb/tetherow-golf-aerial.jpg',
  'broken-top': '/images/kb/broken-top.jpg',
  'northwest-crossing': '/images/kb/northwest-crossing.jpg',
  pronghorn: '/lp/central-oregon-golf/img/pronghorn-01.jpg',
  'awbrey-glen': '/lp/central-oregon-golf/img/awbrey-glen-01.jpg',
  'widgi-creek': '/lp/central-oregon-golf/img/widgi-creek-01.jpg',
  'caldera-springs': '/images/kb/caldera-springs.jpg',
  crosswater: '/lp/central-oregon-golf/img/crosswater-01.jpg',
  'eagle-crest': '/lp/central-oregon-golf/img/eagle-crest-01.jpg',
  'brasada-ranch': '/lp/central-oregon-golf/img/brasada-01.jpg',
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
      ? `${community.activeCount} homes for sale in ${community.name}. Live single-family market stats, open houses, and recent activity for ${community.name} in ${community.city}, Oregon, from a local brokerage.`
      : `Explore ${community.name} in ${community.city}, Oregon. Live single-family market data and recent activity from a local brokerage.`
  return pageMetadata({
    title: `${community.name} Homes for Sale | ${community.city}, Oregon`,
    description: desc,
    path: `/communities/${slug}`,
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
  const aboutParagraphs: string[] = [
    community.description ?? registryEntry?.description ?? '',
  ].filter((p): p is string => Boolean(p && p.trim().length > 0))
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
  const sltRaw = mktStats?.avg_sale_to_list_ratio ?? null
  const marketData: KbMarketData = {
    active: activeCount,
    closed30: pulse?.closedLast30Days ?? null,
    new30: null,
    medianList: medianListPrice,
    saleToList: sltRaw != null ? (sltRaw < 2 ? sltRaw * 100 : sltRaw) : null,
    daysToPending: pulse?.medianDaysToPending ?? null,
    monthsSupply: pulse?.monthsOfSupply ?? null,
    trend: priceHist
      .slice(-13)
      .filter((p) => p.medianSalePrice != null)
      .map((p) => ({ label: monthLabel(p.periodStart), value: p.medianSalePrice as number })),
    byTown: [],
    countyMedian: regionPulse?.medianListPrice ?? null,
    yearSeries: buildYearSeries(priceHist, 5),
  }

  // ── PAGE CONTRACT: AI-citable verified Q&A + structured data ───────────────
  // The Dataset/FAQPage JSON-LD must not vanish when getMarketPulse times out or
  // has no row. Fall back to the always-present community snapshot (active SFR +
  // median list), then to the community detail values, so the schema survives a
  // timeout. Every figure stays verified (§0).
  const marketFaqInput: MarketFaqInput = pulse ?? {
    activeCount: snapshot?.activeSfrCount ?? community.activeCount ?? null,
    medianListPrice: snapshot?.medianListPrice ?? community.medianPrice ?? null,
    refreshedAt: snapshot?.refreshedAt,
  }
  const { faqs, datasetVariables, asOfIso, asOfLabel } = buildMarketFaq(community.name, marketFaqInput)
  const hasMap = mapFeatures.length > 0 || Boolean(mapPolygons)

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
      address: { city: cityName, state: 'OR', country: 'US' },
      containedInPlace: cityName,
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
          titleTop="Homes in"
          titleBottom={community.name}
          lead={`in ${community.name}, ${cityName}, with the live market behind every one.`}
          videoSrc={null}
          posterSrc={heroPhoto}
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
        <KbFeatured items={featuredItems} />
        <KbListingMap
          geojson={mapGeo}
          totalActive={activeCount || mapFeatures.length}
          fitToFeatures
          showRegionMarkers={false}
          polygons={mapPolygons}
          eyebrow={community.name}
          title={`Homes in\n${community.name}`}
          subtitle={`Every active single-family listing in ${community.name}, on the real terrain. Click any dot for the price, the beds, and the street.`}
        />
        <KbTicker items={tickerItems} />
        <KbMarketHud data={marketData} />
        <KbCommunities communities={communityItems} />
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
        <KbExploreTowns
          towns={otherCityItems}
          eyebrow="Central Oregon"
          title="Explore other cities"
          sectionId="nearby"
          cta={{ href: '/cities', label: 'Every city' }}
        />
        <KbArticles
          posts={articlePosts}
          eyebrow="Guides and insights"
          heading={`${community.name} real estate, explained`}
          subtitle={`Local housing news, market data, and buyer and seller guides for ${community.name} and ${cityName}.`}
        />
        <KbTestimonials reviews={TESTIMONIALS.slice(0, 8)} />
        <KbTeam />
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
