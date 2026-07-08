/**
 * City page — KB (kinetic-brutalist) design, Phase 9 wave 1 of the convergence
 * program (docs/KB_CONVERGENCE_ROADMAP.md). Reuses the SAME section library as the
 * homepage (components/site/kb/*), fed CITY-scoped DAL data, never forked
 * (ci:kb-single-source G50). KbNav + KbFooter carry the chrome (default chrome
 * hidden for ^/cities/[slug] via HideChrome). Bend reuses the homepage hero video;
 * other cities use their VERIFIED cityHero photo with a labeled regional fallback.
 *
 * THE PAGE CONTRACT (docs/KB_CONVERGENCE_ROADMAP.md): KB design + SEO for Google &
 * LLMs (pageMetadata + MetadataBlock JSON-LD: Breadcrumb/City/Dataset/FAQPage) +
 * tracking (CityPageTracker + section/interaction events). Every figure live (§0).
 *
 * Section stack: breadcrumb · hero · about · featured · map · ticker · market ·
 * neighborhoods · communities · golf/master-planned · open houses · activity ·
 * explore-other-cities · guides(blog) · testimonials · team · sell · FAQ · footer.
 *
 * Parity contract: design_system/ryan-realty/ui_kits/city/parity.json (KB set).
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  getGeoSnapshot,
  getMarketPulse,
  getRegionPulse,
  getPriceHistory,
  getCityListings,
  getListingTiles,
  getBendNeighborhoodLedger,
  getCityCommunitySnapshots,
  getAllCitySnapshots,
  getRecentBlogPosts,
  getAreaGuideVideo,
} from '@/lib/data'
import { getMarketStatsCacheRowForGeo } from '@/lib/data/market/getMarketStatsCacheRows'
import { getCommunitiesForIndex } from '@/app/actions/communities'
import { getOpenHousesWithListings } from '@/app/actions/open-houses'
import { getActivityFeedWithFallbackMulti } from '@/app/actions/activity-feed'
import { getCityMetadataByName } from '@/lib/data/cities/getCityMetadata'
import { getCityContent, buildDataDrivenCityAbout } from '@/lib/city-content'
import { CITY_QUICK_FACTS } from '@/lib/cities'
import bendNeighborhoodPolygons from '@/data/bend/bend-neighborhood-polygons.json'
import { cityHero, GOLF_COMMUNITY_IMAGES } from '@/lib/geo-images'
import { resolveFeaturedItems } from '@/lib/kb/resolve-featured-items'
import { buildYearSeries } from '@/lib/kb/year-series'
import { assignNeighborhoodPhotos } from '@/lib/kb/neighborhood-photos'
import { resortActiveSfrCounts, resortLabelToSlug, cityResorts } from '@/lib/kb/resort-active-counts'
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
import { KbFeatured } from '@/components/site/kb/KbFeatured.client'
import { KbListingMap, type KbMapGeo } from '@/components/site/kb/KbListingMap.client'
import { KbTicker } from '@/components/site/kb/KbTicker.client'
import { KbMarketHud } from '@/components/site/kb/KbMarketHud.client'
import { KbExploreTowns } from '@/components/site/kb/KbExploreTowns.client'
import { KbCommunities } from '@/components/site/kb/KbCommunities.client'
import { KbAreaGuideVideo } from '@/components/site/kb/KbAreaGuideVideo'
import { KbOpenHouses } from '@/components/site/kb/KbOpenHouses.client'
import { KbActivity } from '@/components/site/kb/KbActivity.client'
import { KbArticles } from '@/components/site/kb/KbArticles'
import { KbTestimonials } from '@/components/site/kb/KbTestimonials.client'
import { KbTeam } from '@/components/site/kb/KbTeam.client'
import { KbSell } from '@/components/site/kb/KbSell.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { FAQBlock } from '@/components/site/FAQBlock'
import CityPageTracker from '@/components/city/CityPageTracker'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import type {
  KbTownItem,
  KbCommunityItem,
  KbTickerItem,
  KbFeaturedItem,
  KbMarketData,
} from '@/components/site/kb/types'
import { TESTIMONIALS } from '@/lib/testimonials'
import communityVideoManifest from '@/data/city-hero-videos.resolved.json'
import '@/components/site/kb/kb.css'

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return []
}
export const dynamicParams = true
export const revalidate = 60

type Props = { params: Promise<{ slug: string }> }

// Each city's scenic hero B-roll (Mt Bachelor for Bend, Sparks Lake for Sunriver, ...)
// is produced by scripts/sync-city-videos.mjs into public/videos/cities/ and recorded
// in data/city-hero-videos.resolved.json (scope:'cities'). It renders as the muted,
// looping <KbHero> background over its poster still. Cities without a clean B-roll clip
// fall back to their verified cityHero photo.
const CITY_HERO_VIDEO: Record<string, { videoSrc: string; posterSrc: string }> = Object.fromEntries(
  Object.entries(communityVideoManifest as Record<string, { scope?: string; video?: string; poster?: string }>)
    .filter(([, v]) => v?.scope === 'cities' && v.video && v.poster)
    .map(([slug, v]) => [slug, { videoSrc: v.video as string, posterSrc: v.poster as string }]),
)

// Curated marquee communities per city (img + Area Guide video), resolved against
// live counts from getCommunitiesForIndex — same pattern as the homepage.
const CITY_COMMUNITIES: Record<string, { match: string; img: string; videoSlug?: string }[]> = {
  bend: [
    { match: 'tetherow', img: '/images/kb/tetherow-golf-aerial.jpg', videoSlug: 'tetherow' },
    { match: 'broken top', img: '/images/kb/broken-top.jpg', videoSlug: 'broken-top' },
    { match: 'northwest crossing', img: '/images/kb/northwest-crossing.jpg', videoSlug: 'northwest-crossing' },
  ],
  sunriver: [{ match: 'caldera', img: '/images/kb/caldera-springs.jpg', videoSlug: 'caldera-springs' }],
}

// Hover photo for each resort/golf community in the master-planned ledger, keyed by
// the resort-registry slug. The literal-name image lookups miss for resorts (their
// banner rows are tagged under alias subdivisions), so this curated map is the
// primary source. Every path is a verified file under public/.
const RESORT_IMG: Record<string, string> = {
  // KB hero imagery (non-golf-lp slugs) stays as KB literals.
  tetherow: '/images/kb/tetherow-golf-aerial.jpg',
  'broken-top': '/images/kb/broken-top.jpg',
  'northwest-crossing': '/images/kb/northwest-crossing.jpg',
  'vandevert-ranch': '/images/kb/vandevert-ranch.jpg',
  'three-rivers': '/images/kb/three-rivers.jpg',
  'caldera-springs': '/images/kb/caldera-springs.jpg',
  // Golf/master-community tile imagery from the canonical source (D86 / G30).
  pronghorn: GOLF_COMMUNITY_IMAGES.pronghorn,
  'awbrey-glen': GOLF_COMMUNITY_IMAGES['awbrey-glen'],
  'widgi-creek': GOLF_COMMUNITY_IMAGES['widgi-creek'],
  crosswater: GOLF_COMMUNITY_IMAGES.crosswater,
  'eagle-crest': GOLF_COMMUNITY_IMAGES['eagle-crest'],
  'brasada-ranch': GOLF_COMMUNITY_IMAGES['brasada-ranch'],
}

// Every active SFR tile in a city, PAGINATED past PostgREST's 1000-row cap (Bend
// alone has ~1044). The resort alias-aware counts must see the COMPLETE set or
// they undercount communities whose older listings fall past the first page. (§0)
async function fetchAllCityActiveSfr(cityName: string): Promise<Awaited<ReturnType<typeof getListingTiles>>> {
  const PAGE = 1000
  // Dedupe by listingKey across pages — offset pagination over a newest-sorted set
  // can repeat a row if inventory shifts between page fetches.
  const byKey = new Map<string, Awaited<ReturnType<typeof getListingTiles>>[number]>()
  for (let offset = 0; offset < 6000; offset += PAGE) {
    const page = await getListingTiles({ city: cityName, status: 'active', propertyType: 'A', limit: PAGE, offset })
    for (const t of page) byKey.set(t.listingKey, t)
    if (page.length < PAGE) break
  }
  return [...byKey.values()]
}

const CENTRAL_OREGON_CITY_SLUGS = new Set([
  'bend', 'redmond', 'sisters', 'la-pine', 'sunriver', 'madras',
  'prineville', 'culver', 'terrebonne', 'tumalo', 'powell-butte',
])

const monthLabel = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }) : ''
const fmtFull = (n: number | null): string | null => (n != null ? `$${(Math.round(n / 1000) * 1000).toLocaleString('en-US')}` : null)

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
  const snapshot = await getGeoSnapshot({ geoType: 'city', geoKey: slug })
  if (!snapshot) notFound()
  const cityName = snapshot.geoLabel
  return pageMetadata({
    title: `Homes for Sale in ${cityName}, Oregon`,
    description: `Search homes for sale in ${cityName}, Oregon with live single-family market data, neighborhoods, resort communities, open houses, and recent activity from a local brokerage.`,
    path: `/cities/${slug}`,
  })
}

export default async function CityDetailPage({ params }: Props) {
  const { slug } = await params

  const snapshot = await getGeoSnapshot({ geoType: 'city', geoKey: slug })
  if (!snapshot) notFound()
  const cityName = snapshot.geoLabel
  // market_pulse_live + market_stats_cache store city geo_slug SPACE-separated
  // ("la pine", "powell butte") — normalize for those reads, or multi-word cities
  // come back stat-dead. Keep the hyphenated `slug` for URLs / cityHero / config.
  const geoSlug = slug.replace(/-/g, ' ')

  const [
    pulse, regionPulse, mktStats, priceHist, communities, neighborhoodStats,
    communitySnapshots, allCitySnapshots, blogPosts, openHouses, activity,
    cityMeta, mapTiles, featuredTiles, resortTiles, areaGuideVideo,
  ] = await Promise.all([
    withTimeoutFallback(getMarketPulse({ geoType: 'city', geoSlug }), null, 3500, 'city:pulse'),
    withTimeoutFallback(getRegionPulse(), null, 3000, 'city:regionPulse'),
    withTimeoutFallback(getMarketStatsCacheRowForGeo({ geoSlug }), null, 3000, 'city:mktStats'),
    withTimeoutFallback(getPriceHistory('city', geoSlug, 'monthly', 60), [], 4500, 'city:priceHistory'),
    withTimeoutFallback(getCommunitiesForIndex(), [], 3500, 'city:communities'),
    // getBendNeighborhoodLedger (listing_tile_mv), not getBendNeighborhoodStats
    // (market_pulse_live has never carried neighborhood rows — every district
    // rendered a false "0 Active" on the live page; design-audit §0).
    slug === 'bend'
      ? withTimeoutFallback(getBendNeighborhoodLedger(), [], 5000, 'city:nbhStats')
      : Promise.resolve([] as Awaited<ReturnType<typeof getBendNeighborhoodLedger>>),
    withTimeoutFallback(getCityCommunitySnapshots(slug), [], 3000, 'city:commSnaps'),
    withTimeoutFallback(getAllCitySnapshots(), [], 3000, 'city:allCities'),
    withTimeoutFallback(getRecentBlogPosts({ cityName, limit: 3 }), [], 3000, 'city:blog'),
    withTimeoutFallback(getOpenHousesWithListings({ city: cityName }), [], 3500, 'city:openHouses'),
    withTimeoutFallback(getActivityFeedWithFallbackMulti({ cities: [cityName], limit: 8 }), [], 3500, 'city:activity'),
    withTimeoutFallback(getCityMetadataByName(cityName), null, 3000, 'city:meta'),
    withTimeoutFallback(getCityListings(cityName, { status: 'active', sort: 'newest', limit: 1500 }), [], 4500, 'city:mapTiles'),
    withTimeoutFallback(getCityListings(cityName, { status: 'active', sort: 'price-desc', limit: 14 }), [], 4500, 'city:featured'),
    // Uncapped active SFR tiles for the city — the source for alias-aware resort
    // counts. mapTiles is capped at 1500 + all-types, which UNDERcounts resorts
    // (Widgi 28 vs true 48). This SFR-only, high-limit pull is exact. (§0)
    cityResorts(slug).length > 0
      ? withTimeoutFallback(fetchAllCityActiveSfr(cityName), [], 6000, 'city:resortTiles')
      : Promise.resolve([] as Awaited<ReturnType<typeof getListingTiles>>),
    withTimeoutFallback(getAreaGuideVideo(slug), null, 3000, 'area-guide-video'),
  ])

  // Hero — Bend reuses the homepage video; otherwise the VERIFIED cityHero photo
  // (a city without one renders the LABELED regional fallback, never a wrong-city
  // photo). DB hero_image_url override wins. (§D86)
  const activeCount = pulse?.activeCount ?? 0
  const curatedHero = cityHero(slug)
  const heroImageUrl = cityMeta?.hero_image_url ?? null
  const heroPhoto = heroImageUrl ? { src: heroImageUrl, verified: true } : curatedHero
  const heroVideoCfg = CITY_HERO_VIDEO[slug]
  const heroVideoSrc = heroVideoCfg?.videoSrc ?? null
  const heroPosterSrc = heroVideoCfg?.posterSrc ?? heroPhoto.src
  const mediaCaption = heroVideoSrc || heroPhoto.verified ? undefined : 'Regional view · Cascade Range'

  // About — hand-written city content where it exists, else data-driven paragraphs.
  const cityContent = getCityContent(cityName)
  const quickFacts = CITY_QUICK_FACTS[cityName] ?? null
  const aboutParagraphs: string[] = cityContent?.description
    ? [cityContent.description]
    : buildDataDrivenCityAbout({
        cityName,
        population: quickFacts?.population ?? null,
        elevation: quickFacts?.elevation ?? null,
        county: quickFacts?.county ?? null,
        schoolDistrict: quickFacts?.schoolDistrict ?? null,
        nearestAirport: quickFacts?.nearestAirport ?? null,
        activeCount,
        medianPrice: pulse?.medianListPrice ?? snapshot.medianListPrice,
        communityCount: communitySnapshots.length,
      }).slice(0, 2)
  const aboutFacts: { label: string; value: string }[] = [
    ...(quickFacts?.population ? [{ label: 'Population', value: quickFacts.population }] : []),
    ...(pulse?.medianListPrice ? [{ label: 'Median list', value: fmtFull(pulse.medianListPrice) ?? '—' }] : []),
    { label: 'Active single-family', value: activeCount.toLocaleString('en-US') },
    ...(pulse?.medianDaysToPending != null ? [{ label: 'Median to pending', value: `${Math.round(pulse.medianDaysToPending)} days` }] : []),
    ...(quickFacts?.elevation ? [{ label: 'Elevation', value: quickFacts.elevation }] : []),
    ...(quickFacts?.county ? [{ label: 'County', value: `${quickFacts.county} County` }] : []),
  ]

  // Featured + map + ticker (shared resolver).
  const featuredItems: KbFeaturedItem[] = await resolveFeaturedItems(featuredTiles)
  const mapFeatures = mapTiles
    .filter((t) => t.lat != null && t.lng != null)
    .map((t) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [Number(t.lng), Number(t.lat)] as [number, number] },
      properties: {
        p: t.listPrice, bd: t.beds, ba: t.baths, sf: t.sqft,
        a: [t.streetNumber, t.streetName, t.streetSuffix].filter(Boolean).join(' '),
        sub: t.subdivisionName ?? '', city: t.city ?? '', img: t.photoUrl ?? '',
      },
    }))
  const mapGeo: KbMapGeo = { type: 'FeatureCollection', features: mapFeatures }
  // Neighborhood boundary polygons drawn on the city map (Bend has them).
  const neighborhoodPolygons =
    slug === 'bend'
      ? {
          type: 'FeatureCollection' as const,
          features: (bendNeighborhoodPolygons.communities as Array<{ name: string; geometry: unknown }>).map((c) => ({
            type: 'Feature' as const,
            geometry: c.geometry,
            properties: { name: c.name },
          })),
        }
      : undefined
  const tickerItems: KbTickerItem[] = mapTiles.slice(0, 6).map((t) => ({
    price: t.listPrice,
    address: [t.streetNumber, t.streetName, t.streetSuffix].filter(Boolean).join(' '),
    town: t.city ?? '',
  }))

  // Communities in this city (with banner images) — reused for the rail AND as
  // neighborhood hover imagery where a neighborhood matches a community by name.
  const cityComms = communities.filter((c) => c.city?.toLowerCase().trim() === cityName.toLowerCase().trim())
  const communityVideos = communityVideoManifest as Record<string, { video?: string } | undefined>
  const commImgByName = new Map(cityComms.map((c) => [c.subdivision.toLowerCase(), c.heroImageUrl]))
  const commImgBySlug = new Map(cityComms.map((c) => [c.slug, c.heroImageUrl]))
  // One active count per community across the page — a resort like Tetherow that
  // appears in BOTH the visual rail and the golf/master-planned ledger must not
  // show two different numbers. The rail's index count is canonical. The resort
  // registry slugs differ from the index slugs, so the ledger matches the rail by
  // slug first, then by NAME, before falling back to its own SFR snapshot count.
  const commActiveBySlug = new Map(cityComms.map((c) => [c.slug, c.activeCount]))
  const commActiveByName = new Map(cityComms.map((c) => [c.subdivision.toLowerCase().trim(), c.activeCount]))
  // Alias-aware active SFR per resort. A resort's homes are MLS-tagged under many
  // subdivision names (Widgi Creek -> "Inn Of The 7th", "Elkai Woods", ...), so the
  // literal-name count undercounts every resort (Widgi 0 vs true 48). Counted from
  // the city's active tiles via the registry aliases — the canonical number used by
  // BOTH the golf ledger and the rail so a community never shows two figures. (§0)
  const resortSfrCounts = resortActiveSfrCounts(slug, resortTiles)
  const resortSlugByLabel = resortLabelToSlug(slug)

  // Neighborhoods ledger — designated Bend polygons + live westside stats. (§D83)
  // Hover photo: a curated community banner when the neighborhood name matches a
  // community, else a real home INSIDE the neighborhood boundary (highest-priced
  // active listing). No match leaves it blank — never a wrong-place photo. (§D86)
  const neighborhoodPhotos =
    slug === 'bend'
      ? assignNeighborhoodPhotos(
          (bendNeighborhoodPolygons.communities as Array<{ slug: string; name?: string; geometry: { type: string; coordinates: unknown } }>).filter(
            (c) => c.slug.startsWith('bend-'),
          ),
          mapTiles,
        )
      : new Map<string, string>()
  const liveStatsByHref = new Map(neighborhoodStats.map((r) => [r.href, r]))
  const bendNeighborhoodItems: KbTownItem[] =
    slug === 'bend'
      ? (bendNeighborhoodPolygons.communities as Array<{ slug: string; name?: string }>)
          .filter((c) => c.slug.startsWith('bend-'))
          .map((c) => {
            const nslug = c.slug.replace(/^bend-/, '')
            const href = `/cities/bend/${nslug}`
            const live = liveStatsByHref.get(href)
            const name = live?.label ?? c.name ?? nslug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
            return {
              name,
              href,
              activeCount: live?.activeCount ?? 0,
              medianPrice: live?.medianListPrice ?? null,
              img: commImgByName.get(name.toLowerCase()) ?? neighborhoodPhotos.get(c.slug) ?? '',
            }
          })
      : []

  // Golf & master-planned communities — a SEPARATE ledger from neighborhoods. (§D85)
  const communitySfrBySlug = new Map<string, number>()
  for (const s of communitySnapshots) {
    const rawSlug = s.geoKey.includes(':') ? s.geoKey.split(':')[1]! : s.geoKey
    communitySfrBySlug.set(rawSlug.replace(/\s+/g, '-').toLowerCase(), s.activeSfrCount)
  }
  const golfCommunityItems: KbTownItem[] = cityResorts(slug)
    .map((c) => ({
      name: c.label,
      href: `/communities/${c.slug}`,
      activeCount: resortSfrCounts.get(c.slug) ?? communitySfrBySlug.get(c.slug) ?? 0,
      medianPrice: null,
      img: RESORT_IMG[c.slug] ?? commImgBySlug.get(c.slug) ?? commImgByName.get(c.label.toLowerCase().trim()) ?? '',
    }))

  // Communities rail — EVERY community in the city that has a banner photo, with
  // the curated marquee set (hand-picked still + silent Area Guide video) floated
  // to the front, then the rest by active count. (Matt: "all in the slider".)
  const curatedComms = CITY_COMMUNITIES[slug] ?? []
  const communityItems: KbCommunityItem[] = cityComms
    .map((c): KbCommunityItem | null => {
      const curated = curatedComms.find((f) => c.subdivision.toLowerCase().includes(f.match))
      const cv = curated?.videoSlug ? communityVideos[curated.videoSlug] : undefined
      const img = curated?.img ?? c.heroImageUrl ?? null
      if (!img) return null
      // When this community is a resort, show its alias-aware count (so the rail
      // card matches the golf ledger and the real MLS total, not the literal-name
      // undercount). (§0)
      const resortSlug = resortSlugByLabel.get(c.subdivision.toLowerCase().trim())
      const activeCount = resortSlug ? resortSfrCounts.get(resortSlug) ?? c.activeCount : c.activeCount
      return {
        name: c.subdivision,
        activeCount,
        town: cityName,
        href: `/communities/${c.slug}`,
        img,
        video: cv?.video ? { url: cv.video, embedType: 'video-tag' as const } : null,
      }
    })
    .filter((x): x is KbCommunityItem => x !== null)
    .sort((a, b) => (a.video ? 0 : 1) - (b.video ? 0 : 1) || b.activeCount - a.activeCount)

  // Dedupe by NAME, not href: the carousel's hrefs are city-prefixed slugs
  // from the general community index (/communities/bend-tetherow) while the
  // ledger's are plain registry slugs (/communities/tetherow) for the SAME
  // physical place, so an href-based Set never matched (design-audit P2).
  const carouselNames = new Set(communityItems.map((c) => c.name.toLowerCase().trim()))
  const golfCommunityItemsDeduped = golfCommunityItems.filter(
    (t) => carouselNames.has(t.name.toLowerCase().trim()) === false,
  )

  // Explore other cities — editorial index with VERIFIED thumbnails. (§D84, §D87)
  const otherCityItems: KbTownItem[] = allCitySnapshots
    .map((s) => ({ s, citySlug: s.geoKey.replace(/\s+/g, '-') }))
    .filter(({ citySlug }) => citySlug !== slug && CENTRAL_OREGON_CITY_SLUGS.has(citySlug))
    .slice(0, 8)
    .map(({ s, citySlug }) => {
      const hero = cityHero(citySlug)
      return {
        name: s.geoLabel,
        href: `/cities/${citySlug}`,
        activeCount: s.activeSfrCount > 0 ? s.activeSfrCount : 0,
        medianPrice: s.medianListPrice ?? null,
        img: hero.verified ? hero.src : '',
      }
    })

  // Open houses (next, in this city) → KB cards.
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

  // Live activity → KB rows.
  const activityItems = activity.slice(0, 8).map((a) => {
    const km = ACTIVITY_KIND[a.event_type] ?? { kind: a.event_type, label: a.event_type }
    return {
      kind: km.kind,
      label: km.label,
      address: [a.StreetNumber, a.StreetName, a.StreetSuffix].filter(Boolean).join(' ') || 'Address on request',
      cityLine: [a.City, a.SubdivisionName].filter(Boolean).join(' · '),
      price: a.ListPrice ?? null,
      imageUrl: a.PhotoURL ?? null,
      href: listingTileHref({ listingKey: a.listing_key, streetNumber: a.StreetNumber ?? null, streetName: a.StreetName ?? null, city: a.City ?? null }),
      whenLabel: a.event_at
        ? new Date(a.event_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
        : '',
    }
  })

  // Guides / blog. (§D80 — getRecentBlogPosts)
  const articlePosts = blogPosts.map((p) => ({
    title: p.title,
    href: `/blog/${p.slug}`,
    excerpt: p.excerpt,
    imageUrl: p.heroImageUrl,
    dateLabel: p.publishedAt
      ? new Date(p.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
      : null,
  }))

  // Market HUD.
  const sltRaw = mktStats?.avg_sale_to_list_ratio ?? null
  const marketData: KbMarketData = {
    active: pulse?.activeCount ?? null,
    closed30: pulse?.closedLast30Days ?? null,
    new30: null,
    medianList: pulse?.medianListPrice ?? null,
    saleToList: sltRaw != null ? (sltRaw < 2 ? sltRaw * 100 : sltRaw) : null,
    daysToPending: pulse?.medianDaysToPending ?? null,
    monthsSupply: pulse?.monthsOfSupply ?? null,
    trend: priceHist
      .slice(-13)
      .filter((p) => p.medianSalePrice != null)
      .map((p) => ({ label: monthLabel(p.periodStart), value: p.medianSalePrice as number })),
    byTown: bendNeighborhoodItems.filter((n) => n.medianPrice != null).map((n) => ({ name: n.name, median: n.medianPrice as number })),
    countyMedian: regionPulse?.medianListPrice ?? null,
    yearSeries: buildYearSeries(priceHist, 5),
  }

  // AI-citability: verified market Q&A + structured data. The PAGE CONTRACT
  // requires SEO/LLM-citable data on EVERY render, so the Dataset/FAQPage JSON-LD
  // must not vanish when getMarketPulse times out or has no row. Fall back to the
  // always-present geo snapshot (active SFR count + median list + as-of), which is
  // awaited above and never null. Every figure stays verified (§0).
  const marketFaqInput: MarketFaqInput = pulse ?? {
    activeCount: snapshot.activeSfrCount,
    medianListPrice: snapshot.medianListPrice,
    refreshedAt: snapshot.refreshedAt,
  }
  const { faqs, datasetVariables, asOfIso, asOfLabel } = buildMarketFaq(cityName, marketFaqInput)
  const hasMap = mapFeatures.length > 0
  const citySchemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Cities', url: '/cities' },
        { name: cityName, url: `/cities/${slug}` },
      ],
    },
    {
      type: 'place',
      placeType: 'City',
      name: cityName,
      description: `Homes for sale and live single-family market data for ${cityName}, Oregon.`,
      url: `/cities/${slug}`,
      address: { city: cityName, state: 'OR', country: 'US' },
      containedInPlace: 'Central Oregon',
      hasMap: hasMap ? `/cities/${slug}` : undefined,
      additionalProperty: datasetVariables.length > 0 ? datasetVariables : undefined,
    },
  ]
  if (datasetVariables.length > 0) {
    citySchemas.push({
      type: 'dataset',
      name: `${cityName}, Oregon real estate market statistics${asOfLabel ? `, ${asOfLabel}` : ''}`,
      description: `Live single-family home market data for ${cityName}, Oregon. Median list price, active inventory, months of supply, and median days to pending. Sourced from the regional MLS via Ryan Realty.`,
      url: `/cities/${slug}`,
      dateModified: asOfIso ?? undefined,
      spatialCoverageName: `${cityName}, OR`,
      variableMeasured: datasetVariables,
    })
  }

  return (
    <main className="kb-root">
      <KbNav />
      <CityPageTracker
        cityName={cityName}
        slug={slug}
        listingCount={activeCount}
        medianPrice={pulse?.medianListPrice ?? null}
        communityCount={communitySnapshots.length}
      />
      <KbSectionTracker pageType="city" />
      <MetadataBlock schemas={citySchemas} />
      <KbBreadcrumb overlay trail={[{ label: 'Home', href: '/' }, { label: 'Cities', href: '/cities' }, { label: cityName }]} />
      <SmoothScrollProvider>
        <KbHero
          data={{
            activeCount: pulse?.activeCount ?? null,
            medianListPrice: pulse?.medianListPrice ?? null,
            medianDaysToPending: pulse?.medianDaysToPending ?? null,
          }}
          eyebrow={`${cityName} · Oregon`}
          titleTop={cityName}
          titleBottom="Homes for Sale"
          lead={`in ${cityName}, Oregon, with the live market behind every one.`}
          videoSrc={heroVideoSrc}
          posterSrc={heroPosterSrc}
          mediaCaption={mediaCaption}
        />
        {aboutParagraphs.length > 0 ? (
          <KbAbout eyebrow={`${cityName} · Oregon`} heading={`Living in ${cityName}`} paragraphs={aboutParagraphs} facts={aboutFacts} />
        ) : null}
        {/* Flow: lead with the MARKET (credibility) → the homes → a live price
            ticker → the map → drill-down (neighborhoods/communities) → this-week
            (open houses) → live activity → guides → explore out. */}
        <KbMarketHud data={marketData} eyebrow={`${cityName} · The market`} />
        <KbFeatured items={featuredItems} eyebrow={`${cityName} · For sale`} />
        <KbTicker items={tickerItems} />
        <KbListingMap
          geojson={mapGeo}
          totalActive={pulse?.activeCount ?? mapFeatures.length}
          fitToFeatures
          showRegionMarkers={false}
          polygons={neighborhoodPolygons}
          eyebrow={cityName}
          title={`Homes in\n${cityName}`}
          subtitle={`Every active single-family listing in ${cityName}, on the real terrain. Click any dot for the price, the beds, and the street.`}
        />
        <KbExploreTowns
          towns={bendNeighborhoodItems}
          eyebrow={`${cityName} · Neighborhoods`}
          title="Neighborhoods"
          sectionId="neighborhoods"
          cta={{ href: `/homes-for-sale/${slug}`, label: `All ${cityName} homes` }}
        />
        <KbCommunities communities={communityItems} eyebrow={`${cityName} · Communities`} />
        {/* Ledger dedupes against the carousel above it (design-audit P2: the
            same 3-4 resorts rendered twice, once as a photo carousel and again
            as a text ledger). Only communities without a carousel card (no
            curated photo) land here. */}
        {golfCommunityItemsDeduped.length > 0 ? (
          <KbExploreTowns
            towns={golfCommunityItemsDeduped}
            eyebrow={`${cityName} · Communities`}
            title="Golf and master-planned communities"
            sectionId="communities-ledger"
            cta={{ href: '/communities', label: 'Every community' }}
          />
        ) : null}
        <KbAreaGuideVideo videoUrl={areaGuideVideo} locationName={cityName} />
        <KbOpenHouses items={openHouseItems} eyebrow={`${cityName} · This week`} heading="Open houses" viewAllHref={`/open-houses/${slug}`} />
        <KbActivity items={activityItems} eyebrow={`Live · ${cityName}`} heading="Latest market activity" viewAllHref="/housing-market" viewAllLabel="Full market pulse" />
        <KbArticles
          posts={articlePosts}
          eyebrow="Guides and insights"
          heading={`${cityName} real estate, explained`}
          subtitle={`Local housing news, neighborhood deep dives, and buyer and seller guides for ${cityName} and Central Oregon.`}
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
        <KbSell
          data={{
            medianListPrice: pulse?.medianListPrice ?? null,
            medianDaysToPending: pulse?.medianDaysToPending ?? null,
            soldCount30d: pulse?.closedLast30Days ?? null,
          }}
        />
        {faqs.length > 0 ? (
          <section id="faq" aria-label={`${cityName} real estate questions`}>
            <FAQBlock items={faqs} eyebrow="Common questions" title={`${cityName} real estate questions`} />
          </section>
        ) : null}
        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
