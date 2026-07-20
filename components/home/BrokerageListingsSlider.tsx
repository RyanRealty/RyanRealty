import { getBrokerageListings, type PriceDropTile } from '@/lib/data'
import TilesSlider from '@/components/TilesSlider'
import ListingTile from '@/components/ListingTile'

/**
 * BrokerageListingsSlider — Shows Ryan Realty's own listings across all statuses.
 *
 * Fetches listings where ListOfficeName matches 'Ryan Realty',
 * sorted: Active first, then Pending, then Closed.
 *
 * Returns null if no listings found (section hidden).
 */
export default async function BrokerageListingsSlider() {
  const listings = await getBrokerageListings()

  if (listings.length === 0) return null

  return (
    <section className="px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <TilesSlider
          title="Ryan Realty Listings"
          subtitle="Properties listed by our team across Central Oregon"
        >
          {listings.map((listing: PriceDropTile) => {
            const key = listing.ListingKey ?? listing.ListNumber ?? ''
            return (
              <div
                key={key}
                className="w-[280px] shrink-0 snap-start sm:w-[320px]"
              >
                <ListingTile
                  // PriceDropTile omits Latitude/Longitude (the brokerage tile
                  // projection never selects coords, and ListingTile never reads
                  // them). Fill them as null so the row satisfies the tile prop
                  // without a blind cast.
                  listing={{ ...listing, Latitude: null, Longitude: null }}
                  listingKey={key}
                  signedIn={false}
                  saved={false}
                  liked={false}
                  userEmail={null}
                />
              </div>
            )
          })}
        </TilesSlider>
      </div>
    </section>
  )
}
