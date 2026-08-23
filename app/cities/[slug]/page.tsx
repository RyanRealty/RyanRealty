/**
 * City page — KB (kinetic-brutalist) design, Phase 9 wave 1 of the convergence
 * program (docs/KB_CONVERGENCE_ROADMAP.md). Reuses the SAME section library as the
 * homepage (components/site/kb/*), fed CITY-scoped DAL data, never forked
 * (ci:kb-single-source G50). CHROME: Global PublicNav in app/layout.tsx owns the
 * top bar (KbNav from lib/site-nav.ts). This page owns KbFooter only — do not
 * re-mount KbNav. HideChrome is only for the not-found footer edge case / CSS
 * hide if still used. Bend reuses the homepage hero video; other cities use
 * their VERIFIED cityHero photo with a labeled regional fallback.
 *
 * THE PAGE CONTRACT (docs/KB_CONVERGENCE_ROADMAP.md): KB design + SEO for Google &
 * LLMs (pageMetadata + MetadataBlock JSON-LD: Breadcrumb/City/Dataset/FAQPage) +
 * tracking (CityPageTracker + section/interaction events). Every figure live (§0).
 *
 * Section stack (E3 craft 2026-08-10): breadcrumb · hero (Layer A + city CTAs) ·
 * featured · ticker · map · buyer alerts (mid) · about · market · neighborhoods ·
 * popular · communities · golf · area guide · open houses · activity · SELL ·
 * guides · testimonials · team · other-cities · FAQ · footer.
 * Funnel: inventory first, capture mid-page, convert before exit links.
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
  getCityDetachedMarket,
} from '@/lib/data'
import { getMarketStatsCacheRowForGeo } from '@/lib/data/market/getMarketStatsCacheRows'
import { getCoreChartSeries } from '@/lib/data/market/getCoreChartSeries'
import { canonicalCityCacheSlug } from '@/lib/market/city-cache-slug'
import { publishMonthsOfSupply } from '@/lib/market/publish-months-of-supply'
import { publishSellMedian } from '@/lib/market/publish-median-caption'
import { publishDaysLabel } from '@/lib/market/publish-days-figure'
import { toPublicCoreChartSeries } from '@/lib/market/publish-public-chart-source'
import { CITY_TILE_FETCH_LIMIT, publishCityInventory } from '@/lib/market/publish-city-inventory'
import { medianListPriceOfTiles } from '@/lib/market/tile-medians'
import { isStockPlaceHeroUrl } from '@/lib/market/publish-place-hero'
import { getCommunitiesForIndex } from '@/app/actions/communities'
import { getOpenHousesWithListings } from '@/app/actions/open-houses'
import { getActivityFeedWithFallbackMulti } from '@/app/actions/activity-feed'
import { getCityMetadataByName } from '@/lib/data/cities/getCityMetadata'
import { getCityContent, buildDataDrivenCityAbout } from '@/lib/city-content'
import { CITY_QUICK_FACTS, PRIMARY_CITIES } from '@/lib/cities'
import bendNeighborhoodPolygons from '@/data/bend/bend-neighborhood-polygons.json'
import { cityHero } from '@/lib/geo-images'
import { resolveFeaturedItems } from '@/lib/kb/resolve-featured-items'
import { curateFeaturedTiles } from '@/lib/kb/curate-featured'
import { placeHeroLead } from '@/lib/kb/place-hero-lead'
import { buildYearSeries } from '@/lib/kb/year-series'
import { assignNeighborhoodPhotos } from '@/lib/kb/neighborhood-photos'
import { resortActiveSfrCounts, resortLabelToSlug, cityResorts } from '@/lib/kb/resort-active-counts'
import { fetchAllCityActiveSfr } from '@/lib/kb/city-active-sfr'
import { CITY_HERO_VIDEO, CITY_MARQUEE_COMMUNITIES, CITY_RESORT_LEDGER_IMG, communityVideoUrl } from '@/lib/kb/city-page-config'
// Row-to-prop shaping shared with the neighborhood + community place pages —
// one copy, so a fix cannot land on one of the three and drift on the others.
import {
  buildActivityItems,
  buildArticlePosts,
  buildMapPointFeatures,
  buildMonthlyTrend,
  buildOpenHouseItems,
  buildOtherCityItems,
  buildTickerItems,
} from '@/lib/kb/place-sections'
import { homesForSalePath, slugify } from '@/lib/slug'
import { getPlaceLinks } from '@/lib/place-links'
import { pageMetadata } from '@/lib/site/page-metadata'
import { withTimeoutFallback, withTimeoutFallbackResult } from '@/lib/with-timeout-fallback'
import { buildTimeRails, skippableRail } from '@/lib/build-phase'
import { buildMarketFaq, type MarketFaqInput } from '@/lib/site/market-faq'
import type { SchemaInput } from '@/lib/site/json-ld'
import { buildCitySchemas } from './city-schemas'
import { CityMarketCharts } from './_v3/city-market-charts'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbAbout } from '@/components/site/kb/KbAbout'
import { KbFeatured } from '@/components/site/kb/KbFeatured.client'
// KbListingMap remains in the parity contract; PlaceMapListSplit composes it for dual-pane.
import { KbListingMap, type KbMapGeo } from '@/components/site/kb/KbListingMap.client'
import { PlaceMapListSplit } from '@/components/site/explore/PlaceMapListSplit.client'
import { CITY_PLACE_LIST_CAP, splitRowsFromTiles } from '@/lib/explore/subdivision-page-extras'
import { KbTicker } from '@/components/site/kb/KbTicker.client'
import { KbMarketHud } from '@/components/site/kb/KbMarketHud.client'
import { MarketCoreCharts } from '@/components/market/MarketCoreCharts'
import { KbExploreTowns } from '@/components/site/kb/KbExploreTowns.client'
import { KbCommunities } from '@/components/site/kb/KbCommunities.client'
import { KbAreaGuideVideo } from '@/components/site/kb/KbAreaGuideVideo'
import { KbOpenHouses } from '@/components/site/kb/KbOpenHouses.client'
import { KbActivity } from '@/components/site/kb/KbActivity.client'
import { KbArticles } from '@/components/site/kb/KbArticles'
import { KbTestimonials } from '@/components/site/kb/KbTestimonials.client'
import { KbTeam } from '@/components/site/kb/KbTeam.client'
import { KbSell } from '@/components/site/kb/KbSell.client'
import { KbCommunityAlerts } from '@/components/site/kb/KbCommunityAlerts.client'
import { KbPopularSearches } from '@/components/site/kb/KbPopularSearches'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { MarketSources, type MarketSourceKey } from '@/components/site/MarketSources'
import { FAQBlock } from '@/components/site/FAQBlock'
import CityPageTracker from '@/components/city/CityPageTracker'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import { kbMoneyFull } from '@/components/site/kb/types'
import type { KbTownItem, KbCommunityItem, KbFeaturedItem, KbMarketData } from '@/components/site/kb/types'
import { TESTIMONIALS } from '@/lib/testimonials'
import '@/components/site/kb/kb.css'

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  // Seed the primary Central Oregon cities (finite, in-repo). Long-tail city
  // slugs still SSR on demand via dynamicParams. Build-verified resolvable.
  return PRIMARY_CITIES.map((name) => ({ slug: slugify(name) }))
}
export const dynamicParams = true
export const revalidate = 60

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const snapshot = await getGeoSnapshot({ geoType: 'city', geoKey: slug })
  if (!snapshot) notFound()
  const cityName = snapshot.geoLabel
  return pageMetadata({
    title: `Homes for Sale in ${cityName}, Oregon`,
    description: `Active single-family homes in ${cityName}, Oregon. Live list prices, neighborhoods, open houses, and recent market activity from the regional MLS.`,
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
  const geoSlug = canonicalCityCacheSlug(slug)

  const [
    pulseRead, detached, regionPulse, mktStats, priceHist, communities, neighborhoodStats,
    communitySnapshots, allCitySnapshots, blogPosts, openHouses, activity,
    cityMeta, mapTilesRead, featuredTiles, resortTiles, areaGuideVideo, coreCharts,
  ] = await Promise.all([
    withTimeoutFallbackResult(getMarketPulse({ geoType: 'city', geoSlug }), null, 3500, 'city:pulse'),
    withTimeoutFallback(getCityDetachedMarket(slug), null, 3000, 'city:detached'),
    withTimeoutFallback(getRegionPulse(), null, 3000, 'city:regionPulse'),
    withTimeoutFallback(getMarketStatsCacheRowForGeo({ geoType: 'city', geoSlug }), null, 3000, 'city:mktStats'),
    withTimeoutFallback(getPriceHistory('city', geoSlug, 'monthly', 60), [], 4500, 'city:priceHistory'),
    withTimeoutFallback(getCommunitiesForIndex(), [], 3500, 'city:communities'),
    // getBendNeighborhoodLedger → getBendNeighborhoodPublicInventory
    // (listing_boundary_xref_mv SFR + PUBLIC_ACTIVE). Same population as the
    // place-page hero/FAQ. Not pulse.active_count (includes Coming Soon).
    slug === 'bend'
      ? withTimeoutFallback(getBendNeighborhoodLedger(), [], 5000, 'city:nbhStats')
      : Promise.resolve([] as Awaited<ReturnType<typeof getBendNeighborhoodLedger>>),
    withTimeoutFallback(getCityCommunitySnapshots(slug), [], 3000, 'city:commSnaps'),
    withTimeoutFallback(getAllCitySnapshots(), [], 3000, 'city:allCities'),
    skippableRail(() => getRecentBlogPosts({ cityName, limit: 3 }), [], 3000, 'city:blog'),
    skippableRail(() => getOpenHousesWithListings({ city: cityName }), [], 3500, 'city:openHouses'),
    skippableRail(() => getActivityFeedWithFallbackMulti({ cities: [cityName], limit: 8 }), [], 3500, 'city:activity'),
    withTimeoutFallback(getCityMetadataByName(cityName), null, 3000, 'city:meta'),
    // propertyType:'A' (§0, C-02): every sibling geo map — community, neighborhood,
    // subdivision, zip, homepage — is SFR, and the hero count beside this map is
    // market_pulse_live's SFR activeCount. All-types tiles here made the badge read
    // 1,000 against a hero of 491 on /cities/bend. The 1500 cap also stops binding
    // once the pull is SFR-only.
    withTimeoutFallbackResult(getCityListings(cityName, { status: 'active', sort: 'newest', propertyType: 'A', propertySubType: 'Single Family Residence', limit: CITY_TILE_FETCH_LIMIT }), [], 4500, 'city:mapTiles'),
    // Wide SFR pool for curateFeaturedTiles below — the old price-desc top-14
    // pull had ONLY luxury outliers in it, so curation ran but had nothing
    // mid-market to pick from (design-audit P2).
    withTimeoutFallback(getCityListings(cityName, { status: 'active', sort: 'newest', propertyType: 'A', propertySubType: 'Single Family Residence', limit: 300 }), [], 4500, 'city:featured'),
    // Uncapped active SFR tiles for the city — the source for alias-aware resort
    // counts. mapTiles is capped at 1500 + all-types, which UNDERcounts resorts
    // (Widgi 28 vs true 48). This SFR-only, high-limit pull is exact. (§0)
    cityResorts(slug).length > 0
      ? withTimeoutFallback(fetchAllCityActiveSfr(cityName), [], 6000, 'city:resortTiles')
      : Promise.resolve([] as Awaited<ReturnType<typeof getListingTiles>>),
    withTimeoutFallback(getAreaGuideVideo(slug), null, 3000, 'area-guide-video'),
    // Tabbed core-chart module series (24-month cache-fed trends). Null on a
    // blip → the module renders nothing under the HUD. (§0)
    withTimeoutFallback(getCoreChartSeries({ geoType: 'city', geoSlug }), null, 4500, 'city:coreCharts'),
  ])

  // Hero — Bend reuses the homepage video; otherwise the VERIFIED cityHero photo
  // (a city without one renders the LABELED regional fallback, never a wrong-city
  // photo). DB hero_image_url override wins. (§D86)
  // §0 UNKNOWN IS NOT ZERO: `?? 0` published a fabricated "0 homes for sale" whenever the pulse read timed out.
  // When the address-set tile fetch is complete (under the cap), publish that
  // count so hero / facts / JSON-LD cannot say 6 against a 24-door list.
  const pulse = pulseRead.ok ? pulseRead.value : null
  const mapTiles = mapTilesRead.value
  const publishedInventory = publishCityInventory({
    pulseCount: pulse?.activeCount ?? null,
    pulseMedian: pulse?.medianListPrice ?? null,
    tileCount: mapTiles.length,
    tileMedian: medianListPriceOfTiles(mapTiles),
    tileLimit: CITY_TILE_FETCH_LIMIT,
    tileFetchOk: mapTilesRead.ok,
  })
  const activeCount: number | null = publishedInventory.count
  const publishedMedian = publishedInventory.medianListPrice
  const sellMedian = publishSellMedian({ placeMedian: publishedMedian, grain: 'city', placeName: cityName })
  const curatedHero = cityHero(slug)
  const heroImageUrl = cityMeta?.hero_image_url ?? null
  const heroPhoto =
    heroImageUrl && !isStockPlaceHeroUrl(heroImageUrl)
      ? { src: heroImageUrl, verified: true }
      : curatedHero
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
        activeCount: activeCount ?? 0,
        medianPrice: publishedMedian ?? snapshot.medianListPrice,
        communityCount: communitySnapshots.length,
      }).slice(0, 2)
  const daysFact = publishDaysLabel(pulse?.medianDaysToPending)
  const aboutFacts: { label: string; value: string }[] = [
    ...(quickFacts?.population ? [{ label: 'Population', value: quickFacts.population }] : []),
    ...(publishedMedian ? [{ label: 'Median list', value: kbMoneyFull(publishedMedian) ?? '—' }] : []),
    ...(activeCount != null ? [{ label: 'Active single-family', value: activeCount.toLocaleString('en-US') }] : []),
    ...(daysFact ? [{ label: 'Median to pending', value: daysFact }] : []),
    ...(quickFacts?.elevation ? [{ label: 'Elevation', value: quickFacts.elevation }] : []),
    ...(quickFacts?.county ? [{ label: 'County', value: `${quickFacts.county} County` }] : []),
  ]

  // Featured + map + ticker. Curated like the homepage rail (Phase D) so
  // price-desc doesn't lead with pure luxury outliers (design-audit P2).
  const cityMedians = publishedMedian != null ? Array(4).fill({ name: cityName, medianPrice: publishedMedian }) : []
  const featuredItems: KbFeaturedItem[] = await resolveFeaturedItems(curateFeaturedTiles(featuredTiles, cityMedians, 14))
  const mapFeatures = buildMapPointFeatures(mapTiles)
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
  // The tape spans one city here, so a tile with no City renders a blank town.
  const tickerItems = buildTickerItems(mapTiles, '')

  // Communities in this city (with banner images) — reused for the rail AND as
  // neighborhood hover imagery where a neighborhood matches a community by name.
  const cityComms = communities.filter((c) => c.city?.toLowerCase().trim() === cityName.toLowerCase().trim())
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
              activeCount: live?.activeCount ?? (neighborhoodStats.length > 0 ? 0 : null),
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
      href: getPlaceLinks({ type: 'community', slug: c.slug, citySlug: slug }).placeUrl,
      activeCount: resortSfrCounts.get(c.slug) ?? communitySfrBySlug.get(c.slug) ?? 0,
      medianPrice: null,
      img: CITY_RESORT_LEDGER_IMG[c.slug] ?? commImgBySlug.get(c.slug) ?? commImgByName.get(c.label.toLowerCase().trim()) ?? '',
    }))

  // Communities rail — EVERY community in the city that has a banner photo, with
  // the curated marquee set (hand-picked still + silent Area Guide video) floated
  // to the front, then the rest by active count. (Matt: "all in the slider".)
  const curatedComms = CITY_MARQUEE_COMMUNITIES[slug] ?? []
  const communityItems: KbCommunityItem[] = cityComms
    .map((c): KbCommunityItem | null => {
      const curated = curatedComms.find((f) => c.subdivision.toLowerCase().includes(f.match))
      const cvUrl = communityVideoUrl(curated?.videoSlug)
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
        href: getPlaceLinks({
          type: 'community',
          slug: resortSlug ?? c.slug,
          citySlug: slug,
        }).placeUrl,
        img,
        video: cvUrl ? { url: cvUrl, embedType: 'video-tag' as const } : null,
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

  // Explore other cities — editorial index with VERIFIED thumbnails, minus the
  // city the reader is already on. (§D84, §D87)
  const otherCityItems: KbTownItem[] = buildOtherCityItems(allCitySnapshots, { excludeSlug: slug })

  // Open houses (next, in this city) → KB cards.
  const openHouseItems = buildOpenHouseItems(openHouses)

  // Live activity → KB rows. 21-day stale-"New" relabel per design-audit TRU-2.
  const activityItems = buildActivityItems(activity, { staleNewAfterDays: 21 })

  // Guides / blog. (§D80 — getRecentBlogPosts)
  const articlePosts = buildArticlePosts(blogPosts)

  // Market HUD.
  const sltRaw = mktStats?.avg_sale_to_list_ratio ?? null
  const marketActive = detached?.activeCount ?? pulse?.activeCount ?? null
  const monthsOfSupply = publishMonthsOfSupply({
    grain: 'city',
    pulseMos: detached?.monthsOfSupply ?? pulse?.monthsOfSupply,
    pulseActiveCount: marketActive,
    displayedActiveCount: marketActive,
  })
  const marketMedian = detached?.medianListPrice ?? publishedMedian
  const marketData: KbMarketData = {
    active: marketActive,
    closed30: pulse?.closedLast30Days ?? null,
    new30: null,
    medianList: marketMedian,
    saleToList: sltRaw != null ? (sltRaw < 2 ? sltRaw * 100 : sltRaw) : null,
    daysToPending: pulse?.medianDaysToPending ?? null,
    monthsSupply: monthsOfSupply,
    trend: buildMonthlyTrend(priceHist),
    byTown: bendNeighborhoodItems.filter((n) => n.medianPrice != null).map((n) => ({ name: n.name, median: n.medianPrice as number })),
    countyMedian: regionPulse?.medianListPrice ?? null,
    yearSeries: buildYearSeries(priceHist, 5),
  }

  // AI-citability: verified market Q&A + structured data. The PAGE CONTRACT
  // requires SEO/LLM-citable data on EVERY render, so the Dataset/FAQPage JSON-LD
  // must not vanish when getMarketPulse times out or has no row. Fall back to the
  // always-present geo snapshot (active SFR count + median list + as-of), which is
  // awaited above and never null. Every figure stays verified (§0).
  const marketFaqInput: MarketFaqInput = {
    ...(pulse ?? { activeCount: snapshot.activeSfrCount, medianListPrice: snapshot.medianListPrice, refreshedAt: snapshot.refreshedAt }),
    activeCount: marketActive ?? snapshot.activeSfrCount,
    pulseActiveCount: marketActive,
    medianListPrice: marketMedian ?? snapshot.medianListPrice,
    grain: 'city',
    monthsOfSupply,
  }
  const { faqs, datasetVariables, asOfIso, asOfLabel } = buildMarketFaq(cityName, marketFaqInput)
  const hasMap = mapFeatures.length > 0
  // JSON-LD (breadcrumb + City Place + Dataset) — extracted verbatim to
  // ./city-schemas.ts for the ci:file-size-budget floor.
  const citySchemas: SchemaInput[] = buildCitySchemas({
    cityName,
    slug,
    hasMap,
    datasetVariables,
    asOfIso,
    asOfLabel,
  })

  return (
    <main className="kb-root">
      <CityPageTracker
        cityName={cityName}
        slug={slug}
        listingCount={activeCount}
        medianPrice={publishedMedian}
        communityCount={communitySnapshots.length}
      />
      <KbSectionTracker />
      <MetadataBlock schemas={citySchemas} />
      <KbBreadcrumb overlay trail={[{ label: 'Home', href: '/' }, { label: 'Cities', href: '/cities' }, { label: cityName }]} />
      <SmoothScrollProvider>
        <KbHero
          data={{
            activeCount,
            medianListPrice: publishedMedian,
            medianDaysToPending: pulse?.medianDaysToPending ?? null,
          }}
          eyebrow={`${cityName} · Oregon`}
          titleTop={cityName}
          titleBottom="Homes for Sale"
          lead={placeHeroLead({ placeName: cityName, activeCount })}
          videoSrc={heroVideoSrc}
          posterSrc={heroPosterSrc}
          posterAlt={`${cityName}, Oregon`}
          mediaCaption={mediaCaption}
          // City-scoped CTAs (E3): default /homes-for-sale is region-wide and
          // steers off this inventory page. Primary stays on city inventory;
          // ghost keeps the valuation path for owners reading a buyer page.
          cta={{ href: homesForSalePath(cityName), label: `See ${cityName} homes` }}
          ctaSecondary={{ href: '/sell/valuation', label: 'Value my home' }}
        />
        {hasMap && mapTiles.length > 0 ? (
          <PlaceMapListSplit
            rows={splitRowsFromTiles(mapTiles, { cap: CITY_PLACE_LIST_CAP })}
            mapGeo={mapGeo}
            polygons={neighborhoodPolygons}
            eyebrow={`${cityName} · For sale`}
            title={`Homes in ${cityName}`}
            subtitle={`Active single-family listings with a ${cityName} address. Hover the list to lift a pin.`}
            totalActive={activeCount ?? mapFeatures.length}
            viewAllHref={homesForSalePath(cityName)}
            viewAllLabel={`See every ${cityName} home for sale`}
          />
        ) : (
          <KbFeatured
            items={featuredItems}
            eyebrow={`${cityName} · For sale`}
            viewAllHref={homesForSalePath(cityName)}
            viewAllLabel={`See every ${cityName} home for sale`}
            viewAllPlace={cityName}
            totalCount={activeCount || null}
          />
        )}
        <KbTicker items={tickerItems} />
        {/* Mid-page buyer capture (E3): after map inventory, city + SFR only.
            propertyType A matches hero activeCount (§0). Empty subdivision. */}
        <KbCommunityAlerts
          communityName={cityName}
          city={cityName}
          subdivision=""
          extraFilters={{ propertyType: 'A' }}
          headline={cityName}
          body={`Enter your email. When a single-family home hits the market in ${cityName}, you hear first.`}
        />
        {aboutParagraphs.length > 0 ? (
          <KbAbout eyebrow={`${cityName} · Oregon`} heading={`${cityName}, in plain words`} paragraphs={aboutParagraphs} facts={aboutFacts} />
        ) : null}
        {/* ONE market section (Matt 2026-07-29): the core charts render INSIDE the HUD
            section, not as a second stacked, separately-headed section. The communities
            page adopted this the day it was asked for; the city page was the last
            stacker (C-17). */}
        <KbMarketHud data={marketData} eyebrow={`${cityName} · The market`} geoName={cityName} asOf={pulse?.refreshedAt ?? null} byTownKind="neighborhood">
          {coreCharts ? (
            <div className="pt-10" aria-label={`${cityName} market trend charts`}>
              <MarketCoreCharts data={toPublicCoreChartSeries(coreCharts)} heading={`${cityName} market trends`} />
            </div>
          ) : null}
          {/* The approved chart-room town charts (Unit CITY 2026-08-19) — same
              market section, additive under the core trends. Subject rows are
              bound to the SAME published figures the HUD prints (§0). */}
          <CityMarketCharts
            citySlug={slug}
            geoSlug={geoSlug}
            cityName={cityName}
            publishedMos={monthsOfSupply}
            publishedDtp={pulse?.medianDaysToPending ?? null}
            displayedActiveCount={marketActive}
          />
        </KbMarketHud>
        <KbExploreTowns
          towns={bendNeighborhoodItems}
          eyebrow={`${cityName} · Neighborhoods`}
          title="Neighborhoods"
          sectionId="neighborhoods"
          cta={{ href: `/homes-for-sale/${slug}`, label: `All ${cityName} homes` }}
        />
        <KbPopularSearches citySlug={slug} cityName={cityName} />
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
        <KbAreaGuideVideo videoUrl={areaGuideVideo?.url ?? null} wide={areaGuideVideo?.wide} locationName={cityName} posterSrc={heroPosterSrc} />
        {/* Urgency cluster (this week + live feed) before convert. */}
        {buildTimeRails(true) || openHouseItems.length > 0 ? (
          <KbOpenHouses items={openHouseItems} eyebrow={`${cityName} · This week`} heading="Open houses" viewAllHref={`/open-houses/${slug}`} />
        ) : null}
        <KbActivity items={activityItems} eyebrow={`Live · ${cityName}`} heading="Latest market activity" viewAllHref="/housing-market" viewAllLabel="Full market pulse" />
        {/* Convert before trust + exit links (E3 CTA clarity). City eyebrow. */}
        <KbSell
          data={{
            medianListPrice: sellMedian?.value ?? null,
            medianCaption: sellMedian?.caption ?? null,
            medianDaysToPending: pulse?.medianDaysToPending ?? null,
            soldCount30d: pulse?.closedLast30Days ?? null,
          }}
          eyebrow={`Sell in ${cityName}`}
        />
        <KbArticles
          posts={articlePosts}
          eyebrow="Guides and news"
          heading={`${cityName} guides`}
          subtitle={`Housing news, neighborhood guides, and buyer and seller notes for ${cityName}.`}
        />
        <KbTestimonials reviews={TESTIMONIALS.slice(0, 8)} />
        <KbTeam />
        {/* Exit links last: every row leaves this city page. */}
        <KbExploreTowns
          towns={otherCityItems}
          eyebrow="Central Oregon"
          title="Other cities on the list"
          sectionId="nearby"
          cta={{ href: '/cities', label: 'Every city' }}
        />
        {faqs.length > 0 ? (
          <section id="faq" aria-label={`${cityName} real estate questions`}>
            <FAQBlock items={faqs} eyebrow="Common questions" title={`Questions about ${cityName}`} />
          </section>
        ) : null}
        {/* Census only when the page actually renders a population figure
            (quickFacts.population, from CITY_QUICK_FACTS). Never link padding. */}
        <MarketSources
          sources={(quickFacts?.population ? ['ods', 'census'] : ['ods']) as MarketSourceKey[]}
        />
        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
