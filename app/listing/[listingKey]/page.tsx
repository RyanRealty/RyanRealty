import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  getListingDetail,
  getListingDetailHistory,
  getListingPhotos,
  getListingVideos,
  getListingDetailOpenHouses,
  getMarketPulse,
  getMarketStats,
  getBrokers,
  getReviews,
  resolveListingAgent,
} from '@/lib/data'
import { resolveFeaturedItems } from '@/lib/kb/resolve-featured-items'
import { getRelatedListings } from '@/lib/data/listings/getRelatedListings'
import { getListingsByBuilder } from '@/lib/data/listings/getListingsByBuilder'
import { findTrailsNear, findGolfNear } from '@/lib/explore/lifestyle-near'
import { LifestyleNearSection } from '@/components/site/explore/LifestyleNearSection'
import { PlaceParentsSection } from '@/components/site/explore/PlaceParentsSection'
import { BuilderExploreSection } from '@/components/site/explore/BuilderExploreSection'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { pageMetadata } from '@/lib/site/page-metadata'
import { listingShareSummary } from '@/lib/share-metadata'
import { homesForSalePath, listingDetailPath, subdivisionListingsPath } from '@/lib/slug'
import { getPublishedCmaForListing } from '@/lib/data/cma/getPublishedCma'
import { getListingPricingRead } from '@/lib/data/pricing/reads'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { LivePricingRead } from '@/components/site/listing-detail/LivePricingRead'
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
import { KbFeatured } from '@/components/site/kb/KbFeatured.client'
import { ListingLikeThisAlerts } from '@/components/site/listing-detail/ListingLikeThisAlerts'
import { resolveListingPlaceAndMarket } from '@/lib/listing/listing-place-market'
import { publishListingContactKey } from '@/lib/listing/publish-listing-contact-key'
import { buildLifestyleLine } from '@/components/site/listing-detail/listing-city-lifestyle'
import { PublishedCmaSection } from '@/components/site/listing-detail/PublishedCmaSection'
import ListingBrokerCTA from '@/components/site/listing-detail/ListingBrokerCTA.client'
import { PhotoGalleryLightbox as _PhotoGalleryLightboxImport } from '@/components/site/PhotoGalleryLightbox'
import { TextMattCTA as _TextMattCTAImport } from '@/components/site/listing-detail/TextMattCTA'
// Parity marker: rendered transitively via ListingBrokerCTA.client (the mobile
// sticky broker bar), imported here under its real name so the mockup-parity
// gate (which matches the import identifier) sees it.
import ListingMobileContactBar from '@/components/site/listing-detail/ListingMobileContactBar.client'
import ListingTracker from '@/components/listing/ListingTracker'
import { ListingAttribution } from '@/components/listing/ListingAttribution'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import type { SchemaInput } from '@/lib/site/json-ld'
// KB (kinetic-brutalist) shell — Phase 9 page-class migration. Wraps the
// existing listing-detail composition (ListingDetailShell + its parity-
// required sections) in the same chrome the homepage/city/community pages
// use: KbNav on top, KbFooter at the bottom, the cream `.kb-root` surface,
// inertial smooth-scroll, and section/scroll tracking. The listing body is
// RESTYLED IN PLACE — every data fetch, section, form, gallery, map,
// calculator, JSON-LD, and the sticky broker sidebar are preserved exactly.
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import '@/components/site/kb/kb.css'

// Parity-gate markers (D75): real consumers are ListingHero / ListingBrokerCTA.
void _PhotoGalleryLightboxImport
void _TextMattCTAImport
void ListingMobileContactBar

/**
 * Listing-detail composition, ordered to the buyer decision sequence
 * (reordered 2026-07-30; alerts early 2026-08-10): see it, price it,
 * check the facts, read the story, capture intent, tour it, place it,
 * judge the market, schools and parks, history, run the money, then
 * who to call.
 *
 *   hero        ListingHero (photo-grid OR autoplay-video)
 *   main        PriceCtaStrip · OpenHouses · PropertySpecs · DescriptionBlock
 *               · ListingLikeThisAlerts (#listing-like-alerts + coach)
 *               · RoomRestyle · ListingVideoEmbed · ListingLocationMap
 *               · NeighborhoodMarketContext · SchoolsBlock · ParksNearbyBlock
 *               · PropertyHistory · MortgageCalculator · RentalAnalysis
 *               · ListingAttribution (ODS §5-3)
 *   sidebar     ListingBrokerCTA (TextMattCTA + ListingMobileContactBar)
 *   full-width  KbFeatured - homes for sale in this area
 *
 * Two sections were retired here 2026-07-30: VacationRentalPotential (no
 * nightly-rate, occupancy, or City of Bend STR-permit source exists) and
 * TransparentCMASummary (every public.cmas row is a confidential client
 * document). Neither had ever rendered - both took a hardcoded null prop.
 *
 * The mockup-parity CI gate verifies every requiredComponent in
 * design_system/ryan-realty/ui_kits/listing-detail/parity.json is
 * imported here. The route-smoke gate verifies the rendered page
 * returns 200 + non-blank against a real listing key.
 */

type PageProps = { params: Promise<{ listingKey: string }> }

// 5-min warm window: under ad traffic the vast majority of listing hits serve
// from the ISR/data cache and never touch the Supabase pooler. On-demand
// revalidation (cacheTag.listing) still invalidates instantly when a listing
// changes, so this only lengthens the backstop, not real freshness.
export const revalidate = 300

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { listingKey } = await params
  const listing = await getListingDetail(listingKey)
  if (!listing) notFound()

  const street = [listing.streetNumber, listing.streetName, listing.streetSuffix].filter(Boolean).join(' ').trim()
  // Comma between street and city ("63177 Iner Loop, Bend, OR 97701") — the
  // comma-less form matched no county/Zillow record (design-audit P1, trust).
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
  // Address only — the root layout title template owns the single brand suffix
  // (" | Ryan Realty — Central Oregon Real Estate"). Adding "| Ryan Realty" here
  // double-stamped the brand on every listing (the #1 ad-landing surface).
  const title = addressFull ? addressFull : `Listing ${listing.listingKey}`

  // Canonical = the PUBLIC URL (matches the sitemap + internal links), NOT the
  // internal /listing/<key> route. Pointing the canonical at /listing/<key>
  // split indexing signal: the sitemap listed the pretty URL while the page
  // told Google to index the raw-key one. Built with the same listingDetailPath
  // helper the sitemap uses, so they agree.
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

// Save/unsave a listing from the price strip. Returns needsAuth for a signed-out
// visitor so the client routes them to sign-in (the save -> account capture path).
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

  // Place ladder + market grain (Exploration System). See CONTEXT.md.
  const { placeContext, marketGeo } = resolveListingPlaceAndMarket(listing)
  const featuredGeoName = marketGeo?.name ?? listing.city ?? 'Nearby'
  const featuredViewAllHref = marketGeo && marketGeo.geoType !== 'city' ? subdivisionListingsPath(listing.city, marketGeo.name) : homesForSalePath(listing.city)

  // Every arm is timeout-guarded (not just .catch): the listing page is the #1
  // ad-landing surface, and an unbounded pooler stall on any of these used to
  // hang the render to FUNCTION_INVOCATION_TIMEOUT / "Something went wrong".
  // Each section degrades independently. Enforced by the db-timeout-guard gate.
  // "Similar homes" = active homes in THIS listing's place (subdivision first,
  // then neighborhood, then city) — the same canonical featured-homes rail the
  // city/community pages use, not a bespoke MV. Scope mirrors marketGeo.
  const nearbyScope =
    marketGeo?.geoType === 'community'
      ? { subdivision: marketGeo.name, city: listing.city ?? undefined }
      : marketGeo?.geoType === 'neighborhood'
      ? { neighborhood: marketGeo.name, city: listing.city ?? undefined }
      : { city: listing.city ?? undefined }

  const [relatedHomes, history, photos, videos, brokers, listingAgent, marketPulse, marketStats, openHouses, reviews, publishedCma, builderTiles, pricingRead] =
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
      listing.builderName
        ? withTimeoutFallback(
            getListingsByBuilder({
              builderName: listing.builderName,
              city: listing.city,
              excludeKey: listing.listingKey,
              limit: 8,
            }),
            [],
            3500,
            'listing:builder',
          )
        : Promise.resolve([]),
      withTimeoutFallback(getListingPricingRead(listing.listingKey), null, 3000, 'listing:pricingRead'),
    ])

  const listingWithPhotos = { ...listing, photos }

  // Primary rail = place + similar merge; second rail = pure similar when it
  // adds homes the primary set doesn't already show (avoid double tile walls).
  // One inventory rail only (experience rule: no two card grids in a row).
  // Ranking already merges similar_listings_mv + place proximity.
  const featuredItems = await withTimeoutFallback(
    resolveFeaturedItems(relatedHomes.primary.slice(0, 12), 12),
    [],
    3000,
    'listing:featured',
  )

  const { isListingSaved } = await import('@/app/actions/saved-listings')
  const initialSaved = await isListingSaved(listing.listingKey).catch(() => false)
  // Resolve the fallback contact broker by the STABLE principal flag, not a slug
  // string: the slug was renamed 'matt-ryan' -> 'matthew-ryan' (commit 6cb0202),
  // which silently nulled `matt` and made the whole sticky CTA sidebar disappear.
  // Prefer the principal, then known slug variants, then email, then any broker.
  const matt =
    brokers.find((b) => b.isPrincipal) ??
    brokers.find((b) => b.slug === 'matthew-ryan' || b.slug === 'matt-ryan') ??
    brokers.find((b) => b.email === 'matt@ryan-realty.com') ??
    brokers[0] ??
    null
  const ctaBroker = listingAgent ?? matt

  // The sticky card shows ONE broker who may not be the person a given review
  // names, so the social-proof quote must be broker-agnostic. Drop any review
  // that names a broker (first/last name), keeping the brokerage count + average
  // intact. "ryan" is excluded from the tokens — it's the brokerage name, not a
  // person — and "matt" is added for the Matthew short form.
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

  const breadcrumbs = [
    { label: 'Home', href: '/' },
    { label: 'Homes for sale', href: '/homes-for-sale?view=list' },
    ...(listing.city && cityHref ? [{ label: listing.city, href: cityHref }] : []),
    { label: street || `Listing ${listingKey}` },
  ]

  const marketHubHref = marketGeo
    ? marketGeo.geoType === 'community'
      ? `/communities/${marketGeo.geoSlug}`
      : marketGeo.geoType === 'neighborhood' && listing.citySlug
      ? `/cities/${listing.citySlug}/${marketGeo.geoSlug}`
      : `/cities/${marketGeo.geoSlug}`
    : '/housing-market'

  // Videos ≠ virtual tours (Matt): hero gets reels; tours get their own viewer.
  const virtualTours = videos.filter((v) => v.isVirtualTour)
  const reelVideos = videos.filter((v) => !v.isVirtualTour)
  const contactKey =
    publishListingContactKey({ listNumber: listing.listNumber, listingKey: listing.listingKey }) ??
    listing.listingKey
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
      <LivePricingRead
        read={pricingRead}
        listPrice={listing.listPrice}
        listingKey={listing.listingKey}
        subjectAddress={street}
        sqft={listing.sqft ?? listing.totalLivingAreaSqFt}
        dom={listing.dom}
        placeMedianDays={marketPulse?.medianDaysToPending ?? null}
        placeName={marketGeo?.name ?? listing.city ?? listing.subdivisionName ?? null}
        hoaMonthly={listing.hoaMonthly}
        associationFee={listing.associationFee}
        associationFeeFrequency={listing.associationFeeFrequency}
        taxAnnualAmount={listing.taxAnnualAmount}
        hideCmaRequest={Boolean(publishedCma)}
      />
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
      {/* Facts before prose: a buyer scans the spec grid, then reads the
          remarks. Reordered 2026-07-30 to the buyer decision sequence. */}
      <PropertySpecs listing={listingWithPhotos} />
      <DescriptionBlock publicRemarks={listingWithPhotos.publicRemarks} />
      {/* B1 alerts early (after facts + story) so high-intent visitors see the
          form without scrolling past the full main stack + featured homes.
          id="listing-like-alerts" is the jump target for PriceCtaStrip,
          RoomRestyle next-step, and ListingAlertCoach. Single mount only. */}
      <ListingLikeThisAlerts
        city={listing.city}
        listPrice={listing.listPrice}
        beds={listing.beds}
      />
      {photos.some((p) => p.url) ? (
        <RoomRestyle
          photos={photos.map((p) => ({ url: p.url, caption: p.caption ?? null }))}
          listingKey={contactKey}
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
        photoUrl={photos[0]?.url ?? listing.photoUrl}
        price={listing.listPrice}
        beds={listing.beds}
        baths={listing.baths}
        sqft={listing.sqft ?? listing.totalLivingAreaSqFt}
        cityLine={listing.city}
        href={listingHref}
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
      <LifestyleNearSection
        lat={listing.lat}
        lng={listing.lng}
        items={
          listing.lat != null && listing.lng != null
            ? [
                ...findTrailsNear(listing.lat, listing.lng, 10, 3),
                ...findGolfNear(listing.lat, listing.lng, 15, 3),
              ]
            : []
        }
        eyebrow="Lifestyle"
        title="Trails and golf nearby"
      />
      {history.length > 0 ? <PropertyHistory history={history} mode="meaningful-only" /> : null}
      {/* The money block: what it costs to own, then what it could earn. */}
      <MortgageCalculator
        listPrice={listing.listPrice}
        taxAnnualAmount={listing.taxAnnualAmount}
      />
      <RentalAnalysis listing={listing} />
      {/* Our opinion of value. Renders ONLY for a document Matt published per
          row (published_to_listing) that also passed its own audit — the guard
          lives in getPublishedCmaForListing, never here. Sold-comp detail stays
          behind the registration the section's CTA opens (ODS 5-4 C). */}
      <PublishedCmaSection cma={publishedCma} />
      <ListingAttribution
        listAgentName={listing.listAgentName}
        listOfficeName={listing.listOfficeName}
        listContact={listing.listOfficePhone ?? listing.listAgentPhone ?? listing.listAgentEmail}
        refreshedAt={listing.refreshedAt}
      />
    </>
  )

  const sidebar = ctaBroker ? (
    // ONE consolidated sticky card: the contact broker (the resolved Ryan Realty
    // listing agent when known, else the assigned/principal broker) with full
    // contact info + lg-only review social proof, plus the mobile sticky bar.
    <ListingBrokerCTA
      defaultBroker={ctaBroker}
      brokers={brokers}
      listingKey={contactKey}
      reviews={genericReviews}
      lockToDefault={listingAgent != null}
    />
  ) : null

  // JSON-LD from the fetched listing only (§0). Photos already honor suppression.
  // Canonical path matches generateMetadata / sitemap / canonical link.
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
      // Photos: already gated by media_suppressed in getListingPhotos().
      // Cap at 5 per schema.org convention (matching the builder's own slice).
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

  return (
    <main className="kb-root">
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
      <KbSectionTracker pageType="listing" />
      <SmoothScrollProvider>
        <KbBreadcrumb trail={breadcrumbs} />
        <ListingDetailShell
          hero={hero}
          main={main}
          sidebar={sidebar}
        />
        {featuredItems.length > 0 ? (
          <KbFeatured
            items={featuredItems}
            eyebrow={`${featuredGeoName} · For sale`}
            viewAllHref={featuredViewAllHref}
            viewAllLabel={`See every ${featuredGeoName} home for sale`}
          />
        ) : null}
        {/* Ledger parents after the inventory rail (not a second card grid). */}
        <PlaceParentsSection
          parents={placeContext.parents}
          eyebrow="Keep exploring"
          title="This home sits inside"
        />
        {listing.builderName && builderTiles.length > 0 ? (
          <BuilderExploreSection builderName={listing.builderName} tiles={builderTiles} />
        ) : null}
        <KbFooter towns={[]} listingKey={contactKey} />
      </SmoothScrollProvider>
    </main>
  )
}
