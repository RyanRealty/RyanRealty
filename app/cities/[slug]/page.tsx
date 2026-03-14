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
import { getActiveBrokers } from '@/app/actions/brokers'
import { isCitySaved } from '@/app/actions/saved-cities'
import { getSavedCommunityKeys } from '@/app/actions/saved-communities'
import { getLikedCommunityKeys } from '@/app/actions/community-engagement'
import { homesForSalePath } from '@/lib/slug'
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
import GeoSectionPopularCommunities from '@/components/geo-page/GeoSectionPopularCommunities'
import GeoSectionFeaturedListings from '@/components/geo-page/GeoSectionFeaturedListings'
import GeoSectionLatestActivity from '@/components/geo-page/GeoSectionLatestActivity'

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
  listings: { ListPrice?: number | null }[]
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
  return {
    population: known?.population ?? null,
    elevation: known?.elevation ?? null,
    county: known?.county ?? null,
    schoolDistrict: known?.schoolDistrict ?? null,
    priceRangeMin,
    priceRangeMax,
    avgLotSize: null,
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

  const displayPrefs = prefs ?? {
    downPaymentPercent: DEFAULT_DISPLAY_DOWN_PCT,
    interestRate: DEFAULT_DISPLAY_RATE,
    loanTermYears: DEFAULT_DISPLAY_TERM_YEARS,
  }

  const quickFacts = buildQuickFacts(city.name, listings)
  const cityContent = getCityContent(city.name)
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

      <CommunitiesBar
        cityName={city.name}
        communities={communities}
        signedIn={!!session?.user}
        savedEntityKeys={savedCommunityKeys}
        likedEntityKeys={likedCommunityKeys}
      />

      <ListingsSlider
        title="Homes for sale in this city"
        listings={listings}
        placeName={city.name}
        savedKeys={session?.user ? savedKeys : []}
        likedKeys={session?.user ? likedKeys : []}
        signedIn={!!session?.user}
        userEmail={session?.user?.email ?? null}
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

      <GeoSectionNewestListings
        title="Newest listings"
        listings={listings}
        viewAllHref={homesForSalePath(city.name)}
        viewAllLabel="View all"
        savedKeys={session?.user ? savedKeys : []}
        likedKeys={session?.user ? likedKeys : []}
        signedIn={!!session?.user}
        userEmail={session?.user?.email ?? null}
      />

      <GeoSectionPopularCommunities
        title="Popular communities"
        communities={communities}
        viewAllHref={`/cities/${slug}`}
        viewAllLabel="View all communities"
        signedIn={!!session?.user}
        savedEntityKeys={savedCommunityKeys}
        likedEntityKeys={likedCommunityKeys}
      />

      <GeoSectionFeaturedListings
        title="Featured listings"
        listings={listings.slice(6, 12)}
        viewAllHref={homesForSalePath(city.name)}
        viewAllLabel="View all"
        savedKeys={session?.user ? savedKeys : []}
        likedKeys={session?.user ? likedKeys : []}
        signedIn={!!session?.user}
        userEmail={session?.user?.email ?? null}
      />

      <GeoSectionLatestActivity title="Latest activity" items={activityFeed} />

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
