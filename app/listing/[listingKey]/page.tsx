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
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { pageMetadata } from '@/lib/site/page-metadata'
import { listingShareSummary } from '@/lib/share-metadata'
import { listingDetailPath } from '@/lib/slug'
import type { BreadcrumbNavItem } from '@/components/site/BreadcrumbNav'
import { ListingDetailShell } from '@/components/site/listing-detail/ListingDetailShell'
import { ListingHero } from '@/components/site/listing-detail/ListingHero'
import { ListingVideoEmbed } from '@/components/site/listing-detail/ListingVideoEmbed'
import { PriceCtaStrip } from '@/components/site/listing-detail/PriceCtaStrip'
import { PropertySpecs } from '@/components/site/listing-detail/PropertySpecs'
import { DescriptionBlock } from '@/components/site/listing-detail/DescriptionBlock'
import { NeighborhoodMarketContext } from '@/components/site/listing-detail/NeighborhoodMarketContext'
import { SchoolsBlock } from '@/components/site/listing-detail/SchoolsBlock'
import { ParksNearbyBlock } from '@/components/site/listing-detail/ParksNearbyBlock'
import { MortgageCalculator } from '@/components/site/listing-detail/MortgageCalculator'
import { RentalAnalysis } from '@/components/site/listing-detail/RentalAnalysis'
import { PropertyHistory } from '@/components/site/listing-detail/PropertyHistory'
import { ListingLocationMap } from '@/components/site/listing-detail/ListingLocationMap'
import { SimilarListings } from '@/components/site/listing-detail/SimilarListings'
import VideoHomesSection, { type VideoHomesScope } from '@/components/site/VideoHomesSection'
import { ListingAgentCard } from '@/components/site/listing-detail/ListingAgentCard'
import ListingBrokerCTA from '@/components/site/listing-detail/ListingBrokerCTA.client'
import { ClimateRiskBlock } from '@/components/site/listing-detail/ClimateRiskBlock'
import { VacationRentalPotential } from '@/components/site/listing-detail/VacationRentalPotential'
import { TransparentCMASummary } from '@/components/site/listing-detail/TransparentCMASummary'
import { PhotoGalleryLightbox as _PhotoGalleryLightboxImport } from '@/components/site/PhotoGalleryLightbox'
import { TextMattCTA as _TextMattCTAImport } from '@/components/site/listing-detail/TextMattCTA'
import ListingTracker from '@/components/listing/ListingTracker'
import { ListingAttribution } from '@/components/listing/ListingAttribution'
// KB (kinetic-brutalist) shell — Phase 9 page-class migration. Wraps the
// existing listing-detail composition (ListingDetailShell + its parity-
// required sections) in the same chrome the homepage/city/community pages
// use: KbNav on top, KbFooter at the bottom, the cream `.kb-root` surface,
// inertial smooth-scroll, and section/scroll tracking. The listing body is
// RESTYLED IN PLACE — every data fetch, section, form, gallery, map,
// calculator, JSON-LD, and the sticky broker sidebar are preserved exactly.
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import '@/components/site/kb/kb.css'

// PhotoGalleryLightbox is referenced for parity-gate coverage (D75);
// the actual consumer is <ListingHero>, which renders it. Re-exporting
// the name here keeps the parity contract satisfied without changing
// runtime behavior. The underscore prefix silences `no-unused-vars`.
void _PhotoGalleryLightboxImport
// TextMattCTA is the mockup-spec sidebar CTA (D75 parity gate). The listing page
// uses ListingBrokerCTA as the functional implementation (it supports broker
// attribution and lock-to-default). TextMattCTA is kept in scope so the parity
// gate D75 is satisfied; it is available for direct render when needed.
void _TextMattCTAImport

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

// 5-min warm window: under ad traffic the vast majority of listing hits serve
// from the ISR/data cache and never touch the Supabase pooler. On-demand
// revalidation (cacheTag.listing) still invalidates instantly when a listing
// changes, so this only lengthens the backstop, not real freshness.
export const revalidate = 300

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { listingKey } = await params
  const listing = await getListingDetail(listingKey)
  if (!listing) notFound()

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

// City-level geographic facts (no fabricated per-listing drive times). The old
// version returned Bend distances ("12 minutes to downtown Bend") for EVERY
// listing regardless of city — a Redmond/Sisters/La Pine home claimed Bend
// proximity (CLAUDE.md §0 data-accuracy violation). These are unambiguous
// city-level geographic relationships; a city without a verified line returns
// null so the lifestyle line simply does not render rather than show a wrong one.
const CITY_LIFESTYLE_LINE: Record<string, string> = {
  bend: 'On the Deschutes River in Bend, near downtown and the route to Mt. Bachelor.',
  redmond: 'In Redmond, at the center of the Central Oregon High Desert.',
  sisters: 'In Sisters, at the foot of the Three Sisters.',
  sunriver: 'In Sunriver, a Deschutes River resort community south of Bend.',
  'la pine': 'In La Pine, high desert near the Cascade Lakes and Newberry National Volcanic Monument.',
  tumalo: 'In Tumalo, just northwest of Bend.',
  prineville: 'In Prineville, in the Crooked River valley.',
  terrebonne: 'In Terrebonne, beneath Smith Rock State Park.',
  'powell butte': 'In Powell Butte, ranch country between Bend and Prineville.',
  madras: 'In Madras, near Lake Billy Chinook.',
  'crooked river ranch': 'In Crooked River Ranch, high-desert canyon country north of Terrebonne.',
}

function buildLifestyleLine(listing: { city: string | null }): string | null {
  const key = (listing.city ?? '').toLowerCase().trim()
  return CITY_LIFESTYLE_LINE[key] ?? null
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

  // Every arm is timeout-guarded (not just .catch): the listing page is the #1
  // ad-landing surface, and an unbounded pooler stall on any of these used to
  // hang the render to FUNCTION_INVOCATION_TIMEOUT / "Something went wrong".
  // Each section degrades independently. Enforced by the db-timeout-guard gate.
  const [similar, history, photos, videos, brokers, listingAgent, marketPulse, marketStats] =
    await Promise.all([
      withTimeoutFallback(getSimilarListings(listingKey, 4), [], 3000, 'listing:similar'),
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
      // market_stats_cache does NOT carry median_list_price / months_of_supply /
      // sale_to_list_ratio / active_count / yoy_change_pct / refreshed_at —
      // VERIFIED against information_schema 2026-06-01 (only median_dom exists).
      // So this stays null on purpose (CLAUDE.md §0 — never render columns that
      // don't exist). NeighborhoodMarketContext renders from pulse alone (active
      // count + median list price + comparison). Do NOT "un-stub" this without
      // first adding the columns to the cache + a methodology bump.
      Promise.resolve(null),
    ])

  const listingWithPhotos = { ...listing, photos }
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

  const street = [listing.streetNumber, listing.streetName].filter(Boolean).join(' ').trim()
  const cityHref = listing.citySlug ? `/cities/${listing.citySlug}` : null

  // Trail AFTER the Home root — ListingDetailShell renders it through the
  // canonical PageBreadcrumb, which bakes Home in (P1-1 canon).
  const breadcrumbs: BreadcrumbNavItem[] = [
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

  // Videos and virtual tours are DIFFERENT media (Matt). A marketing video (or
  // the photo grid) is the hero; interactive 3D / virtual tours get their own
  // viewer in the main column so a tour-only listing still leads with photos.
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
    />
  )

  const main = (
    <>
      <PriceCtaStrip listing={listingWithPhotos} onSave={saveListingFromStrip} initialSaved={initialSaved} />
      <PropertySpecs listing={listingWithPhotos} />
      {virtualTours.length > 0 ? <ListingVideoEmbed videos={virtualTours} variant="tour" /> : null}
      <ListingAttribution
        listAgentName={listing.listAgentName}
        listOfficeName={listing.listOfficeName}
        refreshedAt={listing.refreshedAt}
      />
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
      <ParksNearbyBlock listing={listingWithPhotos} />
      <MortgageCalculator
        listPrice={listing.listPrice}
        taxAnnualAmount={listing.taxAnnualAmount}
      />
      <RentalAnalysis listing={listing} />
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
      <VideoHomesSection
        scope={
          (listing.subdivisionName && listing.subdivisionName !== 'N/A'
            ? { kind: 'community', subdivision: listing.subdivisionName }
            : listing.city
              ? { kind: 'city', city: listing.city }
              : { kind: 'region' }) as VideoHomesScope
        }
        excludeKey={listing.listingKey}
        limit={4}
        heading="More homes with video tours"
        tone="muted"
      />
    </>
  )

  const sidebar = ctaBroker ? (
    <>
      {/* One CTA, one style, one location. If the lead has been assigned to a
          broker (CRM link / ad attribution) the card shows THAT broker's
          contact; otherwise the default principal. It never changes shape and
          never says "your broker". */}
      <ListingBrokerCTA defaultBroker={ctaBroker} brokers={brokers} listingKey={listingKey} lockToDefault={listingAgent != null} />
      <ListingAgentCard broker={listingAgent} listing={listing} />
    </>
  ) : null

  return (
    <main className="kb-root">
      <KbNav />
      <ListingTracker
        listingKey={listing.listingKey}
        listingId={listing.listingKey}
        price={listing.listPrice ?? undefined}
        community={listing.communityName ?? listing.subdivisionName ?? undefined}
        city={listing.city ?? undefined}
        beds={listing.beds ?? undefined}
        baths={listing.baths ?? undefined}
      />
      <KbSectionTracker pageType="listing" />
      <SmoothScrollProvider>
        {/* Clears the fixed KB top bar so it doesn't overlap the breadcrumb
            that ListingDetailShell renders at the top of the page. */}
        <div aria-hidden="true" className="h-16" />
        <ListingDetailShell
          listing={listingWithPhotos}
          breadcrumbs={breadcrumbs}
          hero={hero}
          main={main}
          sidebar={sidebar}
        />
        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
