/**
 * City template — city-d restyle of the live /cities/[slug] page.
 * One template by slug. Spark, place graph, Chart Room, and SEO H1 stay.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  getGeoSnapshot,
  getMarketPulse,
  getCityListings,
  getListingTiles,
  getAllCitySnapshots,
  getCityMetadataByName,
  getReviews,
} from '@/lib/data'
import { getCommunitiesForIndex } from '@/app/actions/communities'
import { canonicalCityCacheSlug } from '@/lib/market/city-cache-slug'
import { publishMonthsOfSupply } from '@/lib/market/publish-months-of-supply'
import { CITY_TILE_FETCH_LIMIT, publishCityInventory } from '@/lib/market/publish-city-inventory'
import { medianListPriceOfTiles } from '@/lib/market/tile-medians'
import { isStockPlaceHeroUrl } from '@/lib/market/publish-place-hero'
import { getCityContent, buildDataDrivenCityAbout } from '@/lib/city-content'
import { CITY_QUICK_FACTS, PRIMARY_CITIES } from '@/lib/cities'
import { cityHero } from '@/lib/geo-images'
import { cityResorts, resortActiveSfrCounts } from '@/lib/kb/resort-active-counts'
import { fetchAllCityActiveSfr } from '@/lib/kb/city-active-sfr'
import { publishDaysLabel } from '@/lib/market/publish-days-figure'
import { CITY_HERO_VIDEO, CITY_RESORT_LEDGER_IMG } from '@/lib/kb/city-page-config'
import { homesForSalePath, slugify } from '@/lib/slug'
import { pageMetadata } from '@/lib/site/page-metadata'
import { withTimeoutFallback, withTimeoutFallbackResult } from '@/lib/with-timeout-fallback'
import { buildMarketFaq, type MarketFaqInput } from '@/lib/site/market-faq'
import type { SchemaInput } from '@/lib/site/json-ld'
import { buildCitySchemas } from './city-schemas'
import { CityMarketCharts } from './_v3/city-market-charts'
import {
  cityDistrictsNote,
  cityHeroLead,
  cityPitchHeading,
  footerCityLinks,
  footerCommunityLinks,
  marketKpis,
  nearbyPlacesForCity,
  schoolsForCity,
} from './_v3/city-d-data'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { MarketSources, type MarketSourceKey } from '@/components/site/MarketSources'
import { FAQBlock } from '@/components/site/FAQBlock'
import CityPageTracker from '@/components/city/CityPageTracker'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import { CityDHero } from '@/components/site/city-d/CityDHero'
import { CityDPitch } from '@/components/site/city-d/CityDPitch'
import { CityDNearby } from '@/components/site/city-d/CityDNearby'
import { CityDMarket } from '@/components/site/city-d/CityDMarket'
import { CityDSchools } from '@/components/site/city-d/CityDSchools'
import { CityDReviews } from '@/components/site/city-d/CityDReviews'
import { CityDWalk } from '@/components/site/city-d/CityDWalk'
import { CityDFooter } from '@/components/site/city-d/CityDFooter'
import { CityDDock } from '@/components/site/city-d/CityDDock.client'
import resortRegistry from '@/data/resort-communities.json' assert { type: 'json' }
import '@/components/site/kb/kb.css'
import '@/components/site/city-d/city-d.css'

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
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
  const geoSlug = canonicalCityCacheSlug(slug)
  const resortsHere = cityResorts(slug)

  const [pulseRead, communities, allCitySnapshots, cityMeta, mapTilesRead, resortTiles, reviews] =
    await Promise.all([
      withTimeoutFallbackResult(getMarketPulse({ geoType: 'city', geoSlug }), null, 3500, 'city:pulse'),
      withTimeoutFallback(getCommunitiesForIndex(), [], 3500, 'city:communities'),
      withTimeoutFallback(getAllCitySnapshots(), [], 3000, 'city:allCities'),
      withTimeoutFallback(getCityMetadataByName(cityName), null, 3000, 'city:meta'),
      withTimeoutFallbackResult(
        getCityListings(cityName, {
          status: 'active',
          sort: 'newest',
          propertyType: 'A',
          limit: CITY_TILE_FETCH_LIMIT,
        }),
        [],
        4500,
        'city:mapTiles',
      ),
      resortsHere.length > 0
        ? withTimeoutFallback(fetchAllCityActiveSfr(cityName), [], 6000, 'city:resortTiles')
        : Promise.resolve([] as Awaited<ReturnType<typeof getListingTiles>>),
      withTimeoutFallback(getReviews(8), { reviews: [], count: 0, averageRating: 0, source: 'google' as const }, 3000, 'city:reviews'),
    ])

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
  const monthsOfSupply = publishMonthsOfSupply({
    grain: 'city',
    pulseMos: pulse?.monthsOfSupply,
    pulseActiveCount: pulse?.activeCount,
    displayedActiveCount: activeCount,
  })

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

  const cityContent = getCityContent(cityName)
  const quickFacts = CITY_QUICK_FACTS[cityName] ?? null
  const hasOfficialNeighborhoods = slug === 'bend'
  const aboutParagraphs: string[] = []
  if (cityContent?.description) aboutParagraphs.push(cityContent.description)
  if (cityContent?.history) aboutParagraphs.push(cityContent.history)
  if (aboutParagraphs.length === 0 && activeCount != null) {
    aboutParagraphs.push(
      ...buildDataDrivenCityAbout({
        cityName,
        population: quickFacts?.population ?? null,
        elevation: quickFacts?.elevation ?? null,
        county: quickFacts?.county ?? null,
        schoolDistrict: quickFacts?.schoolDistrict ?? null,
        nearestAirport: quickFacts?.nearestAirport ?? null,
        activeCount,
        medianPrice: publishedMedian ?? snapshot.medianListPrice,
        communityCount: 0,
      }).slice(0, 2),
    )
  }
  const districtsNote = cityDistrictsNote(hasOfficialNeighborhoods, cityName)
  if (districtsNote) aboutParagraphs.push(districtsNote)

  const cityComms = communities.filter(
    (c) => c.city?.toLowerCase().trim() === cityName.toLowerCase().trim(),
  )
  const resortSfrCounts = resortActiveSfrCounts(slug, resortTiles)
  const nearby = nearbyPlacesForCity({
    citySlug: slug,
    cityName,
    resorts: resortsHere,
    communities: cityComms,
    resortCounts: resortSfrCounts,
    ledgerImg: CITY_RESORT_LEDGER_IMG,
  })
  const pendingDaysLabel = publishDaysLabel(pulse?.medianDaysToPending)
  const { schools, district } = schoolsForCity(cityName)
  const kpis = marketKpis({
    medianListPrice: publishedMedian,
    activeCount,
    medianDaysToPending: pulse?.medianDaysToPending ?? null,
    daysLabel: pendingDaysLabel,
    hasOfficialNeighborhoods,
  })
  const featuredReview = reviews.reviews[0]
    ? {
        quote: reviews.reviews[0].text,
        author: reviews.reviews[0].reviewerName?.trim() || 'Google review',
        source: 'Verified Google review',
      }
    : null

  const marketFaqInput: MarketFaqInput = {
    ...(pulse ?? {
      activeCount: snapshot.activeSfrCount,
      medianListPrice: snapshot.medianListPrice,
      refreshedAt: snapshot.refreshedAt,
    }),
    activeCount: activeCount ?? snapshot.activeSfrCount,
    pulseActiveCount: pulse?.activeCount ?? null,
    medianListPrice: publishedMedian ?? snapshot.medianListPrice,
    grain: 'city',
    monthsOfSupply,
  }
  const { faqs, datasetVariables, asOfIso, asOfLabel } = buildMarketFaq(cityName, marketFaqInput)
  const citySchemas: SchemaInput[] = buildCitySchemas({
    cityName,
    slug,
    hasMap: false,
    datasetVariables,
    asOfIso,
    asOfLabel,
  })

  const allResorts = (resortRegistry.communities as Array<{ slug: string; label: string; is_resort?: boolean }>)
    .filter((c) => c.is_resort === true)
    .map((c) => ({ slug: c.slug, label: c.label }))

  return (
    <main className="kb-root city-d">
      <CityPageTracker
        cityName={cityName}
        slug={slug}
        listingCount={activeCount}
        medianPrice={publishedMedian}
        communityCount={cityComms.length}
      />
      <KbSectionTracker />
      <MetadataBlock schemas={citySchemas} />
      <KbBreadcrumb
        overlay
        trail={[{ label: 'Places' }, { label: `City of ${cityName}` }]}
      />
      <SmoothScrollProvider>
        <CityDHero
          cityName={cityName}
          h1={`${cityName} homes for sale`}
          lead={cityHeroLead({
            cityName,
            activeCount,
            medianListPrice: publishedMedian,
            medianDaysToPending: pulse?.medianDaysToPending ?? null,
          })}
          videoSrc={heroVideoSrc}
          posterSrc={heroPosterSrc}
          posterAlt={`${cityName}, Oregon`}
          mediaCaption={mediaCaption}
          cta={{ href: homesForSalePath(cityName), label: `See homes in ${cityName}` }}
        />
        <CityDPitch
          heading={cityPitchHeading({
            cityName,
            nearestAirport: quickFacts?.nearestAirport,
          })}
          paragraphs={aboutParagraphs}
        />
        <CityDNearby cityName={cityName} places={nearby} />
        <CityDMarket cityName={cityName} kpis={kpis}>
          <CityMarketCharts
            citySlug={slug}
            geoSlug={geoSlug}
            cityName={cityName}
            publishedMos={monthsOfSupply}
            publishedDtp={pulse?.medianDaysToPending ?? null}
            displayedActiveCount={activeCount}
          />
        </CityDMarket>
        <CityDSchools cityName={cityName} schools={schools} district={district} />
        <CityDReviews
          cityName={cityName}
          review={featuredReview}
          rating={reviews.averageRating}
          count={reviews.count}
        />
        <CityDWalk cityName={cityName} rating={reviews.averageRating} count={reviews.count} />
        {faqs.length > 0 ? (
          <section className="city-d-section" id="faq" aria-label={`${cityName} real estate questions`}>
            <div className="city-d-wrap">
              <FAQBlock items={faqs} eyebrow="Common questions" title={`Questions about ${cityName}`} />
            </div>
          </section>
        ) : null}
        <MarketSources
          sources={(quickFacts?.population ? ['ods', 'census'] : ['ods']) as MarketSourceKey[]}
        />
        <CityDFooter
          cities={footerCityLinks(allCitySnapshots)}
          communities={footerCommunityLinks(allResorts)}
        />
        <CityDDock rating={reviews.averageRating} reviewCount={reviews.count} />
      </SmoothScrollProvider>
    </main>
  )
}
