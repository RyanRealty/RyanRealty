/**
 * Bend district template — hood-d restyle of the live /cities/{city}/{slug}
 * route. Spark inventory, place-graph children, Chart Room Time/Relate/Rank,
 * and SEO H1 "{District} homes for sale" stay. Official 13 Bend districts
 * only for generateStaticParams. Empty slices hide. No invented parks or counts.
 */
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getNeighborhoodBySlug, getCommunitiesInNeighborhood } from '@/app/actions/cities'
import {
  getMarketPulse,
  getMarketStats,
  getListingTiles,
  getGeoBoundaryMapData,
  getRecentBlogPosts,
  getReviews,
} from '@/lib/data'
import { getResortCommunityContent } from '@/lib/resort-community-content'
import { getNeighborhoodPublicInventory } from '@/lib/data/geo/neighborhood-public-inventory'
import { communityImage, cityHero } from '@/lib/geo-images'
import { buildMapPointFeatures } from '@/lib/kb/place-sections'
import { canonicalCityCacheSlug } from '@/lib/market/city-cache-slug'
import { publishMonthsOfSupply, publishSoldCount } from '@/lib/market/publish-months-of-supply'
import { subdivisionListingsPath } from '@/lib/slug'
import { pageMetadata } from '@/lib/site/page-metadata'
import { withTimeoutFallback, withTimeoutFallbackResult } from '@/lib/with-timeout-fallback'
import { skippableRail } from '@/lib/build-phase'
import { buildMarketFaq, type MarketFaqInput } from '@/lib/site/market-faq'
import type { SchemaInput } from '@/lib/site/json-ld'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { MarketSources } from '@/components/site/MarketSources'
import { FAQBlock } from '@/components/site/FAQBlock'
import { V3SectionTracker } from '@/components/site/v3/V3SectionTracker.client'
import { formatDate } from '@/lib/format/date'
import { publishNeighborhoodHero } from '@/lib/market/publish-place-hero'
import { mapCentroid } from '@/lib/explore/subdivision-page-extras'
import { buildNeighborhoodSchemas } from './neighborhood-schemas'
import { NeighborhoodMarketCharts } from './_v3/neighborhood-market-charts'
import {
  hoodChildren,
  hoodCompare,
  hoodEvents,
  hoodHomes,
  hoodJournal,
  hoodLead,
  hoodMapRows,
  hoodPeers,
  hoodPlaces,
  hoodSchools,
} from './_v3/hood-d-model'
import { HoodDHero } from '@/components/site/hood-d/HoodDHero'
import { HoodDSearch } from '@/components/site/hood-d/HoodDSearch.client'
import { HoodDHomes } from '@/components/site/hood-d/HoodDHomes'
import { HoodDMap } from '@/components/site/hood-d/HoodDMap.client'
import { HoodDTrails } from '@/components/site/hood-d/HoodDTrails'
import { HoodDWeek } from '@/components/site/hood-d/HoodDWeek'
import { HoodDJournal } from '@/components/site/hood-d/HoodDJournal'
import { HoodDNarrative } from '@/components/site/hood-d/HoodDNarrative'
import { HoodDCompare } from '@/components/site/hood-d/HoodDCompare'
import { HoodDMarket } from '@/components/site/hood-d/HoodDMarket'
import { HoodDPeers } from '@/components/site/hood-d/HoodDPeers'
import { HoodDSchools } from '@/components/site/hood-d/HoodDSchools'
import { HoodDReview } from '@/components/site/hood-d/HoodDReview'
import { HoodDAsk } from '@/components/site/hood-d/HoodDAsk'
import { HoodDAlerts } from '@/components/site/hood-d/HoodDAlerts.client'
import { HoodDFooter } from '@/components/site/hood-d/HoodDFooter'
import { HoodDDock } from '@/components/site/hood-d/HoodDDock.client'
import type { KbMapGeo } from '@/components/site/kb/KbListingMap.client'
import '@/components/site/kb/kb.css'
import '@/components/site/hood-d/hood-d.css'

export async function generateStaticParams(): Promise<Array<{ slug: string; neighborhoodSlug: string }>> {
  const { BEND_NEIGHBORHOOD_DISTRICTS } = await import('@/lib/data/geo/getBendNeighborhoodLedger')
  return BEND_NEIGHBORHOOD_DISTRICTS.map((n) => ({ slug: 'bend', neighborhoodSlug: n.slug }))
}
export const dynamicParams = true
export const revalidate = 60

type Props = { params: Promise<{ slug: string; neighborhoodSlug: string }> }

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
  const cityGeoSlug = canonicalCityCacheSlug(citySlug)
  const boundaryNeighborhoodSlug = `${citySlug}-${neighborhoodSlug}`
  const browseHref = subdivisionListingsPath(cityName, neighborhood.name)

  const [
    pulse,
    stats,
    cityPulse,
    boundaryRead,
    blogPosts,
    neighborhoodCommunities,
    richContent,
    inventoryRead,
    reviews,
  ] = await Promise.all([
    withTimeoutFallback(getMarketPulse({ geoType: 'neighborhood', geoSlug: boundaryNeighborhoodSlug }), null, 3500, 'nbh:pulse'),
    withTimeoutFallback(getMarketStats({ geoType: 'neighborhood', geoSlug: boundaryNeighborhoodSlug, periodType: 'rolling_365d' }), null, 3500, 'nbh:stats'),
    withTimeoutFallback(getMarketPulse({ geoType: 'city', geoSlug: cityGeoSlug }), null, 3500, 'nbh:cityPulse'),
    withTimeoutFallbackResult(getGeoBoundaryMapData({ geoType: 'neighborhood', geoSlug: boundaryNeighborhoodSlug }), { polygon: null, pins: [] }, 4500, 'nbh:boundary'),
    skippableRail(() => getRecentBlogPosts({ cityName, limit: 3 }), [], 3000, 'nbh:blog'),
    withTimeoutFallback(getCommunitiesInNeighborhood(neighborhood.id, cityName), [], 3500, 'nbh:communities'),
    withTimeoutFallback(getResortCommunityContent(boundaryNeighborhoodSlug), null, 2500, 'nbh:content'),
    getNeighborhoodPublicInventory(boundaryNeighborhoodSlug),
    withTimeoutFallback(
      getReviews(8),
      { reviews: [], count: 0, averageRating: 0, source: 'google' as const },
      3000,
      'nbh:reviews',
    ),
  ])

  const boundaryMapData = boundaryRead.value
  const inventory = inventoryRead
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

  const activeCount: number | null = inventory?.activeCount ?? null
  const medianListPrice =
    activeCount == null ? null : inventory?.medianListPrice ?? pulse?.medianListPrice ?? null
  const centroid = mapCentroid(listingTiles)

  const { src: heroPhoto, verified: heroVerified } = publishNeighborhoodHero({
    curated: communityImage(boundaryNeighborhoodSlug) ?? communityImage(neighborhoodSlug),
    dbUrl: neighborhood.heroImageUrl,
    cityFallbackSrc: cityHero(citySlug).src,
  })
  const mediaCaption = heroVerified ? `${neighborhood.name} in ${cityName}, Oregon` : 'Regional view · Cascade Range'

  const mapFeatures = buildMapPointFeatures(listingTiles)
  const mapGeo: KbMapGeo = { type: 'FeatureCollection', features: mapFeatures }
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

  const homes = hoodHomes(listingTiles)
  const mapRows = hoodMapRows(
    listingTiles.map((t) => ({
      listingKey: t.listingKey,
      listNumber: t.listNumber,
      listPrice: t.listPrice,
      beds: t.beds,
      baths: t.baths,
      streetNumber: t.streetNumber,
      streetName: t.streetName,
      streetSuffix: t.streetSuffix,
      city: t.city,
      subdivisionName: t.subdivisionName,
      propertySubType: t.propertySubType ?? null,
      photoUrl: t.photoUrl,
    })),
  )
  const childrenPlaces = hoodChildren(neighborhoodCommunities)
  const { photos, list, note } = hoodPlaces(centroid?.lat ?? null, centroid?.lng ?? null, richContent, neighborhoodSlug)
  const events = hoodEvents(centroid?.lat ?? null, centroid?.lng ?? null)
  const journal = hoodJournal(blogPosts, (iso) => formatDate(iso, { timeZone: 'UTC' }))
  const prose =
    richContent && richContent.aboutProse.length > 0
      ? richContent.aboutProse
      : [neighborhood.description ?? ''].filter((p) => p.trim().length > 0)
  const schools = hoodSchools(richContent)
  const peers = citySlug === 'bend' ? hoodPeers(neighborhoodSlug) : []
  const compareRows = hoodCompare({
    hereActive: activeCount,
    hereMedian: medianListPrice,
    hereDays: pulse?.medianDaysToPending ?? null,
    cityActive: cityPulse?.activeCount ?? null,
    cityMedian: cityPulse?.medianListPrice ?? null,
    cityDays: cityPulse?.medianDaysToPending ?? null,
  })
  const review = reviews.reviews[0]
    ? { quote: reviews.reviews[0].text, author: reviews.reviews[0].reviewerName?.trim() || 'Google review' }
    : null

  // prettier-ignore — ci:mos-grain-trust reads line-wise: the raw soldCount is
  // legal only on the same line as the publishMonthsOfSupply() call it feeds.
  const monthsOfSupply = publishMonthsOfSupply({ grain: 'neighborhood', pulseMos: pulse?.monthsOfSupply, pulseActiveCount: pulse?.activeCount, displayedActiveCount: activeCount, soldCount12mo: stats?.soldCount })
  const marketFaqInput: MarketFaqInput = {
    ...(pulse ?? {}),
    grain: 'neighborhood',
    activeCount,
    medianListPrice: medianListPrice ?? pulse?.medianListPrice ?? null,
    monthsOfSupply,
    soldCount12mo: publishSoldCount({ value: stats?.soldCount, grain: 'neighborhood' }),
  }
  const { faqs, datasetVariables, asOfIso, asOfLabel } = buildMarketFaq(neighborhood.name, marketFaqInput)

  const withCoords = boundaryMapData.pins.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
  const geo =
    withCoords.length > 0
      ? {
          lat: withCoords.reduce((a, p) => a + p.lat, 0) / withCoords.length,
          lng: withCoords.reduce((a, p) => a + p.lng, 0) / withCoords.length,
        }
      : undefined
  const hasMap = mapFeatures.length > 0 || Boolean(mapPolygons)
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
    <main className="kb-root hood-d">
      <V3SectionTracker />
      <MetadataBlock schemas={neighborhoodSchemas} />
      <KbBreadcrumb
        overlay
        trail={[
          { label: cityName, href: `/cities/${citySlug}` },
          { label: neighborhood.name },
        ]}
      />
      <SmoothScrollProvider>
        <HoodDHero
          cityName={cityName}
          cityHref={`/cities/${citySlug}`}
          name={neighborhood.name}
          headline={`${neighborhood.name} homes for sale`}
          lead={hoodLead({ name: neighborhood.name, cityName, prose })}
          data={{
            activeCount,
            medianListPrice,
            medianDaysToPending: pulse?.medianDaysToPending ?? null,
          }}
          posterSrc={heroPhoto}
          posterAlt={mediaCaption}
          cta={{ href: browseHref, label: `See homes` }}
        />
        <HoodDSearch placeName={neighborhood.name} emptyHref={browseHref} />
        <HoodDHomes
          name={neighborhood.name}
          homes={homes}
          listHref={browseHref}
          mapHref="#on-the-map"
        />
        {hasMap ? (
          <HoodDMap
            name={neighborhood.name}
            rows={mapRows}
            mapGeo={mapGeo}
            polygons={mapPolygons}
            totalActive={inventoryOk ? (activeCount ?? 0) : listingTiles.length}
            browseHref={browseHref}
            childrenPlaces={childrenPlaces}
          />
        ) : null}
        <HoodDTrails
          heading={neighborhoodSlug === 'river-west' ? 'Trails and the river' : 'Parks and trails'}
          kicker={neighborhoodSlug === 'river-west' ? 'Along the trail, and just south.' : null}
          photos={photos}
          list={list}
          note={note}
        />
        <HoodDWeek events={events} />
        <HoodDJournal posts={journal} />
        <HoodDNarrative name={neighborhood.name} paragraphs={prose} />
        <HoodDCompare name={neighborhood.name} cityName={cityName} rows={compareRows} />
        <HoodDMarket name={neighborhood.name}>
          <NeighborhoodMarketCharts
            geoSlug={boundaryNeighborhoodSlug}
            districtName={neighborhood.name}
          />
        </HoodDMarket>
        <HoodDPeers heading="Nearby districts" peers={peers} />
        <HoodDSchools schools={schools} />
        <HoodDReview review={review} rating={reviews.averageRating} count={reviews.count} />
        <HoodDAsk name={neighborhood.name} />
        <HoodDAlerts cityName={cityName} neighborhoodName={neighborhood.name} />
        {faqs.length > 0 ? (
          <section className="hood-d-faq" id="faq" aria-label={`${neighborhood.name} real estate questions`}>
            <div className="hood-d-wrap">
              <FAQBlock items={faqs} eyebrow="Common questions" title={`Questions about ${neighborhood.name}`} />
            </div>
          </section>
        ) : null}
        <MarketSources sources={['ods']} />
        <HoodDFooter cityName={cityName} citySlug={citySlug} />
        <HoodDDock rating={reviews.averageRating} reviewCount={reviews.count} />
      </SmoothScrollProvider>
    </main>
  )
}
