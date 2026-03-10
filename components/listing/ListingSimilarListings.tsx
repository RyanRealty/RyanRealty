'use client'

import type { SimilarListingRow } from '../../app/actions/listings'
import ListingTile from '../ListingTile'
import type { ListingTileListing } from '../ListingTile'

type Props = {
  subdivisionName: string
  listings: SimilarListingRow[]
  signedIn?: boolean
  userEmail?: string | null
  savedKeys?: string[]
  likedKeys?: string[]
}

export default function ListingSimilarListings({ subdivisionName, listings, signedIn = false, userEmail, savedKeys = [], likedKeys = [] }: Props) {
  if (listings.length === 0) return null

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">
        Other homes for sale in {subdivisionName}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((row, idx) => {
          const linkKey = (row.ListNumber ?? row.ListingKey ?? '').toString().trim() || `sim-${idx}`
          const listing = row as ListingTileListing
          return (
            <ListingTile
              key={linkKey}
              listing={listing}
              listingKey={linkKey}
              signedIn={signedIn}
              userEmail={userEmail ?? undefined}
              saved={signedIn ? savedKeys.includes(linkKey) : undefined}
              liked={signedIn ? likedKeys.includes(linkKey) : undefined}
            />
          )
        })}
      </div>
    </section>
  )
}
