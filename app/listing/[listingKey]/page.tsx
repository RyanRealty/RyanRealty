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
  getAtlasTiles,
} from '@/lib/data'
import { getRelatedListings } from '@/lib/data/listings/getRelatedListings'
import { getListingsByBuilder } from '@/lib/data/listings/getListingsByBuilder'
import { BuilderExploreSection } from '@/components/site/listing-detail/BuilderExploreSection'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { listingHistorySeedFrom, readListingDetailHistory } from '@/lib/listing/read-listing-detail-history'
import { pageMetadata } from '@/lib/site/page-metadata'
import { cityNeighborhoodHref } from '@/lib/site/place-href'
import { listingPlaceTrail } from '@/lib/site/place-trail'
import { listingShareSummary } from '@/lib/share-metadata'
import { publishListingSaleAsk } from '@/lib/listing/publish-listing-ask'
import { publishWholePropertyAmount } from '@/lib/listing/publish-listing-figure'
import { listingMlsAddressFull, listingMlsStreetLine } from '@/lib/listing/publish-street-line'
import { homesForSalePath, listingDetailPath, subdivisionListingsPath } from '@/lib/slug'
import { getPublishedCmaForListing } from '@/lib/data/cma/getPublishedCma'
import { cityDetachedSlug, getDetachedOverlays } from '@/lib/data/market-truth/getSellBendMarket'
import { EMPTY_PUBLIC_PACE, getPublicDetachedPace } from '@/lib/data/market-truth/public-pace'
import { leftoverHudKpis, leftoverHudPublishes } from '@/lib/market/publish-leftover-hud'
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
import { GoverningDocumentsBlock } from '@/components/site/listing-detail/GoverningDocumentsBlock'
import { getPlaceDocumentsForListing } from '@/lib/data/places/getPlaceDocumentsForListing'
import { MortgageCalculator } from '@/components/site/listing-detail/MortgageCalculator'
import { RentalAnalysis } from '@/components/site/listing-detail/RentalAnalysis'
import { PropertyHistory } from '@/components/site/listing-detail/PropertyHistory'
import { ListingLocationMap } from '@/components/site/listing-detail/ListingLocationMap'
import { buildListingAtlas } from './_v3/listing-atlas'
import { listingAtlasHeadline } from '@/lib/listing/listing-place-market'
import { ListingLikeThisAlerts } from '@/components/site/listing-detail/ListingLikeThisAlerts'
import { ListingAroundHere } from '@/components/site/listing-detail/ListingAroundHere'
import { SchoolsBlock } from '@/components/site/listing-detail/SchoolsBlock'
import { ListingAskInstrument } from '@/components/site/listing-detail/ListingAskInstrument'
import { buildListingAskClaim } from '@/components/site/listing-detail/listing-ask'
import {
  buildListingPriceBandChart,
  closedPricesForLeftoverGrain,
  leftoverClosedFromDate,
} from '@/components/site/listing-detail/listing-price-bands'
import { ListingMoreDoors } from '@/components/site/listing-detail/ListingMoreDoors'
import {
  buildListingDoors,
  listingDoorsOrNull,
  listingRentalEligible,
} from '@/components/site/listing-detail/listing-doors'
import { ListingSimilarStrip } from '@/components/site/listing-detail/ListingSimilarStrip'
import {
  listingSimilarDedupe,
  listingSimilarInPlace,
  listingSimilarRail,
} from '@/components/site/listing-detail/listing-similar'
import { ListingLotFigure } from '@/components/site/listing-detail/ListingLotFigure'
import {
  leftoverListingGrains,
  listingBoundaryAttempts,
  listingInventoryDoor,
  resolveListingPlaceAndMarket,
} from '@/lib/listing/listing-place-market'

import { publishListingContactKey } from '@/lib/listing/publish-listing-contact-key'
import { publishOpenHouseBadgeLabel } from '@/lib/listing/publish-listing-card-badges'
import { buildLifestyleLine } from '@/components/site/listing-detail/listing-city-lifestyle'
import { PublishedCmaSection } from '@/components/site/listing-detail/PublishedCmaSection'
import ListingBrokerCTA from '@/components/site/listing-detail/ListingBrokerCTA.client'
import ListingBrokerBar from '@/components/site/listing-detail/ListingBrokerBar.client'
import { PhotoGalleryLightbox as _PhotoGalleryLightboxImport } from '@/components/site/listing-detail/PhotoGalleryLightbox'
import { TextMattCTA as _TextMattCTAImport } from '@/components/site/listing-detail/TextMattCTA'
// Parity marker: rendered transitively via ListingBrokerBar.client (the mobile
// sticky broker bar), imported here under its real name so the mockup-parity
// gate (which matches the import identifier) sees it.
import ListingMobileContactBar from '@/components/site/listing-detail/ListingMobileContactBar.client'
import ListingTracker from '@/components/listing/ListingTracker'
import { ListingAttribution } from '@/components/listing/ListingAttribution'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { buildListingJsonLd } from './listing-json-ld'
// Listing look (V3_LISTING_CLASS): paper + panels. Brand colors/fonts stay.
import {
  V3_ROOT_CLASS,
  V3_LISTING_CLASS,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3SectionTracker,
  V3Atlas,
  V3Instrument,
  V3Chart,
  V3Doors,
  V3ListingRow,
  v3Text,
} from '@/components/site/v3'
import { basemapForRegions } from '@/lib/geo/basemap-source'

// Parity-gate markers (D75): real consumers are ListingHero / ListingBrokerCTA.
void _PhotoGalleryLightboxImport
void _TextMattCTAImport
void ListingMobileContactBar
void ListingVideoEmbed
void V3Instrument
void V3Doors
void V3ListingRow

/**
 * One house, Redfin's section order, our data. Nothing that we publish is
 * parked behind a door at the bottom of the page.
 *
 *   hero        ListingHero (mosaic)
 *   main        PriceCtaStrip · OpenHouses · About · payment
 *               · V3Atlas #location · Schools · parks/trails/golf/events
 *               · V3Instrument #ask · V3Chart #price-bands
 *               · details · history · CC&Rs · CMA · rental
 *               · similar homes · builder · alerts · doors · attribution
 *   sidebar     ListingBrokerCTA (tour / call / text live here and on the bar)
 *   floating    ListingBrokerBar (OUTSIDE the aside)
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
  const featuredGeoName =
    placeContext.curatedCommunity?.label ?? marketGeo?.name ?? listing.city ?? 'Nearby'
  const featuredViewAllHref =
    placeContext.curatedCommunity
      ? `/communities/${placeContext.curatedCommunity.slug}`
      : marketGeo && marketGeo.geoType !== 'city'
        ? subdivisionListingsPath(listing.city, marketGeo.name)
        : homesForSalePath(listing.city)

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

  const [relatedHomes, history, photos, floorPlans, videos, brokers, listingAgent, leftoverOverlays, leftoverPaceRows, leftoverClosedTiles, openHouses, reviews, publishedCma, builderTiles, calcDefaults] =
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
      listing.city && leftoverGrains.length > 0
        ? withTimeoutFallback(
            getAtlasTiles({
              cities: [listing.city],
              closedFromDate: leftoverClosedFromDate(),
            }),
            [],
            4500,
            'listing:leftoverCloses',
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
      // Payment rate from the ingested 30-yr series; null keeps the component default.
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

  const listingWithPhotos = { ...listing, photos }

  // Primary rail = place + similar merge; second rail = pure similar when it
  // adds homes the primary set doesn't already show (avoid double tile walls).
  // One inventory rail only (experience rule: no two card grids in a row).
  // Ranking already merges similar_listings_mv + place proximity.
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
  // The living map around this home: the neighborhood (else the city) as the
  // frame, every listing inside it, the recorded plats as doors, this home
  // held. Same population and builder as the place pages.
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
  // One hop: an out-of-area city's page is /oregon/<slug> and /cities/<slug>
  // 308s there; a registry community used as a neighborhood slug 308s to
  // /communities/<slug> (lib/site/place-href).
  const neighborhoodDoorHref =
    placeContext.neighborhood?.href ?? cityNeighborhoodHref(listing.citySlug, listing.neighborhoodSlug)
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

  const breadcrumbs = listingPlaceTrail({
    city: listing.city && listing.citySlug ? { label: listing.city, slug: listing.citySlug } : null,
    neighborhood: placeContext.neighborhood,
    community: placeContext.curatedCommunity,
    subdivision: placeContext.subdivision,
    address: street || `Listing ${listingKey}`,
  })

  // Media 1 is a reel when one exists (publishListingLeadMedia). 3D is a pill.
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
  const priceBandChart =
    leftoverGrain && askClaim
      ? buildListingPriceBandChart({
          grainName: leftoverGrain.name,
          closed: closedPricesForLeftoverGrain(leftoverClosedTiles, leftoverGrain).map((price) => ({
            price,
          })),
          listPrice: publishedSaleAsk,
        })
      : null
  const neighborhoodDoor =
    placeContext.neighborhood?.label && neighborhoodDoorHref
      ? {
          href: neighborhoodDoorHref,
          name: placeContext.neighborhood.label,
          homesForSale: leftoverHud?.active ?? null,
        }
      : leftoverGrain
        ? {
            href: leftoverGrain.hubHref,
            name: leftoverGrain.name,
            homesForSale: leftoverHud?.active ?? null,
          }
        : undefined
  const parentDoor = placeContext.parents[0]
  const listingDoors = listingDoorsOrNull(
    buildListingDoors({
      neighborhood: neighborhoodDoor,
      elementarySchool: listing.elementarySchool,
      middleSchool: listing.middleSchool,
      highSchool: listing.highSchool,
      schoolDistrict: listing.schoolDistrict,
      plat:
        platDocuments && platDocuments.documents.length > 0
          ? {
              href: `/subdivisions/${platDocuments.geoSlug}`,
              name: platDocuments.platName,
              documentCount: platDocuments.documents.length,
            }
          : undefined,
      lat: listing.lat,
      lng: listing.lng,
      paymentHref: wholePropertyPrice != null ? '#payment' : undefined,
      rental: listingRentalEligible({
        propertyType: listing.propertyType,
        beds: listing.beds,
        wholePropertyPrice,
      }),
      cma: Boolean(publishedCma),
      sitsInside:
        parentDoor?.href && parentDoor.label
          ? { href: parentDoor.href, name: parentDoor.label }
          : undefined,
    }),
  )

  const hero = (
    <ListingHero
      photos={photos}
      floorPlans={floorPlans}
      videos={videos}
      addressLine={street}
      lat={listing.lat}
      lng={listing.lng}
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
      {buildLifestyleLine({ city: listing.city }) ? (
        <p className="listing-detail__lifestyle">{buildLifestyleLine({ city: listing.city })}</p>
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
      lifestyleLine={buildLifestyleLine({ city: listing.city })}
      addressLine={street}
      photoUrl={photos[0]?.url ?? listing.photoUrl}
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

  const main = (
    <>
      <PriceCtaStrip
        listing={listingWithPhotos}
        history={history}
        onSave={saveListingFromStrip}
        initialSaved={initialSaved}
        ratePct={calcDefaults?.mortgageRate ?? null}
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
      {listingWithPhotos.publicRemarks ? (
        <div id="remarks">
          <DescriptionBlock publicRemarks={listingWithPhotos.publicRemarks} />
        </div>
      ) : null}
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
      <ListingAroundHere lat={listing.lat} lng={listing.lng} city={listing.city} />
      {askClaim ? <ListingAskInstrument claim={askClaim} /> : null}
      {priceBandChart ? <V3Chart id="price-bands" {...priceBandChart} /> : null}
      <div id="specs">
        <PropertySpecs listing={listingWithPhotos} />
      </div>
      {history.length > 0 ? (
        <div id="history">
          <PropertyHistory history={history} mode="meaningful-only" />
        </div>
      ) : null}
      {platDocuments && platDocuments.documents.length > 0 ? (
        <div id="plat">
          <GoverningDocumentsBlock
            platName={platDocuments.platName}
            platHref={`/subdivisions/${platDocuments.geoSlug}`}
            documents={platDocuments.documents}
          />
        </div>
      ) : null}
      {publishedCma ? (
        <div id="cma">
          <PublishedCmaSection cma={publishedCma} />
        </div>
      ) : null}
      {listingRentalEligible({
        propertyType: listing.propertyType,
        beds: listing.beds,
        wholePropertyPrice,
      }) ? (
        <div id="rental">
          <RentalAnalysis listing={listing} />
        </div>
      ) : null}
      {similarRows.length > 0 ? (
        <ListingSimilarStrip
          rows={similarRows}
          placeName={featuredGeoName}
          viewMoreHref={featuredViewAllHref}
        />
      ) : null}
      {listing.builderName && builderTiles.length > 0 ? (
        <div id="builder">
          <BuilderExploreSection builderName={listing.builderName} tiles={builderTiles} />
        </div>
      ) : null}
      <ListingLikeThisAlerts
        city={listing.city}
        listPrice={wholePropertyPrice}
        beds={listing.beds}
        photoUrl={photos[0]?.url ?? listing.photoUrl}
      />
      {listingDoors ? <ListingMoreDoors doors={listingDoors} /> : null}
      <ListingAttribution
        listAgentName={listing.listAgentName}
        listOfficeName={listing.listOfficeName}
        listContact={listing.listOfficePhone ?? listing.listAgentPhone ?? listing.listAgentEmail}
        refreshedAt={listing.refreshedAt}
      />
    </>
  )

  /**
   * The fixed bar goes OUTSIDE the grid. It used to render inside
   * ListingBrokerCTA, which sits in the aside, and the aside is display:none
   * below 64rem — a fixed element does not escape a hidden ancestor, so the bar
   * measured 0px high at 390, 1024 and 1440.
   */
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
    photoUrls: photos.map((p) => p.url),
    // THE TRUE LISTING AGENT, never a substitute (2026-08-27 audit: this
    // published Matt as the machine-readable listingAgent of another
    // brokerage's listing — the visible attribution said Cascade Hasson while
    // the JSON-LD said Matt Ryan). Our broker goes in only when they ARE the
    // listing agent (the listingAgent match is by list-agent identity);
    // otherwise the MLS's own agent name is published, or nothing.
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
      {/* The tour and ask that KbFooter's listing band carried live on
          PriceCtaStrip, the broker sidebar, and the mobile bar; V3Footer
          carries the ODS attribution slot and no button. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
