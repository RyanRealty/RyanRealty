/**
 * Neighborhood detail page — KB (kinetic-brutalist) design, Phase 9 wave 3 of
 * the convergence program (docs/KB_CONVERGENCE_ROADMAP.md). Mirrors the
 * community page section order (components/site/kb/*), fed NEIGHBORHOOD-scoped
 * DAL data, never forked (ci:kb-single-source G50). KbNav + KbFooter carry chrome.
 *
 * THE PAGE CONTRACT (docs/KB_CONVERGENCE_ROADMAP.md): KB design + SEO for
 * Google & LLMs (pageMetadata + MetadataBlock JSON-LD: Breadcrumb/Neighborhood
 * Place/Dataset/FAQPage) + tracking (KbSectionTracker section/interaction
 * events). Every figure live (§0).
 *
 * City-fallback for the market chart: when the neighborhood's own monthly series
 * is too sparse (<8 non-null points OR <2 calendar years) it falls back to the
 * parent city's getPriceHistory('city', citySlug, 'monthly', 60), relabeled via
 * chartScopeLabel "{City} (city)" so the city figure never reads as this one's.
 *
 * The chart-room forms mount INSIDE that same market section (Unit NEIGHBORHOOD
 * 2026-08-19, ./_v3/neighborhood-market-charts). They read the district polygon
 * assignment back to 1997 and the live boundary inventory — never a neighborhood
 * pulse or stats-cache CLOSED figure, both of which under-count closings at this
 * grain by 6x to 16x. That reconciliation is in the data module's header.
 *
 * Section stack (E3 light, city funnel parity): breadcrumb · hero · featured ·
 * ticker · map · buyer alerts (mid) · overview/about · market · subdivisions ·
 * area guide · open houses · activity · SELL · guides · testimonials · team ·
 * other cities · FAQ · footer. Inventory leads; convert before exit links.
 * Data ONLY through @/lib/data and @/app/actions/cities. No raw .from() calls.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getNeighborhoodBySlug, getCommunitiesInNeighborhood } from '@/app/actions/cities'
import { EMPTY_PUBLIC_PACE, getPublicDetachedPace } from '@/lib/data/market-truth/public-pace'
import {
  getPublicDetachedMonthly,
  leftoverNeighborhoodOrCityMonthly,
} from '@/lib/data/market-truth/public-monthly'
import { zonedDateKey } from '@/lib/format/date'
import { getPublicPlaceSegments } from '@/lib/data/market-truth/public-segments'
import { resolveNeighborhoodMetricSlug } from '@/lib/data/market-truth/neighborhood-metric-slug'
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
  getGeoBoundaryMapData,
  getAllCitySnapshots,
  getRecentBlogPosts,
  getBlogPostsBySlugs,
  getAreaGuideVideo,
} from '@/lib/data'
import { getResortCommunityContent } from '@/lib/resort-community-content'
import { getNeighborhoodPublicInventory } from '@/lib/data/geo/neighborhood-public-inventory'
import { getOpenHousesWithListings } from '@/app/actions/open-houses'
import { getActivityFeedWithFallbackMulti } from '@/app/actions/activity-feed'
import { communityImage, cityHero } from '@/lib/geo-images'
import { resolveFeaturedItems } from '@/lib/kb/resolve-featured-items'
import { buildYearSeries } from '@/lib/kb/year-series'
// Row-to-prop shaping shared with the city + community place pages — one copy,
// so a fix cannot land on one of the three and drift on the others.
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
import { publishSellMedian } from '@/lib/market/publish-median-caption'
import { publishDaysLabel } from '@/lib/market/publish-days-figure'
import { slugify, subdivisionListingsPath } from '@/lib/slug'
import { pageMetadata } from '@/lib/site/page-metadata'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { buildTimeRails, hotRailTimeoutMs, skippableRail, skippableRailResult } from '@/lib/build-phase'
import { buildMarketFaq, type MarketFaqInput } from '@/lib/site/market-faq'
import type { SchemaInput } from '@/lib/site/json-ld'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbAbout } from '@/components/site/kb/KbAbout'
import { KbResortOverview } from '@/components/site/kb/KbResortOverview'
import { KbFeatured } from '@/components/site/kb/KbFeatured.client'
import { KbListingMap, type KbMapGeo } from '@/components/site/kb/KbListingMap.client'
import { KbTicker } from '@/components/site/kb/KbTicker.client'
import { KbMarketHud } from '@/components/site/kb/KbMarketHud.client'
import { KbExploreTowns } from '@/components/site/kb/KbExploreTowns.client'
import { KbActivity } from '@/components/site/kb/KbActivity.client'
import { KbOpenHouses } from '@/components/site/kb/KbOpenHouses.client'
import { KbArticles } from '@/components/site/kb/KbArticles'
import { KbTestimonials } from '@/components/site/kb/KbTestimonials.client'
import { KbTeam } from '@/components/site/kb/KbTeam.client'
import { KbSell } from '@/components/site/kb/KbSell.client'
import { KbCommunityAlerts } from '@/components/site/kb/KbCommunityAlerts.client'
import { KbAreaGuideVideo } from '@/components/site/kb/KbAreaGuideVideo'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { MarketSources } from '@/components/site/MarketSources'
import { FAQBlock } from '@/components/site/FAQBlock'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import { formatPriceExact } from '@/lib/format/money'
import { publishNeighborhoodHero } from '@/lib/market/publish-place-hero'
import { kbMoneyFull } from '@/components/site/kb/types'
import type { KbTownItem, KbMarketData } from '@/components/site/kb/types'
import { TESTIMONIALS } from '@/lib/testimonials'
import { peerNeighborhoodTowns } from '@/lib/explore/neighborhood-peers'
import { lifestyleNearLatLng } from '@/lib/explore/lifestyle-near'
import { mapCentroid } from '@/lib/explore/subdivision-page-extras'
import { LifestyleNearSection } from '@/components/site/explore/LifestyleNearSection'
import { PlaceMapListSplit } from '@/components/site/explore/PlaceMapListSplit.client'
import { splitRowsFromTiles } from '@/lib/explore/subdivision-page-extras'
import { buildNeighborhoodSchemas } from './neighborhood-schemas'
import { NeighborhoodMarketCharts } from './_v3/neighborhood-market-charts'
import '@/components/site/kb/kb.css'

export async function generateStaticParams(): Promise<Array<{ slug: string; neighborhoodSlug: string }>> {
  const { BEND_NEIGHBORHOOD_DISTRICTS } = await import('@/lib/data/geo/getBendNeighborhoodLedger')
  return BEND_NEIGHBORHOOD_DISTRICTS.map((n) => ({ slug: 'bend', neighborhoodSlug: n.slug }))
}
export const dynamicParams = true
export const revalidate = 60

type Props = { params: Promise<{ slug: string; neighborhoodSlug: string }> }

// Short form for the character-constrained meta description below ONLY. Facts
// tables use kbMoneyFull, per the brand rule ($895,000, not $895K).
const fmtK = (n: number | null): string | null => (n != null ? `$${Math.round(n / 1000).toLocaleString()}K` : null)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: citySlug, neighborhoodSlug } = await params
  const neighborhood = await getNeighborhoodBySlug(citySlug, neighborhoodSlug)
  if (!neighborhood) notFound()

  const title =
    neighborhood.seoTitle?.trim() ||
    `${neighborhood.name} homes for sale | ${neighborhood.cityName}, Oregon`

  const inventory =
    citySlug === 'bend'
      ? await getNeighborhoodPublicInventory(`${citySlug}-${neighborhoodSlug}`)
      : null
  const generatedDescription =
    inventory != null && inventory.activeCount > 0
      ? `${inventory.activeCount} single-family homes for sale in ${neighborhood.name}, ${neighborhood.cityName}. Median list price ${inventory.medianListPrice != null ? fmtK(inventory.medianListPrice) ?? '' : 'available on request'}. Live market data from the regional MLS.`
      : `Active single-family homes in ${neighborhood.name}, ${neighborhood.cityName}, Oregon. List prices and days on market, pulled live.`
  // Brand voice (CLAUDE.md): a curated DB seo_description carrying a banned
  // cliche (the live "charming" on /cities/bend/old-bend) must never reach the
  // SERP, so a tripped guard falls back to the clean data-driven description.
  const bannedDescRe =
    /\b(charming|stunning|nestled|boasts|pristine|breathtaking|must-see|hidden gem|luxurious|meticulously|gorgeous|immaculate)\b/i
  const description =
    neighborhood.seoDescription && !bannedDescRe.test(neighborhood.seoDescription)
      ? neighborhood.seoDescription
      : generatedDescription

  return pageMetadata({
    title,
    description,
    path: `/cities/${citySlug}/${neighborhoodSlug}`,
  })
}

export default async function NeighborhoodDetailPage({ params }: Props) {
  const { slug: citySlug, neighborhoodSlug } = await params

  const neighborhood = await getNeighborhoodBySlug(citySlug, neighborhoodSlug)
  if (!neighborhood) notFound()

  const cityName = neighborhood.cityName
  // market_pulse_live + market_stats_cache store city geo_slug SPACE-separated
  // ("la pine", "powell butte") — normalize for those reads.
  const cityGeoSlug = canonicalCityCacheSlug(citySlug)

  // Boundary polygon slug for neighborhoods: "{citySlug}-{neighborhoodSlug}"
  const boundaryNeighborhoodSlug = `${citySlug}-${neighborhoodSlug}`
  // GIS / inventory / map stay on the prefixed boundary key. Market Truth
  // neighborhood geo_slug is often the community slug (sunriver, not
  // sunriver-sunriver). Identity probe, not a published figure.
  const metricNeighborhoodSlug = await resolveNeighborhoodMetricSlug({
    citySlug,
    neighborhoodSlug,
  })

  const currentMonthKey = zonedDateKey(new Date()).slice(0, 7)
  const [
    pulse, stats, regionPulse, priceHist,
    boundaryRead, allCitySnapshots, blogPosts, openHouses, activity,
    cityPriceHist, neighborhoodCommunities, richContent, areaGuideVideo,
    peerNeighborhoods,
    inventoryRead,
    publicPace, publicSegments, leftoverCityMonthly, leftoverNeighborhoodMonthly, publicMix,
  ] = await Promise.all([
    withTimeoutFallback(getMarketPulse({ geoType: 'neighborhood', geoSlug: metricNeighborhoodSlug }), null, 3500, 'nbh:pulse'),
    // Hot-path core figures (HUD, about facts, FAQ): a build timeout would
    // bake the fallback into the static HTML, so the build leash is 3×.
    // Sold median / sale-to-list do not use this GIS-boundary cache row —
    // leftover (metric slug) is the closed-side source; miss omits.
    withTimeoutFallback(getMarketStats({ geoType: 'neighborhood', geoSlug: boundaryNeighborhoodSlug, periodType: 'rolling_365d' }), null, hotRailTimeoutMs(3500), 'nbh:stats'),
    withTimeoutFallback(getRegionPulse(), null, 3000, 'nbh:regionPulse'),
    withTimeoutFallback(getPriceHistory('neighborhood', boundaryNeighborhoodSlug, 'monthly', 60), [], 4500, 'nbh:priceHistory'),
    // Result variant: a timed-out boundary yields `{ pins: [] }`, which is
    // indistinguishable from a genuinely empty neighborhood. `.ok` keeps them
    // apart so a degraded read can never publish a count (§0). Skipped during
    // SSG (it timed out on 8 of ~14 build renders anyway) — the polygon overlay
    // and schema centroid refill on first revalidate; counts come from the
    // inventory read, never from pins.
    skippableRailResult(() => getGeoBoundaryMapData({ geoType: 'neighborhood', geoSlug: boundaryNeighborhoodSlug }), { polygon: null, pins: [] }, 4500, 'nbh:boundary'),
    withTimeoutFallback(getAllCitySnapshots(), [], 3000, 'nbh:cities'),
    skippableRail(() => getRecentBlogPosts({ cityName, limit: 3 }), [], 3000, 'nbh:blog'),
    skippableRail(() => getOpenHousesWithListings({ city: cityName }), [], 3500, 'nbh:openHouses'),
    skippableRail(() => getActivityFeedWithFallbackMulti({ cities: [cityName], limit: 8 }), [], 3500, 'nbh:activity'),
    // Parent-city monthly price history — fallback when this neighborhood's own
    // series is too thin for a real multi-year trend (<8 non-null points OR <2
    // calendar years). Relabeled as city-level when used (§0). (§0)
    withTimeoutFallback(getPriceHistory('city', cityGeoSlug, 'monthly', 60), [], 4500, 'nbh:cityPriceHistory'),
    // Subdivisions within this neighborhood — drives the KbExploreTowns ledger.
    skippableRail(() => getCommunitiesInNeighborhood(neighborhood.id, cityName), [], 3500, 'nbh:communities'),
    // Rich, verified neighborhood depth from
    // data/resort-community-{citySlug}-{neighborhoodSlug}.json — the same curated
    // source the resort LPs render, keyed by the boundary slug. Null until
    // authored, and KbResortOverview then renders nothing.
    withTimeoutFallback(getResortCommunityContent(boundaryNeighborhoodSlug), null, 2500, 'nbh:content'),
    // Per-neighborhood area-guide video, tagged by the neighborhood/community
    // slug (EXACT geo match). Null → KbAreaGuideVideo renders nothing.
    withTimeoutFallback(getAreaGuideVideo(neighborhoodSlug), null, 3000, 'area-guide-video'),
    withTimeoutFallback(peerNeighborhoodTowns(citySlug, neighborhoodSlug), [], 3500, 'nbh:peers'),
    getNeighborhoodPublicInventory(boundaryNeighborhoodSlug),
    withTimeoutFallback(
      getPublicDetachedPace({ geoType: 'neighborhood', geoSlug: metricNeighborhoodSlug }),
      EMPTY_PUBLIC_PACE,
      3000,
      'nbh:publicPace',
    ),
    withTimeoutFallback(
      getPublicPlaceSegments({ geoType: 'neighborhood', geoSlug: metricNeighborhoodSlug }),
      [],
      3000,
      'nbh:publicSegments',
    ),
    withTimeoutFallback(
      getPublicDetachedMonthly({
        geoType: 'city',
        geoSlug: citySlug,
        currentMonthKey,
      }),
      [],
      4500,
      'nbh:leftoverCityMonthly',
    ),
    withTimeoutFallback(
      getPublicDetachedMonthly({
        geoType: 'neighborhood',
        geoSlug: metricNeighborhoodSlug,
        currentMonthKey,
      }),
      [],
      4500,
      'nbh:leftoverNeighborhoodMonthly',
    ),
    withTimeoutFallback(
      getPublicDetachedMix({ geoType: 'neighborhood', geoSlug: metricNeighborhoodSlug }),
      EMPTY_PUBLIC_MIX,
      3000,
      'nbh:publicMix',
    ),
  ])

  const boundaryMapData = boundaryRead.value
  const inventory = inventoryRead
  // Counted set = SFR + PUBLIC_ACTIVE inside the recorded boundary. Same payload
  // as /neighborhoods and /cities/bend tiles (getBendNeighborhoodPublicInventory).
  // Do not fall back to pin length, pulse.active_count, or listing_tile_mv tags —
  // those are different populations (Awbrey Butte 52 / 62 / 63, 2026-08-16).
  // A measured empty (inventory present, 0 keys) must not revive pin-only homes.
  const inventoryOk = inventory != null
  const countedKeys = inventoryOk ? inventory.listingKeys : []
  const boundaryListingKeys = inventoryOk
    ? countedKeys
    : boundaryMapData.pins.map((p) => p.listingKey)
  const listingTiles =
    boundaryListingKeys.length > 0
      ? await withTimeoutFallback(
          getListingTiles({ listingKeys: boundaryListingKeys, status: 'active', propertyType: 'A', limit: 250 }),
          [],
          4500,
          'nbh:tiles',
        )
      : []

  // ── COUNTS + PRICES ────────────────────────────────────────────────────────
  // §0 UNKNOWN IS NOT ZERO. A timed-out inventory read is null, never 0, and
  // never a different query's number.
  const activeCount: number | null = inventory?.activeCount ?? null
  const medianListPrice =
    activeCount == null ? null : inventory?.medianListPrice ?? pulse?.medianListPrice ?? null
  const sellMedian = publishSellMedian({
    placeMedian: medianListPrice,
    grain: 'neighborhood',
    placeName: neighborhood.name,
  })
  const medianDays = pulse?.medianDaysToPending ?? stats?.medianDaysOnMarket ?? null
  const nbhCentroid = mapCentroid(listingTiles)
  const nbhLifestyle = lifestyleNearLatLng(nbhCentroid?.lat, nbhCentroid?.lng)

  // ── HERO ──────────────────────────────────────────────────────────────────
  // Curated communityImage by boundary slug (handles a neighborhood sharing its
  // name with a resort), then the DB hero, then the city photo with a labeled
  // regional fallback.
  const { src: heroPhoto, verified: heroVerified } = publishNeighborhoodHero({
    curated: communityImage(boundaryNeighborhoodSlug) ?? communityImage(neighborhoodSlug),
    dbUrl: neighborhood.heroImageUrl,
    cityFallbackSrc: cityHero(citySlug).src,
  })
  const mediaCaption = heroVerified ? undefined : 'Regional view · Cascade Range'

  const neighborhoodLabel = `${neighborhood.name} · ${cityName}`

  // ── RICH OVERVIEW (amenity → blog topic-cluster links) ────────────────────
  // Resolve the posts amenity rows reference so each amenity links to its post.
  const amenityBlogSlugs = (richContent?.amenities ?? [])
    .map((a) => a.blog_slug)
    .filter((s): s is string => Boolean(s))
  const amenityPosts =
    amenityBlogSlugs.length > 0
      ? await skippableRail(() => getBlogPostsBySlugs(amenityBlogSlugs), {}, 2500, 'nbh:amenityPosts')
      : {}

  const aboutParagraphs: string[] = [neighborhood.description ?? ''].filter(
    (p): p is string => Boolean(p && p.trim().length > 0),
  )
  const leftover = publicPace
  const leftoverMedianClose = leftover.medianClose != null ? kbMoneyFull(leftover.medianClose) : null
  const leftoverSaleToList =
    leftover.saleToOriginal != null
      ? leftover.saleToOriginal < 2
        ? leftover.saleToOriginal * 100
        : leftover.saleToOriginal
      : null
  const daysFact = publishDaysLabel(medianDays)
  const aboutFacts: { label: string; value: string }[] = [
    // Omitted, never "0", when the count is unknown (§0).
    ...(activeCount != null ? [{ label: 'Active single-family', value: activeCount.toLocaleString('en-US') }] : []),
    ...(medianListPrice != null ? [{ label: 'Median list', value: formatPriceExact(medianListPrice) }] : []),
    ...(daysFact
      ? [{ label: pulse?.medianDaysToPending != null ? 'Median to pending' : 'Median days on market', value: daysFact }]
      : []),
    ...(leftoverMedianClose ? [{ label: 'Median close, 12 months', value: leftoverMedianClose }] : []),
    { label: 'City', value: cityName },
  ]

  // ── FEATURED + MAP + TICKER ───────────────────────────────────────────────
  const featuredTileInput = listingTiles
    .sort((a, b) => (b.listPrice ?? 0) - (a.listPrice ?? 0))
    .slice(0, 14)
    .map((t) => ({
      listingKey: t.listingKey ?? '', listNumber: t.listNumber ?? null, listPrice: t.listPrice,
      beds: t.beds, baths: t.baths, sqft: t.sqft ?? null, status: t.status ?? null,
      streetNumber: t.streetNumber, streetName: t.streetName, city: t.city, postalCode: t.postalCode,
      subdivisionName: t.subdivisionName, lat: t.lat, lng: t.lng, photoUrl: t.photoUrl,
    }))
    .filter((t) => t.listingKey)
  const featuredItems = await resolveFeaturedItems(featuredTileInput as unknown as Parameters<typeof resolveFeaturedItems>[0])

  const mapFeatures = buildMapPointFeatures(listingTiles)
  const mapGeo: KbMapGeo = { type: 'FeatureCollection', features: mapFeatures }

  // Boundary polygon for the map (reliable when present).
  const mapPolygons = boundaryMapData.polygon
    ? {
        type: 'FeatureCollection' as const,
        features: [
          {
            type: 'Feature' as const,
            geometry: boundaryMapData.polygon as unknown,
            properties: { name: neighborhood.name },
          },
        ],
      }
    : undefined

  const tickerItems = buildTickerItems(listingTiles, cityName)

  // ── SUBDIVISIONS ── each card → /subdivisions/{slugify(name)} ─────────────
  const subdivisionItems: KbTownItem[] = neighborhoodCommunities
    .slice(0, 12)
    .map((c) => ({
      name: c.subdivision,
      href: `/subdivisions/${slugify(c.subdivision)}`,
      activeCount: c.activeCount ?? 0,
      medianPrice: c.medianPrice ?? null,
      img: c.heroImageUrl ?? communityImage(c.slug) ?? '',
    }))

  // ── EXPLORE OTHER CITIES ──────────────────────────────────────────────────
  // No excludeSlug: a neighborhood page links its own parent city on purpose.
  const otherCityItems: KbTownItem[] = buildOtherCityItems(allCitySnapshots)

  // Prefer in-boundary open houses / activity when membership keys exist.
  // Fall back to city-wide with an honest city eyebrow (§0).
  const boundaryKeySet = new Set(boundaryListingKeys)
  const ohScoped = openHouses.filter((oh) => boundaryKeySet.has(oh.listing_key))
  const useOhScoped = ohScoped.length > 0
  const activityScoped = activity.filter((a) => boundaryKeySet.has(a.listing_key))
  const useActScoped = activityScoped.length > 0

  // ── LIVE ACTIVITY ──────────────────────────────────────────────────────────
  const activityItems = buildActivityItems(useActScoped ? activityScoped : activity)

  // ── OPEN HOUSES ────────────────────────────────────────────────────────────
  const openHouseItems = buildOpenHouseItems(useOhScoped ? ohScoped : openHouses)
  const openHouseEyebrow = useOhScoped
    ? `${neighborhood.name} · This week`
    : `${cityName} · This week`
  const activityEyebrow = useActScoped
    ? `Live · ${neighborhood.name}`
    : `Live · ${cityName}`

  // ── GUIDES / BLOG ──────────────────────────────────────────────────────────
  const articlePosts = buildArticlePosts(blogPosts)

  // ── MARKET HUD ─────────────────────────────────────────────────────────────
  // City-fallback for a too-sparse neighborhood series — see the header block.
  // chartScopeLabel keeps the city figure from reading as this one's (§0).
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

  const hudActive = pulse?.activeCount ?? activeCount ?? null
  const monthsOfSupply = publishMonthsOfSupply({
    grain: 'neighborhood',
    source: 'market-truth',
    pulseMos: pulse?.monthsOfSupply,
    pulseActiveCount: pulse?.activeCount,
    displayedActiveCount: hudActive,
  })
  const marketData: KbMarketData = {
    active: hudActive,
    closed30: publishSoldCount({ value: pulse?.closedLast30Days, grain: 'neighborhood' }),
    new30: null,
    medianList: pulse?.medianListPrice ?? medianListPrice,
    saleToList: leftoverSaleToList,
    daysToPending: pulse?.medianDaysToPending ?? null,
    monthsSupply: monthsOfSupply,
    trend: buildMonthlyTrend(chartPriceHist),
    byTown: [],
    countyMedian: regionPulse?.medianListPrice ?? null,
    yearSeries: buildYearSeries(chartPriceHist, 5),
    chartLeftover: chartMonths.leftoverUsed,
  }

  // ── PAGE CONTRACT: AI-citable verified Q&A + structured data ───────────────
  const marketFaqInput: MarketFaqInput = {
    ...(pulse ?? {}), grain: 'neighborhood',
    source: 'market-truth',
    activeCount: hudActive,
    pulseActiveCount: pulse?.activeCount,
    medianListPrice: medianListPrice ?? pulse?.medianListPrice ?? null,
    monthsOfSupply,
    soldCount12mo: publicPace.closedCount ?? null,
  }
  const { faqs, datasetVariables, asOfIso, asOfLabel } = buildMarketFaq(neighborhood.name, marketFaqInput)

  // Geo centroid for Place schema: average of in-boundary listing coords.
  const withCoords = boundaryMapData.pins.filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng),
  )
  const geo =
    withCoords.length > 0
      ? {
          lat: withCoords.reduce((a, p) => a + p.lat, 0) / withCoords.length,
          lng: withCoords.reduce((a, p) => a + p.lng, 0) / withCoords.length,
        }
      : undefined

  const hasMap = mapFeatures.length > 0 || Boolean(mapPolygons)

  // JSON-LD (breadcrumb + Neighborhood Place + Dataset) — extracted verbatim
  // to ./neighborhood-schemas.ts for the ci:file-size-budget floor.
  const neighborhoodSchemas: SchemaInput[] = buildNeighborhoodSchemas({
    neighborhoodName: neighborhood.name,
    neighborhoodSlug,
    cityName,
    citySlug,
    hasMap,
    geo,
    datasetVariables,
    asOfIso,
    asOfLabel,
  })

  return (
    <main className="kb-root">
      <KbSectionTracker />
      <MetadataBlock schemas={neighborhoodSchemas} />
      <KbBreadcrumb
        overlay
        trail={[
          { label: 'Home', href: '/' },
          { label: cityName, href: `/cities/${citySlug}` },
          { label: neighborhood.name },
        ]}
      />
      <SmoothScrollProvider>
        <KbHero
          data={{
            activeCount,
            medianListPrice,
            medianDaysToPending: pulse?.medianDaysToPending ?? null,
          }}
          eyebrow={neighborhoodLabel}
          titleTop={neighborhood.name}
          titleBottom="Homes for Sale"
          lead={placeHeroLead({
            placeName: neighborhood.name,
            parentName: cityName,
            activeCount,
          })}
          videoSrc={null}
          posterSrc={heroPhoto}
          posterAlt={`${neighborhood.name} in ${cityName}, Oregon`}
          mediaCaption={mediaCaption}
          cta={{
            href: subdivisionListingsPath(cityName, neighborhood.name),
            label: `See ${neighborhood.name} homes`,
          }}
          ctaSecondary={{ href: '/sell/valuation', label: 'Value my home' }}
        />
        {/* Dual-pane when we have pins; else featured grid (no map of zero). */}
        {hasMap && listingTiles.length > 0 ? (
          <PlaceMapListSplit
            rows={splitRowsFromTiles(listingTiles)}
            mapGeo={mapGeo}
            polygons={mapPolygons}
            eyebrow={`${neighborhood.name} · For sale`}
            title={`Homes in ${neighborhood.name}`}
            subtitle={`Every active single-family listing in ${neighborhood.name}. Zoom the map for photo stamps.`}
            totalActive={inventoryOk ? (activeCount ?? 0) : listingTiles.length}
            viewAllHref={subdivisionListingsPath(cityName, neighborhood.name)}
            viewAllLabel={`See every ${neighborhood.name} home for sale`}
          />
        ) : (
          <KbFeatured
            items={featuredItems}
            eyebrow={`${neighborhood.name} · For sale`}
            viewAllHref={subdivisionListingsPath(cityName, neighborhood.name)}
            viewAllLabel={`See every ${neighborhood.name} home for sale`}
            viewAllPlace={neighborhood.name}
            totalCount={activeCount || null}
          />
        )}
        <KbTicker items={tickerItems} />
        {/* Mid-page buyer capture (E3 light): after map inventory. City-scoped
            listing_alerts only — neighborhood keys are not always 1:1 with MLS
            tags (§0), so no invented subdivision filter. */}
        <KbCommunityAlerts
          communityName={cityName}
          city={cityName}
          subdivision=""
          extraFilters={{ propertyType: 'A' }}
          headline={cityName}
          body={`Enter your email. When a single-family home hits the market in ${cityName}${neighborhood.name ? ` (including ${neighborhood.name})` : ''}, you hear first.`}
        />
        {/* Rich, verified depth. Null when no config, so it degrades to nothing.
            When present it carries the overview, so About is suppressed. */}
        <KbResortOverview content={richContent} name={neighborhood.name} postsBySlug={amenityPosts} />
        {richContent === null && aboutParagraphs.length > 0 ? (
          <KbAbout
            eyebrow={neighborhoodLabel}
            heading={`${neighborhood.name}, in plain words`}
            paragraphs={aboutParagraphs}
            facts={aboutFacts}
          />
        ) : null}
        <KbMarketHud
          data={marketData}
          eyebrow={`${neighborhood.name} · The market`} geoName={neighborhood.name} asOf={pulse?.refreshedAt ?? null}
          chartScopeLabel={chartIsCityLevel && cityName ? `${cityName} (city)` : undefined}
        >
          <PublicProductTypes cityName={neighborhood.name} citySlug={citySlug} rows={publicSegments} />
          <PublicPaceStats cityName={neighborhood.name} row={publicPace} />
          <PublicMixStats cityName={neighborhood.name} row={publicMix} />
          {/* The approved chart-room forms (Unit NEIGHBORHOOD 2026-08-19) —
              same market section, additive under the HUD figures. Closed-side
              cards read the district polygon assignment; the asking-price card
              reads the same inventory row this page's own figures come from.
              Neighborhood pulse and stats-cache closed figures are not charted
              (both under-count closings at this grain — see the data module). */}
          <NeighborhoodMarketCharts
            geoSlug={boundaryNeighborhoodSlug}
            districtName={neighborhood.name}
          />
        </KbMarketHud>
        {subdivisionItems.length > 0 ? (
          <KbExploreTowns
            towns={subdivisionItems}
            eyebrow={`${neighborhood.name} · Subdivisions`}
            title="Subdivisions"
            sectionId="subdivisions"
            cta={{ href: `/homes-for-sale/${citySlug}`, label: `All ${cityName} homes` }}
          />
        ) : null}
        {peerNeighborhoods.length > 0 ? (
          <KbExploreTowns
            towns={peerNeighborhoods}
            eyebrow={`${cityName} · Other neighborhoods`}
            title="Explore nearby neighborhoods"
            sectionId="peer-neighborhoods"
            cta={{ href: `/cities/${citySlug}`, label: `All of ${cityName}` }}
          />
        ) : null}
        <LifestyleNearSection
          lat={nbhCentroid?.lat}
          lng={nbhCentroid?.lng}
          items={nbhLifestyle}
          eyebrow={`${neighborhood.name} · Lifestyle`}
          title="Parks, trails, golf, and events nearby"
        />
        <KbAreaGuideVideo videoUrl={areaGuideVideo?.url ?? null} wide={areaGuideVideo?.wide} locationName={neighborhood.name} posterSrc={heroPhoto} />
        {/* Open houses + the feed are fetched city-wide (the MLS carries no
            neighborhood scope on either), so they are labeled with the city (§0). */}
        {buildTimeRails(true) || openHouseItems.length > 0 ? (
          <KbOpenHouses
            items={openHouseItems}
            eyebrow={openHouseEyebrow}
            heading="Open houses"
            viewAllHref={`/open-houses/${citySlug}`}
          />
        ) : null}
        <KbActivity
          items={activityItems}
          eyebrow={activityEyebrow}
          heading="Latest market activity"
          viewAllHref="/housing-market"
          viewAllLabel="Full market pulse"
        />
        {/* Convert before trust, and BOTH before the exit links. */}
        <KbSell
          data={{
            medianListPrice: sellMedian?.value ?? null,
            medianCaption: sellMedian?.caption ?? null,
            medianDaysToPending: pulse?.medianDaysToPending ?? null,
            soldCount30d: publishSoldCount({ value: pulse?.closedLast30Days, grain: 'neighborhood' }),
          }}
          eyebrow={`Sell in ${neighborhood.name}`}
        />
        <KbArticles
          posts={articlePosts}
          eyebrow="Guides and news"
          heading={`${neighborhood.name} guides`}
          subtitle={`Housing news, market data, and buyer and seller notes for ${neighborhood.name} and ${cityName}.`}
        />
        <KbTestimonials reviews={TESTIMONIALS.slice(0, 8)} />
        <KbTeam />
        {/* Last block before the FAQ: every link here routes the reader OFF this
            page, so it sits after the ask, never before it. */}
        <KbExploreTowns
          towns={otherCityItems}
          eyebrow="Central Oregon"
          title="Other cities on the list"
          sectionId="nearby"
          cta={{ href: '/cities', label: 'Every city' }}
        />
        {faqs.length > 0 ? (
          <section id="faq" aria-label={`${neighborhood.name} real estate questions`}>
            <FAQBlock items={faqs} eyebrow="Common questions" title={`Questions about ${neighborhood.name}`} />
          </section>
        ) : null}
        <MarketSources sources={['ods']} />
        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
