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
import { getEngagementCountsBatch } from '@/app/actions/engagement'
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
import { slugify } from '@/lib/slug'
import { getResortCommunityContent, buildDataDrivenCommunityAbout } from '@/lib/community-content'
import { getLiveMarketPulse } from '@/app/actions/market-stats'
import { getOpenHousesWithListings } from '@/app/actions/open-houses'
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
  const communityPulse = await getLiveMarketPulse({
    geoType: 'subdivision',
    geoSlug: `${slugify(community.city)}-${slugify(community.subdivision)}`,
  })
  const communityOpenHouses = await getOpenHousesWithListings({
    city: community.city,
    community: [community.subdivision],
  })

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
  const listingKeys = listings
    .map((l) => (l.ListingKey ?? l.ListNumber ?? '').toString().trim())
    .filter(Boolean)
  const engagementMap = listingKeys.length > 0 ? await getEngagementCountsBatch(listingKeys) : {}
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            generateBreadcrumbSchema([
              { name: 'Home', url: siteUrl },
              { name: 'Cities', url: `${siteUrl}/cities` },
              { name: community.city, url: `${siteUrl}/cities/${citySlug}` },
              ...(community.neighborhoodName && community.neighborhoodSlug
                ? [{ name: community.neighborhoodName, url: `${siteUrl}${neighborhoodPagePath(citySlug, community.neighborhoodSlug)}` }]
                : []),
              { name: community.name, url: `${siteUrl}/communities/${slug}` },
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
                question: `How many homes are for sale in ${community.name}?`,
                answer: community.activeCount > 0
                  ? `There are currently ${community.activeCount} homes for sale in ${community.name}, ${community.city}.`
                  : `Inventory in ${community.name} changes frequently. Check back or contact Ryan Realty for the latest listings.`,
              },
              {
                question: `What is the median home price in ${community.name}?`,
                answer: community.medianPrice != null
                  ? `The current median home price in ${community.name} is $${community.medianPrice.toLocaleString()}.`
                  : `Contact Ryan Realty for current pricing in ${community.name}.`,
              },
            ])
          ),
        }}
      />

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
        city={community.city}
        subdivision={community.subdivision}
        slug={slug}
        stats={{
          medianPrice: community.medianPrice,
          count: community.activeCount,
          avgDom: community.avgDom,
          closedLast12Months: community.closedLast12Months,
        }}
        priceHistory={priceHistory}
      />

      {communityPulse && (
        <div className="mx-auto mt-8 max-w-7xl px-4 sm:px-6">
          <LivePulseBanner
            title={`${community.name} live market pulse`}
            activeCount={communityPulse.active_count}
            pendingCount={communityPulse.pending_count}
            newCount7d={communityPulse.new_count_7d}
            updatedAt={communityPulse.updated_at}
          />
        </div>
      )}

      <div className="mx-auto mt-8 max-w-7xl px-4 sm:px-6">
        <OpenHouseSection
          title={`Open houses in ${community.name} this week`}
          items={communityOpenHouses.slice(0, 10)}
          viewAllHref={`/open-houses/${citySlug}`}
        />
      </div>

      <div className="mx-auto mt-8 max-w-7xl px-4 sm:px-6">
        <VideoToursRow
          title={`Video tours in ${community.name}`}
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
          <RecentlySoldRow title={`Recently sold in ${community.name}`} listings={recentlySoldRows} />
        </div>
      </div>

      <GeoSectionFeaturedListings
        title="Featured homes"
        listings={featuredListings}
        viewAllHref={homesForSalePath(community.city, community.subdivision)}
        viewAllLabel="View all"
        savedKeys={session?.user ? savedKeys : []}
        likedKeys={session?.user ? likedKeys : []}
        signedIn={!!session?.user}
        userEmail={session?.user?.email ?? null}
        engagementMap={engagementMap}
      />

      <ListingsSlider
        title="Homes for sale in this community"
        listings={listings}
        savedKeys={session?.user ? savedKeys : []}
        likedKeys={session?.user ? likedKeys : []}
        signedIn={!!session?.user}
        userEmail={session?.user?.email ?? null}
        placeName={community.name}
        engagementMap={engagementMap}
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
        engagementMap={engagementMap}
      />

      <CommunitiesSlider
        title="Popular communities"
        communities={communitiesInCity}
        viewAllHref={`/cities/${citySlug}`}
        viewAllLabel="View all communities"
        excludeSlug={slug}
        signedIn={!!session?.user}
        savedEntityKeys={savedCommunityKeys}
        likedEntityKeys={likedCommunityKeys}
      />

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
