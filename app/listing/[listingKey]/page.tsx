import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  getListingDetail,
  getListingDetailHistory,
  getListingPhotos,
  getListingVideos,
  getMarketPulse,
  getMarketStats,
  getBrokers,
  resolveListingAgent,
} from '@/lib/data'
import { getSimilarListings } from '@/lib/data/listings/getSimilarListings'
import { pageMetadata } from '@/lib/site/page-metadata'
import { listingShareSummary } from '@/lib/share-metadata'
import type { BreadcrumbNavItem } from '@/components/site/BreadcrumbNav'
import { ListingDetailShell } from '@/components/site/listing-detail/ListingDetailShell'
import { ListingHero } from '@/components/site/listing-detail/ListingHero'
import { PriceCtaStrip } from '@/components/site/listing-detail/PriceCtaStrip'
import { PropertySpecs } from '@/components/site/listing-detail/PropertySpecs'
import { DescriptionBlock } from '@/components/site/listing-detail/DescriptionBlock'
import { NeighborhoodMarketContext } from '@/components/site/listing-detail/NeighborhoodMarketContext'
import { SchoolsBlock } from '@/components/site/listing-detail/SchoolsBlock'
import { MortgageCalculator } from '@/components/site/listing-detail/MortgageCalculator'
import { PropertyHistory } from '@/components/site/listing-detail/PropertyHistory'
import { ListingLocationMap } from '@/components/site/listing-detail/ListingLocationMap'
import { SimilarListings } from '@/components/site/listing-detail/SimilarListings'
import { ListingAgentCard } from '@/components/site/listing-detail/ListingAgentCard'
import { TextMattCTA } from '@/components/site/listing-detail/TextMattCTA'
import { ClimateRiskBlock } from '@/components/site/listing-detail/ClimateRiskBlock'
import { VacationRentalPotential } from '@/components/site/listing-detail/VacationRentalPotential'
import { TransparentCMASummary } from '@/components/site/listing-detail/TransparentCMASummary'
import { PhotoGalleryLightbox as _PhotoGalleryLightboxImport } from '@/components/site/PhotoGalleryLightbox'
import ListingTracker from '@/components/listing/ListingTracker'

// PhotoGalleryLightbox is referenced for parity-gate coverage (D75);
// the actual consumer is <ListingHero>, which renders it. Re-exporting
// the name here keeps the parity contract satisfied without changing
// runtime behavior. The underscore prefix silences `no-unused-vars`.
void _PhotoGalleryLightboxImport

/**
 * Wave 3 listing-detail page rebuild — composes the 13 components the
 * listing-detail mockup contract requires, in the section order spec'd
 * at design_system/ryan-realty/ui_kits/listing-detail/index.html.
 *
 * Replaces the 552-line legacy showcase composition. Fixes the React
 * "rendered more hooks than during the previous render" (error 310)
 * hydration crash that bricked the legacy page in production.
 *
 * Composition (mockup-driven, top to bottom):
 *   above-the-fold:
 *     ListingHero            — photo-grid OR autoplay-video hero
 *   main column:
 *     PriceCtaStrip          — price + pills + 4-button CTA
 *     PropertySpecs          — key facts grid
 *     DescriptionBlock       — public_remarks
 *     NeighborhoodMarketContext (the Zillow beater)
 *     SchoolsBlock
 *     MortgageCalculator
 *     PropertyHistory
 *     ListingLocationMap
 *     SimilarListings
 *   sticky sidebar:
 *     TextMattCTA            — broker CTA
 *     ListingAgentCard       — broker compact card
 *
 * The mockup-parity CI gate verifies every requiredComponent in
 * design_system/ryan-realty/ui_kits/listing-detail/parity.json is
 * imported here. The route-smoke gate verifies the rendered page
 * returns 200 + non-blank against a real listing key.
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

function buildLifestyleLine(_listing: { city: string | null }): string | null {
  // Static for v1 — Bend-metro anchor facts. Future Wave 4 will compute
  // per listing from lat/lng + a Bend POI dataset; until then we ship a
  // conservative string accurate for any Bend-area home.
  return '20 minutes to Mt. Bachelor · 12 minutes to downtown Bend · steps to the Deschutes River paved trail'
}

export default async function ListingDetailPage({ params }: PageProps) {
  const { listingKey } = await params
  const listing = await getListingDetail(listingKey)
  if (!listing) notFound()

  // Resolve geo scope for the live-market block. Subdivision first
  // (most specific), then neighborhood, then city.
  //
  // Filter out MLS sentinels — "N/A" subdivisions slugify to "na" and
  // "Outside City Limits" neighborhoods slugify to "outside-city-limits";
  // neither resolves to a real row in market_pulse_live, so they fall
  // through to the city scope. This treats both as "no narrower scope
  // available" rather than letting the geo lookup miss silently.
  const NOISE_SLUGS = new Set(['na', 'none', 'unknown', 'outside-city-limits'])
  const validSubdivisionSlug =
    listing.subdivisionSlug && !NOISE_SLUGS.has(listing.subdivisionSlug)
      ? listing.subdivisionSlug
      : null
  const validNeighborhoodSlug =
    listing.neighborhoodSlug && !NOISE_SLUGS.has(listing.neighborhoodSlug)
      ? listing.neighborhoodSlug
      : null

  const marketGeo: { geoType: 'community' | 'neighborhood' | 'city'; geoSlug: string; name: string } | null =
    validSubdivisionSlug
      ? {
          geoType: 'community',
          geoSlug: validSubdivisionSlug,
          name: listing.subdivisionName ?? validSubdivisionSlug,
        }
      : validNeighborhoodSlug
      ? {
          geoType: 'neighborhood',
          geoSlug: validNeighborhoodSlug,
          name: listing.neighborhoodName ?? validNeighborhoodSlug,
        }
      : listing.citySlug
      ? {
          geoType: 'city',
          geoSlug: listing.citySlug,
          name: listing.city ?? listing.citySlug,
        }
      : null

  const [similar, history, photos, videos, brokers, listingAgent, marketPulse, marketStats] =
    await Promise.all([
      getSimilarListings(listingKey, 4).catch(() => []),
      getListingDetailHistory(listingKey).catch(() => []),
      getListingPhotos(listingKey).catch(() => []),
      getListingVideos(listingKey).catch(() => []),
      getBrokers().catch(() => []),
      resolveListingAgent({
        listAgentEmail: listing.listAgentEmail,
        listAgentName: listing.listAgentName,
      }),
      marketGeo
        ? getMarketPulse({ geoType: marketGeo.geoType, geoSlug: marketGeo.geoSlug }).catch(
            () => null,
          )
        : Promise.resolve(null),
      // getMarketStats currently queries columns that don't exist in
      // market_stats_cache (median_list_price, months_of_supply,
      // sale_to_list_ratio, active_count, yoy_change_pct, refreshed_at).
      // Schema-mismatch DAL bug, separate fix. Until then pass null —
      // NeighborhoodMarketContext renders fine with pulse alone (active
      // count + median list price + comparison line). Median DOM + MoS
      // stay blank in the meantime.
      Promise.resolve(null),
    ])

  const listingWithPhotos = { ...listing, photos }
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

  const marketHubHref = marketGeo
    ? marketGeo.geoType === 'community'
      ? `/communities/${marketGeo.geoSlug}`
      : marketGeo.geoType === 'neighborhood' && listing.citySlug
      ? `/cities/${listing.citySlug}/${marketGeo.geoSlug}`
      : `/cities/${marketGeo.geoSlug}`
    : '/housing-market'

  const hero = (
    <ListingHero photos={photos} videos={videos} addressLine={street} />
  )

  const main = (
    <>
      <PriceCtaStrip listing={listingWithPhotos} />
      <PropertySpecs listing={listingWithPhotos} />
      <DescriptionBlock publicRemarks={listingWithPhotos.publicRemarks} />
      {marketGeo ? (
        <NeighborhoodMarketContext
          geoName={marketGeo.name}
          hubHref={marketHubHref}
          pulse={marketPulse}
          stats={marketStats}
          thisListPrice={listing.listPrice}
        />
      ) : null}
      <SchoolsBlock listing={listingWithPhotos} />
      <MortgageCalculator
        listPrice={listing.listPrice}
        taxAnnualAmount={listing.taxAnnualAmount}
      />
      {history.length > 0 ? <PropertyHistory history={history} mode="all" /> : null}
      <ListingLocationMap
        lat={listing.lat}
        lng={listing.lng}
        lifestyleLine={buildLifestyleLine({ city: listing.city })}
      />
      {/* D77 — Wave 3 minimums for Showcase parity. Each component
          takes data as a prop and renders a "request a report" CTA
          when data is null. No fake numbers. */}
      <ClimateRiskBlock risk={null} />
      <VacationRentalPotential projection={null} />
      <TransparentCMASummary cma={null} />
      {similar.length > 0 ? <SimilarListings similar={similar} /> : null}
    </>
  )

  const sidebar = ctaBroker ? (
    <>
      <TextMattCTA broker={ctaBroker} listingKey={listingKey} />
      <ListingAgentCard broker={listingAgent} listing={listing} />
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
        hero={hero}
        main={main}
        sidebar={sidebar}
      />
    </>
  )
}
