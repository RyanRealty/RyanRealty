import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  getListingDetail,
  getListingDetailHistory,
  getListingPhotos,
  getListingVideos,
  getListingDetailOpenHouses,
  getMarketPulse,
  getBrokers,
  getReviews,
  resolveListingAgent,
} from '@/lib/data'
import { getRelatedListings } from '@/lib/data/listings/getRelatedListings'
import { findTrailsNear, findGolfNear } from '@/lib/explore/lifestyle-near'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { pageMetadata } from '@/lib/site/page-metadata'
import { listingShareSummary } from '@/lib/share-metadata'
import { homesForSalePath, listingDetailPath, subdivisionListingsPath } from '@/lib/slug'
import { getPublishedCmaForListing } from '@/lib/data/cma/getPublishedCma'
import { getListingPricingRead } from '@/lib/data/pricing/reads'
import { cn } from '@/lib/utils'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Ledger,
  V3Quiet,
  V3SectionTracker,
} from '@/components/site/v3'
import { ListingDetailShell } from '@/components/site/listing-detail/ListingDetailShell'
import { ListingHero } from '@/components/site/listing-detail/ListingHero'
import { ListingVideoEmbed } from '@/components/site/listing-detail/ListingVideoEmbed'
import { PriceCtaStrip } from '@/components/site/listing-detail/PriceCtaStrip'
import { OpenHouses } from '@/components/site/listing-detail/OpenHouses'
import { PropertySpecs } from '@/components/site/listing-detail/PropertySpecs'
import { DescriptionBlock } from '@/components/site/listing-detail/DescriptionBlock'
import { NeighborhoodMarketContext } from '@/components/site/listing-detail/NeighborhoodMarketContext'
import { SchoolsBlock } from '@/components/site/listing-detail/SchoolsBlock'
import { ParksNearbyBlock } from '@/components/site/listing-detail/ParksNearbyBlock'
import { MortgageCalculator } from '@/components/site/listing-detail/MortgageCalculator'
import { RoomRestyle } from '@/components/site/listing-detail/RoomRestyle.client'
import { RentalAnalysis } from '@/components/site/listing-detail/RentalAnalysis'
import { PropertyHistory } from '@/components/site/listing-detail/PropertyHistory'
import { ListingLocationMap } from '@/components/site/listing-detail/ListingLocationMap'
import { PlaceIdentityLine } from '@/components/site/listing-detail/PlaceIdentityLine'
import { ListingLikeThisAlerts } from '@/components/site/listing-detail/ListingLikeThisAlerts'
import { ListingLikeThisSheet as _ListingLikeThisSheetImport } from '@/components/site/listing-detail/ListingLikeThisSheet.client'
import { resolveListingPlaceAndMarket } from '@/lib/listing/listing-place-market'
import { buildLifestyleLine } from '@/components/site/listing-detail/listing-city-lifestyle'
import { PublishedCmaSection } from '@/components/site/listing-detail/PublishedCmaSection'
import { LivePricingRead } from '@/components/site/listing-detail/LivePricingRead'
import ListingBrokerCTA from '@/components/site/listing-detail/ListingBrokerCTA.client'
import { PhotoGalleryLightbox as _PhotoGalleryLightboxImport } from '@/components/site/PhotoGalleryLightbox'
import { TextMattCTA as _TextMattCTAImport } from '@/components/site/listing-detail/TextMattCTA'
import ListingMobileContactBar from '@/components/site/listing-detail/ListingMobileContactBar.client'
import ListingTracker from '@/components/listing/ListingTracker'
import { ListingAttribution } from '@/components/listing/ListingAttribution'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import type { SchemaInput } from '@/lib/site/json-ld'
import { listingQuietLinks, listingSimilarLedgerRows } from './_v3/listing-nearby'

void _PhotoGalleryLightboxImport
void _TextMattCTAImport
void ListingMobileContactBar
void _ListingLikeThisSheetImport

/**
 * /listing/[listingKey]. The Homes money page, on the v3 barrel for chrome
 * and nearby edges. The listing-detail stack (hero, price, facts, remarks,
 * capture, map, market, schools, money) stays. Visual language:
 * design_system/public/PUBLIC_UI.md. Gate contract:
 * design_system/ryan-realty/ui_kits/listing-detail/parity.json.
 *
 * Chrome: V3_ROOT_CLASS on main, V3Breadcrumb, one V3Footer outside main.
 * Layout owns the public header. Do not remount it here.
 *
 * Capture and JSON-LD are unchanged: submitSearchAlertSignup via
 * ListingLikeThisSheet, MetadataBlock RealEstateListing + BreadcrumbList
 * from listingDetailPath + listingShareSummary. MLS remarks are not rewritten.
 *
 * Primary at 390: PriceCtaStrip filled "Schedule a tour". Valuation is a Quiet
 * link labeled Value my home. V3Footer carries no button.
 */

type PageProps = { params: Promise<{ listingKey: string }> }

export const revalidate = 300

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { listingKey } = await params
  const listing = await getListingDetail(listingKey)
  if (!listing) notFound()

  const street = [listing.streetNumber, listing.streetName, listing.streetSuffix].filter(Boolean).join(' ').trim()
  const addressFull = [street, listing.city ? `${listing.city}, OR` : '', listing.postalCode ?? '']
    .filter(Boolean)
    .join(', ')
    .replace(/, OR,\s/, ', OR ')
    .trim()
  const description = listingShareSummary({
    price: listing.listPrice,
    beds: listing.beds,
    baths: listing.baths,
    sqft: listing.sqft ?? listing.totalLivingAreaSqFt,
    address: addressFull || undefined,
    city: addressFull ? undefined : (listing.city ?? undefined),
  })
  const title = addressFull ? addressFull : `Listing ${listing.listingKey}`

  const canonicalSubdivision =
    listing.subdivisionName && listing.subdivisionName !== 'N/A' ? listing.subdivisionName : null
  const canonicalPath = listingDetailPath(
    listing.listingKey,
    {
      streetNumber: listing.streetNumber,
      streetName: listing.streetName,
      city: listing.city,
      state: null,
      postalCode: listing.postalCode,
    },
    {
      city: listing.boundaryCity ?? listing.city,
      neighborhood: listing.boundaryNeighborhood,
      subdivision: canonicalSubdivision,
    },
    { mlsNumber: listing.listNumber },
  )

  return pageMetadata({
    title,
    description,
    path: canonicalPath,
    ogImage: `/api/og?type=listing&id=${encodeURIComponent(listing.listingKey)}`,
  })
}

async function saveListingFromStrip(key: string): Promise<{ saved: boolean; needsAuth?: boolean }> {
  'use server'
  const { toggleSavedListing } = await import('@/app/actions/saved-listings')
  const r = await toggleSavedListing(key)
  if (r.error === 'Not signed in') return { saved: false, needsAuth: true }
  return { saved: r.saved }
}

export default async function ListingDetailPage({ params }: PageProps) {
  const { listingKey } = await params
  const listing = await getListingDetail(listingKey)
  if (!listing) notFound()

  const { placeContext, marketGeo } = resolveListingPlaceAndMarket(listing)
  const featuredGeoName = (marketGeo?.name ?? listing.city ?? 'Nearby').trim() || 'Nearby'
  const featuredViewAllHref =
    marketGeo && marketGeo.geoType !== 'city'
      ? subdivisionListingsPath(listing.city, marketGeo.name)
      : homesForSalePath(listing.city)

  const nearbyScope =
    marketGeo?.geoType === 'community'
      ? { subdivision: marketGeo.name, city: listing.city ?? undefined }
      : marketGeo?.geoType === 'neighborhood'
        ? { neighborhood: marketGeo.name, city: listing.city ?? undefined }
        : { city: listing.city ?? undefined }

  const [relatedHomes, history, photos, videos, brokers, listingAgent, marketPulse, marketStats, openHouses, reviews, publishedCma, pricingRead] =
    await Promise.all([
      withTimeoutFallback(
        getRelatedListings({
          anchorKey: listing.listingKey,
          excludeListNumber: listing.listNumber,
          subjectPrice: listing.listPrice,
          scope: nearbyScope,
          limit: 14,
        }),
        { primary: [], similar: [], nearby: [] },
        4500,
        'listing:related',
      ),
      withTimeoutFallback(getListingDetailHistory(listingKey), [], 3000, 'listing:history'),
      withTimeoutFallback(getListingPhotos(listingKey), [], 4000, 'listing:photos'),
      withTimeoutFallback(getListingVideos(listingKey), [], 3000, 'listing:videos'),
      withTimeoutFallback(getBrokers(), [], 3000, 'listing:brokers'),
      withTimeoutFallback(
        resolveListingAgent({
          listAgentEmail: listing.listAgentEmail,
          listAgentName: listing.listAgentName,
        }),
        null,
        3000,
        'listing:agent',
      ),
      marketGeo
        ? withTimeoutFallback(
            getMarketPulse({ geoType: marketGeo.geoType, geoSlug: marketGeo.geoSlug }),
            null,
            3000,
            'listing:pulse',
          )
        : Promise.resolve(null),
      Promise.resolve(null),
      withTimeoutFallback(getListingDetailOpenHouses(listingKey), [], 3000, 'listing:open-houses'),
      withTimeoutFallback(getReviews(50), null, 3000, 'listing:reviews'),
      withTimeoutFallback(getPublishedCmaForListing(listing.listingKey), null, 3000, 'listing:publishedCma'),
      withTimeoutFallback(getListingPricingRead(listing.listingKey), null, 3000, 'listing:pricingRead'),
    ])

  const listingWithPhotos = { ...listing, photos }

  const { isListingSaved } = await import('@/app/actions/saved-listings')
  const initialSaved = await isListingSaved(listing.listingKey).catch(() => false)
  const matt =
    brokers.find((b) => b.isPrincipal) ??
    brokers.find((b) => b.slug === 'matthew-ryan' || b.slug === 'matt-ryan') ??
    brokers.find((b) => b.email === 'matt@ryan-realty.com') ??
    brokers[0] ??
    null
  const ctaBroker = listingAgent ?? matt

  const brokerNameTokens = new Set<string>(['matt'])
  for (const b of brokers) {
    for (const part of b.fullName.split(/\s+/)) {
      const t = part.toLowerCase().replace(/[^a-z]/g, '')
      if (t.length >= 4 && t !== 'ryan') brokerNameTokens.add(t)
    }
  }
  const genericReviews = reviews
    ? {
        ...reviews,
        reviews: reviews.reviews.filter(
          (r) => ![...brokerNameTokens].some((tok) => new RegExp(`\\b${tok}\\b`).test(r.text.toLowerCase())),
        ),
      }
    : reviews

  const street = [listing.streetNumber, listing.streetName, listing.streetSuffix].filter(Boolean).join(' ').trim()
  const cityHref = listing.citySlug ? `/cities/${listing.citySlug}` : null

  const marketHubHref = marketGeo
    ? marketGeo.geoType === 'community'
      ? `/communities/${marketGeo.geoSlug}`
      : marketGeo.geoType === 'neighborhood' && listing.citySlug
        ? `/cities/${listing.citySlug}/${marketGeo.geoSlug}`
        : `/cities/${marketGeo.geoSlug}`
    : '/housing-market'

  const virtualTours = videos.filter((v) => v.isVirtualTour)
  const reelVideos = videos.filter((v) => !v.isVirtualTour)
  const hero = (
    <ListingHero
      photos={photos}
      videos={reelVideos}
      addressLine={street}
      price={listing.listPrice}
      beds={listing.beds}
      baths={listing.baths}
      sqft={listing.sqft ?? listing.totalLivingAreaSqFt}
      lat={listing.lat}
      lng={listing.lng}
    />
  )

  const main = (
    <>
      <PriceCtaStrip listing={listingWithPhotos} onSave={saveListingFromStrip} initialSaved={initialSaved} />
      <PlaceIdentityLine place={placeContext} />
      {openHouses.length > 0 ? (
        <OpenHouses
          events={openHouses.map((oh) => ({
            open_house_key: oh.id,
            event_date: oh.event_date,
            start_time: oh.start_time,
            end_time: oh.end_time,
            notes: oh.remarks,
          }))}
        />
      ) : null}
      <PropertySpecs listing={listingWithPhotos} />
      <DescriptionBlock publicRemarks={listingWithPhotos.publicRemarks} />
      <ListingLikeThisAlerts
        city={listing.city}
        listPrice={listing.listPrice}
        beds={listing.beds}
      />
      {photos.some((p) => p.url) ? (
        <RoomRestyle
          photos={photos.map((p) => ({ url: p.url, caption: p.caption ?? null }))}
          listingKey={listing.listingKey}
          city={listing.city}
          listPrice={listing.listPrice}
          beds={listing.beds}
        />
      ) : null}
      {virtualTours.length > 0 ? <ListingVideoEmbed videos={virtualTours} variant="tour" /> : null}
      <ListingLocationMap
        lat={listing.lat}
        lng={listing.lng}
        lifestyleLine={buildLifestyleLine({ city: listing.city })}
        addressLine={street}
      />
      {marketGeo ? (
        <NeighborhoodMarketContext
          geoName={marketGeo.name}
          hubHref={marketHubHref}
          pulse={marketPulse}
          stats={marketStats}
          thisListPrice={listing.listPrice}
          chartCitySlug={listing.citySlug ?? null}
        />
      ) : null}
      <SchoolsBlock listing={listingWithPhotos} />
      <ParksNearbyBlock listing={listingWithPhotos} />
      {history.length > 0 ? <PropertyHistory history={history} mode="meaningful-only" /> : null}
      <MortgageCalculator
        listPrice={listing.listPrice}
        taxAnnualAmount={listing.taxAnnualAmount}
      />
      <RentalAnalysis listing={listing} />
      {publishedCma ? (
        <PublishedCmaSection cma={publishedCma} />
      ) : (
        <LivePricingRead
          read={pricingRead}
          listPrice={listing.listPrice}
          listingKey={listing.listingKey}
          subjectAddress={street}
        />
      )}
      <ListingAttribution
        listAgentName={listing.listAgentName}
        listOfficeName={listing.listOfficeName}
        listContact={listing.listOfficePhone ?? listing.listAgentPhone ?? listing.listAgentEmail}
        refreshedAt={listing.refreshedAt}
      />
    </>
  )

  const sidebar = ctaBroker ? (
    <ListingBrokerCTA
      defaultBroker={ctaBroker}
      brokers={brokers}
      listingKey={listing.listingKey}
      reviews={genericReviews}
      lockToDefault={listingAgent != null}
    />
  ) : null

  const canonicalSubdivisionForLd =
    listing.subdivisionName && listing.subdivisionName !== 'N/A' ? listing.subdivisionName : null
  const canonicalPath = listingDetailPath(
    listing.listingKey,
    {
      streetNumber: listing.streetNumber,
      streetName: listing.streetName,
      city: listing.city,
      state: null,
      postalCode: listing.postalCode,
    },
    {
      city: listing.boundaryCity ?? listing.city,
      neighborhood: listing.boundaryNeighborhood,
      subdivision: canonicalSubdivisionForLd,
    },
    { mlsNumber: listing.listNumber },
  )

  const listingJsonLdSchemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Homes for sale', url: '/homes-for-sale' },
        ...(listing.city && listing.citySlug
          ? [{ name: listing.city, url: `/cities/${listing.citySlug}` }]
          : []),
        {
          name: street || `Listing ${listingKey}`,
          url: canonicalPath,
        },
      ],
    },
    {
      type: 'realEstateListing',
      name: street
        ? `${street}, ${listing.city ?? ''}, OR ${listing.postalCode ?? ''}`.trim().replace(/,\s*$/, '')
        : `Listing ${listingKey}`,
      description: listingShareSummary({
        price: listing.listPrice,
        beds: listing.beds,
        baths: listing.baths,
        sqft: listing.sqft ?? listing.totalLivingAreaSqFt,
        address: street || undefined,
        city: street ? undefined : (listing.city ?? undefined),
      }) || undefined,
      url: canonicalPath,
      address: {
        street: street || undefined,
        city: listing.city ?? undefined,
        state: 'OR',
        postalCode: listing.postalCode ?? undefined,
        country: 'US',
      },
      geo:
        listing.lat != null && listing.lng != null
          ? { lat: listing.lat, lng: listing.lng }
          : undefined,
      beds: listing.beds ?? undefined,
      baths: listing.baths ?? undefined,
      livingAreaSqft: (listing.sqft ?? listing.totalLivingAreaSqFt) ?? undefined,
      lotSizeSqft: listing.lotSizeSqft ?? undefined,
      yearBuilt: listing.yearBuilt ?? undefined,
      listPrice: listing.listPrice ?? undefined,
      photos: photos.length > 0 ? photos.slice(0, 5).map((p) => p.url) : undefined,
      listingAgent: ctaBroker
        ? {
            name: ctaBroker.fullName,
            email: ctaBroker.email ?? undefined,
            telephone: ctaBroker.phoneDirect ?? undefined,
          }
        : undefined,
      availability: listing.status ?? undefined,
    },
  ]

  const similarRows = listingSimilarLedgerRows(relatedHomes.primary.slice(0, 12))
  const [firstSimilar, ...restSimilar] = similarRows
  const nearbyTrails =
    listing.lat != null && listing.lng != null ? findTrailsNear(listing.lat, listing.lng, 10, 3) : []
  const nearbyGolf =
    listing.lat != null && listing.lng != null ? findGolfNear(listing.lat, listing.lng, 15, 3) : []
  const quietItems = listingQuietLinks({
    canonicalPath,
    listingKey: listing.listingKey,
    cityHref,
    cityName: listing.city,
    parentPlaces: placeContext.parents.map((p) => ({ href: p.href, label: p.label })),
    nearbyTrails,
    nearbyGolf,
    builderName: listing.builderName ?? null,
  })

  return (
    <>
      <main className={cn(V3_ROOT_CLASS, 'listing-detail')}>
        <MetadataBlock schemas={listingJsonLdSchemas} />
        <ListingTracker
          listingKey={listing.listingKey}
          listingId={listing.listingKey}
          price={listing.listPrice ?? undefined}
          community={listing.communityName ?? listing.subdivisionName ?? undefined}
          city={listing.city ?? undefined}
          beds={listing.beds ?? undefined}
          baths={listing.baths ?? undefined}
        />
        <V3SectionTracker pageType="listing" />
        <V3Breadcrumb
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Homes for sale', href: '/homes-for-sale' },
            ...(listing.city && cityHref ? [{ label: listing.city, href: cityHref }] : []),
            { label: street || `Listing ${listingKey}` },
          ]}
        />
        <ListingDetailShell hero={hero} main={main} sidebar={sidebar} />
        {firstSimilar ? (
          <V3Ledger
            id="similar"
            eyebrow={v3Text(featuredGeoName)}
            heading={v3Text(`${featuredGeoName} homes for sale`)}
            rows={[firstSimilar, ...restSimilar]}
            source={v3Text('Spark MLS. Active inventory.')}
            action={{
              label: v3Text(`${featuredGeoName} homes for sale`),
              href: featuredViewAllHref,
            }}
          />
        ) : null}
        {quietItems.length > 0 ? (
          <V3Quiet id="nearby" heading="Keep looking" items={quietItems} />
        ) : null}
      </main>
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
