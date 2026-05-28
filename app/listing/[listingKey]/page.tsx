import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  getListingDetail,
  getListingDetailHistory,
  getListingPhotos,
  getListingVideos,
  getOpenHousesInRange,
  getBrokers,
  resolveListingAgent,
} from '@/lib/data'
import { getSimilarListings } from '@/lib/data/listings/getSimilarListings'
import { pageMetadata } from '@/lib/site/page-metadata'
import { listingShareSummary } from '@/lib/share-metadata'
import type { BreadcrumbNavItem } from '@/components/site/BreadcrumbNav'
import { ListingDetailShell } from '@/components/site/listing-detail/ListingDetailShell'
import { PriceBlock } from '@/components/site/listing-detail/PriceBlock'
import { PhotoGallery } from '@/components/site/listing-detail/PhotoGallery'
import { PropertySpecs } from '@/components/site/listing-detail/PropertySpecs'
import { DescriptionBlock } from '@/components/site/listing-detail/DescriptionBlock'
import { PropertyHistory } from '@/components/site/listing-detail/PropertyHistory'
import { SimilarListings } from '@/components/site/listing-detail/SimilarListings'
import { OpenHouses } from '@/components/site/listing-detail/OpenHouses'
import { ListingVideoEmbed } from '@/components/site/listing-detail/ListingVideoEmbed'
import { ListingAgentCard } from '@/components/site/listing-detail/ListingAgentCard'
import { TextMattCTA } from '@/components/site/listing-detail/TextMattCTA'
import { MortgageCalculator } from '@/components/site/listing-detail/MortgageCalculator'
import ListingTracker from '@/components/listing/ListingTracker'

/**
 * Wave 3 listing-detail page rebuild — composes the Layer 4 components
 * shipped this week into the new listing-detail surface.
 *
 * Replaces 552 lines of legacy showcase composition with a declarative
 * tree of typed primitives. The React #310 hydration error that has
 * been bricking every listing page in production was inside the legacy
 * `components/listing/showcase/*` tree; this rebuild replaces it
 * entirely.
 *
 * Per docs/EXECUTION_PLAN.md §9 Wave 2 Layer 4 / Wave 3.
 */

type PageProps = { params: Promise<{ listingKey: string }> }

export const revalidate = 60

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { listingKey } = await params
  const listing = await getListingDetail(listingKey)
  if (!listing) return { title: 'Listing not found | Ryan Realty' }

  const street = [listing.streetNumber, listing.streetName].filter(Boolean).join(' ').trim()
  const addressFull = [street, listing.city ? `${listing.city}, OR` : '', listing.postalCode ?? '']
    .filter(Boolean)
    .join(' ')
    .trim()
  const description = listingShareSummary({
    price: listing.listPrice,
    beds: listing.beds,
    baths: listing.baths,
    sqft: listing.sqft ?? listing.totalLivingAreaSqFt,
    address: addressFull || undefined,
    city: addressFull ? undefined : (listing.city ?? undefined),
  })
  const title = addressFull
    ? `${addressFull} | Ryan Realty`
    : `Listing ${listing.listingKey} | Ryan Realty`

  return pageMetadata({
    title,
    description,
    path: `/listing/${listing.listingKey}`,
    ogImage: `/api/og?type=listing&id=${encodeURIComponent(listing.listingKey)}`,
  })
}

export default async function ListingDetailPage({ params }: PageProps) {
  const { listingKey } = await params
  const listing = await getListingDetail(listingKey)
  if (!listing) notFound()

  // Parallel fan-out for the rest of the read path. Each call falls back
  // to an empty result on failure so the page still renders if a single
  // upstream chunk is slow or unavailable.
  const today = new Date()
  const todayIso = today.toISOString().slice(0, 10)
  const future = new Date(today.getTime() + 30 * 86_400_000)
  const futureIso = future.toISOString().slice(0, 10)

  const [similar, history, photos, videos, openHousesAll, brokers, listingAgent] = await Promise.all([
    getSimilarListings(listingKey, 4).catch(() => []),
    getListingDetailHistory(listingKey).catch(() => []),
    getListingPhotos(listingKey).catch(() => []),
    getListingVideos(listingKey).catch(() => []),
    getOpenHousesInRange({
      dateFromIso: todayIso,
      dateToIso: futureIso,
      todayIso,
    }).catch(() => []),
    getBrokers().catch(() => []),
    resolveListingAgent({
      listAgentEmail: listing.listAgentEmail,
      listAgentName: listing.listAgentName,
    }),
  ])

  // getListingDetail does not yet populate photos (Wave 1.6 TODO). Merge
  // photos from the new getListingPhotos DAL (3-tier fallback) into the
  // listing payload so downstream components rely on listing.photos.
  const listingWithPhotos = { ...listing, photos }

  const listingOpenHouses = openHousesAll
    .filter((o) => o.listing_key === listingKey)
    .map((o) => ({
      open_house_key: o.open_house_key,
      event_date: o.event_date,
      start_time: o.start_time,
      end_time: o.end_time,
      notes: o.remarks,
    }))

  const matt = brokers.find((b) => b.slug === 'matt-ryan') ?? null
  const ctaBroker = listingAgent ?? matt

  const street = [listing.streetNumber, listing.streetName].filter(Boolean).join(' ').trim()
  const cityHref = listing.citySlug ? `/cities/${listing.citySlug}` : null

  const breadcrumbs: BreadcrumbNavItem[] = [
    { label: 'Home', href: '/' },
    { label: 'Homes for sale', href: '/homes-for-sale' },
    ...(listing.city && cityHref ? [{ label: listing.city, href: cityHref }] : []),
    { label: street || `Listing ${listingKey}` },
  ]

  const main = (
    <>
      <PhotoGallery photos={photos} addressLine={street} />
      <PriceBlock listing={listingWithPhotos} />
      <PropertySpecs listing={listingWithPhotos} />
      <DescriptionBlock publicRemarks={listingWithPhotos.publicRemarks} />
      {videos.length > 0 ? <ListingVideoEmbed videos={videos} /> : null}
      {history.length > 0 ? <PropertyHistory history={history} /> : null}
      {similar.length > 0 ? <SimilarListings similar={similar} /> : null}
    </>
  )

  const sidebar = ctaBroker ? (
    <>
      <TextMattCTA broker={ctaBroker} listingKey={listingKey} />
      {listingOpenHouses.length > 0 ? <OpenHouses events={listingOpenHouses} /> : null}
      <ListingAgentCard broker={listingAgent} listing={listing} />
      <MortgageCalculator
        listPrice={listing.listPrice}
        taxAnnualAmount={listing.taxAnnualAmount}
      />
    </>
  ) : null

  return (
    <>
      <ListingTracker
        listingKey={listing.listingKey}
        listingId={listing.listingKey}
        price={listing.listPrice ?? undefined}
        community={listing.communityName ?? listing.subdivisionName ?? undefined}
        city={listing.city ?? undefined}
        beds={listing.beds ?? undefined}
        baths={listing.baths ?? undefined}
      />
      <ListingDetailShell
        listing={listingWithPhotos}
        breadcrumbs={breadcrumbs}
        main={main}
        sidebar={sidebar}
      />
    </>
  )
}
