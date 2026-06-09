'use client'

import dynamic from 'next/dynamic'
import type { ListingForMap } from '@/components/SearchMapClustered'

const SearchMapClustered = dynamic(
  () => import('@/components/SearchMapClustered'),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground"
        style={{ minHeight: '320px' }}
      >
        Loading map…
      </div>
    ),
  }
)
import type { CityListingRow } from '@/app/actions/cities'
import { H2 } from '@/components/site/primitives'

type Props = {
  listings: CityListingRow[]
  cityName: string
  savedListingKeys?: string[]
  likedListingKeys?: string[]
}

/** City listings are compatible with ListingForMap (same lat/lng/key/price fields). */
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

export default function CityMap({ listings, cityName, savedListingKeys = [], likedListingKeys = [] }: Props) {
  const mapListings = toMapListings(listings)

  return (
    <section className="bg-muted px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="city-map-heading">
      <div className="mx-auto max-w-7xl">
        <H2 id="city-map-heading" className="text-2xl text-primary">
          {cityName} Map
        </H2>
        <div className="mt-4 h-[400px] w-full overflow-hidden rounded-lg border border-border shadow-sm">
          <SearchMapClustered
            listings={mapListings}
            savedListingKeys={savedListingKeys}
            likedListingKeys={likedListingKeys}
            placeQuery={`${cityName} Oregon`}
            className="h-full w-full rounded-lg"
          />
        </div>
      </div>
    </section>
  )
}
