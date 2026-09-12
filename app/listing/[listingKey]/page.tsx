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
  getListingCutFacts,
} from '@/lib/data'
import { getRelatedListings } from '@/lib/data/listings/getRelatedListings'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { listingHistorySeedFrom, readListingDetailHistory } from '@/lib/listing/read-listing-detail-history'
import { pageMetadata } from '@/lib/site/page-metadata'
import { listingPlaceTrail } from '@/lib/site/place-trail'
import { listingAliasPlatLadder } from '@/lib/listing/listing-alias-plat-trail'
import { listingShareSummary } from '@/lib/share-metadata'
import { publishListingDrop } from '@/lib/listing/publish-listing-ask'
import {
  publishListingPublishedPrice,
  publishListingPublishedWholePropertyPrice,
  publishListingStatusWord,
} from '@/lib/listing/publish-listing-published-price'
import { isPublicOffMarketStatus } from '@/lib/listing-status-public'
import { publishListingOffMarketFacts } from '@/lib/listing/publish-listing-offmarket'
import { ListingOffMarketFacts } from '@/components/site/listing-detail/ListingOffMarketFacts'
import { ListingOutOfAreaNotice } from '@/components/site/listing-detail/ListingOutOfAreaNotice'
import { buildListingOutOfAreaNotice } from '@/components/site/listing-detail/listing-out-of-area'
import { outOfAreaListingPolicy } from '@/lib/data/listings/service-area'
import { getOutOfAreaCity } from '@/lib/data/geo/getOutOfAreaCities'
import { ListingLikeThisAlerts } from '@/components/site/listing-detail/ListingLikeThisAlerts'
import { listingMlsAddressFull, listingMlsStreetLine } from '@/lib/listing/publish-street-line'
import { homesForSalePath, listingCanonicalHref, subdivisionListingsPath } from '@/lib/slug'
import { ListingDetailShell } from '@/components/site/listing-detail/ListingDetailShell'
import {
  ListingUnavailable,
  LISTING_UNAVAILABLE_METADATA,
} from '@/components/site/listing-detail/ListingUnavailable'
import { ListingHero } from '@/components/site/listing-detail/ListingHero'
import { isNextRouterPrefetch } from '@/lib/listing/is-next-router-prefetch'
import {
  LISTING_FIELD_LEAD_PHOTO_SIZE,
  LISTING_MOSAIC_LEAD_PHOTO_SIZE,
  listingRowPhotoSrc,
} from '@/lib/listing/row-photo'
import { preferListingMosaicPhotoUrl } from '@/lib/listing/publish-listing-mosaic'
import { publishListingDropMark } from '@/lib/listing/publish-listing-drop-mark'
import { publishListingPillRead } from '@/lib/listing/publish-listing-pill-read'
import { daysLiveOnMarket } from '@/lib/listing/days-live'
import { publishListingSharePricePerSqft } from '@/lib/listing/publish-listing-share'
import { formatDate as formatCalendarDate } from '@/lib/format/date'
import { ListingVideoEmbed } from '@/components/site/listing-detail/ListingVideoEmbed'
import { PriceCtaStrip } from '@/components/site/listing-detail/PriceCtaStrip'
import { ListingSaveButton as _ListingSaveButtonImport } from '@/components/site/listing-detail/ListingSaveButton'
import { ListingShareButton as _ListingShareButtonImport } from '@/components/site/listing-detail/ListingShareButton'
import { listingDocumentTitle } from '@/lib/listing/listing-document-title'
import { PropertySpecs } from '@/components/site/listing-detail/PropertySpecs'
import { DescriptionBlock } from '@/components/site/listing-detail/DescriptionBlock'
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
  V3ListingClose,
  buildCloseView,
  buildCloseSubject,
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
void _ListingSaveButtonImport
void _ListingShareButtonImport
void ListingMobileContactBar
void ListingVideoEmbed
void V3ListingRow

/**
 * One house. PAGE_INVENTORY listing (house URL), 13 rows, Zillow Showcase to beat.
 *
 *   1 breadcrumb   City → neighborhood → community → plat → street
 *   2 media        price, beds, baths, sqft, street on the media; tabs we have
 *   3 ask          Tour / Call / Text · Save · Share (cookies cannot cover)
 *   4 facts        type, lot, year, HOA, $/sqft
 *   5 about        the MLS public remarks, as written (§2)
 *   6 payment      computeMonthlyPiti only; P&I, tax, HOA
 *   7 map          this lot + climb, Atlas, assessor lines
 *   8 schools      nearby unless a zone is known
 *   9 parks        same thumbs as the indexes
 *  10 tax         one assessed figure + county link
 *  11 CC&Rs       published plat docs
 *  12 similar     same parent, same house row
 *  13 who listed  live broker; firm proof if no personal record
 */

type PageProps = {
  params: Promise<{ listingKey: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

/**
 * MASTER_SPEC §4.9: an off-market page shows "3-4 active listings". Below three
 * the rail is not an onward path, so the place filter is dropped before the
 * rail is — the city is still the right place, the plat was only the preference.
 */
const OFF_MARKET_SIMILAR_MIN = 3

export const revalidate = 300

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { listingKey } = await params
  const listing = await getListingDetail(listingKey)
  if (!listing) return LISTING_UNAVAILABLE_METADATA

  const addressFull = listingMlsAddressFull(listing)
  // SITE-20. Every figure and every word this function publishes is
  // status-aware, because none of it was: 55550 Heidi Court (MLS 220219603)
  // closed at $1,100,000 and its <meta name=description>, its og:description
  // and its structured-data description all read $1,250,000, under a title
  // that said only the address. The publisher is the same one the visible page
  // uses, so the SERP snippet and the H1 cannot disagree again.
  const statusWord = publishListingStatusWord(listing.status)
  const description = listingShareSummary({
    price: publishListingPublishedWholePropertyPrice({
      status: listing.status,
      listPrice: listing.listPrice,
      closePrice: listing.closePrice,
      propertyType: listing.propertyType,
      propertySubType: listing.propertySubType,
      subdivisionName: listing.subdivisionName,
      city: listing.city,
      listNumber: listing.listNumber,
    }),
    statusWord,
    beds: listing.beds,
    baths: listing.baths,
    sqft: listing.sqft ?? listing.totalLivingAreaSqFt,
    address: addressFull || undefined,
    city: addressFull ? undefined : (listing.city ?? undefined),
  })
  const addressTitle = addressFull ? addressFull : `Listing ${listing.listingKey}`
  const title = listingDocumentTitle({
    statusWord,
    addressTitle,
    beds: listing.beds,
    baths: listing.baths,
  })

  // SITE-22: ONE builder for the canonical, the JSON-LD url, the sitemap row
  // and every internal href. The by-address route no longer overrides this with
  // a self-canonical to whatever path was requested, so this is the single URL
  // every path for this listing points at.
  const canonicalPath = listingCanonicalHref(listing)

  // SITE-33 (Matt 2026-09-08). 56% of listings.xml was Southern Oregon
  // inventory rendered identically to a Bend home under a "Central Oregon"
  // brand suffix. The ruling: the page still serves in full, it carries the
  // honesty block, and it leaves the index — with FOLLOW PRESERVED, so the
  // ~200 internal links on it (and the /oregon referral pages that link IN to
  // it) keep passing. `nofollow` is deliberately not set. The canonical stays:
  // pageMetadata always emits alternates.canonical, noindexed or not.
  //
  // The predicate is the one lib/data/listings/service-area.ts uses for the
  // tile and feed reads and the one /oregon/[city] uses for the city tier, so
  // the robots directive, the visible block and the sitemap row cannot
  // disagree about which market this home is in.
  const outOfArea = outOfAreaListingPolicy(listing.city)

  // SITE-32 (Matt ruled 2026-09-08). THE ABSENCE OF A STATUS BRANCH BELOW IS
  // THE POLICY, not an oversight — read this before you add one.
  //
  // Off-market listing URLs — Closed, Expired, Canceled, Withdrawn, and Pending
  // with them — stay INDEXED, index,follow, carrying SITE-21's honest state.
  // `noindex` here is a function of GEOGRAPHY ONLY (SITE-33's out-of-area
  // cities) and, one branch up at :140, of the refusal path where
  // getListingDetail returned null (IDX opt-out or Coming Soon). Status is not
  // an input and must not become one.
  //
  // Two contradictory written policies had stood for months — MASTER_SPEC §4.9
  // said keep the URL indexed, docs/plans/data-architecture-plan.md Part J §1
  // said noindex it and optionally 410 after 12 months — and neither was ever
  // implemented. The losing text is deleted; §4.9 is the one statement.
  // The measurement that settled it, GSC 2026-06-08..2026-09-05: off-market is
  // 6,611 of 14,508 listing-detail URLs and 26,123 of 56,650 impressions (46%),
  // earning ~324-577 clicks per 90 days at a CTR that straddles or beats
  // Active. An address query has no Active substitute, so a noindex deletes
  // those clicks rather than redistributing them. A Closed page showing
  // ClosePrice is NOT a VOW-only sold surface under ODS A.4 for indexing (Matt,
  // same ruling), so G54 is deliberately not extended here.
  //
  // These URLs are residual index, not submitted: getListingSitemapRows.ts
  // ships Active/AUC only, and that stays. Held by
  // scripts/check-listing-offmarket-index.mjs (ci:listing-offmarket-index).
  return pageMetadata({
    title,
    description,
    path: canonicalPath,
    ogImage: `/api/og?type=listing&id=${encodeURIComponent(listing.listingKey)}`,
    noindex: outOfArea !== null,
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

export default async function ListingDetailPage({ params, searchParams }: PageProps) {
  const [{ listingKey }, sp] = await Promise.all([params, searchParams ?? Promise.resolve({})])
  // SITE-60: Flight renders (prefetch and client navigations) must not emit a
  // 1600×1200 hero preload. Next strips the rsc / next-router-prefetch headers
  // before headers() sees them, so this also reads Accept and `_rsc`.
  const lcpPriority = !(await isNextRouterPrefetch(sp))
  const listing = await getListingDetail(listingKey)
  if (!listing) return <ListingUnavailable />

  // SITE-20: ONE published price for the whole page. Before this, PriceCtaStrip
  // branched on Closed by hand and printed the close price, while these two
  // constants — which feed the on-media hero caption, the map card, the
  // payment, the near-this-price band and the structured data — read the ask.
  // A sold home showed $1,100,000 in its H1 and $1,250,000 everywhere else.
  const publishedSaleAsk = publishListingPublishedPrice({
    status: listing.status,
    listPrice: listing.listPrice,
    closePrice: listing.closePrice,
    propertyType: listing.propertyType,
  })

  const wholePropertyPrice = publishListingPublishedWholePropertyPrice({
    status: listing.status,
    listPrice: listing.listPrice,
    closePrice: listing.closePrice,
    propertyType: listing.propertyType,
    propertySubType: listing.propertySubType,
    subdivisionName: listing.subdivisionName,
    city: listing.city,
    listNumber: listing.listNumber,
  })

  // SITE-21: THE HOME IS NOT FOR SALE. Closed, Expired, Canceled, Withdrawn —
  // and deliberately NOT Pending, which is under contract, takes backup offers,
  // and is one of this site's better lead sources. Everything this flag turns
  // off is an ask the broker cannot fulfil or a figure about a price nobody can
  // pay; everything it turns on is a door that goes somewhere.
  const offMarket = isPublicOffMarketStatus(listing.status)

  // SITE-33 — this home's market, decided by the SAME predicate as the robots
  // directive above and the sitemap row. Null on every Central Oregon home, so
  // a Bend page pays nothing: the geo read below only runs when the answer is
  // already "outside our market".
  const outOfArea = outOfAreaListingPolicy(listing.city)
  // Whether /oregon/<city> will actually render. That route notFound()s a slug
  // with no live snapshot row, and a door to a 404 is worse than no door, so
  // the block falls back to /contact when the city has no page. One cached
  // read (geo_snapshot_mv, 1h, the same index the city tier serves from).
  const outOfAreaCityRow = outOfArea
    ? await withTimeoutFallback(
        getOutOfAreaCity(outOfArea.citySlug),
        null,
        3000,
        'listing:out-of-area-city',
      )
    : null
  const outOfAreaNotice = buildListingOutOfAreaNotice(outOfArea, outOfAreaCityRow !== null)

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

  const [relatedHomes, history, photos, floorPlans, videos, brokers, listingAgent, leftoverOverlays, leftoverPaceRows, openHouses, reviews, calcDefaults, cutFacts] =
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
      withTimeoutFallback(getListingVideos(listingKey), [], 8000, 'listing:videos'),
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
      // SITE-06: how a price cut behaves in THIS listing's city, re-pulled per
      // city, pinned to a 12-month window. Null when nothing publishes honestly
      // at that window and the close then renders its acts without a drawing.
      withTimeoutFallback(
        getListingCutFacts({ citySlug: listing.citySlug, cityLabel: listing.city }),
        null,
        3000,
        'listing:cutFacts',
      ),
    ])

  let leftoverHud: ReturnType<typeof leftoverHudKpis> | null = null
  let leftoverLayers: ReturnType<typeof leftoverOverlays.get> = undefined
  let leftoverGrain = leftoverGrains[leftoverGrains.length - 1] ?? null
  /** SITE-45: the pace row behind the HUD that published, for the pills' read. */
  let leftoverPace: typeof EMPTY_PUBLIC_PACE | null = null
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
      leftoverPace = pace
      break
    }
  }

  const galleryPhotos =
    photos.length > 0
      ? photos
      : listing.photoUrl
        ? [{ url: listing.photoUrl, caption: null, order: 0 }]
        : []
  // SITE-60 + SITE-115: speculative Flight must not name 1600×1200 (list-page
  // tax). Real document navigations lock the gallery to the mosaic plate so
  // the hero never paints 320/800 even when listing_photos.cdn_url stored an
  // 800 derivative. MosaicStill also upgrades via preferListingMosaicPhotoUrl.
  const flightPhotos = lcpPriority
    ? galleryPhotos.map((p) => ({
        ...p,
        url: preferListingMosaicPhotoUrl(
          listingRowPhotoSrc(p.url, LISTING_MOSAIC_LEAD_PHOTO_SIZE),
        ),
      }))
    : galleryPhotos.map((p) => ({
        ...p,
        url: listingRowPhotoSrc(p.url, LISTING_FIELD_LEAD_PHOTO_SIZE),
      }))
  const flightFloorPlans = lcpPriority
    ? floorPlans.map((p) => ({
        ...p,
        url: preferListingMosaicPhotoUrl(
          listingRowPhotoSrc(p.url, LISTING_MOSAIC_LEAD_PHOTO_SIZE),
        ),
      }))
    : floorPlans.map((p) => ({
        ...p,
        url: listingRowPhotoSrc(p.url, LISTING_FIELD_LEAD_PHOTO_SIZE),
      }))
  const listingWithPhotos = {
    ...listing,
    photos: flightPhotos,
    photoUrl: flightPhotos[0]?.url ?? listing.photoUrl,
  }

  // SITE-21. relatedHomes.nearby is the only ACTIVE-only pool: fetchNearbyTiles
  // queries status 'active', while relatedHomes.similar hydrates the similar MV
  // at status 'all' and happily returns closed rows. On a page that exists to
  // send a reader from a home they cannot buy to homes they can, a closed
  // comparable in the rail is the same dead end one row down, so an off-market
  // page never widens past the active pool — and when the place filter leaves
  // fewer than MASTER_SPEC §4.9's three, it drops the filter rather than the
  // rail. An on-market page keeps the behaviour it had.
  const placeNames = [
    placeContext.curatedCommunity?.label,
    placeContext.neighborhood?.label,
    listing.subdivisionName,
  ].filter((n): n is string => !!n && n !== 'N/A')
  const similarBase = offMarket
    ? relatedHomes.nearby
    : relatedHomes.nearby.length > 0
      ? relatedHomes.nearby
      : [...relatedHomes.similar, ...relatedHomes.primary]
  const similarInPlace = listingSimilarDedupe(listingSimilarInPlace(similarBase, placeNames))
  const similarPool =
    offMarket && similarInPlace.length < OFF_MARKET_SIMILAR_MIN
      ? listingSimilarDedupe(similarBase)
      : similarInPlace
  const similarRows = listingSimilarRail(similarPool).map((row) =>
    row.photoUrl
      ? { ...row, photoUrl: listingRowPhotoSrc(row.photoUrl) }
      : row,
  )
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
  const listingHref = listingCanonicalHref(listing)

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
  // SITE-21. The market instrument asks how THIS price compares to what is on
  // the market in this place, and prints "$1,250,000 this price". On a sold
  // home that sentence compares a price nobody can pay against a market the
  // house has left, and on the founding case it printed the ask beside a
  // headline reading the close price — two prices for one home. Off market the
  // claim is the sale itself.
  const askClaim = offMarket
    ? null
    : buildListingAskClaim({
        ask: publishedSaleAsk,
        wholePropertyPrice,
        hud: leftoverHud,
        grain: leftoverGrain,
        updatedAt:
          leftoverLayers?.headlines?.computedAt ?? leftoverLayers?.inventory?.computedAt ?? null,
      })
  // SITE-45. The fold's two drawn facts. The price cut as two points off the
  // same history rail the page renders below (publishListingDropMark reads the
  // row publishListingLastDrop labels); the pills' plain read from the reads
  // the ask instrument already makes (days to contract from the HUD, the
  // closed median $/sqft from the pace row), at the grain that published.
  const dropMark = offMarket ? null : publishListingDropMark(history)
  const pillRead = offMarket
    ? null
    : publishListingPillRead({
        daysLive: daysLiveOnMarket(listing.onMarketDate ?? null),
        daysToPending: leftoverHud?.daysToPending ?? null,
        ppsf: publishListingSharePricePerSqft({
          propertyType: listing.propertyType,
          propertySubType: listing.propertySubType,
          subdivisionName: listing.subdivisionName,
          city: listing.city,
          listNumber: listing.listNumber,
          pricePerSqft: listing.pricePerSqft,
        }),
        medianPpsf: leftoverPace?.medianPpsf ?? null,
        placeName: leftoverGrain?.name ?? null,
        asOfLabel: (() => {
          const iso = leftoverLayers?.headlines?.computedAt ?? leftoverLayers?.inventory?.computedAt ?? null
          return iso ? formatCalendarDate(iso) : null
        })(),
      })
  const offMarketFacts = offMarket
    ? publishListingOffMarketFacts({
        status: listing.status,
        closePrice: listing.closePrice,
        closeDate: listing.closeDate,
        listPrice: listing.listPrice,
        onMarketDate: listing.onMarketDate,
        publishedPrice: wholePropertyPrice,
      })
    : null
  // The broker card asks a different question of a sale than of a listing that
  // ended without one — an EXPIRED home carried "Ask what this one closed at"
  // on the first render (§0.5, looked at 2026-09-09).
  const offMarketKind: 'sold' | 'unsold' | null = offMarket
    ? offMarketFacts?.statusWord === 'Sold'
      ? 'sold'
      : 'unsold'
    : null
  const similarLabel = listing.city ? `Homes for sale in ${listing.city}` : 'Homes for sale'
  // Every off-market door points at something that exists. The rail is an
  // anchor only when the rail rendered; with no active inventory to show, the
  // same label opens the city search rather than jumping to nothing. Same rule
  // for the saved search, which needs a city to pre-fill and renders nothing
  // without one.
  const similarHref = similarRows.length > 0 ? '#similar' : homesForSalePath(listing.city)
  const alertsHref = listing.city ? '#listing-like-alerts' : '/contact?intent=question'
  const ctaTel = brokerTelDigits(ctaBroker?.phoneDirect ?? ctaBroker?.phoneFub)
  // /book only knows three slugs (app/book/page.tsx BROKER_SLUGS). Map the
  // routed broker's first name onto one; anything unexpected books with Matt,
  // which is the same default /book applies to an unknown ?agent.
  const ctaBrokerSlug = ((): 'matt' | 'rebecca' | 'paul' => {
    const first = (ctaBroker?.fullName ?? '').trim().toLowerCase().split(/\s+/)[0]
    if (first === 'rebecca') return 'rebecca'
    if (first === 'paul') return 'paul'
    return 'matt'
  })()

  const hero = (
    <ListingHero
      photos={flightPhotos}
      floorPlans={flightFloorPlans}
      videos={videos}
      addressLine={street}
      lat={listing.lat}
      lng={listing.lng}
      openHouseLabel={
        openHouses[0]
          ? publishOpenHouseBadgeLabel(openHouses[0].event_date, openHouses[0].start_time)
          : null
      }
      lcpPriority={lcpPriority}
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
      photoUrl={galleryPhotos[0] ? listingRowPhotoSrc(galleryPhotos[0].url) : listing.photoUrl}
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

  // SITE-06: where THIS house currently sits on the same axes the city's record
  // is drawn on. Both facts come off the listing row. The cut goes through
  // publishListingDrop, which refuses an OriginalListPrice the published history
  // does not support; the day count is measured from OnMarketDate and is NOT
  // `DaysOnMarket`, which is list-to-close and is banned as DOM (CLAUDE.md §7).
  const closeSubject = buildCloseSubject({
    addressLine: street,
    drop: publishListingDrop({
      listPrice: listing.listPrice,
      originalListPrice: listing.originalListPrice,
      historyPrices: history.map((row) => row.price ?? null),
    }),
    onMarketDate: listing.onMarketDate,
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
        callHref={ctaTel && !offMarket ? `tel:${ctaTel}` : null}
        textHref={ctaTel && !offMarket ? `sms:${ctaTel}` : null}
        similarHref={similarHref}
        alertsHref={alertsHref}
        dropMark={dropMark}
        read={pillRead}
      />
      {/* SITE-33 — THIS IS NOT OUR MARKET, said before the page says anything
          else about the home. A reader who scrolls past the price strip on a
          Medford house has already been told, by a "| Ryan Realty — Central
          Oregon" title and a page identical to a Bend one, something that is
          not true. The block is the city tier's own claim one level down, and
          it ends in that city's referral page. Null on every Central Oregon
          listing. */}
      {outOfAreaNotice ? <ListingOutOfAreaNotice notice={outOfAreaNotice} /> : null}
      {/* SITE-21 — THE SOLD FACTS, first thing under the price. What happened
          to this house is the answer the reader came for, and it is the only
          claim about its price that is still true. */}
      {offMarketFacts ? (
        <ListingOffMarketFacts
          facts={offMarketFacts}
          browseHref={homesForSalePath(listing.city)}
          browseLabel={similarLabel}
        />
      ) : null}
      {/* The homes a reader CAN buy get the prominence on a page about one
          they cannot: the rail moves from the bottom of the page to directly
          under the sold facts. MASTER_SPEC §4.9. */}
      {offMarket ? (
        <ListingSimilarStrip
          rows={similarRows}
          placeName={featuredGeoName}
          viewMoreHref={featuredViewAllHref}
        />
      ) : null}
      {/* And the ask that replaces the tour: tell me when the next one lists.
          Same capture contract the page has always carried, city and price
          band and beds pre-filled from this home (parity.json capture). */}
      {offMarket ? (
        <ListingLikeThisAlerts
          city={listing.city}
          listPrice={wholePropertyPrice}
          beds={listing.beds}
          photoUrl={flightPhotos[0]?.url ?? listing.photoUrl}
          showCoach={false}
        />
      ) : null}
      <PropertySpecs listing={listingWithPhotos} />
      {/* The listing agent's own words, as written (CLAUDE.md §2; Matt
          2026-09-09: "mls descriptions must come back"). The 12-section rebuild
          dropped this import while getListingDetail kept reading public_remarks,
          so the remarks travelled to the page in the payload and were never
          rendered; ci:listing-remarks-rendered now fails that shape. Nothing is
          rewritten or summarised, and the clamp reveals the rest in place. */}
      <DescriptionBlock publicRemarks={listing.publicRemarks} />
      {/* No payment on a home that is not for sale. The founding case computed
          principal and interest on a $1,250,000 ask under a $1,100,000 sold
          headline; even fed the close price it is a loan nobody can take out
          on a house nobody can buy. */}
      {!offMarket && wholePropertyPrice != null ? (
        <div id="payment">
          <MortgageCalculator
            listPrice={wholePropertyPrice}
            taxAnnualAmount={listing.taxAnnualAmount}
            hoaMonthly={listing.hoaMonthly}
            ratePct={calcDefaults?.mortgageRate ?? null}
            listingKey={listing.listingKey}
          />
        </div>
      ) : null}
      {atlasBlock}
      <div id="schools">
        <SchoolsBlock listing={listingWithPhotos} />
      </div>
      <ListingAroundHere lat={listing.lat} lng={listing.lng} />
      {!offMarket && askClaim ? <ListingAskInstrument claim={askClaim} /> : null}
      <div id="history">
        <PropertyHistory
          history={history}
          mode="meaningful-only"
          closePrice={listing.closePrice}
        />
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
      {!offMarket && similarRows.length > 0 ? (
        <ListingSimilarStrip
          rows={similarRows}
          placeName={featuredGeoName}
          viewMoreHref={featuredViewAllHref}
        />
      ) : null}
      {/* SITE-06 — THE ENDING. It sits after the similar-homes Ledger and before
          the broker block on purpose: this is the page's climax (one claim, one
          drawing, one decision) and "who listed it" is the signature under it.
          Two asks side by side would be the stacked-section tell TASTE.md bans,
          so the close is a CHOOSER — three doors, one panel. */}
      {/* All three of the close's acts are asks about a live listing: watch
          THIS price, book a walk-through of THIS house, email me THIS payment.
          None of them survives the home leaving the market, so off market the
          ending is the saved search up top instead. */}
      {!offMarket ? (
        <V3ListingClose
          id="close"
          listingKey={listing.listingKey}
          addressLine={street}
          bookHref={`/book?agent=${encodeURIComponent(ctaBrokerSlug)}&listing=${encodeURIComponent(listing.listingKey)}`}
          paymentHref="#payment"
          view={cutFacts ? buildCloseView(cutFacts, closeSubject) : null}
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
            offMarket={offMarketKind}
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
      offMarket={offMarket}
      similarHref={similarHref}
      alertsHref={alertsHref}
    />
  ) : null

  const sidebar = ctaBroker ? (
    <ListingBrokerCTA
      defaultBroker={ctaBroker}
      brokers={brokers}
      listingKey={contactKey}
      reviews={genericReviews}
      lockToDefault={listingAgent != null}
      offMarket={offMarketKind}
    />
  ) : null

  const listingJsonLdSchemas = buildListingJsonLd({
    listingKey,
    street,
    wholePropertyPrice,
    trail: breadcrumbs,
    listing,
    photoUrls: (lcpPriority ? galleryPhotos : flightPhotos).map((p) => p.url),
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
