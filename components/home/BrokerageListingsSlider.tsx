import { getBrokerageListings } from '@/app/actions/listings'
import { getSession } from '@/app/actions/auth'
import { getSavedListingKeys } from '@/app/actions/saved-listings'
import { getLikedListingKeys } from '@/app/actions/likes'
import TilesSlider from '@/components/TilesSlider'
import ListingTile from '@/components/ListingTile'
import type { HomeTileRow } from '@/app/actions/listings'

/**
 * BrokerageListingsSlider — Shows Ryan Realty's own listings across all statuses.
 *
 * Fetches listings where ListOfficeName matches 'Ryan Realty',
 * sorted: Active first, then Pending, then Closed.
 *
 * Returns null if no listings found (section hidden).
 */
export default async function BrokerageListingsSlider() {
  const [listings, session] = await Promise.all([
    getBrokerageListings(),
    getSession(),
  ])

  if (listings.length === 0) return null

  const [savedKeys, likedKeys] = await Promise.all([
    session?.user ? getSavedListingKeys() : Promise.resolve([] as string[]),
    session?.user ? getLikedListingKeys() : Promise.resolve([] as string[]),
  ])

  const savedSet = new Set(savedKeys)
  const likedSet = new Set(likedKeys)

  return (
    <section className="px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <TilesSlider
          title="Ryan Realty Listings"
          subtitle="Properties listed by our team across Central Oregon"
        >
          {listings.map((listing: HomeTileRow) => {
            const key = listing.ListingKey ?? listing.ListNumber ?? ''
            return (
              <div
                key={key}
                className="w-[280px] shrink-0 snap-start sm:w-[320px]"
              >
                <ListingTile
                  listing={listing}
                  listingKey={key}
                  signedIn={!!session?.user}
                  saved={savedSet.has(key)}
                  liked={likedSet.has(key)}
                  userEmail={session?.user?.email ?? null}
                />
              </div>
            )
          })}
        </TilesSlider>
      </div>
    </section>
  )
}
