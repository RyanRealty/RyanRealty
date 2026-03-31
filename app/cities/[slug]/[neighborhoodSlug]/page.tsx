import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  getNeighborhoodBySlug,
  getNeighborhoodListings,
  getNeighborhoodSoldListings,
  getCommunitiesInCity,
  getCommunitiesInNeighborhood,
} from '@/app/actions/cities'
import { getActivityFeed } from '@/app/actions/activity-feed'
import { getEngagementCountsBatch } from '@/app/actions/engagement'
import { getActiveBrokers } from '@/app/actions/brokers'
import { shareDescription, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT } from '@/lib/share-metadata'
import { getSession } from '@/app/actions/auth'
import { getSavedListingKeys } from '@/app/actions/saved-listings'
import { getLikedListingKeys } from '@/app/actions/likes'
import { getSavedCommunityKeys } from '@/app/actions/saved-communities'
import { getLikedCommunityKeys } from '@/app/actions/community-engagement'
import { getBuyingPreferences } from '@/app/actions/buying-preferences'
import { trackPageViewIfPossible } from '@/lib/followupboss'
import { getFubPersonIdFromCookie } from '@/app/actions/fub-identity-bridge'
import { DEFAULT_DISPLAY_RATE, DEFAULT_DISPLAY_DOWN_PCT, DEFAULT_DISPLAY_TERM_YEARS } from '@/lib/mortgage'
import { homesForSalePath, slugify } from '@/lib/slug'
import { buildDataDrivenNeighborhoodAbout } from '@/lib/city-content'
import { getPlaceContent } from '@/app/actions/place-content'
import { buildNeighborhoodHeroQuery } from '@/lib/hero-image-query'
import NeighborhoodHero from '@/components/neighborhood/NeighborhoodHero'
import NeighborhoodOverview from '@/components/neighborhood/NeighborhoodOverview'
import NeighborhoodMarketStats from '@/components/neighborhood/NeighborhoodMarketStats'
import NeighborhoodMap from '@/components/neighborhood/NeighborhoodMap'
import NeighborhoodPageTracker from '@/components/neighborhood/NeighborhoodPageTracker'
import BreadcrumbStrip from '@/components/layout/BreadcrumbStrip'
import { fetchPlacePhoto } from '@/lib/photo-api'
import NeighborhoodPageActionBar from '@/components/geo-page/NeighborhoodPageActionBar'
import ListingsSlider from '@/components/geo-page/ListingsSlider'
import GeoCTAWithBroker from '@/components/geo-page/GeoCTAWithBroker'
import GeoSectionNewestListings from '@/components/geo-page/GeoSectionNewestListings'
import CommunitiesSlider from '@/components/sliders/CommunitiesSlider'
import GeoSectionFeaturedListings from '@/components/geo-page/GeoSectionFeaturedListings'
import GeoSectionLatestActivity from '@/components/geo-page/GeoSectionLatestActivity'
import PlaceContentSection from '@/components/geo-page/PlaceContentSection'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

type Props = { params: Promise<{ slug: string; neighborhoodSlug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: citySlug, neighborhoodSlug } = await params
  const neighborhood = await getNeighborhoodBySlug(citySlug, neighborhoodSlug)
  if (!neighborhood) return { title: 'Neighborhood Not Found' }

  // Use seo_title and seo_description from DB if available, fallback to generated values
  const title = neighborhood.seoTitle || `${neighborhood.name} in ${neighborhood.cityName}, Oregon | Homes for Sale | Ryan Realty`
  const rawDesc =
    neighborhood.seoDescription ||
    (neighborhood.activeCount > 0
      ? `${neighborhood.activeCount} homes for sale in ${neighborhood.name}, ${neighborhood.cityName}. Median price ${neighborhood.medianPrice != null ? `$${neighborhood.medianPrice.toLocaleString()}` : '—'}.`
      : `Explore ${neighborhood.name} in ${neighborhood.cityName}, Oregon.`)
  const description = shareDescription(rawDesc)
  const canonical = `${siteUrl}/cities/${citySlug}/${neighborhoodSlug}`
  const ogImage = neighborhood.heroImageUrl
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
      ...(ogImage && { images: [{ url: ogImage, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt: `${neighborhood.name}, ${neighborhood.cityName} — Ryan Realty` }] }),
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export const revalidate = 60

export default async function NeighborhoodDetailPage({ params }: Props) {
  const { slug: citySlug, neighborhoodSlug } = await params
  const neighborhood = await getNeighborhoodBySlug(citySlug, neighborhoodSlug)
  if (!neighborhood) notFound()

  const [session, fubPersonId] = await Promise.all([getSession(), getFubPersonIdFromCookie()])
  const pageUrl = `${siteUrl}/cities/${citySlug}/${neighborhoodSlug}`
  const pageTitle = `${neighborhood.name} in ${neighborhood.cityName}, Oregon | Ryan Realty`
  trackPageViewIfPossible({ sessionUser: session?.user ?? undefined, fubPersonId, pageUrl, pageTitle })
  const [placePhotoUrl, listings, soldListings, savedKeys, likedKeys, prefs, communitiesInNeighborhood, activityFeed, brokers, savedCommunityKeys, likedCommunityKeys] = await Promise.all([
    !neighborhood.heroImageUrl
      ? fetchPlacePhoto(buildNeighborhoodHeroQuery(neighborhood.name, neighborhood.cityName)).then((r) => r?.url ?? null).catch(() => null)
      : Promise.resolve(null),
    getNeighborhoodListings(neighborhood.id, 24),
    getNeighborhoodSoldListings(neighborhood.id, 6),
    session?.user ? getSavedListingKeys() : Promise.resolve([]),
    session?.user ? getLikedListingKeys() : Promise.resolve([]),
    session?.user ? getBuyingPreferences().catch(() => null) : Promise.resolve(null),
    getCommunitiesInNeighborhood(neighborhood.id, neighborhood.cityName),
    getActivityFeed({ city: neighborhood.cityName, limit: 24 }),
    getActiveBrokers(),
    session?.user ? getSavedCommunityKeys() : Promise.resolve([]),
    session?.user ? getLikedCommunityKeys() : Promise.resolve([]),
  ])

  const heroImageUrl = neighborhood.heroImageUrl ?? placePhotoUrl ?? null
  const neighborhoodContentKey = `${slugify(neighborhood.cityName)}:${neighborhoodSlug}`
  const placeContent = await getPlaceContent('neighborhood', neighborhoodContentKey)

  const displayPrefs = prefs ?? {
    downPaymentPercent: DEFAULT_DISPLAY_DOWN_PCT,
    interestRate: DEFAULT_DISPLAY_RATE,
    loanTermYears: DEFAULT_DISPLAY_TERM_YEARS,
  }

  const dataDrivenParagraphs =
    !neighborhood.description || neighborhood.description.trim().length < 180
      ? buildDataDrivenNeighborhoodAbout({
          neighborhoodName: neighborhood.name,
          cityName: neighborhood.cityName,
          activeCount: neighborhood.activeCount,
          medianPrice: neighborhood.medianPrice,
        })
      : undefined

  const listingKeys = listings
    .map((l) => (l.ListingKey ?? l.ListNumber ?? '').toString().trim())
    .filter(Boolean)
  const engagementMap = listingKeys.length > 0
    ? await getEngagementCountsBatch(listingKeys)
    : ({} as Record<string, { view_count: number; like_count: number; save_count: number; share_count: number }>)
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

  const prices = listings
    .map((l) => l.ListPrice)
    .filter((p): p is number => p != null && Number.isFinite(p) && p > 0)
  const priceRangeMin = prices.length > 0 ? Math.min(...prices) : null
  const priceRangeMax = prices.length > 0 ? Math.max(...prices) : null

  const domValues = listings
    .map((l) => {
      const onMarket = (l as { OnMarketDate?: string | null }).OnMarketDate
      if (!onMarket) return null
      const d = new Date(onMarket)
      if (Number.isNaN(d.getTime())) return null
      const days = Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000))
      return days >= 0 ? days : null
    })
    .filter((n): n is number => n != null)
  const avgDom = domValues.length > 0 ? Math.round(domValues.reduce((a, b) => a + b, 0) / domValues.length) : null

  const neighborhoodStats = {
    medianPrice: neighborhood.medianPrice,
    count: neighborhood.activeCount,
    avgDom,
    closedLast12Months: 0,
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

  const breadcrumbItems: { name: string; item: string }[] = [
    { name: 'Ryan Realty', item: siteUrl },
    { name: 'Cities', item: `${siteUrl}/cities` },
    { name: neighborhood.cityName, item: `${siteUrl}/cities/${citySlug}` },
    { name: neighborhood.name, item: `${siteUrl}/cities/${citySlug}/${neighborhoodSlug}` },
  ]

  return (
    <main className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Place',
            name: neighborhood.name,
            address: {
              addressLocality: neighborhood.cityName,
              addressRegion: 'OR',
              addressCountry: 'US',
            },
            ...(geo && {
              geo: {
                '@type': 'GeoCoordinates',
                latitude: geo.lat,
                longitude: geo.lng,
              },
            }),
            url: `${siteUrl}/cities/${citySlug}/${neighborhoodSlug}`,
          }),
        }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: breadcrumbItems.map((item, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: item.name,
              item: item.item,
            })),
          }),
        }}
      />

      <NeighborhoodPageTracker
        neighborhoodName={neighborhood.name}
        cityName={neighborhood.cityName}
        citySlug={citySlug}
        neighborhoodSlug={neighborhoodSlug}
        listingCount={neighborhood.activeCount}
        medianPrice={neighborhood.medianPrice}
      />

      <NeighborhoodHero
        name={neighborhood.name}
        cityName={neighborhood.cityName}
        citySlug={citySlug}
        heroImageUrl={heroImageUrl}
        activeCount={neighborhood.activeCount}
        medianPrice={neighborhood.medianPrice}
        avgDom={avgDom}
        actions={
          <NeighborhoodPageActionBar
            neighborhoodName={neighborhood.name}
            cityName={neighborhood.cityName}
            shareUrl={`${siteUrl}/cities/${citySlug}/${neighborhoodSlug}`}
            variant="overlay"
          />
        }
      />

      <BreadcrumbStrip
        items={[
          { label: 'Home', href: '/' },
          { label: 'Cities', href: '/cities' },
          { label: neighborhood.cityName, href: `${siteUrl}/cities/${citySlug}` },
          { label: neighborhood.name },
        ]}
      />

      <NeighborhoodOverview
        neighborhoodName={neighborhood.name}
        cityName={neighborhood.cityName}
        citySlug={citySlug}
        description={neighborhood.description}
        dataDrivenParagraphs={dataDrivenParagraphs}
        activeCount={neighborhood.activeCount}
        medianPrice={neighborhood.medianPrice}
        priceRangeMin={priceRangeMin}
        priceRangeMax={priceRangeMax}
      />

      {placeContent && (
        <PlaceContentSection
          content={placeContent}
          placeName={neighborhood.name}
        />
      )}

      <NeighborhoodMarketStats
        neighborhoodName={neighborhood.name}
        cityName={neighborhood.cityName}
        citySlug={citySlug}
        stats={neighborhoodStats}
        priceHistory={[]}
      />

      <GeoSectionLatestActivity
        title="Latest activity"
        items={activityFeed}
        signedIn={!!session?.user}
        savedKeys={session?.user ? savedKeys : []}
        likedKeys={session?.user ? likedKeys : []}
      />

      <GeoSectionFeaturedListings
        title="Featured homes"
        listings={featuredListings}
        viewAllHref={homesForSalePath(neighborhood.cityName)}
        viewAllLabel="View all"
        savedKeys={session?.user ? savedKeys : []}
        likedKeys={session?.user ? likedKeys : []}
        signedIn={!!session?.user}
        userEmail={session?.user?.email ?? null}
        engagementMap={engagementMap}
      />

      <ListingsSlider
        title="Homes for sale in this neighborhood"
        listings={listings}
        savedKeys={session?.user ? savedKeys : []}
        likedKeys={session?.user ? likedKeys : []}
        signedIn={!!session?.user}
        userEmail={session?.user?.email ?? null}
        placeName={neighborhood.name}
        engagementMap={engagementMap}
      />

      <GeoSectionNewestListings
        title="Newest listings"
        listings={listings}
        viewAllHref={homesForSalePath(neighborhood.cityName)}
        viewAllLabel="View all"
        savedKeys={session?.user ? savedKeys : []}
        likedKeys={session?.user ? likedKeys : []}
        signedIn={!!session?.user}
        userEmail={session?.user?.email ?? null}
        engagementMap={engagementMap}
      />

      <CommunitiesSlider
        title="Popular communities"
        communities={communitiesInNeighborhood}
        viewAllHref={`/cities/${citySlug}`}
        viewAllLabel="View all communities"
        signedIn={!!session?.user}
        savedEntityKeys={savedCommunityKeys}
        likedEntityKeys={likedCommunityKeys}
      />

      <GeoCTAWithBroker
        heading={`Looking for a Home in ${neighborhood.name}?`}
        supportingText={`Save your search to get alerts when new homes in ${neighborhood.name} hit the market.`}
        primaryCta={{ label: 'Browse homes for sale', href: homesForSalePath(neighborhood.cityName) }}
        secondaryCta={{ label: 'Get notified of new listings', href: '/account/saved-searches' }}
        brokers={brokers}
      />

      <NeighborhoodMap listings={listings} neighborhoodName={neighborhood.name} />
    </main>
  )
}
