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
 * City-fallback for the market chart: when the neighborhood's own monthly series
 * is too sparse (<8 non-null points OR <2 calendar years) it falls back to the
 * parent city's getPriceHistory('city', citySlug, 'monthly', 60), relabeled via
 * chartScopeLabel "{City} (city)" so the city figure never reads as this one's.
 *
 * Section stack (city-page funnel parity): breadcrumb · hero · featured · ticker ·
 * map · overview/about · market · subdivisions · area guide · open houses ·
 * activity · SELL · guides · testimonials · team · other cities · FAQ · footer.
 * Inventory leads and the seller CTA precedes the exit links, so a home is never
 * buried under prose (design-audit P1, shipped on the city page 2026-07-28).
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
  getAreaGuideVideo,
} from '@/lib/data'
import { getResortCommunityContent } from '@/lib/resort-community-content'
import { getMarketStatsCacheRowForGeo } from '@/lib/data/market/getMarketStatsCacheRows'
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
import { slugify, subdivisionListingsPath } from '@/lib/slug'
import { pageMetadata } from '@/lib/site/page-metadata'
import { withTimeoutFallback, withTimeoutFallbackResult } from '@/lib/with-timeout-fallback'
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
import { KbOpenHouses } from '@/components/site/kb/KbOpenHouses.client'
import { KbArticles } from '@/components/site/kb/KbArticles'
import { KbTestimonials } from '@/components/site/kb/KbTestimonials.client'
import { KbTeam } from '@/components/site/kb/KbTeam.client'
import { KbSell } from '@/components/site/kb/KbSell.client'
import { KbAreaGuideVideo } from '@/components/site/kb/KbAreaGuideVideo'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { MarketSources } from '@/components/site/MarketSources'
import { FAQBlock } from '@/components/site/FAQBlock'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import { kbMoneyFull } from '@/components/site/kb/types'
import type { KbTownItem, KbMarketData } from '@/components/site/kb/types'
import { TESTIMONIALS } from '@/lib/testimonials'
import '@/components/site/kb/kb.css'

export async function generateStaticParams(): Promise<Array<{ slug: string; neighborhoodSlug: string }>> {
  return []
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
    `Homes for Sale in ${neighborhood.name} | ${neighborhood.cityName}, Oregon`

  const generatedDescription =
    neighborhood.activeCount > 0
      ? `${neighborhood.activeCount} homes for sale in ${neighborhood.name}, ${neighborhood.cityName}. Median list price ${neighborhood.medianPrice != null ? fmtK(neighborhood.medianPrice) ?? '' : 'available on request'}. Local market data from Ryan Realty.`
      : `Homes for sale in ${neighborhood.name}, ${neighborhood.cityName}, Oregon, with live market data.`
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
  const cityGeoSlug = citySlug.replace(/-/g, ' ')

  // Boundary polygon slug for neighborhoods: "{citySlug}-{neighborhoodSlug}"
  const boundaryNeighborhoodSlug = `${citySlug}-${neighborhoodSlug}`

  const [
    pulse, stats, mktStats, regionPulse, priceHist,
    boundaryRead, allCitySnapshots, blogPosts, openHouses, activity,
    cityPriceHist, neighborhoodCommunities, richContent, areaGuideVideo,
  ] = await Promise.all([
    withTimeoutFallback(getMarketPulse({ geoType: 'neighborhood', geoSlug: boundaryNeighborhoodSlug }), null, 3500, 'nbh:pulse'),
    withTimeoutFallback(getMarketStats({ geoType: 'neighborhood', geoSlug: boundaryNeighborhoodSlug, periodType: 'rolling_365d' }), null, 3500, 'nbh:stats'),
    withTimeoutFallback(getMarketStatsCacheRowForGeo({ geoType: 'neighborhood', geoSlug: boundaryNeighborhoodSlug }), null, 3000, 'nbh:mktStats'),
    withTimeoutFallback(getRegionPulse(), null, 3000, 'nbh:regionPulse'),
    withTimeoutFallback(getPriceHistory('neighborhood', boundaryNeighborhoodSlug, 'monthly', 60), [], 4500, 'nbh:priceHistory'),
    // Result variant: a timed-out boundary yields `{ pins: [] }`, which is
    // indistinguishable from a genuinely empty neighborhood. `.ok` keeps them
    // apart so a degraded read can never publish a count (§0).
    withTimeoutFallbackResult(getGeoBoundaryMapData({ geoType: 'neighborhood', geoSlug: boundaryNeighborhoodSlug }), { polygon: null, pins: [] }, 4500, 'nbh:boundary'),
    withTimeoutFallback(getAllCitySnapshots(), [], 3000, 'nbh:cities'),
    withTimeoutFallback(getRecentBlogPosts({ cityName, limit: 3 }), [], 3000, 'nbh:blog'),
    withTimeoutFallback(getOpenHousesWithListings({ city: cityName }), [], 3500, 'nbh:openHouses'),
    withTimeoutFallback(getActivityFeedWithFallbackMulti({ cities: [cityName], limit: 8 }), [], 3500, 'nbh:activity'),
    // Parent-city monthly price history — fallback when this neighborhood's own
    // series is too thin for a real multi-year trend (<8 non-null points OR <2
    // calendar years). Relabeled as city-level when used (§0). (§0)
    withTimeoutFallback(getPriceHistory('city', cityGeoSlug, 'monthly', 60), [], 4500, 'nbh:cityPriceHistory'),
    // Subdivisions within this neighborhood — drives the KbExploreTowns ledger.
    withTimeoutFallback(getCommunitiesInNeighborhood(neighborhood.id, cityName), [], 3500, 'nbh:communities'),
    // Rich, verified neighborhood depth from
    // data/resort-community-{citySlug}-{neighborhoodSlug}.json — the same curated
    // source the resort LPs render, keyed by the boundary slug. Null until
    // authored, and KbResortOverview then renders nothing.
    withTimeoutFallback(getResortCommunityContent(boundaryNeighborhoodSlug), null, 2500, 'nbh:content'),
    // Per-neighborhood area-guide video, tagged by the neighborhood/community
    // slug (EXACT geo match). Null → KbAreaGuideVideo renders nothing.
    withTimeoutFallback(getAreaGuideVideo(neighborhoodSlug), null, 3000, 'area-guide-video'),
  ])

  const boundaryMapData = boundaryRead.value
  // In-boundary listing tiles (lat/lng/photo for map + featured + ticker).
  const boundaryListingKeys = boundaryMapData.pins.map((p) => p.listingKey)
  const listingTiles =
    boundaryListingKeys.length > 0
      ? await withTimeoutFallback(
          // §0: the map subtitle claims "every active SINGLE-FAMILY listing". The
          // listings_in_boundary RPC filters only StandardStatus='Active', so the
          // property-type narrowing has to happen here or the claim is false.
          getListingTiles({ listingKeys: boundaryListingKeys, status: 'active', propertyType: 'A', limit: 250 }),
          [],
          4500,
          'nbh:tiles',
        )
      : []

  // ── COUNTS + PRICES ────────────────────────────────────────────────────────
  // §0 UNKNOWN IS NOT ZERO. This used to read `pulse?.activeCount ?? pins.length
  // > 0 ? pins.length : neighborhood.activeCount`, which binds as `(pulse?.
  // activeCount ?? (pins.length > 0)) ? pins.length : …` because `??` is
  // lower-precedence than `>`. The pulse count never guarded anything and the
  // answer was ALWAYS `pins.length`, so a boundary read that timed out returned
  // the `{ pins: [] }` fallback and the hero published "0 homes for sale" beside
  // a real median list price. Pins are the in-polygon truth, but only when the
  // read SUCCEEDED, a polygon exists, and the count is under the RPC row cap (at
  // the cap the true total is higher). Otherwise pulse, then the listing_tile_mv
  // row, then null — consumers suppress the figure rather than print a zero.
  const BOUNDARY_PIN_CAP = 200 // p_limit in getGeoBoundaryMapData's fetchPins
  const inBoundaryCount =
    boundaryRead.ok && boundaryMapData.polygon != null && boundaryMapData.pins.length < BOUNDARY_PIN_CAP
      ? boundaryMapData.pins.length
      : null
  const activeCount: number | null =
    inBoundaryCount ?? pulse?.activeCount ?? neighborhood.activeCount ?? null
  // A count we could not measure has no asking price to pair with it.
  const medianListPrice =
    activeCount == null ? null : pulse?.medianListPrice ?? neighborhood.medianPrice ?? null
  const medianDays = pulse?.medianDaysToPending ?? stats?.medianDaysOnMarket ?? null

  // ── HERO ──────────────────────────────────────────────────────────────────
  // Curated communityImage by boundary slug (handles a neighborhood sharing its
  // name with a resort), then the DB hero, then the city photo with a labeled
  // regional fallback.
  const curatedHero = communityImage(boundaryNeighborhoodSlug) ?? communityImage(neighborhoodSlug)
  const heroPhoto = curatedHero ?? neighborhood.heroImageUrl ?? cityHero(citySlug).src
  const heroVerified = Boolean(curatedHero || neighborhood.heroImageUrl)
  const mediaCaption = heroVerified ? undefined : 'Regional view · Cascade Range'

  const neighborhoodLabel = `${neighborhood.name} · ${cityName}`

  // ── RICH OVERVIEW (amenity → blog topic-cluster links) ────────────────────
  // Resolve the posts amenity rows reference so each amenity links to its post.
  const amenityBlogSlugs = (richContent?.amenities ?? [])
    .map((a) => a.blog_slug)
    .filter((s): s is string => Boolean(s))
  const amenityPosts =
    amenityBlogSlugs.length > 0
      ? await withTimeoutFallback(getBlogPostsBySlugs(amenityBlogSlugs), {}, 2500, 'nbh:amenityPosts')
      : {}

  const aboutParagraphs: string[] = [neighborhood.description ?? ''].filter(
    (p): p is string => Boolean(p && p.trim().length > 0),
  )
  const aboutFacts: { label: string; value: string }[] = [
    // Omitted, never "0", when the count is unknown (§0).
    ...(activeCount != null ? [{ label: 'Active single-family', value: activeCount.toLocaleString('en-US') }] : []),
    ...(medianListPrice != null ? [{ label: 'Median list', value: kbMoneyFull(medianListPrice) ?? '—' }] : []),
    ...(medianDays != null
      ? [{ label: pulse?.medianDaysToPending != null ? 'Median to pending' : 'Median days on market', value: `${Math.round(medianDays)} days` }]
      : []),
    ...(stats?.medianSalePrice != null ? [{ label: 'Median sold, 1 yr', value: kbMoneyFull(stats.medianSalePrice) ?? '—' }] : []),
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

  // ── LIVE ACTIVITY ──────────────────────────────────────────────────────────
  // No stale-"New" relabel here — every event keeps the label the feed reports.
  const activityItems = buildActivityItems(activity)

  // ── OPEN HOUSES ────────────────────────────────────────────────────────────
  // Fetched city-wide (the MLS has no neighborhood scope on open-house rows), so
  // the section is labeled with the CITY, never the neighborhood (§0).
  const openHouseItems = buildOpenHouseItems(openHouses)

  // ── GUIDES / BLOG ──────────────────────────────────────────────────────────
  const articlePosts = buildArticlePosts(blogPosts)

  // ── MARKET HUD ─────────────────────────────────────────────────────────────
  // City-fallback for a too-sparse neighborhood series — see the header block.
  // chartScopeLabel keeps the city figure from reading as this one's (§0).
  const chartIsCityLevel = isTrendSeriesTooSparse(priceHist)
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
    trend: buildMonthlyTrend(chartPriceHist),
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
            activeCount,
            medianListPrice,
            medianDaysToPending: pulse?.medianDaysToPending ?? null,
          }}
          eyebrow={neighborhoodLabel}
          titleTop={neighborhood.name}
          titleBottom="Homes for Sale"
          lead={`in ${neighborhood.name}, ${cityName}.`}
          videoSrc={null}
          posterSrc={heroPhoto}
          mediaCaption={mediaCaption}
        />
        {/* Inventory first: the page is titled "{Neighborhood} homes for sale",
            so a buyer never scrolls prose to reach a home (design-audit P1). The
            grid caps at 12 tiles; the footer link reaches the rest. */}
        <KbFeatured
          items={featuredItems}
          eyebrow={`${neighborhood.name} · For sale`}
          viewAllHref={subdivisionListingsPath(cityName, neighborhood.name)}
          viewAllLabel={`See every ${neighborhood.name} home for sale`}
          totalCount={activeCount || null}
        />
        <KbTicker items={tickerItems} />
        {/* Suppressed when degraded: an empty map badged "0 active listings" is the same fabricated zero as the hero (§0). */}
        {hasMap ? (
          <KbListingMap
            geojson={mapGeo}
            totalActive={activeCount ?? mapFeatures.length}
            fitToFeatures
            showRegionMarkers={false}
            polygons={mapPolygons}
            eyebrow={neighborhood.name}
            title={`Homes in\n${neighborhood.name}`}
            subtitle={`Every active single-family listing in ${neighborhood.name}.`}
          />
        ) : null}
        {/* Rich, verified depth. Null when no config, so it degrades to nothing.
            When present it carries the overview, so About is suppressed. */}
        <KbResortOverview content={richContent} name={neighborhood.name} postsBySlug={amenityPosts} />
        {richContent === null && aboutParagraphs.length > 0 ? (
          <KbAbout
            eyebrow={neighborhoodLabel}
            heading={`Living in ${neighborhood.name}`}
            paragraphs={aboutParagraphs}
            facts={aboutFacts}
          />
        ) : null}
        <KbMarketHud
          data={marketData}
          eyebrow={`${neighborhood.name} · The market`} geoName={neighborhood.name} asOf={pulse?.refreshedAt ?? null}
          chartScopeLabel={chartIsCityLevel && cityName ? `${cityName} (city)` : undefined}
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
        <KbAreaGuideVideo videoUrl={areaGuideVideo?.url ?? null} wide={areaGuideVideo?.wide} locationName={neighborhood.name} posterSrc={heroPhoto} />
        {/* Open houses + the feed are fetched city-wide (the MLS carries no
            neighborhood scope on either), so they are labeled with the city (§0). */}
        <KbOpenHouses items={openHouseItems} eyebrow={`${cityName} · This week`} heading="Open houses" viewAllHref={`/open-houses/${citySlug}`} />
        <KbActivity
          items={activityItems}
          eyebrow={`Live · ${cityName}`}
          heading="Latest market activity"
          viewAllHref="/housing-market"
          viewAllLabel="Full market pulse"
        />
        {/* Convert before trust, and BOTH before the exit links. */}
        <KbSell
          data={{
            medianListPrice,
            medianDaysToPending: pulse?.medianDaysToPending ?? null,
            soldCount30d: pulse?.closedLast30Days ?? null,
          }}
        />
        <KbArticles
          posts={articlePosts}
          eyebrow="Guides and news"
          heading={`${neighborhood.name} real estate guides`}
          subtitle={`Housing news, market data, and buyer and seller advice for ${neighborhood.name} and ${cityName}.`}
        />
        <KbTestimonials reviews={TESTIMONIALS.slice(0, 8)} />
        <KbTeam />
        {/* Last block before the FAQ: every link here routes the reader OFF this
            page, so it sits after the ask, never before it. */}
        <KbExploreTowns
          towns={otherCityItems}
          eyebrow="Central Oregon"
          title="Other cities"
          sectionId="nearby"
          cta={{ href: '/cities', label: 'Every city' }}
        />
        {faqs.length > 0 ? (
          <section id="faq" aria-label={`${neighborhood.name} real estate questions`}>
            <FAQBlock items={faqs} eyebrow="Common questions" title={`${neighborhood.name} real estate questions`} />
          </section>
        ) : null}
        <MarketSources sources={['ods']} />
        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
