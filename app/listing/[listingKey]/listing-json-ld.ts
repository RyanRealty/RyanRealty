/**
 * The listing page's structured data, built from the fetched listing only (§0).
 *
 * Split out of page.tsx 2026-08-19 while fixing the lease-rate defect: the page
 * was at its file-size budget, and the schema array is a self-contained pure
 * shaper with no fetching in it. Same two schemas, same field-for-field output.
 *
 * STRUCTURED DATA IS PUBLISHED DATA. Google ingests `offers.price` exactly as it
 * ingests the H1, so this builder takes an already-published figure rather than
 * the raw ListPrice. 735 Purcell Boulevard, Bend (MLS 220174840) is a commercial
 * sublease whose ListPrice 2.5 is a rent rate per square foot; it shipped as
 * offers.price 2.5 on a SingleFamilyResidence.
 *
 * The figure it takes is the WHOLE-PROPERTY price, which is stricter than the
 * page's published ask. A machine node carries no qualifier: the visible page
 * prints "Tenancy in common" next to the $1 ask on MLS 220190868, while the
 * JSON-LD said SingleFamilyResidence, offers.price 1, description "$1 · 3 bed,
 * 2 bath · 1,405 sq ft" — a $1 single-family home, ingested as fact. Three
 * Active fractional-interest rows published exactly that (220190868 at 1,
 * 220157653 at 250, 220218225 at 500). When the whole-property price is
 * withheld the offer and the priced description are withheld with it.
 *
 * Photos are already gated by media_suppressed inside getListingPhotos(); the
 * cap at 5 matches the builder's own slice.
 */

import { listingShareSummary } from '@/lib/share-metadata'
import { listingDetailPath } from '@/lib/slug'
import type { SchemaInput } from '@/lib/site/json-ld'

export type ListingJsonLdInput = {
  listingKey: string
  /** Street line as the page prints it. */
  street: string
  /**
   * The price of the WHOLE property, or null when withheld (a lease rate, a
   * fractional interest, or no price at all). Never the raw ListPrice, and
   * never the page's badged share ask.
   */
  wholePropertyPrice: number | null
  listing: {
    listingKey: string
    listNumber: string | null
    streetNumber: string | null
    streetName: string | null
    city: string | null
    citySlug: string | null
    postalCode: string | null
    boundaryCity: string | null
    boundaryNeighborhood: string | null
    subdivisionName: string | null
    beds: number | null
    baths: number | null
    sqft: number | null
    totalLivingAreaSqFt: number | null
    lotSizeSqft: number | null
    yearBuilt: number | null
    lat: number | null
    lng: number | null
    status: string | null
  }
  photoUrls: readonly string[]
  agent: { fullName: string; email: string | null; phoneDirect: string | null } | null
}

/** Canonical public path — matches generateMetadata, the sitemap, and the canonical link. */
export function listingCanonicalPath(listing: ListingJsonLdInput['listing']): string {
  const subdivision =
    listing.subdivisionName && listing.subdivisionName !== 'N/A' ? listing.subdivisionName : null
  return listingDetailPath(
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
      subdivision,
    },
    { mlsNumber: listing.listNumber },
  )
}

export function buildListingJsonLd(input: ListingJsonLdInput): SchemaInput[] {
  const { listing, street, listingKey, wholePropertyPrice, photoUrls, agent } = input
  const canonicalPath = listingCanonicalPath(listing)
  const livingArea = listing.sqft ?? listing.totalLivingAreaSqFt

  return [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Homes for sale', url: '/homes-for-sale' },
        ...(listing.city && listing.citySlug
          ? [{ name: listing.city, url: `/cities/${listing.citySlug}` }]
          : []),
        { name: street || `Listing ${listingKey}`, url: canonicalPath },
      ],
    },
    {
      type: 'realEstateListing',
      name: street
        ? `${street}, ${listing.city ?? ''}, OR ${listing.postalCode ?? ''}`.trim().replace(/,\s*$/, '')
        : `Listing ${listingKey}`,
      description:
        listingShareSummary({
          price: wholePropertyPrice,
          beds: listing.beds,
          baths: listing.baths,
          sqft: livingArea,
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
      livingAreaSqft: livingArea ?? undefined,
      lotSizeSqft: listing.lotSizeSqft ?? undefined,
      yearBuilt: listing.yearBuilt ?? undefined,
      listPrice: wholePropertyPrice ?? undefined,
      photos: photoUrls.length > 0 ? photoUrls.slice(0, 5) : undefined,
      listingAgent: agent
        ? {
            name: agent.fullName,
            email: agent.email ?? undefined,
            telephone: agent.phoneDirect ?? undefined,
          }
        : undefined,
      availability: listing.status ?? undefined,
    },
  ]
}
