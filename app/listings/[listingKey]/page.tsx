import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getListingDetailData, getSimilarListingsForDetailPage } from '@/app/actions/listing-detail'
// getBrokerageSettings removed — CTAs always route to site owner, never listing agent
import { getCanonicalSiteUrl, listingShareSummary, listingShareText, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT } from '@/lib/share-metadata'
import { listingDetailPath, slugify } from '@/lib/slug'
import { isListingSaved } from '@/app/actions/saved-listings'
import { isListingLiked } from '@/app/actions/likes'
import { getEngagementForListingDetail } from '@/app/actions/engagement'
import { getSession } from '@/app/actions/auth'
import { getSavedListingKeys } from '@/app/actions/saved-listings'
import { getLikedListingKeys } from '@/app/actions/likes'
import { getActivityFeed } from '@/app/actions/activity-feed'
import { getRecentlySold } from '@/app/actions/recently-sold'
import { getCachedStats, getLiveMarketPulse } from '@/app/actions/market-stats'
import ListingTracker from '@/components/listing/ListingTracker'
import ShowcaseHero from '@/components/listing/showcase/ShowcaseHero'
import ShowcaseStickyBar from '@/components/listing/showcase/ShowcaseStickyBar'
import ShowcaseKeyFacts from '@/components/listing/showcase/ShowcaseKeyFacts'
import DemandIndicators from '@/components/listing/DemandIndicators'
import ShowcaseOpenHouse from '@/components/listing/showcase/ShowcaseOpenHouse'
import ShowcaseDescription from '@/components/listing/showcase/ShowcaseDescription'
import ShowcasePropertyDetails from '@/components/listing/showcase/ShowcasePropertyDetails'
import ShowcasePayment from '@/components/listing/showcase/ShowcasePayment'
import PriceHistoryChart from '@/components/listing/PriceHistoryChart'
import ShowcaseAgent from '@/components/listing/showcase/ShowcaseAgent'
import ShowcaseMap from '@/components/listing/showcase/ShowcaseMap'
import ShowcaseVideos from '@/components/listing/showcase/ShowcaseVideos'
import ShowcaseSimilar from '@/components/listing/showcase/ShowcaseSimilar'
import AreaMarketContext from '@/components/listing/AreaMarketContext'
import VacationRentalPotentialCard from '@/components/listing/VacationRentalPotentialCard'
import ActivityFeedSlider from '@/components/ActivityFeedSlider'
import RecentlySoldRow from '@/components/RecentlySoldRow'
import AdUnit from '@/components/AdUnit'
import { getVacationRentalPotential } from '@/lib/vacation-rental-potential'

type PageProps = { params: Promise<{ listingKey: string }> }

function buildFullAddress(data: Awaited<ReturnType<typeof getListingDetailData>>): string {
  if (!data?.property) return ''
  const p = data.property
  const parts = [p.street_number, p.street_name].filter(Boolean).join(' ')
  if (parts) return [parts, p.city, p.state, p.postal_code].filter(Boolean).join(', ')
  return p.unparsed_address || ''
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { listingKey } = await params
  const data = await getListingDetailData(listingKey)
  if (!data) return { title: 'Listing Not Found | Ryan Realty' }

  const { listing, property, videos } = data
  const address = buildFullAddress(data)
  const beds = listing.beds_total ?? 0
  const baths = listing.baths_full ?? listing.baths_total_integer ?? 0
  const sqft = listing.living_area != null ? Math.round(Number(listing.living_area)) : null
  const title = `${beds}bd ${baths}ba ${sqft != null ? `${sqft}sqft` : ''} | ${address || 'Property'} | Ryan Realty`
  const description = listingShareSummary({
    price: listing.list_price,
    beds: listing.beds_total,
    baths: listing.baths_full ?? listing.baths_total_integer,
    sqft: listing.living_area,
    address: address || undefined,
    city: address ? undefined : (property?.city ?? undefined),
  })
  const base = getCanonicalSiteUrl()
  const canonicalPath = listingDetailPath(
    listing.listing_key,
    {
      streetNumber: property?.street_number ?? null,
      streetName: property?.street_name ?? null,
      city: property?.city ?? null,
      state: property?.state ?? null,
      postalCode: property?.postal_code ?? null,
    },
    {
      city: property?.city ?? null,
      neighborhood: data.community?.neighborhood_name ?? null,
      subdivision: listing.subdivision_name ?? null,
    },
    { mlsNumber: listing.list_number ?? listing.listing_id ?? null }
  )
  const canonical = `${base}${canonicalPath}`
  const ogImage = `${base}/api/og?type=listing&id=${encodeURIComponent(listingKey)}`
  const shareVideo =
    videos.length > 0 && videos[0]?.Uri && directVideoExt.test(videos[0].Uri) ? videos[0].Uri : null

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
      images: [{ url: ogImage, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt: address || title }],
      ...(shareVideo ? { videos: [shareVideo] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  }
}

const directVideoExt = /\.(mp4|webm|ogg|mov)(\?|$)/i

export default async function ListingDetailPage({ params }: PageProps) {
  const { listingKey } = await params
  const data = await getListingDetailData(listingKey)
  if (!data) notFound()

  const { listing, property, photos, agents, priceHistory, openHouses, community, videos, virtualTours } = data
  const [saved, liked, similarListings, engagement, session] = await Promise.all([
    isListingSaved(listingKey),
    isListingLiked(listingKey),
    getSimilarListingsForDetailPage(
      listing.listing_key,
      community?.name ?? listing.subdivision_name ?? null,
      property?.city ?? null,
      listing.list_price ?? null,
      listing.beds_total ?? null
    ),
    getEngagementForListingDetail(listing.listing_key),
    getSession(),
  ])

  const address = buildFullAddress(data)
  const city = property?.city ?? null
  const listingAgent = agents[0] ?? null

  const heroVideoUrl =
    videos.length > 0 && videos[0]?.Uri && directVideoExt.test(videos[0].Uri) ? videos[0].Uri : null

  const shareUrl = `${getCanonicalSiteUrl()}${listingDetailPath(
    listing.listing_key,
    {
      streetNumber: property?.street_number ?? null,
      streetName: property?.street_name ?? null,
      city: property?.city ?? null,
      state: property?.state ?? null,
      postalCode: property?.postal_code ?? null,
    },
    {
      city: property?.city ?? null,
      neighborhood: community?.neighborhood_name ?? null,
      subdivision: listing.subdivision_name ?? null,
    },
    { mlsNumber: listing.list_number ?? listing.listing_id ?? null }
  )}`
  const shareTitle = [address, listing.list_price != null ? `$${Number(listing.list_price).toLocaleString()}` : ''].filter(Boolean).join(' | ')
  const shareText = listingShareText({
    price: listing.list_price,
    beds: listing.beds_total,
    baths: listing.baths_full ?? listing.baths_total_integer,
    sqft: listing.living_area,
    address: address || undefined,
    city: property?.city ?? undefined,
    publicRemarks: listing.public_remarks ?? undefined,
  })

  const citySlug = city ? slugify(city) : ''
  const [areaStats, marketPulse, nearbyActivity, nearbySold, nearbySavedKeys, nearbyLikedKeys] = await Promise.all([
    citySlug ? getCachedStats({ geoType: 'city', geoSlug: citySlug }) : Promise.resolve(null),
    citySlug ? getLiveMarketPulse({ geoType: 'city', geoSlug: citySlug }) : Promise.resolve(null),
    getActivityFeed({
      city: city ?? undefined,
      subdivision: community?.name ?? listing.subdivision_name ?? undefined,
      limit: 12,
      eventTypes: ['new_listing', 'price_drop', 'status_pending', 'status_closed', 'status_expired', 'back_on_market'],
    }),
    getRecentlySold({
      city: city ?? undefined,
      subdivision: community?.name ?? listing.subdivision_name ?? undefined,
      limit: 12,
    }),
    session?.user ? getSavedListingKeys() : Promise.resolve([]),
    session?.user ? getLikedListingKeys() : Promise.resolve([]),
  ])
  const rentalPotential = await getVacationRentalPotential({
    city: property?.city ?? null,
    state: property?.state ?? null,
    beds: listing.beds_total ?? null,
    baths: listing.baths_full ?? listing.baths_total_integer ?? null,
    listPrice: listing.list_price ?? null,
    medianListPrice: marketPulse?.median_list_price ?? null,
    associationYn: listing.association_yn ?? null,
  })

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SingleFamilyResidence',
    name: address || listing.subdivision_name || 'Property',
    description: (listing.public_remarks ?? '').slice(0, 300),
    address: {
      '@type': 'PostalAddress',
      streetAddress: [property?.street_number, property?.street_name].filter(Boolean).join(' '),
      addressLocality: property?.city ?? undefined,
      addressRegion: property?.state ?? undefined,
      postalCode: property?.postal_code ?? undefined,
    },
    numberOfRooms: listing.beds_total ?? undefined,
    numberOfBathroomsTotal: (listing.baths_full ?? listing.baths_total_integer) ?? undefined,
    floorSize: listing.living_area != null ? { '@type': 'QuantitativeValue', value: listing.living_area, unitCode: 'FTK' } : undefined,
    ...(listing.list_price != null && { offers: { '@type': 'Offer', price: listing.list_price, priceCurrency: 'USD' } }),
    ...(property?.latitude != null && property?.longitude != null && {
      geo: { '@type': 'GeoCoordinates', latitude: property.latitude, longitude: property.longitude },
    }),
    ...(photos.length > 0 && { image: photos.slice(0, 5).map((p) => p.cdn_url ?? p.photo_url) }),
    ...(listingAgent && {
      listingAgent: {
        '@type': 'RealEstateAgent',
        name: listingAgent.agent_name ?? undefined,
        email: listingAgent.agent_email ?? undefined,
      },
    }),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ListingTracker
        listingKey={listing.listing_key}
        listingId={listing.listing_key}
        price={listing.list_price ?? undefined}
        community={community?.name ?? listing.subdivision_name ?? undefined}
        city={city ?? undefined}
        beds={listing.beds_total ?? undefined}
        baths={listing.baths_full ?? listing.baths_total_integer ?? undefined}
      />
      <div className="min-h-screen bg-background">
        <ShowcaseHero
          listingKey={listing.listing_key}
          heroVideoUrl={heroVideoUrl}
          photos={photos}
        />
        <ShowcaseStickyBar
          listingKey={listing.listing_key}
          address={address}
          city={city}
          price={listing.list_price ?? null}
          beds={listing.beds_total ?? null}
          baths={listing.baths_full ?? listing.baths_total_integer ?? null}
          sqft={listing.living_area != null ? Number(listing.living_area) : null}
          saved={saved}
          liked={liked}
          shareUrl={shareUrl}
          shareTitle={shareTitle}
          shareText={shareText}
          viewCount={engagement.view_count}
          likeCount={engagement.like_count}
          saveCount={engagement.save_count}
          shareCount={engagement.share_count}
        />
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <ShowcaseOpenHouse listingKey={listing.listing_key} openHouses={openHouses} />
          <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="space-y-8 lg:col-span-2">
              <ShowcaseKeyFacts
                beds={listing.beds_total ?? null}
                baths={listing.baths_full ?? listing.baths_total_integer ?? null}
                sqft={listing.living_area != null ? Number(listing.living_area) : null}
                lotAcres={listing.lot_size_acres ?? null}
                lotSqft={listing.lot_size_sqft ?? null}
                propertyType={listing.property_type ?? listing.property_sub_type ?? null}
                yearBuilt={listing.year_built ?? null}
                price={listing.list_price ?? null}
                daysOnMarket={listing.days_on_market ?? listing.cumulative_days_on_market ?? null}
                mlsNumber={listing.list_number ?? listing.listing_id ?? listing.listing_key}
              />
              <DemandIndicators
                listingKey={listing.listing_key}
                viewCount={engagement.view_count}
                saveCount={engagement.save_count}
                likeCount={engagement.like_count}
                daysOnMarket={listing.days_on_market ?? listing.cumulative_days_on_market ?? null}
              />
              <ShowcaseDescription
                publicRemarks={listing.public_remarks ?? null}
                directions={listing.directions ?? null}
              />
              <AdUnit slot="1001002001" format="horizontal" />
              <ShowcasePropertyDetails
                listing={listing}
                communityName={community?.name ?? listing.subdivision_name ?? null}
              />
              <AdUnit slot="1001002002" format="horizontal" />
              <ShowcaseVideos
                listingKey={listing.listing_key}
                videos={videos}
                virtualTours={virtualTours}
                heroVideoUrl={heroVideoUrl}
              />
              <ShowcasePayment
                listPrice={listing.list_price ?? 0}
                taxAmount={listing.tax_amount ?? undefined}
                associationFee={listing.association_yn ? listing.association_fee ?? undefined : undefined}
                associationYn={listing.association_yn ?? null}
              />
              <VacationRentalPotentialCard potential={rentalPotential} />
              <PriceHistoryChart priceHistory={priceHistory} />
            </div>
            <div className="space-y-8 lg:col-span-1">
              <ShowcaseAgent
                listingKey={listing.listing_key}
                address={address}
                agent={listingAgent}
                showContactInfo={false}
                shareUrl={shareUrl}
              />
              <AdUnit slot="1001002004" format="vertical" />
              <ShowcaseMap
                latitude={property?.latitude ?? undefined}
                longitude={property?.longitude ?? undefined}
                price={listing.list_price ?? undefined}
                address={address}
              />
            </div>
          </div>
          <div className="mt-8">
            <AreaMarketContext
              cityName={city}
              listingPrice={listing.list_price ?? null}
              listingSqft={listing.living_area != null ? Number(listing.living_area) : null}
              medianAreaPrice={areaStats?.median_sale_price ?? null}
              medianAreaPpsf={areaStats?.median_ppsf ?? null}
              avgSaleToListRatio={areaStats?.avg_sale_to_list_ratio ?? null}
              activeInventory={marketPulse?.active_count ?? null}
            />
          </div>
          <div className="mt-8">
            <AdUnit slot="1001002003" format="horizontal" />
          </div>
          <ShowcaseSimilar listingKey={listing.listing_key} listings={similarListings} />
          <div className="mt-8">
            <ActivityFeedSlider
              title="What is happening nearby"
              items={nearbyActivity}
              signedIn={!!session?.user}
              savedKeys={nearbySavedKeys}
              likedKeys={nearbyLikedKeys}
            />
          </div>
          <div className="mt-8">
            <RecentlySoldRow title="Recently sold nearby" listings={nearbySold} />
          </div>
        </div>
      </div>
    </>
  )
}
