import TilesSlider from '@/components/TilesSlider'
import ListingTile from '@/components/ListingTile'
import type { ListingTileListing } from '@/components/ListingTile'
import type { RecentlySoldListing } from '@/app/actions/recently-sold'

type Props = {
  title?: string
  listings: RecentlySoldListing[]
  signedIn?: boolean
  userEmail?: string | null
  savedKeys?: string[]
  likedKeys?: string[]
}

/** Map RecentlySoldListing (camelCase) to ListingTileListing (PascalCase). */
function mapToTileListing(item: RecentlySoldListing): ListingTileListing {
  return {
    ListingKey: item.listingKey,
    ListNumber: item.listNumber,
    mls_source: item.mlsSource,
    ListPrice: item.listPrice,
    BedroomsTotal: item.beds,
    BathroomsTotal: item.baths,
    TotalLivingAreaSqFt: item.sqft,
    StreetNumber: item.streetNumber,
    StreetName: item.streetName,
    City: item.city,
    State: item.state,
    PostalCode: item.postalCode,
    SubdivisionName: null,
    PhotoURL: item.photoUrl,
    Latitude: null,
    Longitude: null,
    StandardStatus: 'Closed',
    ClosePrice: item.closePrice,
    CloseDate: item.closeDate,
  }
}

export default function RecentlySoldRow({
  title = 'Recently sold nearby',
  listings,
  signedIn = false,
  userEmail,
  savedKeys = [],
  likedKeys = [],
}: Props) {
  if (listings.length === 0) return null

  const savedSet = new Set(savedKeys)
  const likedSet = new Set(likedKeys)

  return (
    <TilesSlider title={title}>
      {listings.map((item) => {
        const tile = mapToTileListing(item)
        return (
          <div
            key={item.listingKey}
            className="w-[280px] shrink-0 snap-start sm:w-[320px]"
          >
            <ListingTile
              listing={tile}
              listingKey={item.listingKey}
              signedIn={signedIn}
              userEmail={userEmail}
              saved={savedSet.has(item.listingKey)}
              liked={likedSet.has(item.listingKey)}
            />
          </div>
        )
      })}
    </TilesSlider>
  )
}
