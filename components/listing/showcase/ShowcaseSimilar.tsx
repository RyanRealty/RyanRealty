'use client'

import { useEffect } from 'react'
import { trackEvent } from '@/lib/tracking'
import ListingTile from '@/components/ListingTile'
import type { ListingTileListing } from '@/components/ListingTile'

type Similar = {
  listing_key: string
  list_number: string | null
  mls_source: string | null
  list_price: number | null
  beds_total: number | null
  baths_full: number | null
  living_area: number | null
  subdivision_name: string | null
  address: string
  photo_url: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
}

type Props = {
  listingKey: string
  listings: Similar[]
  /** Override section title. Default: "Similar homes" */
  title?: string
  signedIn?: boolean
  userEmail?: string | null
  savedKeys?: string[]
  likedKeys?: string[]
}

/** Map the SimilarListingForDetail shape to ListingTileListing (PascalCase). */
function mapToTileListing(item: Similar): ListingTileListing {
  // Parse address parts back out — address is "123 Main St, Bend, OR, 97701"
  return {
    ListingKey: item.listing_key,
    ListNumber: item.list_number,
    mls_source: item.mls_source,
    ListPrice: item.list_price,
    BedroomsTotal: item.beds_total,
    BathroomsTotal: item.baths_full,
    TotalLivingAreaSqFt: item.living_area,
    SubdivisionName: item.subdivision_name,
    StreetNumber: null,
    StreetName: null,
    City: item.city ?? null,
    State: item.state ?? null,
    PostalCode: item.postal_code ?? null,
    PhotoURL: item.photo_url,
    Latitude: null,
    Longitude: null,
    StandardStatus: 'Active',
  }
}

export default function ShowcaseSimilar({
  listingKey,
  listings,
  title = 'Similar homes',
  signedIn = false,
  userEmail,
  savedKeys = [],
  likedKeys = [],
}: Props) {
  useEffect(() => {
    if (listings.length > 0) {
      trackEvent('view_similar_listings', { listing_key: listingKey, count: listings.length })
    }
  }, [listingKey, listings.length])

  if (listings.length === 0) return null

  const savedSet = new Set(savedKeys)
  const likedSet = new Set(likedKeys)

  return (
    <section className="mt-12" aria-labelledby="similar-heading">
      <h2 id="similar-heading" className="mb-6 text-xl font-semibold text-foreground">
        {title}
      </h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((item) => {
          const tile = mapToTileListing(item)
          return (
            <ListingTile
              key={item.listing_key}
              listing={tile}
              listingKey={item.listing_key}
              signedIn={signedIn}
              userEmail={userEmail}
              saved={savedSet.has(item.listing_key)}
              liked={likedSet.has(item.listing_key)}
            />
          )
        })}
      </div>
    </section>
  )
}
