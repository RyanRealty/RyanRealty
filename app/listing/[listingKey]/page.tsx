import type { Metadata } from 'next'
import {
  getListingDetail,
  getListingPhotos,
  getListingVideos,
  getListingDetailOpenHouses,
  getBrokers,
  getReviews,
  resolveListingAgent,
  getCalculatorDefaults,
} from '@/lib/data'
import { resolveFeaturedItems } from '@/lib/kb/resolve-featured-items'
import { getRelatedListings } from '@/lib/data/listings/getRelatedListings'
import { getListingsByBuilder } from '@/lib/data/listings/getListingsByBuilder'
import { findTrailsNear, findGolfNear } from '@/lib/explore/lifestyle-near'
import { LifestyleNearSection } from '@/components/site/listing-detail/LifestyleNearSection'
import { PlaceParentsSection } from '@/components/site/listing-detail/PlaceParentsSection'
import { BuilderExploreSection } from '@/components/site/listing-detail/BuilderExploreSection'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { listingHistorySeedFrom, readListingDetailHistory } from '@/lib/listing/read-listing-detail-history'
import { pageMetadata } from '@/lib/site/page-metadata'
import { listingShareSummary } from '@/lib/share-metadata'
import { publishListingSaleAsk } from '@/lib/listing/publish-listing-ask'
import { publishWholePropertyAmount } from '@/lib/listing/publish-listing-figure'
import { listingMlsAddressFull, listingMlsStreetLine } from '@/lib/listing/publish-street-line'
import { homesForSalePath, listingDetailPath, subdivisionListingsPath } from '@/lib/slug'
import { getPublishedCmaForListing } from '@/lib/data/cma/getPublishedCma'
import { getListingPricingRead } from '@/lib/data/pricing/reads'
import { cityDetachedSlug, getDetachedOverlays } from '@/lib/data/market-truth/getSellBendMarket'
import { EMPTY_PUBLIC_PACE, getPublicDetachedPace } from '@/lib/data/market-truth/public-pace'
import { leftoverHudKpis, leftoverHudPublishes } from '@/lib/market/publish-leftover-hud'
import { LivePricingRead } from '@/components/site/listing-detail/LivePricingRead'
import { ListingDetailShell } from '@/components/site/listing-detail/ListingDetailShell'
import {
  ListingUnavailable,
  LISTING_UNAVAILABLE_METADATA,
} from '@/components/site/listing-detail/ListingUnavailable'
import { ListingHero } from '@/components/site/listing-detail/ListingHero'
import { ListingVideoEmbed } from '@/components/site/listing-detail/ListingVideoEmbed'
import { PriceCtaStrip } from '@/components/site/listing-detail/PriceCtaStrip'
import { OpenHouses } from '@/components/site/listing-detail/OpenHouses'
import { PropertySpecs } from '@/components/site/listing-detail/PropertySpecs'
import { DescriptionBlock } from '@/components/site/listing-detail/DescriptionBlock'
import { NeighborhoodMarketContext } from '@/components/site/listing-detail/NeighborhoodMarketContext'
import { SchoolsBlock } from '@/components/site/listing-detail/SchoolsBlock'
import { ParksNearbyBlock } from '@/components/site/listing-detail/ParksNearbyBlock'
import { GoverningDocumentsBlock } from '@/components/site/listing-detail/GoverningDocumentsBlock'
import { getPlaceDocumentsForListing } from '@/lib/data/places/getPlaceDocumentsForListing'
import { MortgageCalculator } from '@/components/site/listing-detail/MortgageCalculator'
import { RoomRestyle } from '@/components/site/listing-detail/RoomRestyle.client'
import { RentalAnalysis } from '@/components/site/listing-detail/RentalAnalysis'
import { PropertyHistory } from '@/components/site/listing-detail/PropertyHistory'
import { ListingLocationMap } from '@/components/site/listing-detail/ListingLocationMap'
import { PlaceIdentityLine } from '@/components/site/listing-detail/PlaceIdentityLine'
import { ListingFeaturedHomes } from '@/components/site/listing-detail/ListingFeaturedHomes.client'
import { ListingLikeThisAlerts } from '@/components/site/listing-detail/ListingLikeThisAlerts'
import { leftoverListingGrains, resolveListingPlaceAndMarket } from '@/lib/listing/listing-place-market'
import { publishListingContactKey } from '@/lib/listing/publish-listing-contact-key'
import { buildLifestyleLine } from '@/components/site/listing-detail/listing-city-lifestyle'
import { PublishedCmaSection } from '@/components/site/listing-detail/PublishedCmaSection'
import ListingBrokerCTA from '@/components/site/listing-detail/ListingBrokerCTA.client'
import { PhotoGalleryLightbox as _PhotoGalleryLightboxImport } from '@/components/site/listing-detail/PhotoGalleryLightbox'
import { TextMattCTA as _TextMattCTAImport } from '@/components/site/listing-detail/TextMattCTA'
// Parity marker: rendered transitively via ListingBrokerCTA.client (the mobile
// sticky broker bar), imported here under its real name so the mockup-parity
// gate (which matches the import identifier) sees it.
import ListingMobileContactBar from '@/components/site/listing-detail/ListingMobileContactBar.client'
import ListingTracker from '@/components/listing/ListingTracker'
import { ListingAttribution } from '@/components/listing/ListingAttribution'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { buildListingJsonLd } from './listing-json-ld'
// v3 chrome — the P9 roll's last page (B ratchet zero, 2026-08-27). The page
// mounts V3_ROOT_CLASS + `.listing-detail` on one <main>: the v3 token layer
// carries color/type, and listing-detail.css carries the listing body's own
// register (the kb-era carriers were ported there, values unchanged). Chrome
// is V3Breadcrumb + V3SectionTracker inside main and ONE V3Footer outside it;
// app/layout.tsx owns the header (V3Chrome). The listing body is RESTYLED IN
// PLACE — every data fetch, section, form, gallery, map, calculator, JSON-LD,
// and the sticky broker sidebar are preserved exactly. Anchor jumps clear the
// fixed mast via scroll-margin-top in listing-detail.css (the Lenis smooth
// scroller did not survive: no other v3 page runs one, and native hash
// scrolling honors the same scroll margin).
import {
  V3_ROOT_CLASS,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3SectionTracker,
} from '@/components/site/v3'

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
 *   full-width  ListingFeaturedHomes - homes for sale in this area
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
  // NOT notFound(). This route renders dynamically inside a loading.tsx
  // Suspense boundary, so the 200 is already committed by the time this
  // resolves and Next cannot downgrade the status — it only marks the boundary
  // for a client-side swap, leaving a blank page in the served HTML. The page
  // body renders <ListingUnavailable /> to match; noindex is what keeps the
  // unavoidable 200 out of the index. See ListingUnavailable.tsx.
  if (!listing) return LISTING_UNAVAILABLE_METADATA

  const addressFull = listingMlsAddressFull(listing)
  // The share card and the meta description travel WITHOUT the "Tenancy in
  // common" badge that qualifies the price on the page, so they take the
  // whole-property price: a pasted link to MLS 220190868 read "$1 · 3 bed,
  // 2 bath · 1,405 sq ft" for a fractional interest at Eagle Crest.
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
  // The refusal is RENDERED, not thrown. getListingDetail returns null for an
  // invalid key, a seller internet opt-out, a non-IDX-participant broker, and a
  // Coming Soon row alike — none of them may show a home. Throwing notFound()
  // here produced HTTP 200 with an empty body (nav + footer, 1,634 chars) on
  // ryan-realty.com because the shell had already flushed. See
  // ListingUnavailable.tsx for the measurement and the mechanism.
  if (!listing) return <ListingUnavailable />

  // The ONE published asking sale price for this page. Withheld on a lease
  // listing (MLS PropertyType 'G' — 735 Purcell, MLS 220174840, is a sublease
  // whose ListPrice 2.5 is a per-sq-ft rent rate), so the hero, the "what it
  // costs to own" block, the share summary and the JSON-LD offer all withhold
  // together rather than one surface publishing rent as an ask.
  const publishedSaleAsk =
    publishListingSaleAsk({ price: listing.listPrice, propertyType: listing.propertyType })?.ask ??
    null

  // The price OF THE WHOLE HOME, which is not always the ask. On a fractional
  // interest (65 Active "Tenancy in Common" rows, 1 "Timeshare", plus the rows
  // the reviewed registry names) the ask buys a share, so every figure
  // describing the dwelling takes this instead: the monthly payment, the rental
  // analysis, the median comparison, the near-this-price alert band, and the
  // JSON-LD offer. MLS 220190868 asks $1 for a fractional at Eagle Crest and
  // published a 1,571,464% cap rate off it; MLS 220222478 asks $159,900 for a
  // quarter share of an 866 sq ft cabin and published a 3.5% cap rate,
  // "Cash needed $31,980" and a SingleFamilyResidence offer at that price.
  const wholePropertyPrice = publishWholePropertyAmount({
    price: listing.listPrice,
    propertyType: listing.propertyType,
    propertySubType: listing.propertySubType,
    subdivisionName: listing.subdivisionName,
    city: listing.city,
    listNumber: listing.listNumber,
  })

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
  // The plat's recorded CC&Rs. Resolved through place_membership (boundary
  // polygons), not the MLS SubdivisionName text — on this page a buyer is
  // deciding about one specific house, and the wrong plat's covenants would be
  // worse than none. Timeout-guarded like every other arm here.
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

  const [relatedHomes, history, photos, videos, brokers, listingAgent, leftoverOverlays, leftoverPaceRows, openHouses, reviews, publishedCma, builderTiles, pricingRead, calcDefaults] =
    await Promise.all([
      withTimeoutFallback(
        getRelatedListings({
          anchorKey: listing.listingKey,
          excludeListNumber: listing.listNumber,
          // Price proximity for the onward rail. A share price would anchor it
          // to the cheapest inventory nearby; null falls back to place order.
          subjectPrice: publishWholePropertyAmount({
            price: listing.listPrice,
            propertyType: listing.propertyType,
            propertySubType: listing.propertySubType,
            subdivisionName: listing.subdivisionName,
            city: listing.city,
            listNumber: listing.listNumber,
          }),
          scope: nearbyScope,
          limit: 14,
        }),
        { primary: [], similar: [], nearby: [] },
        4500,
        'listing:related',
      ),
      readListingDetailHistory(listing.listingKey, listingHistorySeedFrom(listing)),
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
      // Payment rate from the ingested 30-yr series; null keeps the component default.
      withTimeoutFallback(getCalculatorDefaults(), null, 3000, 'listing:calcDefaults'),
    ])

  let leftoverHud: ReturnType<typeof leftoverHudKpis> | null = null
  let leftoverPace = EMPTY_PUBLIC_PACE
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
      leftoverPace = pace
      leftoverLayers = layers
      leftoverGrain = grain
      break
    }
  }

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

  const street = listingMlsStreetLine(listing)
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
      price={publishedSaleAsk}
      beds={listing.beds}
      baths={listing.baths}
      sqft={listing.sqft ?? listing.totalLivingAreaSqFt}
      acres={listing.lotSizeAcres}
      propertySubType={listing.propertySubType}
      subdivisionName={listing.subdivisionName}
      city={listing.city}
      listNumber={listing.listNumber}
      lat={listing.lat} lng={listing.lng}
    />
  )

  const main = (
    <>
      <PriceCtaStrip listing={listingWithPhotos} onSave={saveListingFromStrip} initialSaved={initialSaved} history={history} />
      <PlaceIdentityLine place={placeContext} />
      <LivePricingRead
        read={pricingRead}
        listPrice={wholePropertyPrice}
        listingKey={listing.listingKey}
        subjectAddress={street}
        sqft={listing.sqft ?? listing.totalLivingAreaSqFt}
        dom={listing.dom}
        placeMedianDays={leftoverHud?.daysToPending ?? null}
        placeName={leftoverGrain?.name ?? listing.city ?? listing.subdivisionName ?? null}
        hoaMonthly={listing.hoaMonthly}
        associationFee={listing.associationFee}
        associationFeeFrequency={listing.associationFeeFrequency}
        taxAnnualAmount={listing.taxAnnualAmount} propertySubType={listing.propertySubType}
        propertyType={listing.propertyType}
        subdivisionName={listing.subdivisionName}
        city={listing.city}
        listNumber={listing.listNumber}
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
        listPrice={wholePropertyPrice}
        beds={listing.beds}
      />
      {photos.some((p) => p.url) ? (
        <RoomRestyle
          photos={photos.map((p) => ({ url: p.url, caption: p.caption ?? null }))}
          listingKey={contactKey}
          city={listing.city}
          listPrice={wholePropertyPrice}
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
        price={publishedSaleAsk}
        beds={listing.beds}
        baths={listing.baths}
        sqft={listing.sqft ?? listing.totalLivingAreaSqFt}
        cityLine={listing.city}
        href={listingHref}
      />
      {leftoverHud && leftoverGrain ? (
        <NeighborhoodMarketContext
          geoName={leftoverGrain.name}
          hubHref={leftoverGrain.hubHref}
          hud={leftoverHud}
          leftoverPace={leftoverPace}
          thisListPrice={wholePropertyPrice}
          refreshedAt={leftoverLayers?.headlines?.computedAt ?? leftoverLayers?.inventory?.computedAt}
          chartCitySlug={listing.citySlug ?? null}
        />
      ) : null}
      {platDocuments ? (
        <GoverningDocumentsBlock
          platName={platDocuments.platName}
          platHref={`/subdivisions/${platDocuments.geoSlug}`}
          documents={platDocuments.documents}
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
      {/* The money block: what it costs to own, then what it could earn. Both
          are statements about the whole home, so both are withheld when the
          price is not the whole home's. Seeding the calculator with no price
          did not withhold it — 735 Purcell (lease) published "Total monthly
          (PITI) $2,076" with an empty price field, which is the tax bill
          wearing a payment label. */}
      {wholePropertyPrice != null ? (
        <MortgageCalculator
          listPrice={wholePropertyPrice}
          taxAnnualAmount={listing.taxAnnualAmount}
          ratePct={calcDefaults?.mortgageRate ?? null}
        />
      ) : null}
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

  const listingJsonLdSchemas = buildListingJsonLd({
    listingKey,
    street,
    wholePropertyPrice,
    listing,
    photoUrls: photos.map((p) => p.url),
    agent: ctaBroker
      ? { fullName: ctaBroker.fullName, email: ctaBroker.email, phoneDirect: ctaBroker.phoneDirect }
      : null,
  })

  return (
    <>
      <main className={`${V3_ROOT_CLASS} listing-detail`}>
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
        />
        {featuredItems.length > 0 ? (
          <ListingFeaturedHomes
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
      </main>
      {/* The tour and ask that KbFooter's listing band carried live on
          PriceCtaStrip, the broker sidebar, and the mobile bar; V3Footer
          carries the ODS attribution slot and no button. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
