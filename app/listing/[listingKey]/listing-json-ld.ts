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
import type { PlaceCrumb } from '@/lib/site/place-trail'
import type { SchemaInput } from '@/lib/site/json-ld'

export type ListingJsonLdInput = {
  listingKey: string
  /** Street line as the page prints it. */
  street: string
  /**
   * Visible place trail, ancestors first. Home / Homes for sale / Cities are
   * not on this list. Last crumb is the address and has no href; JSON-LD
   * gives it the canonical listing URL.
   */
  trail: readonly PlaceCrumb[]
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
      // ONE URL, matching <link rel=canonical> (2026-08-27 audit: this builder
      // published /homes-for-sale/outside-boundaries/... in the JSON-LD while
      // the canonical said /homes-for-sale/bend/... on the same page).
      // 'outside-boundaries' is the boundary classifier's SENTINEL for a home
      // outside every polygon — it is not a place and never a URL segment.
      // The sentinel arrives as the display form "Outside Boundaries" (verified
      // against listing_tile_mv.boundary_city for 220225078), so the check is
      // case-insensitive on the words, not on the slug it would produce.
      city:
        listing.boundaryCity && !/^outside[\s-]?boundaries$/i.test(listing.boundaryCity.trim())
          ? listing.boundaryCity
          : listing.city,
      neighborhood: listing.boundaryNeighborhood,
      subdivision,
    },
    { mlsNumber: listing.listNumber },
  )
}

export function buildListingJsonLd(input: ListingJsonLdInput): SchemaInput[] {
  const { listing, street, listingKey, wholePropertyPrice, photoUrls, agent, trail } = input
  const canonicalPath = listingCanonicalPath(listing)
  const livingArea = listing.sqft ?? listing.totalLivingAreaSqFt
  const ancestors = trail.filter((crumb) => crumb.href)
  const here = street || `Listing ${listingKey}`

  return [
    {
      type: 'breadcrumb',
      items: [
        ...ancestors.map((crumb) => ({ name: crumb.label, url: crumb.href! })),
        { name: here, url: canonicalPath },
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
