/**
 * Neighborhood detail page — KB (kinetic-brutalist) design, Phase 9 wave 3 of
 * the convergence program (docs/KB_CONVERGENCE_ROADMAP.md). Mirrors the
 * community page section order (components/site/kb/*), fed NEIGHBORHOOD-scoped
 * DAL data, never forked (ci:kb-single-source G50). KbNav + KbFooter carry
 * chrome.
 *
 * THE PAGE CONTRACT (docs/KB_CONVERGENCE_ROADMAP.md): KB design + SEO for
 * Google & LLMs (pageMetadata + MetadataBlock JSON-LD: Breadcrumb/Neighborhood
 * Place/Dataset/FAQPage) + tracking (KbSectionTracker section/interaction
 * events). Every figure live (§0).
 *
 * City-fallback for the market chart: if the neighborhood's own monthly price
 * series is too sparse (<8 non-null monthly points OR <2 calendar years), we
 * fall back to the parent city's getPriceHistory('city', citySlug, 'monthly',
 * 60) for yearSeries/trend. chartScopeLabel is set to "{City} (city)" in that
 * case so the city figure is never read as the neighborhood's.
 *
 * Section stack: breadcrumb · hero · about · market · featured · ticker · map ·
 * communities (subdivisions in neighborhood) · activity · guides(blog) ·
 * testimonials · team · sell · FAQ · footer.
 *
 * Data ONLY through @/lib/data and @/app/actions/cities. No raw .from() calls.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getNeighborhoodBySlug, getCommunitiesInNeighborhood } from '@/app/actions/cities'
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
} from '@/lib/data'
import { getResortCommunityContent } from '@/lib/resort-community-content'
import { getMarketStatsCacheRowForGeo } from '@/lib/data/market/getMarketStatsCacheRows'
import { getOpenHousesWithListings } from '@/app/actions/open-houses'
import { getActivityFeedWithFallbackMulti } from '@/app/actions/activity-feed'
import { communityImage, cityHero } from '@/lib/geo-images'
import { resolveFeaturedItems } from '@/lib/kb/resolve-featured-items'
import { buildYearSeries } from '@/lib/kb/year-series'
import { slugify, listingTileHref } from '@/lib/slug'
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
import { KbActivity } from '@/components/site/kb/KbActivity.client'
import { KbArticles } from '@/components/site/kb/KbArticles'
import { KbTestimonials } from '@/components/site/kb/KbTestimonials.client'
import { KbTeam } from '@/components/site/kb/KbTeam.client'
import { KbSell } from '@/components/site/kb/KbSell.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { FAQBlock } from '@/components/site/FAQBlock'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import type {
  KbTownItem,
  KbTickerItem,
  KbMarketData,
} from '@/components/site/kb/types'
import { TESTIMONIALS } from '@/lib/testimonials'
import '@/components/site/kb/kb.css'

export async function generateStaticParams(): Promise<Array<{ slug: string; neighborhoodSlug: string }>> {
  return []
}
export const dynamicParams = true
export const revalidate = 60

type Props = { params: Promise<{ slug: string; neighborhoodSlug: string }> }

const CENTRAL_OREGON_CITY_SLUGS = new Set([
  'bend', 'redmond', 'sisters', 'la-pine', 'sunriver', 'madras',
  'prineville', 'culver', 'terrebonne', 'tumalo', 'powell-butte',
])

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
  const { slug: citySlug, neighborhoodSlug } = await params
  const neighborhood = await getNeighborhoodBySlug(citySlug, neighborhoodSlug)
  if (!neighborhood) notFound()

  const title =
    neighborhood.seoTitle?.trim() ||
    `Homes for Sale in ${neighborhood.name} | ${neighborhood.cityName}, Oregon`

  const description =
    neighborhood.seoDescription ||
    (neighborhood.activeCount > 0
      ? `${neighborhood.activeCount} homes for sale in ${neighborhood.name}, ${neighborhood.cityName}. Median list price ${neighborhood.medianPrice != null ? fmtK(neighborhood.medianPrice) ?? '' : 'available on request'}. Local market data from Ryan Realty.`
      : `Explore ${neighborhood.name} in ${neighborhood.cityName}, Oregon. Live market data and listings from a local brokerage.`)

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
  const cityGeoSlug = citySlug.replace(/-/g, ' ')

  // Boundary polygon slug for neighborhoods: "{citySlug}-{neighborhoodSlug}"
  const boundaryNeighborhoodSlug = `${citySlug}-${neighborhoodSlug}`

  const [
    pulse, stats, mktStats, regionPulse, priceHist,
    boundaryMapData, allCitySnapshots, blogPosts, openHouses, activity,
    cityPriceHist, neighborhoodCommunities, richContent,
  ] = await Promise.all([
    withTimeoutFallback(getMarketPulse({ geoType: 'neighborhood', geoSlug: boundaryNeighborhoodSlug }), null, 3500, 'nbh:pulse'),
    withTimeoutFallback(getMarketStats({ geoType: 'neighborhood', geoSlug: boundaryNeighborhoodSlug, periodType: 'rolling_365d' }), null, 3500, 'nbh:stats'),
    withTimeoutFallback(getMarketStatsCacheRowForGeo({ geoSlug: boundaryNeighborhoodSlug }), null, 3000, 'nbh:mktStats'),
    withTimeoutFallback(getRegionPulse(), null, 3000, 'nbh:regionPulse'),
    withTimeoutFallback(getPriceHistory('neighborhood', boundaryNeighborhoodSlug, 'monthly', 60), [], 4500, 'nbh:priceHistory'),
    withTimeoutFallback(getGeoBoundaryMapData({ geoType: 'neighborhood', geoSlug: boundaryNeighborhoodSlug }), { polygon: null, pins: [] }, 4500, 'nbh:boundary'),
    withTimeoutFallback(getAllCitySnapshots(), [], 3000, 'nbh:cities'),
    withTimeoutFallback(getRecentBlogPosts({ cityName, limit: 3 }), [], 3000, 'nbh:blog'),
    withTimeoutFallback(getOpenHousesWithListings({ city: cityName }), [], 3500, 'nbh:openHouses'),
    withTimeoutFallback(getActivityFeedWithFallbackMulti({ cities: [cityName], limit: 8 }), [], 3500, 'nbh:activity'),
    // Parent-city monthly price history — fallback when this neighborhood's own
    // series is too thin for a real multi-year trend (<8 non-null points OR <2
    // calendar years). Relabeled as city-level when used (§0). (§0)
    withTimeoutFallback(getPriceHistory('city', cityGeoSlug, 'monthly', 60), [], 4500, 'nbh:cityPriceHistory'),
    // Communities (subdivisions) within this neighborhood — drives the KbExploreTowns
    // ledger. The neighborhood's id is needed; resolved from NeighborhoodDetail.
    withTimeoutFallback(getCommunitiesInNeighborhood(neighborhood.id, cityName), [], 3500, 'nbh:communities'),
    // Rich, verified neighborhood depth (overview prose · drive times · amenities)
    // from data/resort-community-{citySlug}-{neighborhoodSlug}.json — the SAME
    // curated source the resort LPs render. Null until a config is authored;
    // KbResortOverview degrades to render nothing. Keyed by the boundary slug to
    // match the polygon/pin namespace. Restores the pre-KB CommunityRichContent
    // depth in the KB register (the KbResortOverview rebuild of it).
    withTimeoutFallback(getResortCommunityContent(boundaryNeighborhoodSlug), null, 2500, 'nbh:content'),
  ])

  // In-boundary listing tiles (lat/lng/photo for map + featured + ticker).
  const boundaryListingKeys = boundaryMapData.pins.map((p) => p.listingKey)
  const listingTiles =
    boundaryListingKeys.length > 0
      ? await withTimeoutFallback(
          getListingTiles({ listingKeys: boundaryListingKeys, status: 'active', limit: 250 }),
          [],
          4500,
          'nbh:tiles',
        )
      : []

  // ── COUNTS + PRICES ────────────────────────────────────────────────────────
  // Priority: pulse (neighborhood-scoped market_pulse_live) > boundary pins >
  // neighborhood object (computed from listing_tile_mv at cache time).
  const activeCount = pulse?.activeCount ?? boundaryMapData.pins.length > 0
    ? boundaryMapData.pins.length
    : neighborhood.activeCount
  const medianListPrice = pulse?.medianListPrice ?? neighborhood.medianPrice ?? null
  const medianDays = pulse?.medianDaysToPending ?? stats?.medianDaysOnMarket ?? null

  // ── HERO ──────────────────────────────────────────────────────────────────
  // Prefer a curated communityImage keyed by the boundary slug (handles
  // neighborhoods that share their name with a resort), then the neighborhood's
  // own hero image from the DB, then the parent city's verified hero photo with
  // a labeled regional fallback.
  const curatedHero = communityImage(boundaryNeighborhoodSlug) ?? communityImage(neighborhoodSlug)
  const heroPhoto = curatedHero ?? neighborhood.heroImageUrl ?? cityHero(citySlug).src
  const heroVerified = Boolean(curatedHero || neighborhood.heroImageUrl)
  const mediaCaption = heroVerified ? undefined : 'Regional view · Cascade Range'

  const neighborhoodLabel = `${neighborhood.name} · ${cityName}`

  // ── RICH OVERVIEW (amenity → blog topic-cluster links) ────────────────────
  // Resolve the published blog posts referenced by amenity rows so KbResortOverview
  // can link each amenity to its post (same topic-cluster SEO as the community page).
  const amenityBlogSlugs = (richContent?.amenities ?? [])
    .map((a) => a.blog_slug)
    .filter((s): s is string => Boolean(s))
  const amenityPosts =
    amenityBlogSlugs.length > 0
      ? await withTimeoutFallback(getBlogPostsBySlugs(amenityBlogSlugs), {}, 2500, 'nbh:amenityPosts')
      : {}

  // ── ABOUT ─────────────────────────────────────────────────────────────────
  const aboutParagraphs: string[] = [neighborhood.description ?? ''].filter(
    (p): p is string => Boolean(p && p.trim().length > 0),
  )
  const aboutFacts: { label: string; value: string }[] = [
    { label: 'Active single-family', value: (activeCount ?? 0).toLocaleString('en-US') },
    ...(medianListPrice != null ? [{ label: 'Median list', value: fmtK(medianListPrice) ?? '—' }] : []),
    ...(medianDays != null
      ? [{ label: pulse?.medianDaysToPending != null ? 'Median to pending' : 'Median days on market', value: `${Math.round(medianDays)} days` }]
      : []),
    ...(stats?.medianSalePrice != null ? [{ label: 'Median sold, 1 yr', value: fmtK(stats.medianSalePrice) ?? '—' }] : []),
    { label: 'City', value: cityName },
  ]

  // ── FEATURED + MAP + TICKER ───────────────────────────────────────────────
  const featuredTileInput = listingTiles
    .sort((a, b) => (b.listPrice ?? 0) - (a.listPrice ?? 0))
    .slice(0, 14)
    .map((t) => ({
      listingKey: t.listingKey ?? '',
      listNumber: t.listNumber ?? null,
      listPrice: t.listPrice,
      beds: t.beds,
      baths: t.baths,
      sqft: t.sqft ?? null,
      streetNumber: t.streetNumber,
      streetName: t.streetName,
      city: t.city,
      postalCode: t.postalCode,
      subdivisionName: t.subdivisionName,
      lat: t.lat,
      lng: t.lng,
      photoUrl: t.photoUrl,
      status: t.status ?? null,
    }))
    .filter((t) => t.listingKey)
  const featuredItems = await resolveFeaturedItems(featuredTileInput as unknown as Parameters<typeof resolveFeaturedItems>[0])

  const mapFeatures = listingTiles
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

  const tickerItems: KbTickerItem[] = listingTiles.slice(0, 6).map((t) => ({
    price: t.listPrice,
    address: [t.streetNumber, t.streetName].filter(Boolean).join(' '),
    town: t.city ?? cityName,
  }))

  // ── COMMUNITIES / SUBDIVISIONS WITHIN THIS NEIGHBORHOOD ───────────────────
  // Each subdivision card → /subdivisions/{slugify(name)} per the task spec.
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

  // ── LIVE ACTIVITY ──────────────────────────────────────────────────────────
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

  // ── MARKET HUD ─────────────────────────────────────────────────────────────
  // City-fallback: if neighborhood's own monthly price series is too sparse
  // (<8 non-null monthly points OR <2 calendar years), fall back to the parent
  // city's series and set chartScopeLabel so the city figure is never passed off
  // as the neighborhood's. (§0)
  const nbhPricePoints = priceHist.filter((p) => p.medianSalePrice != null)
  const nbhTrendYears = new Set(nbhPricePoints.map((p) => new Date(p.periodStart).getUTCFullYear()))
  const chartIsCityLevel = nbhPricePoints.length < 8 || nbhTrendYears.size < 2
  const chartPriceHist = chartIsCityLevel ? cityPriceHist : priceHist

  const sltRaw = mktStats?.avg_sale_to_list_ratio ?? null
  const marketData: KbMarketData = {
    active: activeCount ?? null,
    closed30: pulse?.closedLast30Days ?? null,
    new30: null,
    medianList: medianListPrice,
    saleToList: sltRaw != null ? (sltRaw < 2 ? sltRaw * 100 : sltRaw) : null,
    daysToPending: pulse?.medianDaysToPending ?? null,
    monthsSupply: pulse?.monthsOfSupply ?? null,
    trend: chartPriceHist
      .slice(-13)
      .filter((p) => p.medianSalePrice != null)
      .map((p) => ({ label: monthLabel(p.periodStart), value: p.medianSalePrice as number })),
    byTown: [],
    countyMedian: regionPulse?.medianListPrice ?? null,
    yearSeries: buildYearSeries(chartPriceHist, 5),
  }

  // ── PAGE CONTRACT: AI-citable verified Q&A + structured data ───────────────
  const marketFaqInput: MarketFaqInput = pulse ?? {
    activeCount: neighborhood.activeCount ?? null,
    medianListPrice: neighborhood.medianPrice ?? null,
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

  const neighborhoodSchemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Cities', url: '/cities' },
        { name: cityName, url: `/cities/${citySlug}` },
        { name: neighborhood.name, url: `/cities/${citySlug}/${neighborhoodSlug}` },
      ],
    },
    {
      type: 'place',
      placeType: 'Neighborhood',
      name: neighborhood.name,
      description: `Homes for sale and live single-family market data for ${neighborhood.name} in ${cityName}, Oregon.`,
      url: `/cities/${citySlug}/${neighborhoodSlug}`,
      address: { city: cityName, state: 'OR', country: 'US' },
      containedInPlace: cityName,
      geo,
      hasMap: hasMap ? `/cities/${citySlug}/${neighborhoodSlug}` : undefined,
      additionalProperty: datasetVariables.length > 0 ? datasetVariables : undefined,
    },
  ]
  if (datasetVariables.length > 0) {
    neighborhoodSchemas.push({
      type: 'dataset',
      name: `${neighborhood.name} real estate market statistics${asOfLabel ? `, ${asOfLabel}` : ''}`,
      description: `Live single-family home market data for ${neighborhood.name} in ${cityName}, Oregon. Includes median list price, active inventory, and market statistics. Sourced from the regional MLS via Ryan Realty.`,
      url: `/cities/${citySlug}/${neighborhoodSlug}`,
      dateModified: asOfIso ?? undefined,
      spatialCoverageName: `${neighborhood.name}, ${cityName}, OR`,
      variableMeasured: datasetVariables,
    })
  }

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="neighborhood" />
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
            activeCount: activeCount ?? null,
            medianListPrice,
            medianDaysToPending: pulse?.medianDaysToPending ?? null,
          }}
          eyebrow={neighborhoodLabel}
          titleTop="Homes in"
          titleBottom={neighborhood.name}
          lead={`in ${neighborhood.name}, ${cityName}, with the live market behind every one.`}
          videoSrc={null}
          posterSrc={heroPhoto}
          mediaCaption={mediaCaption}
        />
        {/* Rich, verified neighborhood depth (overview prose · drive times ·
            amenities) — the KB rebuild of the pre-KB CommunityRichContent. Null
            when no config, so it degrades to nothing. When present it carries the
            overview, so the thin data-driven About below is suppressed to avoid
            duplicating the same prose. */}
        <KbResortOverview content={richContent} name={neighborhood.name} postsBySlug={amenityPosts} />
        {!richContent && aboutParagraphs.length > 0 ? (
          <KbAbout
            eyebrow={neighborhoodLabel}
            heading={`Living in ${neighborhood.name}`}
            paragraphs={aboutParagraphs}
            facts={aboutFacts}
          />
        ) : null}
        {/* Flow: market credibility → featured homes → live ticker → map →
            subdivisions ledger → activity → guides → explore other cities */}
        <KbMarketHud
          data={marketData}
          eyebrow={`${neighborhood.name} · The market`}
          chartScopeLabel={chartIsCityLevel && cityName ? `${cityName} (city)` : undefined}
        />
        <KbFeatured items={featuredItems} eyebrow={`${neighborhood.name} · For sale`} />
        <KbTicker items={tickerItems} />
        <KbListingMap
          geojson={mapGeo}
          totalActive={activeCount || mapFeatures.length}
          fitToFeatures
          showRegionMarkers={false}
          polygons={mapPolygons}
          eyebrow={neighborhood.name}
          title={`Homes in\n${neighborhood.name}`}
          subtitle={`Every active single-family listing in ${neighborhood.name}, on the real terrain. Click any dot for the price, the beds, and the street.`}
        />
        {subdivisionItems.length > 0 ? (
          <KbExploreTowns
            towns={subdivisionItems}
            eyebrow={`${neighborhood.name} · Subdivisions`}
            title="Subdivisions"
            sectionId="subdivisions"
            cta={{ href: `/homes-for-sale/${citySlug}`, label: `All ${cityName} homes` }}
          />
        ) : null}
        <KbActivity
          items={activityItems}
          eyebrow={`Live · ${neighborhood.name}`}
          heading="Latest market activity"
          viewAllHref="/housing-market"
          viewAllLabel="Full market pulse"
        />
        <KbArticles
          posts={articlePosts}
          eyebrow="Guides and insights"
          heading={`${neighborhood.name} real estate, explained`}
          subtitle={`Local housing news, market data, and buyer and seller guides for ${neighborhood.name} and ${cityName}.`}
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
            medianListPrice,
            medianDaysToPending: pulse?.medianDaysToPending ?? null,
            soldCount30d: pulse?.closedLast30Days ?? null,
          }}
        />
        {faqs.length > 0 ? (
          <section id="faq" aria-label={`${neighborhood.name} real estate questions`}>
            <FAQBlock items={faqs} eyebrow="Common questions" title={`${neighborhood.name} real estate questions`} />
          </section>
        ) : null}
        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
