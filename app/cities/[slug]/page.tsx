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
import { getSession } from '@/app/actions/auth'
import { getSavedListingKeys } from '@/app/actions/saved-listings'
import { getLikedListingKeys } from '@/app/actions/likes'
import { getBuyingPreferences } from '@/app/actions/buying-preferences'
import { trackPageView } from '@/lib/followupboss'
import { DEFAULT_DISPLAY_RATE, DEFAULT_DISPLAY_DOWN_PCT, DEFAULT_DISPLAY_TERM_YEARS } from '@/lib/mortgage'
import { CITY_QUICK_FACTS } from '@/lib/cities'
import CityHero from '@/components/city/CityHero'
import CityOverview from '@/components/city/CityOverview'
import CityMarketStats from '@/components/city/CityMarketStats'
import CityCommunities from '@/components/city/CityCommunities'
import CityNeighborhoods from '@/components/city/CityNeighborhoods'
import CityListings from '@/components/city/CityListings'
import CityMap from '@/components/city/CityMap'
import CityCTA from '@/components/city/CityCTA'
import CityPageTracker from '@/components/city/CityPageTracker'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryanrealty.com').replace(/\/$/, '')

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const city = await getCityBySlug(slug)
  if (!city) return { title: 'City Not Found' }
  const title = `Homes for Sale in ${city.name}, Oregon | Ryan Realty`
  const description =
    city.activeCount > 0
      ? `${city.activeCount} homes for sale in ${city.name}. Median price ${city.medianPrice != null ? `$${city.medianPrice.toLocaleString()}` : '—'}. Explore communities, neighborhoods, and market stats.`
      : `Explore ${city.name}, Oregon. Communities, neighborhoods, and market overview.`
  const canonical = `${siteUrl}/cities/${slug}`
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, siteName: 'Ryan Realty', type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export const dynamic = 'force-dynamic'

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

  const session = await getSession()
  const pageUrl = `${siteUrl}/cities/${slug}`
  const pageTitle = `Homes for Sale in ${city.name}, Oregon | Ryan Realty`
  if (session?.user?.email) {
    trackPageView({ user: session.user, pageUrl, pageTitle }).catch(() => {})
  }

  const [
    listings,
    soldListings,
    communities,
    neighborhoods,
    priceHistory,
    savedKeys,
    likedKeys,
    prefs,
  ] = await Promise.all([
    getCityListings(city.name, 24),
    getCitySoldListings(city.name, 6),
    getCommunitiesInCity(city.name),
    getNeighborhoodsInCity(city.name),
    getCityPriceHistory(city.name),
    session?.user ? getSavedListingKeys() : Promise.resolve([]),
    session?.user ? getLikedListingKeys() : Promise.resolve([]),
    session?.user ? getBuyingPreferences().catch(() => null) : Promise.resolve(null),
  ])

  const displayPrefs = prefs ?? {
    downPaymentPercent: DEFAULT_DISPLAY_DOWN_PCT,
    interestRate: DEFAULT_DISPLAY_RATE,
    loanTermYears: DEFAULT_DISPLAY_TERM_YEARS,
  }

  const quickFacts = buildQuickFacts(city.name, listings)
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
    <main className="min-h-screen bg-[var(--background)]">
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
        heroImageUrl={city.heroImageUrl}
        activeCount={city.activeCount}
        medianPrice={city.medianPrice}
        communityCount={city.communityCount}
      />

      <CityOverview
        cityName={city.name}
        description={city.description}
        quickFacts={quickFacts}
      />

      <CityMarketStats
        cityName={city.name}
        slug={slug}
        stats={stats}
        priceHistory={priceHistory}
      />

      <CityCommunities cityName={city.name} communities={communities} />

      <CityNeighborhoods
        cityName={city.name}
        citySlug={slug}
        neighborhoods={neighborhoods}
      />

      <CityListings
        cityName={city.name}
        citySlug={slug}
        listings={listings}
        soldListings={soldListings}
        savedKeys={session?.user ? savedKeys : []}
        likedKeys={session?.user ? likedKeys : []}
        signedIn={!!session?.user}
        userEmail={session?.user?.email ?? null}
        displayPrefs={displayPrefs}
      />

      <CityMap listings={listings} cityName={city.name} />

      <CityCTA cityName={city.name} slug={slug} />
    </main>
  )
}
