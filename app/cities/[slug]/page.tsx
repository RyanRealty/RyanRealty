import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  getCityBySlug,
  getCityListings,
  getCitySoldListings,
  getCityPriceHistory,
  getCommunitiesInCity,
  getNeighborhoodsInCity,
} from '@/app/actions/cities'
import { shareDescription, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT } from '@/lib/share-metadata'
import { getSession } from '@/app/actions/auth'
import { getSavedListingKeys } from '@/app/actions/saved-listings'
import { getLikedListingKeys } from '@/app/actions/likes'
import { getBuyingPreferences } from '@/app/actions/buying-preferences'
import { trackPageViewIfPossible } from '@/lib/followupboss'
import { getFubPersonIdFromCookie } from '@/app/actions/fub-identity-bridge'
import { DEFAULT_DISPLAY_RATE, DEFAULT_DISPLAY_DOWN_PCT, DEFAULT_DISPLAY_TERM_YEARS } from '@/lib/mortgage'
import { CITY_QUICK_FACTS } from '@/lib/cities'
import { getCityContent, buildDataDrivenCityAbout } from '@/lib/city-content'
import { getActivityFeed } from '@/app/actions/activity-feed'
import { getEngagementCountsBatch, type EngagementCounts } from '@/app/actions/engagement'
import { getActiveBrokers } from '@/app/actions/brokers'
import { isCitySaved } from '@/app/actions/saved-cities'
import { getSavedCommunityKeys } from '@/app/actions/saved-communities'
import { getLikedCommunityKeys, getCommunityEngagementBatch } from '@/app/actions/community-engagement'
import { homesForSalePath, subdivisionEntityKey } from '@/lib/slug'
import { slugify } from '@/lib/slug'
import { getLiveMarketPulse } from '@/app/actions/market-stats'
import { getOpenHousesWithListings } from '@/app/actions/open-houses'
import CityHero from '@/components/city/CityHero'
import CityOverview from '@/components/city/CityOverview'
import CityMarketStats from '@/components/city/CityMarketStats'
import CityPageTracker from '@/components/city/CityPageTracker'
import BreadcrumbStrip from '@/components/layout/BreadcrumbStrip'
import { fetchPlacePhoto } from '@/lib/photo-api'
import CityPageActionBar from '@/components/geo-page/CityPageActionBar'
import CommunitiesBar from '@/components/geo-page/CommunitiesBar'
import ListingsSlider from '@/components/geo-page/ListingsSlider'
import GeoCTAWithBroker from '@/components/geo-page/GeoCTAWithBroker'
import GeoSectionNewestListings from '@/components/geo-page/GeoSectionNewestListings'
import CommunitiesSlider from '@/components/sliders/CommunitiesSlider'
import GeoSectionFeaturedListings from '@/components/geo-page/GeoSectionFeaturedListings'
import GeoSectionLatestActivity from '@/components/geo-page/GeoSectionLatestActivity'
import RecentlySoldRow from '@/components/RecentlySoldRow'
import LivePulseBanner from '@/components/reports/LivePulseBanner'
import OpenHouseSection from '@/components/open-houses/OpenHouseSection'
import VideoToursRow from '@/components/videos/VideoToursRow'
import { generateBreadcrumbSchema, generateFAQSchema } from '@/lib/structured-data'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const city = await getCityBySlug(slug)
  if (!city) return { title: 'City Not Found' }
  const title = `Homes for Sale in ${city.name}, Oregon | Ryan Realty`
  const rawDesc =
    city.activeCount > 0
      ? `${city.activeCount} homes for sale in ${city.name}. Median price ${city.medianPrice != null ? `$${city.medianPrice.toLocaleString()}` : '—'}. Explore communities, neighborhoods, and market stats.`
      : `Explore ${city.name}, Oregon. Communities, neighborhoods, and market overview.`
  const description = shareDescription(rawDesc)
  const canonical = `${siteUrl}/cities/${slug}`
  const ogImage = city.heroImageUrl
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'Ryan Realty',
      type: 'website',
      ...(ogImage && { images: [{ url: ogImage, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt: `${city.name}, Oregon — Ryan Realty` }] }),
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export const revalidate = 60

function buildQuickFacts(
  cityName: string,
  listings: {
    ListPrice?: number | null
    lot_size_acres?: number | null
    lot_size_sqft?: number | null
  }[]
): {
  population?: string | null
  elevation?: string | null
  county?: string | null
  schoolDistrict?: string | null
  priceRangeMin?: number | null
  priceRangeMax?: number | null
  avgLotSize?: string | null
  nearestAirport?: string | null
} {
  const known = CITY_QUICK_FACTS[cityName]
  const prices = listings
    .map((l) => (l.ListPrice != null && Number.isFinite(l.ListPrice) ? l.ListPrice : null))
    .filter((p): p is number => p != null && p > 0)
  const priceRangeMin = prices.length > 0 ? Math.min(...prices) : null
  const priceRangeMax = prices.length > 0 ? Math.max(...prices) : null
  const lotSizes = listings
    .map((l) => {
      const acres = l.lot_size_acres != null && Number.isFinite(l.lot_size_acres) ? l.lot_size_acres : null
      const sqFt = l.lot_size_sqft != null && Number.isFinite(l.lot_size_sqft) ? l.lot_size_sqft : null
      if (acres != null && acres > 0) return acres
      if (sqFt != null && sqFt > 0) return sqFt / 43560
      return null
    })
    .filter((n): n is number => n != null && n > 0)
  const avgLotAcres = lotSizes.length > 0 ? lotSizes.reduce((a, b) => a + b, 0) / lotSizes.length : null
  const avgLotSize =
    avgLotAcres != null && avgLotAcres > 0
      ? avgLotAcres >= 1
        ? `${avgLotAcres.toFixed(1)} ac`
        : `${(avgLotAcres * 43560).toFixed(0)} sq ft`
      : null
  return {
    population: known?.population ?? null,
    elevation: known?.elevation ?? null,
    county: known?.county ?? null,
    schoolDistrict: known?.schoolDistrict ?? null,
    priceRangeMin,
    priceRangeMax,
    avgLotSize,
    nearestAirport: known?.nearestAirport ?? null,
  }
}

export default async function CityDetailPage({ params }: Props) {
  const { slug } = await params
  const city = await getCityBySlug(slug)
  if (!city) notFound()

  const [session, fubPersonId] = await Promise.all([getSession(), getFubPersonIdFromCookie()])
  const pageUrl = `${siteUrl}/cities/${slug}`
  const pageTitle = `Homes for Sale in ${city.name}, Oregon | Ryan Realty`
  trackPageViewIfPossible({ sessionUser: session?.user ?? undefined, fubPersonId, pageUrl, pageTitle })
  const heroImageUrl =
    city.heroImageUrl ?? null

  const [
    listings,
    soldListings,
    communities,
    neighborhoods,
    priceHistory,
    savedKeys,
    likedKeys,
    prefs,
    activityFeed,
    brokers,
    citySaved,
    savedCommunityKeys,
    likedCommunityKeys,
  ] = await Promise.all([
    getCityListings(city.name, 24),
    getCitySoldListings(city.name, 6),
    getCommunitiesInCity(city.name),
    getNeighborhoodsInCity(city.name),
    getCityPriceHistory(city.name),
    session?.user ? getSavedListingKeys() : Promise.resolve([]),
    session?.user ? getLikedListingKeys() : Promise.resolve([]),
    session?.user ? getBuyingPreferences().catch(() => null) : Promise.resolve(null),
    getActivityFeed({ city: city.name, limit: 24 }),
    getActiveBrokers(),
    session?.user ? isCitySaved(slug) : Promise.resolve(false),
    session?.user ? getSavedCommunityKeys() : Promise.resolve([]),
    session?.user ? getLikedCommunityKeys() : Promise.resolve([]),
  ])
  const cityPulse = await getLiveMarketPulse({ geoType: 'city', geoSlug: slugify(city.name) })
  const cityOpenHouses = await getOpenHousesWithListings({ city: city.name })

  const displayPrefs = prefs ?? {
    downPaymentPercent: DEFAULT_DISPLAY_DOWN_PCT,
    interestRate: DEFAULT_DISPLAY_RATE,
    loanTermYears: DEFAULT_DISPLAY_TERM_YEARS,
  }

  const quickFacts = buildQuickFacts(city.name, listings)
  const hasRobustDbContent = city.description != null && city.description.trim().length >= 300
  const cityContent = hasRobustDbContent ? null : getCityContent(city.name)
  const dataDrivenParagraphs =
    !cityContent && (!city.description || city.description.trim().length < 180)
      ? buildDataDrivenCityAbout({
          cityName: city.name,
          population: quickFacts.population ?? null,
          elevation: quickFacts.elevation ?? null,
          county: quickFacts.county ?? null,
          schoolDistrict: quickFacts.schoolDistrict ?? null,
          nearestAirport: quickFacts.nearestAirport ?? null,
          activeCount: city.activeCount,
          medianPrice: city.medianPrice,
          communityCount: city.communityCount,
        })
      : undefined
  const stats = {
    medianPrice: city.medianPrice,
    count: city.activeCount,
    avgDom: city.avgDom,
    closedLast12Months: city.closedLast12Months,
  }

  const listingKeys = listings
    .map((l) => (l.ListingKey ?? l.ListNumber ?? '').toString().trim())
    .filter(Boolean)
  const communityEntityKeys = communities.map((c) => subdivisionEntityKey(c.city, c.subdivision))
  const [engagementMap, communityEngagementMap] = await Promise.all([
    listingKeys.length > 0 ? getEngagementCountsBatch(listingKeys) : Promise.resolve({} as Record<string, EngagementCounts>),
    communityEntityKeys.length > 0 ? getCommunityEngagementBatch(communityEntityKeys) : Promise.resolve({}),
  ])
  const engagementScore = (key: string) => {
    const e = engagementMap[key]
    return (e?.view_count ?? 0) + (e?.like_count ?? 0) + (e?.save_count ?? 0) + (e?.share_count ?? 0)
  }
  const featuredListings = [...listings]
    .sort((a, b) => {
      const keyA = (a.ListingKey ?? a.ListNumber ?? '').toString().trim()
      const keyB = (b.ListingKey ?? b.ListNumber ?? '').toString().trim()
      const scoreA = engagementScore(keyA)
      const scoreB = engagementScore(keyB)
      if (scoreB !== scoreA) return scoreB - scoreA
      const priceA = Number(a.ListPrice ?? 0)
      const priceB = Number(b.ListPrice ?? 0)
      return priceB - priceA
    })
    .slice(0, 12)
  const recentlySoldRows = soldListings
    .map((item) => ({
      listingKey: (item.ListingKey ?? item.ListNumber ?? '').toString().trim(),
      listNumber: item.ListNumber ?? null,
      listPrice: item.ListPrice ?? null,
      closePrice: item.ClosePrice ?? null,
      closeDate: item.CloseDate ?? null,
      beds: item.BedroomsTotal ?? null,
      baths: item.BathroomsTotal ?? null,
      sqft: item.TotalLivingAreaSqFt ?? null,
      streetNumber: item.StreetNumber ?? null,
      streetName: item.StreetName ?? null,
      city: item.City ?? null,
      state: item.State ?? null,
      postalCode: item.PostalCode ?? null,
      photoUrl: item.PhotoURL ?? null,
    }))
    .filter((item) => item.listingKey.length > 0)

  const geo = (() => {
    const withCoords = listings.filter(
      (l) =>
        l.Latitude != null &&
        l.Longitude != null &&
        Number.isFinite(Number(l.Latitude)) &&
        Number.isFinite(Number(l.Longitude))
    )
    if (withCoords.length === 0) return null
    const lat = withCoords.reduce((a, l) => a + Number(l.Latitude), 0) / withCoords.length
    const lng = withCoords.reduce((a, l) => a + Number(l.Longitude), 0) / withCoords.length
    return { lat, lng }
  })()

  return (
    <main className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'City',
            name: city.name,
            address: { addressRegion: 'OR', addressCountry: 'US' },
            ...(geo && {
              geo: {
                '@type': 'GeoCoordinates',
                latitude: geo.lat,
                longitude: geo.lng,
              },
            }),
            url: `${siteUrl}/cities/${slug}`,
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            generateBreadcrumbSchema([
              { name: 'Home', url: siteUrl },
              { name: 'Cities', url: `${siteUrl}/cities` },
              { name: city.name, url: `${siteUrl}/cities/${slug}` },
            ])
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            generateFAQSchema([
              {
                question: `How many homes are for sale in ${city.name}?`,
                answer: city.activeCount > 0
                  ? `There are currently ${city.activeCount} homes for sale in ${city.name}, Oregon.`
                  : `Inventory in ${city.name} changes frequently. Check back or contact Ryan Realty for the latest listings.`,
              },
              {
                question: `What is the median home price in ${city.name}?`,
                answer: city.medianPrice != null
                  ? `The current median home price in ${city.name} is $${city.medianPrice.toLocaleString()}.`
                  : `Contact Ryan Realty for current pricing information in ${city.name}.`,
              },
              {
                question: `How many communities are in ${city.name}?`,
                answer: city.communityCount > 0
                  ? `${city.name} has ${city.communityCount} communities and subdivisions with homes for sale.`
                  : `Explore ${city.name} neighborhoods and communities on our city page.`,
              },
            ])
          ),
        }}
      />

      <CityPageTracker
        cityName={city.name}
        slug={slug}
        listingCount={city.activeCount}
        medianPrice={city.medianPrice}
        communityCount={city.communityCount}
      />

      <CityHero
        name={city.name}
        heroImageUrl={heroImageUrl}
        activeCount={city.activeCount}
        medianPrice={city.medianPrice}
        communityCount={city.communityCount}
        actions={
          <CityPageActionBar
            citySlug={slug}
            cityName={city.name}
            initialSaved={citySaved}
            signedIn={!!session?.user}
            shareUrl={`${siteUrl}/cities/${slug}`}
            variant="overlay"
          />
        }
      />

      <BreadcrumbStrip
        items={[
          { label: 'Home', href: '/' },
          { label: 'Cities', href: '/cities' },
          { label: city.name },
        ]}
      />

      <CityOverview
        cityName={city.name}
        description={city.description}
        quickFacts={quickFacts}
        cityContent={cityContent}
        dataDrivenParagraphs={dataDrivenParagraphs}
      />

      <CityMarketStats
        cityName={city.name}
        slug={slug}
        stats={stats}
        priceHistory={priceHistory}
      />

      {cityPulse && (
        <div className="mx-auto mt-8 max-w-7xl px-4 sm:px-6">
          <LivePulseBanner
            title={`${city.name} live market pulse`}
            activeCount={cityPulse.active_count}
            pendingCount={cityPulse.pending_count}
            newCount7d={cityPulse.new_count_7d}
            updatedAt={cityPulse.updated_at}
          />
        </div>
      )}

      <div className="mx-auto mt-8 max-w-7xl px-4 sm:px-6">
        <OpenHouseSection
          title={`Open houses in ${city.name} this week`}
          items={cityOpenHouses.slice(0, 10)}
          viewAllHref={`/open-houses/${slug}`}
        />
      </div>

      <div className="mx-auto mt-8 max-w-7xl px-4 sm:px-6">
        <VideoToursRow
          title={`Video tours in ${city.name}`}
          listings={listings}
          signedIn={!!session?.user}
          savedKeys={session?.user ? savedKeys : []}
          likedKeys={session?.user ? likedKeys : []}
          userEmail={session?.user?.email ?? null}
          engagementMap={engagementMap}
        />
      </div>

      <GeoSectionLatestActivity
        title="Latest activity"
        items={activityFeed}
        signedIn={!!session?.user}
        savedKeys={session?.user ? savedKeys : []}
        likedKeys={session?.user ? likedKeys : []}
      />

      <div className="px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <RecentlySoldRow title={`Recently sold in ${city.name}`} listings={recentlySoldRows} />
        </div>
      </div>

      <GeoSectionFeaturedListings
        title="Featured homes"
        listings={featuredListings}
        viewAllHref={homesForSalePath(city.name)}
        viewAllLabel="View all"
        savedKeys={session?.user ? savedKeys : []}
        likedKeys={session?.user ? likedKeys : []}
        signedIn={!!session?.user}
        userEmail={session?.user?.email ?? null}
        engagementMap={engagementMap}
      />

      <CommunitiesBar
        cityName={city.name}
        communities={communities}
        signedIn={!!session?.user}
        savedEntityKeys={savedCommunityKeys}
        likedEntityKeys={likedCommunityKeys}
        engagementMap={communityEngagementMap}
      />

      <ListingsSlider
        title="Homes for sale in this city"
        listings={listings}
        placeName={city.name}
        savedKeys={session?.user ? savedKeys : []}
        likedKeys={session?.user ? likedKeys : []}
        signedIn={!!session?.user}
        userEmail={session?.user?.email ?? null}
        engagementMap={engagementMap}
      />

      <GeoSectionNewestListings
        title="Newest listings"
        listings={listings}
        viewAllHref={homesForSalePath(city.name)}
        viewAllLabel="View all"
        savedKeys={session?.user ? savedKeys : []}
        likedKeys={session?.user ? likedKeys : []}
        signedIn={!!session?.user}
        userEmail={session?.user?.email ?? null}
        engagementMap={engagementMap}
      />

      <CommunitiesSlider
        title="Popular communities"
        communities={communities}
        viewAllHref={`/cities/${slug}`}
        viewAllLabel="View all communities"
        signedIn={!!session?.user}
        savedEntityKeys={savedCommunityKeys}
        likedEntityKeys={likedCommunityKeys}
      />

      <GeoCTAWithBroker
        heading={`Looking for a Home in ${city.name}?`}
        supportingText={`Save your search to get alerts when new homes in ${city.name} hit the market.`}
        primaryCta={{ label: 'Browse homes for sale', href: homesForSalePath(city.name) }}
        secondaryCta={{ label: 'Get notified of new listings', href: '/account/saved-searches' }}
        brokers={brokers}
      />
    </main>
  )
}
