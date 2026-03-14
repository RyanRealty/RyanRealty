import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  getCommunityBySlug,
  getCommunityListings,
  getCommunitySoldListings,
  getCommunityPriceHistory,
  getCommunityMarketStats,
} from '@/app/actions/communities'
import { getCommunitiesInCity } from '@/app/actions/cities'
import { getActivityFeed } from '@/app/actions/activity-feed'
import { getActiveBrokers } from '@/app/actions/brokers'
import { isCommunitySaved, getSavedCommunityKeys } from '@/app/actions/saved-communities'
import { isCommunityLiked, getLikedCommunityKeys } from '@/app/actions/community-engagement'
import { shareDescription, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT } from '@/lib/share-metadata'
import { getSession } from '@/app/actions/auth'
import { incrementCommunityView } from '@/app/actions/community-engagement'
import { getSavedListingKeys } from '@/app/actions/saved-listings'
import { trackPageViewIfPossible } from '@/lib/followupboss'
import { getFubPersonIdFromCookie } from '@/app/actions/fub-identity-bridge'
import { getLikedListingKeys } from '@/app/actions/likes'
import { getBuyingPreferences } from '@/app/actions/buying-preferences'
import { DEFAULT_DISPLAY_RATE, DEFAULT_DISPLAY_DOWN_PCT, DEFAULT_DISPLAY_TERM_YEARS } from '@/lib/mortgage'
import { homesForSalePath, neighborhoodPagePath } from '@/lib/slug'
import { getResortCommunityContent, buildDataDrivenCommunityAbout } from '@/lib/community-content'
import CommunityHero from '@/components/community/CommunityHero'
import CommunityOverview from '@/components/community/CommunityOverview'
import CommunityMarketStats from '@/components/community/CommunityMarketStats'
import CommunityPageTracker from '@/components/community/CommunityPageTracker'
import BreadcrumbStrip from '@/components/layout/BreadcrumbStrip'
import { fetchPlacePhoto } from '@/lib/photo-api'
import CommunityPageActionBar from '@/components/geo-page/CommunityPageActionBar'
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
  const community = await getCommunityBySlug(slug)
  if (!community) return { title: 'Community Not Found' }
  const title = `${community.name} Homes for Sale | ${community.city}, Oregon | Ryan Realty`
  const rawDesc = community.activeCount > 0
    ? `${community.activeCount} homes for sale in ${community.name}. Median price ${community.medianPrice != null ? `$${community.medianPrice.toLocaleString()}` : '—'}. Explore listings and market stats.`
    : `Explore ${community.name} in ${community.city}, Oregon. Community info and market overview.`
  const description = shareDescription(rawDesc)
  const canonical = `${siteUrl}/communities/${slug}`
  const ogImage = community.heroImageUrl
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
      ...(ogImage && { images: [{ url: ogImage, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt: `${community.name}, ${community.city} — Ryan Realty` }] }),
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export const revalidate = 60

export default async function CommunityDetailPage({ params }: Props) {
  const { slug } = await params
  const community = await getCommunityBySlug(slug)
  if (!community) notFound()

  await incrementCommunityView(community.entityKey).catch(() => {})

  const [session, fubPersonId] = await Promise.all([getSession(), getFubPersonIdFromCookie()])
  const pageUrl = `${siteUrl}/communities/${slug}`
  const pageTitle = `${community.name} Homes for Sale | ${community.city}, Oregon | Ryan Realty`
  trackPageViewIfPossible({ sessionUser: session?.user ?? undefined, fubPersonId, pageUrl, pageTitle })
  const citySlug = community.city.toLowerCase().replace(/\s+/g, '-')
  const [listings, soldListings, priceHistory, marketStats, savedKeys, likedKeys, prefs, communitiesInCity, activityFeed, brokers, communitySaved, communityLiked, savedCommunityKeys, likedCommunityKeys] =
    await Promise.all([
      getCommunityListings(community.city, community.subdivision, 24),
      getCommunitySoldListings(community.city, community.subdivision, 6),
      getCommunityPriceHistory(community.city, community.subdivision),
      getCommunityMarketStats(community.city, community.subdivision),
      session?.user ? getSavedListingKeys() : Promise.resolve([]),
      session?.user ? getLikedListingKeys() : Promise.resolve([]),
      session?.user ? getBuyingPreferences().catch(() => null) : Promise.resolve(null),
      getCommunitiesInCity(community.city),
      getActivityFeed({ city: community.city, subdivision: community.subdivision, limit: 24 }),
      getActiveBrokers(),
      session?.user ? isCommunitySaved(community.entityKey) : Promise.resolve(false),
      session?.user ? isCommunityLiked(community.entityKey) : Promise.resolve(false),
      session?.user ? getSavedCommunityKeys() : Promise.resolve([]),
      session?.user ? getLikedCommunityKeys() : Promise.resolve([]),
    ])

  const displayPrefs = prefs ?? {
    downPaymentPercent: DEFAULT_DISPLAY_DOWN_PCT,
    interestRate: DEFAULT_DISPLAY_RATE,
    loanTermYears: DEFAULT_DISPLAY_TERM_YEARS,
  }

  const prices = listings
    .map((l) => l.ListPrice)
    .filter((p): p is number => p != null && Number.isFinite(p) && p > 0)
  const minPrice = prices.length > 0 ? Math.min(...prices) : null
  const maxPrice = prices.length > 0 ? Math.max(...prices) : null
  const propertyTypes = Array.from(
    new Set(listings.map((l) => (l as { PropertyType?: string }).PropertyType).filter(Boolean))
  ) as string[]
  const lotSizes = listings
    .map((l) => (l as { LotSizeAcres?: number; LotSizeSqFt?: number }).LotSizeAcres ?? (l as { LotSizeSqFt?: number }).LotSizeSqFt)
    .filter((n): n is number => n != null && Number.isFinite(n) && n > 0)
  const avgLot = lotSizes.length > 0 ? lotSizes.reduce((a, b) => a + b, 0) / lotSizes.length : null
  const years = listings
    .map((l) => (l as { YearBuilt?: number }).YearBuilt)
    .filter((n): n is number => n != null && Number.isFinite(n) && n > 0)
  const yearRange = years.length > 0 ? { min: Math.min(...years), max: Math.max(...years) } : null
  const hasHoa = listings.some((l) => (l as { AssociationYN?: boolean }).AssociationYN === true)
  const hasWaterfront = listings.some((l) => (l as { WaterfrontYN?: boolean }).WaterfrontYN === true)

  const resortStaticContent = getResortCommunityContent(community.city, community.subdivision)
  const dataDrivenParagraphs =
    !resortStaticContent && (!community.description || community.description.trim().length < 180)
      ? buildDataDrivenCommunityAbout({
          communityName: community.name,
          city: community.city,
          isResort: community.isResort,
          activeCount: community.activeCount,
          medianPrice: community.medianPrice,
          minPrice: minPrice ?? null,
          maxPrice: maxPrice ?? null,
          propertyTypes,
          avgLotAcres: avgLot,
          yearBuiltMin: yearRange?.min ?? null,
          yearBuiltMax: yearRange?.max ?? null,
          hasHoa,
          hasWaterfront,
        })
      : undefined

  const centroid = (() => {
    const withCoords = listings.filter(
      (l) => l.Latitude != null && l.Longitude != null && Number.isFinite(Number(l.Latitude)) && Number.isFinite(Number(l.Longitude))
    )
    if (withCoords.length === 0) return null
    const lat = withCoords.reduce((a, l) => a + Number(l.Latitude), 0) / withCoords.length
    const lng = withCoords.reduce((a, l) => a + Number(l.Longitude), 0) / withCoords.length
    return { lat, lng }
  })()

  const placeSchema = {
    '@context': 'https://schema.org',
    '@type': 'Place' as const,
    name: community.name,
    address: { addressLocality: community.city, addressRegion: 'OR' },
    ...(centroid && {
      geo: {
        '@type': 'GeoCoordinates',
        latitude: centroid.lat,
        longitude: centroid.lng,
      },
    }),
    url: `${siteUrl}/communities/${slug}`,
  }
  const resortSchema = community.isResort
    ? {
        '@context': 'https://schema.org',
        '@type': 'Resort' as const,
        name: community.name,
        address: { addressLocality: community.city, addressRegion: 'OR' },
        ...(centroid && {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: centroid.lat,
            longitude: centroid.lng,
          },
        }),
        url: `${siteUrl}/communities/${slug}`,
      }
    : null

  return (
    <main className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(placeSchema) }}
      />
      {resortSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(resortSchema) }}
        />
      )}

      <CommunityPageTracker
        communityName={community.name}
        listingCount={community.activeCount}
        medianPrice={community.medianPrice}
      />

      <CommunityHero
        name={community.name}
        city={community.city}
        heroImageUrl={community.heroImageUrl}
        activeCount={community.activeCount}
        medianPrice={community.medianPrice}
        avgDom={community.avgDom}
        isResort={community.isResort}
        actions={
          <CommunityPageActionBar
            entityKey={community.entityKey}
            communityName={community.name}
            cityName={community.city}
            initialSaved={communitySaved}
            initialLiked={communityLiked}
            signedIn={!!session?.user}
            shareUrl={`${siteUrl}/communities/${slug}`}
            variant="overlay"
          />
        }
      />

      <BreadcrumbStrip
        items={[
          { label: 'Home', href: '/' },
          { label: 'Cities', href: '/cities' },
          { label: community.city, href: `/cities/${citySlug}` },
          ...(community.neighborhoodName && community.neighborhoodSlug
            ? [{ label: community.neighborhoodName, href: neighborhoodPagePath(citySlug, community.neighborhoodSlug) }]
            : []),
          { label: community.name },
        ]}
      />

      <ListingsSlider
        title="Homes for sale in this community"
        listings={listings}
        savedKeys={session?.user ? savedKeys : []}
        likedKeys={session?.user ? likedKeys : []}
        signedIn={!!session?.user}
        userEmail={session?.user?.email ?? null}
        placeName={community.name}
      />

      <CommunityOverview
        description={community.description}
        isResort={community.isResort}
        resortContent={community.resortContent}
        communityName={community.name}
        city={community.city}
        listings={listings}
        resortStaticContent={resortStaticContent}
        dataDrivenParagraphs={dataDrivenParagraphs}
      />

      <CommunityMarketStats
        communityName={community.name}
        slug={slug}
        stats={{
          medianPrice: community.medianPrice,
          count: community.activeCount,
          avgDom: community.avgDom,
          closedLast12Months: community.closedLast12Months,
        }}
        priceHistory={priceHistory}
      />

      <GeoSectionNewestListings
        title="Newest listings"
        listings={listings}
        viewAllHref={homesForSalePath(community.city, community.subdivision)}
        viewAllLabel="View all"
        savedKeys={session?.user ? savedKeys : []}
        likedKeys={session?.user ? likedKeys : []}
        signedIn={!!session?.user}
        userEmail={session?.user?.email ?? null}
      />

      <GeoSectionPopularCommunities
        title="Popular communities"
        communities={communitiesInCity}
        viewAllHref={`/cities/${citySlug}`}
        viewAllLabel="View all communities"
        excludeSlug={slug}
        signedIn={!!session?.user}
        savedEntityKeys={savedCommunityKeys}
        likedEntityKeys={likedCommunityKeys}
      />

      <GeoSectionFeaturedListings
        title="Featured listings"
        listings={listings.slice(6, 12)}
        viewAllHref={homesForSalePath(community.city, community.subdivision)}
        viewAllLabel="View all"
        savedKeys={session?.user ? savedKeys : []}
        likedKeys={session?.user ? likedKeys : []}
        signedIn={!!session?.user}
        userEmail={session?.user?.email ?? null}
      />

      <GeoSectionLatestActivity title="Latest activity" items={activityFeed} />

      <GeoCTAWithBroker
        heading={`Looking for a Home in ${community.name}?`}
        supportingText={`Save your search to get alerts when new homes in ${community.name} hit the market.`}
        primaryCta={{ label: 'Browse homes for sale', href: homesForSalePath(community.city, community.subdivision) }}
        secondaryCta={{ label: 'Get notified of new listings', href: '/account/saved-searches' }}
        brokers={brokers}
      />
    </main>
  )
}
