import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getListingDetailData, getSimilarListingsForDetailPage } from '@/app/actions/listing-detail'
import { getBrokerageSettings } from '@/app/actions/brokerage'
import { getCanonicalSiteUrl, listingShareSummary, listingShareText, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT } from '@/lib/share-metadata'
import { isListingSaved } from '@/app/actions/saved-listings'
import { isListingLiked } from '@/app/actions/likes'
import ListingDetailHero from '@/components/listing/ListingDetailHero'
import ListingHeader from '@/components/listing/ListingHeader'
import ListingActions from '@/components/listing/ListingActions'
import ListingTracker from '@/components/listing/ListingTracker'
import OpenHouseBanner from '@/components/listing/OpenHouseBanner'
import ListingDescription from '@/components/listing/ListingDescription'
import PropertyDetails from '@/components/listing/PropertyDetails'
import LeadPaintNotice from '@/components/listing/LeadPaintNotice'
import PaymentCalculator from '@/components/listing/PaymentCalculator'
import PriceHistory from '@/components/listing/PriceHistory'
import AgentCard from '@/components/listing/AgentCard'
import ListingMap from '@/components/listing/ListingMap'
import SimilarListings from '@/components/listing/SimilarListings'
import ListingVideos from '@/components/listing/ListingVideos'
import ListingSummary from '@/components/listing/ListingSummary'

type PageProps = { params: Promise<{ listingKey: string }> }

function formatPrice(n: number | null | undefined): string {
  if (n == null) return ''
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

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

  const { listing, property } = data
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
  const canonical = `${base}/listing/${encodeURIComponent(listingKey)}`
  const ogImage = `${base}/api/og?type=listing&id=${encodeURIComponent(listingKey)}`

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
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  }
}

export default async function ListingDetailPage({ params }: PageProps) {
  const { listingKey } = await params
  const data = await getListingDetailData(listingKey)
  if (!data) notFound()

  const { listing, property, photos, agents, priceHistory, engagement, openHouses, community, videos, virtualTours } = data
  const [saved, liked, similarListings, brokerage] = await Promise.all([
    isListingSaved(listingKey),
    isListingLiked(listingKey),
    getSimilarListingsForDetailPage(
      listing.listing_key,
      community?.name ?? listing.subdivision_name ?? null,
      property?.city ?? null,
      listing.list_price ?? null,
      listing.beds_total ?? null
    ),
    getBrokerageSettings(),
  ])
  const address = buildFullAddress(data)
  const listingAgent = agents[0] ?? null
  const listOfficeName = listingAgent?.office_name?.trim() ?? ''
  const brokerageName = brokerage?.name?.trim() ?? ''
  const isOurBroker =
    listOfficeName.length > 0 &&
    brokerageName.length > 0 &&
    listOfficeName.toLowerCase() === brokerageName.toLowerCase()

  // Hero uses only a direct-play video (mp4/webm/etc.). Virtual tours are never used as hero — they open in a new tab.
  const directVideoExt = /\.(mp4|webm|ogg|mov)(\?|$)/i
  const heroVideoUrl =
    videos.length > 0 && videos[0]?.Uri && directVideoExt.test(videos[0].Uri) ? videos[0].Uri : null

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
        city={property?.city ?? undefined}
        beds={listing.beds_total ?? undefined}
        baths={listing.baths_full ?? listing.baths_total_integer ?? undefined}
      />
      <div className="bg-muted min-h-screen">
        <ListingDetailHero
          photos={photos}
          virtualTourUrl={listing.virtual_tour_url ?? undefined}
          listingKey={listing.listing_key}
          heroVideoUrl={heroVideoUrl}
        />
        <OpenHouseBanner openHouses={openHouses} listingKey={listing.listing_key} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <ListingHeader
            listing={listing}
            address={address}
            city={property?.city ?? undefined}
            state={property?.state ?? undefined}
            postalCode={property?.postal_code ?? undefined}
            community={community}
            mlsNumber={listing.listing_id ?? listing.listing_key}
          />
          <ListingActions
            listingKey={listing.listing_key}
            address={address}
            price={listing.list_price ?? undefined}
            isSaved={saved}
            isLiked={liked}
            mlsNumber={listing.listing_id ?? listing.listing_key}
            city={property?.city}
            beds={listing.beds_total ?? undefined}
            baths={listing.baths_full ?? listing.baths_total_integer ?? undefined}
            shareUrl={`${getCanonicalSiteUrl()}/listing/${encodeURIComponent(listing.listing_key)}`}
            shareTitle={[address, listing.list_price != null ? `$${Number(listing.list_price).toLocaleString()}` : ''].filter(Boolean).join(' | ')}
            shareText={listingShareText({
              price: listing.list_price,
              beds: listing.beds_total,
              baths: listing.baths_full ?? listing.baths_total_integer,
              sqft: listing.living_area,
              address: address || undefined,
              city: property?.city ?? undefined,
              publicRemarks: listing.public_remarks ?? undefined,
            })}
          />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <ListingSummary
                lastSyncedAt={listing.updated_at ?? null}
                daysOnMarket={listing.days_on_market ?? listing.cumulative_days_on_market ?? null}
                viewCount={engagement?.view_count ?? 0}
                saveCount={engagement?.save_count ?? 0}
                likeCount={engagement?.like_count ?? 0}
              />
              <ListingDescription
                publicRemarks={listing.public_remarks ?? undefined}
                directions={listing.directions ?? undefined}
              />
              <PropertyDetails listing={listing} community={community} />
              <LeadPaintNotice yearBuilt={listing.year_built ?? null} />
              <ListingVideos videos={videos} virtualTours={virtualTours} />
              <PaymentCalculator
                listPrice={listing.list_price ?? 0}
                taxAmount={listing.tax_amount ?? undefined}
                associationFee={listing.association_yn ? listing.association_fee ?? undefined : undefined}
              />
              <PriceHistory priceHistory={priceHistory} />
            </div>
            <div className="lg:col-span-1 space-y-8">
              <AgentCard
                agent={listingAgent}
                address={address}
                listingKey={listing.listing_key}
                showContactInfo={isOurBroker}
              />
              <ListingMap
                latitude={property?.latitude ?? undefined}
                longitude={property?.longitude ?? undefined}
                price={listing.list_price ?? undefined}
                address={address}
              />
            </div>
          </div>
          <div className="mt-12">
            <SimilarListings listingKey={listing.listing_key} listings={similarListings} />
          </div>
        </div>
      </div>
    </>
  )
}
