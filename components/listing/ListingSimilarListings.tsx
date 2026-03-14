'use client'

import type { SimilarListingRow } from '../../app/actions/listings'
import ListingTile from '../ListingTile'
import type { ListingTileListing } from '../ListingTile'

type Props = {
  /** When no subdivision or N/A, pass e.g. "Nearby Homes"; otherwise used as "Other homes for sale in {subdivisionName}". */
  subdivisionName: string
  /** Override section title (e.g. "Nearby Homes" when listing has no subdivision). When set, subdivisionName is not used in the heading. */
  sectionTitle?: string | null
  listings: SimilarListingRow[]
  signedIn?: boolean
  userEmail?: string | null
  savedKeys?: string[]
  likedKeys?: string[]
}

export default function ListingSimilarListings({ subdivisionName, sectionTitle, listings, signedIn = false, userEmail, savedKeys = [], likedKeys = [] }: Props) {
  if (listings.length === 0) return null

  const heading = sectionTitle?.trim() || `Other homes for sale in ${subdivisionName}`

  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">
        {heading}
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
