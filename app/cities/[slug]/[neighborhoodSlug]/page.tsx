import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  getNeighborhoodBySlug,
  getNeighborhoodListings,
  getNeighborhoodPendingListings,
  getNeighborhoodPriceHistory,
  getNeighborhoodSoldListings,
  getCommunitiesInNeighborhood,
} from '@/app/actions/cities'
import { getActivityFeedByCityCached } from '@/app/actions/activity-feed'
import { getEngagementCountsBatchCached } from '@/app/actions/engagement'
import { getActiveBrokers } from '@/app/actions/brokers'
import { shareDescription, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT } from '@/lib/share-metadata'
import { homesForSalePath } from '@/lib/slug'
import { buildDataDrivenNeighborhoodAbout } from '@/lib/city-content'
import NeighborhoodHero from '@/components/neighborhood/NeighborhoodHero'
import NeighborhoodOverview from '@/components/neighborhood/NeighborhoodOverview'
import NeighborhoodMarketStats from '@/components/neighborhood/NeighborhoodMarketStats'
import NeighborhoodMap from '@/components/neighborhood/NeighborhoodMap'
import NeighborhoodPageTracker from '@/components/neighborhood/NeighborhoodPageTracker'
import BreadcrumbStrip from '@/components/layout/BreadcrumbStrip'
import NeighborhoodPageActionBar from '@/components/geo-page/NeighborhoodPageActionBar'
import ListingsSlider from '@/components/geo-page/ListingsSlider'
import GeoCTAWithBroker from '@/components/geo-page/GeoCTAWithBroker'
import GeoSectionNewestListings from '@/components/geo-page/GeoSectionNewestListings'
import CommunitiesSlider from '@/components/sliders/CommunitiesSlider'
import GeoSectionFeaturedListings from '@/components/geo-page/GeoSectionFeaturedListings'
import GeoSectionLatestActivity from '@/components/geo-page/GeoSectionLatestActivity'
import RecentlySoldRow from '@/components/RecentlySoldRow'
import { getNeighborhoodInventoryBreakdown, type InventoryBreakdown } from '@/app/actions/inventory-breakdown'
import InventoryTypeSlider from '@/components/geo-page/InventoryTypeSlider'
import VideoToursRow from '@/components/videos/VideoToursRow'
import { getListingsWithVideosCached } from '@/app/actions/videos'
import { getHomeTileRowsByKeys } from '@/app/actions/listings'
import type { YearSeriesPoint } from '@/lib/report-year-compare'

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

async function withTimeout<T>(promise: Promise<T>, fallback: T, timeoutMs = 2500): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ])
}

const EMPTY_INVENTORY: InventoryBreakdown = {
  singleFamily: 0,
  condoTownhome: 0,
  manufacturedMobile: 0,
  landLot: 0,
}

export default async function NeighborhoodDetailPage({ params }: Props) {
  const { slug: citySlug, neighborhoodSlug } = await params
  const neighborhood = await getNeighborhoodBySlug(citySlug, neighborhoodSlug)
  if (!neighborhood) notFound()
  const [listings, pendingListings, soldListings, neighborhoodPriceHistory, savedKeys, likedKeys, communitiesInNeighborhood, activityFeedRaw, brokers, savedCommunityKeys, likedCommunityKeys, inventoryBreakdown, cityVideoRows] = await Promise.all([
    withTimeout(getNeighborhoodListings(neighborhood.id, 24), []),
    withTimeout(getNeighborhoodPendingListings(neighborhood.id, 12), []),
    withTimeout(getNeighborhoodSoldListings(neighborhood.id, 6), []),
    withTimeout(getNeighborhoodPriceHistory(neighborhood.id), []),
    Promise.resolve([] as string[]),
    Promise.resolve([] as string[]),
    withTimeout(getCommunitiesInNeighborhood(neighborhood.id, neighborhood.cityName), []),
    withTimeout(getActivityFeedByCityCached(neighborhood.cityName, null, 24), []),
    withTimeout(getActiveBrokers(), []),
    Promise.resolve([] as string[]),
    Promise.resolve([] as string[]),
    withTimeout(getNeighborhoodInventoryBreakdown(neighborhood.id), EMPTY_INVENTORY),
    withTimeout(getListingsWithVideosCached({ city: neighborhood.cityName, sort: 'price_desc', status: 'active', limit: 20 }), []),
  ])

  const heroImageUrl = neighborhood.heroImageUrl ?? null

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
    ? await getEngagementCountsBatchCached(listingKeys)
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
  const neighborhoodListingKeys = new Set(
    listings
      .map((item) => (item.ListingKey ?? item.ListNumber ?? '').toString().trim())
      .filter((key) => key.length > 0)
  )
  const activityFeed = activityFeedRaw.filter((item) => neighborhoodListingKeys.has(item.listing_key))
  const neighborhoodVideoRows = cityVideoRows.filter((row) => neighborhoodListingKeys.has(row.listing_key))
  const neighborhoodVideoKeys = neighborhoodVideoRows.map((row) => row.listing_key).filter((key) => key.trim().length > 0)
  const neighborhoodVideoListingRows = neighborhoodVideoKeys.length > 0 ? await getHomeTileRowsByKeys(neighborhoodVideoKeys) : []
  const neighborhoodVideoByKey = new Map(neighborhoodVideoRows.map((row) => [row.listing_key, row.video_url]))
  const listingsWithVideo = neighborhoodVideoListingRows.map((row) => {
    const listingKey = (row.ListingKey ?? '').toString().trim()
    const listNumber = (row.ListNumber ?? '').toString().trim()
    const videoUrl = neighborhoodVideoByKey.get(listingKey) ?? neighborhoodVideoByKey.get(listNumber)
    if (!videoUrl) return row
    return {
      ...row,
      details: { Videos: [{ Uri: videoUrl }] },
      has_virtual_tour: true,
    }
  })

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

  const breadcrumbItems: { name: string; item: string }[] = [
    { name: 'Home', item: siteUrl },
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

      <NeighborhoodMarketStats
        neighborhoodName={neighborhood.name}
        cityName={neighborhood.cityName}
        citySlug={citySlug}
        stats={neighborhoodStats}
        priceHistory={neighborhoodPriceHistory}
        salesHistory={neighborhoodPriceHistory.map((point): YearSeriesPoint => ({
          period_start: `${point.month}-01`,
          sold_count: Number(point.soldCount ?? 0),
          median_price: point.medianPrice,
        }))}
      />

      <BreadcrumbStrip
        items={[
          { label: 'Home', href: '/' },
          { label: 'Cities', href: '/cities' },
          { label: neighborhood.cityName, href: `/cities/${citySlug}` },
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

      <InventoryTypeSlider placeLabel={neighborhood.name} breakdown={inventoryBreakdown} />

      <GeoSectionLatestActivity
        title={`What is happening in ${neighborhood.name}`}
        items={activityFeed}
        signedIn={false}
        savedKeys={savedKeys}
        likedKeys={likedKeys}
      />

      <CommunitiesSlider
        title="Popular communities"
        communities={communitiesInNeighborhood.slice(0, 12)}
        viewAllHref={`/cities/${citySlug}`}
        viewAllLabel="View all communities"
        signedIn={false}
        savedEntityKeys={savedCommunityKeys}
        likedEntityKeys={likedCommunityKeys}
      />

      <GeoSectionFeaturedListings
        title="Top popular active listings"
        listings={featuredListings}
        viewAllHref={homesForSalePath(neighborhood.cityName)}
        viewAllLabel="View all"
        savedKeys={savedKeys}
        likedKeys={likedKeys}
        signedIn={false}
        userEmail={null}
        engagementMap={engagementMap}
      />

      {pendingListings.length > 0 && (
        <ListingsSlider
          title={`Pending listings in ${neighborhood.name}`}
          listings={pendingListings}
          savedKeys={savedKeys}
          likedKeys={likedKeys}
          signedIn={false}
          userEmail={null}
          placeName={neighborhood.name}
          engagementMap={engagementMap}
        />
      )}

      <div className="mx-auto mt-8 max-w-7xl px-4 sm:px-6">
        <VideoToursRow
          title={`Video tours in ${neighborhood.name}`}
          listings={listingsWithVideo}
          signedIn={false}
          savedKeys={savedKeys}
          likedKeys={likedKeys}
          userEmail={null}
          engagementMap={engagementMap}
          viewAllHref={`/videos?city=${encodeURIComponent(neighborhood.cityName)}`}
        />
      </div>

      <div className="px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <RecentlySoldRow title={`Recently sold in ${neighborhood.name}`} listings={recentlySoldRows} />
        </div>
      </div>

      <ListingsSlider
        title="Homes for sale in this neighborhood"
        listings={listings}
        savedKeys={savedKeys}
        likedKeys={likedKeys}
        signedIn={false}
        userEmail={null}
        placeName={neighborhood.name}
        engagementMap={engagementMap}
      />

      <GeoSectionNewestListings
        title="Newest listings"
        listings={listings}
        viewAllHref={homesForSalePath(neighborhood.cityName)}
        viewAllLabel="View all"
        savedKeys={savedKeys}
        likedKeys={likedKeys}
        signedIn={false}
        userEmail={null}
        engagementMap={engagementMap}
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
