import type { Metadata } from 'next'
import {
  getListingDetail,
  getListingPhotos,
  getListingFloorPlans,
  getListingVideos,
  getListingDetailOpenHouses,
  getBrokers,
  getReviews,
  resolveListingAgent,
  getCalculatorDefaults,
  getBoundaryGeoJSON,
} from '@/lib/data'
import { getRelatedListings } from '@/lib/data/listings/getRelatedListings'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { listingHistorySeedFrom, readListingDetailHistory } from '@/lib/listing/read-listing-detail-history'
import { pageMetadata } from '@/lib/site/page-metadata'
import { listingPlaceTrail } from '@/lib/site/place-trail'
import { listingAliasPlatLadder } from '@/lib/listing/listing-alias-plat-trail'
import { listingShareSummary } from '@/lib/share-metadata'
import { publishListingSaleAsk } from '@/lib/listing/publish-listing-ask'
import { publishWholePropertyAmount } from '@/lib/listing/publish-listing-figure'
import { listingMlsAddressFull, listingMlsStreetLine } from '@/lib/listing/publish-street-line'
import { homesForSalePath, listingDetailPath, subdivisionListingsPath } from '@/lib/slug'
import { ListingDetailShell } from '@/components/site/listing-detail/ListingDetailShell'
import {
  ListingUnavailable,
  LISTING_UNAVAILABLE_METADATA,
} from '@/components/site/listing-detail/ListingUnavailable'
import { ListingHero } from '@/components/site/listing-detail/ListingHero'
import { ListingVideoEmbed } from '@/components/site/listing-detail/ListingVideoEmbed'
import { PriceCtaStrip } from '@/components/site/listing-detail/PriceCtaStrip'
import { PropertySpecs } from '@/components/site/listing-detail/PropertySpecs'
import { GoverningDocumentsBlock } from '@/components/site/listing-detail/GoverningDocumentsBlock'
import { getPlaceDocumentsForListing } from '@/lib/data/places/getPlaceDocumentsForListing'
import { MortgageCalculator } from '@/components/site/listing-detail/MortgageCalculator'
import { ListingLocationMap } from '@/components/site/listing-detail/ListingLocationMap'
import { buildListingAtlas } from './_v3/listing-atlas'
import { listingAtlasHeadline } from '@/lib/listing/listing-place-market'
import { ListingAroundHere } from '@/components/site/listing-detail/ListingAroundHere'
import { SchoolsBlock } from '@/components/site/listing-detail/SchoolsBlock'
import { ListingAskInstrument } from '@/components/site/listing-detail/ListingAskInstrument'
import { PropertyHistory } from '@/components/site/listing-detail/PropertyHistory'
import { buildListingAskClaim } from '@/components/site/listing-detail/listing-ask'
import { cityDetachedSlug, getDetachedOverlays } from '@/lib/data/market-truth/getSellBendMarket'
import { EMPTY_PUBLIC_PACE, getPublicDetachedPace } from '@/lib/data/market-truth/public-pace'
import { leftoverHudKpis, leftoverHudPublishes } from '@/lib/market/publish-leftover-hud'
import { ListingSimilarStrip } from '@/components/site/listing-detail/ListingSimilarStrip'
import {
  listingSimilarDedupe,
  listingSimilarInPlace,
  listingSimilarRail,
} from '@/components/site/listing-detail/listing-similar'
import { ListingLotFigure } from '@/components/site/listing-detail/ListingLotFigure'
import { ListingTaxHistory, listingCountyRecordHref } from '@/components/site/listing-detail/ListingTaxHistory'
import {
  leftoverListingGrains,
  listingBoundaryAttempts,
  listingInventoryDoor,
  resolveListingPlaceAndMarket,
} from '@/lib/listing/listing-place-market'

import { publishListingContactKey } from '@/lib/listing/publish-listing-contact-key'
import { publishOpenHouseBadgeLabel } from '@/lib/listing/publish-listing-card-badges'
import ListingBrokerCTA from '@/components/site/listing-detail/ListingBrokerCTA.client'
import ListingBrokerBar from '@/components/site/listing-detail/ListingBrokerBar.client'
import { PhotoGalleryLightbox as _PhotoGalleryLightboxImport } from '@/components/site/listing-detail/PhotoGalleryLightbox'
import { TextMattCTA as _TextMattCTAImport } from '@/components/site/listing-detail/TextMattCTA'
import ListingMobileContactBar from '@/components/site/listing-detail/ListingMobileContactBar.client'
import ListingTracker from '@/components/listing/ListingTracker'
import { ListingAttribution } from '@/components/listing/ListingAttribution'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { buildListingJsonLd } from './listing-json-ld'
import {
  V3_ROOT_CLASS,
  V3_LISTING_CLASS,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3SectionTracker,
  V3Atlas,
  V3ListingRow,
  v3Text,
} from '@/components/site/v3'
import { basemapForRegions } from '@/lib/geo/basemap-source'

void _PhotoGalleryLightboxImport
void _TextMattCTAImport
void ListingMobileContactBar
void ListingVideoEmbed
void V3ListingRow

/**
 * One house. PAGE_INVENTORY listing (house URL), 12 rows, Zillow Showcase to beat.
 *
 *   1 breadcrumb   City → neighborhood → community → plat → street
 *   2 media        price, beds, baths, sqft, street on the media; tabs we have
 *   3 ask          Tour / Call / Text (cookies cannot cover)
 *   4 facts        type, lot, year, HOA, $/sqft
 *   5 payment      computeMonthlyPiti only; P&I, tax, HOA
 *   6 map          this lot + climb, Atlas, assessor lines
 *   7 schools      nearby unless a zone is known
 *   8 parks        same thumbs as the indexes
 *   9 tax          one assessed figure + county link
 *  10 CC&Rs        published plat docs
 *  11 similar      same parent, same house row
 *  12 who listed   live broker; firm proof if no personal record
 */

type PageProps = { params: Promise<{ listingKey: string }> }

export const revalidate = 300

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { listingKey } = await params
  const listing = await getListingDetail(listingKey)
  if (!listing) return LISTING_UNAVAILABLE_METADATA

  const addressFull = listingMlsAddressFull(listing)
  const description = listingShareSummary({
    price: publishWholePropertyAmount({
      price: listing.listPrice,
      propertyType: listing.propertyType,
      propertySubType: listing.propertySubType,
      subdivisionName: listing.subdivisionName,
      city: listing.city,
      listNumber: listing.listNumber,
    }),
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

function brokerTelDigits(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/[^\d]/g, '')
  return digits.length >= 10 ? digits : null
}

export default async function ListingDetailPage({ params }: PageProps) {
  const { listingKey } = await params
  const listing = await getListingDetail(listingKey)
  if (!listing) return <ListingUnavailable />

  const publishedSaleAsk =
    publishListingSaleAsk({ price: listing.listPrice, propertyType: listing.propertyType })?.ask ??
    null

  const wholePropertyPrice = publishWholePropertyAmount({
    price: listing.listPrice,
    propertyType: listing.propertyType,
    propertySubType: listing.propertySubType,
    subdivisionName: listing.subdivisionName,
    city: listing.city,
    listNumber: listing.listNumber,
  })

  const { placeContext, marketGeo } = resolveListingPlaceAndMarket(listing)
  const featuredGeoName =
    placeContext.curatedCommunity?.label ?? marketGeo?.name ?? listing.city ?? 'Nearby'
  const featuredViewAllHref =
    placeContext.curatedCommunity
      ? `/communities/${placeContext.curatedCommunity.slug}`
      : marketGeo && marketGeo.geoType !== 'city'
        ? subdivisionListingsPath(listing.city, marketGeo.name)
        : homesForSalePath(listing.city)

  const platDocuments = await withTimeoutFallback(
    getPlaceDocumentsForListing(listing.boundarySubdivision),
    null,
    4500,
    'listing:plat-documents',
  )

  const nearbyScope =
    marketGeo?.geoType === 'community'
      ? { subdivision: marketGeo.name, city: listing.city ?? undefined }
      : marketGeo?.geoType === 'neighborhood'
      ? { neighborhood: marketGeo.name, city: listing.city ?? undefined }
      : { city: listing.city ?? undefined }

  const leftoverGrains = leftoverListingGrains(listing, marketGeo)

  const [relatedHomes, history, photos, floorPlans, videos, brokers, listingAgent, leftoverOverlays, leftoverPaceRows, openHouses, reviews, calcDefaults] =
    await Promise.all([
      withTimeoutFallback(
        getRelatedListings({
          anchorKey: listing.listingKey,
          excludeListNumber: listing.listNumber,
          subjectPrice: wholePropertyPrice,
          scope: nearbyScope,
          limit: 14,
        }),
        { primary: [], similar: [], nearby: [] },
        4500,
        'listing:related',
      ),
      readListingDetailHistory(listing.listingKey, listingHistorySeedFrom(listing)),
      withTimeoutFallback(getListingPhotos(listingKey), [], 8000, 'listing:photos'),
      withTimeoutFallback(getListingFloorPlans(listingKey), [], 4000, 'listing:floor-plans'),
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
      leftoverGrains.length > 0
        ? withTimeoutFallback(
            getDetachedOverlays(
              leftoverGrains.map((grain) => ({ geoType: grain.geoType, geoSlug: grain.geoSlug })),
            ),
            new Map(),
            3000,
            'listing:leftoverOverlay',
          )
        : Promise.resolve(new Map()),
      leftoverGrains.length > 0
        ? Promise.all(
            leftoverGrains.map((grain) =>
              withTimeoutFallback(
                getPublicDetachedPace({ geoType: grain.geoType, geoSlug: grain.geoSlug }),
                EMPTY_PUBLIC_PACE,
                3000,
                `listing:leftoverPace:${grain.geoType}`,
              ),
            ),
          )
        : Promise.resolve([]),
      withTimeoutFallback(getListingDetailOpenHouses(listingKey), [], 3000, 'listing:open-houses'),
      withTimeoutFallback(getReviews(50), null, 3000, 'listing:reviews'),
      withTimeoutFallback(getCalculatorDefaults(), null, 3000, 'listing:calcDefaults'),
    ])

  let leftoverHud: ReturnType<typeof leftoverHudKpis> | null = null
  let leftoverLayers: ReturnType<typeof leftoverOverlays.get> = undefined
  let leftoverGrain = leftoverGrains[leftoverGrains.length - 1] ?? null
  for (let i = 0; i < leftoverGrains.length; i++) {
    const grain = leftoverGrains[i]!
    const slug = cityDetachedSlug(grain.geoSlug)
    const layers = leftoverOverlays.get(`${grain.geoType}:${slug}`)
    const pace = leftoverPaceRows[i] ?? EMPTY_PUBLIC_PACE
    const hud = leftoverHudKpis({
      grain: grain.geoType,
      headlines: layers?.headlines ?? null,
      inventory: layers?.inventory ?? null,
      pace,
    })
    if (leftoverHudPublishes(hud) || pace.pendingCount != null) {
      leftoverHud = hud
      leftoverLayers = layers
      leftoverGrain = grain
      break
    }
  }

  const galleryPhotos =
    photos.length > 0
      ? photos
      : listing.photoUrl
        ? [{ url: listing.photoUrl, caption: null, order: 0 }]
        : []
  const listingWithPhotos = { ...listing, photos: galleryPhotos }

  const similarPool = listingSimilarDedupe(
    listingSimilarInPlace(
      relatedHomes.nearby.length > 0
        ? relatedHomes.nearby
        : [...relatedHomes.similar, ...relatedHomes.primary],
      [
        placeContext.curatedCommunity?.label,
        placeContext.neighborhood?.label,
        listing.subdivisionName,
      ].filter((n): n is string => !!n && n !== 'N/A'),
    ),
  )
  const similarRows = listingSimilarRail(similarPool)
  const inventoryDoor = listingInventoryDoor(placeContext)
  const placeBoundary = await (async () => {
    for (const attempt of listingBoundaryAttempts(listing, placeContext)) {
      const geometry = await withTimeoutFallback(
        getBoundaryGeoJSON(attempt),
        null,
        1800,
        `listing:boundary:${attempt.geoType}`,
      )
      if (geometry) return geometry
    }
    return null
  })()
  const listingAtlas = await buildListingAtlas({
    city: listing.city ?? '',
    citySlug: listing.citySlug ?? null,
    cityName: listing.city ?? null,
    neighborhoodSlug: listing.neighborhoodSlug ?? null,
    neighborhoodName: placeContext.neighborhood?.label ?? listing.neighborhoodName ?? null,
    communitySlug: placeContext.curatedCommunity?.slug ?? null,
    communityName: placeContext.curatedCommunity?.label ?? null,
    boundary: placeBoundary,
    lat: listing.lat ?? null,
    lng: listing.lng ?? null,
  }).catch(() => null)

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

  const street = listingMlsStreetLine(listing)
  const listingHref = listingDetailPath(
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
      subdivision:
        listing.subdivisionName && listing.subdivisionName !== 'N/A' ? listing.subdivisionName : null,
    },
    { mlsNumber: listing.listNumber },
  )

  const aliasLadder = listingAliasPlatLadder({
    mlsSubdivisionName: listing.subdivisionName,
    boundarySubdivision: listing.boundarySubdivision,
  })
  const breadcrumbs = listingPlaceTrail({
    city: listing.city && listing.citySlug ? { label: listing.city, slug: listing.citySlug } : null,
    neighborhood: placeContext.neighborhood,
    community: placeContext.curatedCommunity ?? aliasLadder.parent,
    subdivision: aliasLadder.plat ?? placeContext.subdivision,
    address: street || `Listing ${listingKey}`,
  })

  const contactKey =
    publishListingContactKey({ listNumber: listing.listNumber, listingKey: listing.listingKey }) ??
    listing.listingKey
  const askClaim = buildListingAskClaim({
    ask: publishedSaleAsk,
    wholePropertyPrice,
    hud: leftoverHud,
    grain: leftoverGrain,
    updatedAt: leftoverLayers?.headlines?.computedAt ?? leftoverLayers?.inventory?.computedAt ?? null,
  })
  const ctaTel = brokerTelDigits(ctaBroker?.phoneDirect ?? ctaBroker?.phoneFub)

  const hero = (
    <ListingHero
      photos={galleryPhotos}
      floorPlans={floorPlans}
      videos={videos}
      addressLine={street}
      lat={listing.lat}
      lng={listing.lng}
      price={publishedSaleAsk}
      beds={listing.beds}
      baths={listing.baths}
      sqft={listing.sqft ?? listing.totalLivingAreaSqFt}
      openHouseLabel={
        openHouses[0]
          ? publishOpenHouseBadgeLabel(openHouses[0].event_date, openHouses[0].start_time)
          : null
      }
    />
  )

  const atlasBlock = listingAtlas ? (
    <V3Atlas
      id="location"
      headingLevel={2}
      headline={v3Text(listingAtlasHeadline(listingAtlas.frameName))}
      dots={listingAtlas.atlas.dots}
      regions={listingAtlas.regions}
      basemap={basemapForRegions(listingAtlas.regions, {
        dots: listingAtlas.atlas.dots,
        fit: listingAtlas.dotsFrame ? 'dots' : 'regions',
      })}
      types={listingAtlas.atlas.types}
      events={listingAtlas.atlas.events}
      source={listingAtlas.atlas.source}
      stamp={listingAtlas.atlas.stamp}
      incomplete={!listingAtlas.atlas.complete}
      highlight={{ key: listing.listingKey, label: 'This home' }}
      outlinedOf={listingAtlas.outlinedOf}
      fit={listingAtlas.dotsFrame ? 'dots' : 'regions'}
      parcels={listingAtlas.parcels.map((lot) => ({
        id: lot.taxlot,
        subject: lot.isSubject,
        name: lot.isSubject ? 'This lot' : undefined,
        geometry: lot.geometry,
      }))}
      className="is-stacked"
    >
      {listingAtlas.subjectParcel ? (
        <ListingLotFigure parcel={listingAtlas.subjectParcel} county={listing.county} />
      ) : null}
      {listingAtlas.frameHref ? (
        <p className="v3-atlas__door">
          <a href={listingAtlas.frameHref}>Every home for sale in {listingAtlas.frameName}</a>
        </p>
      ) : null}
    </V3Atlas>
  ) : (
    <ListingLocationMap
      lat={listing.lat}
      lng={listing.lng}
      boundary={placeBoundary}
      addressLine={street}
      photoUrl={galleryPhotos[0]?.url ?? listing.photoUrl}
      price={publishedSaleAsk}
      beds={listing.beds}
      baths={listing.baths}
      sqft={listing.sqft ?? listing.totalLivingAreaSqFt}
      cityLine={listing.city}
      href={listingHref}
      inventoryHref={inventoryDoor?.href}
      inventoryLabel={inventoryDoor?.name}
    />
  )

  const countyRecordHref = listingCountyRecordHref({
    county: listing.county,
    parcelNumber: listing.parcelNumber,
    dialUrl: listingAtlas?.subjectParcel?.dialUrl ?? null,
  })

  const main = (
    <>
      <PriceCtaStrip
        listing={listingWithPhotos}
        history={history}
        onSave={saveListingFromStrip}
        initialSaved={initialSaved}
        ratePct={calcDefaults?.mortgageRate ?? null}
        showEstPayment={false}
        showAlerts={false}
        callHref={ctaTel ? `tel:${ctaTel}` : null}
        textHref={ctaTel ? `sms:${ctaTel}` : null}
      />
      <PropertySpecs listing={listingWithPhotos} />
      {wholePropertyPrice != null ? (
        <div id="payment">
          <MortgageCalculator
            listPrice={wholePropertyPrice}
            taxAnnualAmount={listing.taxAnnualAmount}
            hoaMonthly={listing.hoaMonthly}
            ratePct={calcDefaults?.mortgageRate ?? null}
          />
        </div>
      ) : null}
      {atlasBlock}
      <div id="schools">
        <SchoolsBlock listing={listingWithPhotos} />
      </div>
      <ListingAroundHere lat={listing.lat} lng={listing.lng} />
      {askClaim ? <ListingAskInstrument claim={askClaim} /> : null}
      <div id="history">
        <PropertyHistory history={history} mode="meaningful-only" />
      </div>
      <div id="tax">
        <ListingTaxHistory
          taxYear={listing.taxYear}
          taxAssessedValue={listing.taxAssessedValue}
          taxAnnualAmount={listing.taxAnnualAmount}
          county={listing.county}
          parcelNumber={listing.parcelNumber}
          countyRecordHref={countyRecordHref}
        />
      </div>
      {platDocuments && platDocuments.documents.length > 0 ? (
        <div id="plat">
          <GoverningDocumentsBlock
            platName={platDocuments.platName}
            platHref={`/subdivisions/${platDocuments.geoSlug}`}
            documents={platDocuments.documents}
          />
        </div>
      ) : null}
      {similarRows.length > 0 ? (
        <ListingSimilarStrip
          rows={similarRows}
          placeName={featuredGeoName}
          viewMoreHref={featuredViewAllHref}
        />
      ) : null}
      {ctaBroker ? (
        <div id="listed" className="listing-who listing-who--flow">
          <ListingBrokerCTA
            defaultBroker={ctaBroker}
            brokers={brokers}
            listingKey={contactKey}
            reviews={genericReviews}
            lockToDefault={listingAgent != null}
          />
        </div>
      ) : null}
      <ListingAttribution
        listAgentName={listing.listAgentName}
        listOfficeName={listing.listOfficeName}
        listContact={listing.listOfficePhone ?? listing.listAgentPhone ?? listing.listAgentEmail}
        refreshedAt={listing.refreshedAt}
      />
    </>
  )

  const floating = ctaBroker ? (
    <ListingBrokerBar
      defaultBroker={ctaBroker}
      brokers={brokers}
      listingKey={contactKey}
      lockToDefault={listingAgent != null}
    />
  ) : null

  const sidebar = ctaBroker ? (
    <ListingBrokerCTA
      defaultBroker={ctaBroker}
      brokers={brokers}
      listingKey={contactKey}
      reviews={genericReviews}
      lockToDefault={listingAgent != null}
    />
  ) : null

  const listingJsonLdSchemas = buildListingJsonLd({
    listingKey,
    street,
    wholePropertyPrice,
    trail: breadcrumbs,
    listing,
    photoUrls: galleryPhotos.map((p) => p.url),
    agent: listingAgent
      ? { fullName: listingAgent.fullName, email: listingAgent.email, phoneDirect: listingAgent.phoneDirect }
      : listing.listAgentName
        ? { fullName: listing.listAgentName, email: null, phoneDirect: listing.listAgentPhone ?? null }
        : null,
  })

  return (
    <>
      <main className={`${V3_ROOT_CLASS} ${V3_LISTING_CLASS} listing-detail`}>
        <MetadataBlock schemas={listingJsonLdSchemas} />
        <ListingTracker
          listingKey={listing.listingKey}
          listingId={contactKey}
          price={listing.listPrice ?? undefined}
          community={listing.communityName ?? listing.subdivisionName ?? undefined}
          city={listing.city ?? undefined}
          beds={listing.beds ?? undefined}
          baths={listing.baths ?? undefined}
        />
        <V3SectionTracker />
        <V3Breadcrumb trail={breadcrumbs} />
        <ListingDetailShell
          hero={hero}
          main={main}
          sidebar={sidebar}
          floating={floating}
        />
      </main>
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
