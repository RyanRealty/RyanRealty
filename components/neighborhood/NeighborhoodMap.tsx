'use client'

import SearchMapClustered, { type ListingForMap } from '@/components/SearchMapClustered'
import type { CityListingRow } from '@/app/actions/cities'

type Props = {
  listings: CityListingRow[]
  neighborhoodName: string
  savedListingKeys?: string[]
  likedListingKeys?: string[]
}

function toMapListings(rows: CityListingRow[]): ListingForMap[] {
  return rows.map((r) => ({
    Latitude: r.Latitude,
    Longitude: r.Longitude,
    ListingKey: r.ListingKey,
    ListNumber: r.ListNumber,
    ListPrice: r.ListPrice,
    StreetNumber: r.StreetNumber,
    StreetName: r.StreetName,
    City: r.City,
    State: r.State,
    PostalCode: r.PostalCode,
    BedroomsTotal: r.BedroomsTotal,
    BathroomsTotal: r.BathroomsTotal,
  }))
}

export default function NeighborhoodMap({
  listings,
  neighborhoodName,
  savedListingKeys = [],
  likedListingKeys = [],
}: Props) {
  const mapListings = toMapListings(listings)

  return (
    <section className="bg-card px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="neighborhood-map-heading">
      <div className="mx-auto max-w-7xl">
        <h2 id="neighborhood-map-heading" className="text-2xl font-bold tracking-tight text-primary">
          {neighborhoodName} Map
        </h2>
        <div className="mt-4 h-[360px] w-full overflow-hidden rounded-lg border border-border shadow-sm">
          <SearchMapClustered
            listings={mapListings}
            savedListingKeys={savedListingKeys}
            likedListingKeys={likedListingKeys}
            placeQuery={`${neighborhoodName} Oregon`}
            className="h-full w-full rounded-lg"
          />
        </div>
      </div>
    </section>
  )
}
