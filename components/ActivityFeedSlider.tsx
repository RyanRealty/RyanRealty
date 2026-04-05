'use client'

import TilesSlider from '@/components/TilesSlider'
import ListingTile from '@/components/ListingTile'
import type { ListingTileListing } from '@/components/ListingTile'
import type { ActivityFeedItem } from '@/app/actions/activity-feed-shared'

type Props = {
  title?: string
  items: ActivityFeedItem[]
  signedIn?: boolean
  savedKeys?: string[]
  likedKeys?: string[]
  userEmail?: string | null
}

/** Map ActivityFeedItem to ListingTileListing (PascalCase) for ListingTile rendering. */
function mapToTileListing(item: ActivityFeedItem): ListingTileListing {
  return {
    ListingKey: item.listing_key,
    ListNumber: item.ListNumber ?? null,
    mls_source: item.mls_source ?? null,
    ListPrice: item.ListPrice ?? null,
    BedroomsTotal: item.BedroomsTotal ?? null,
    BathroomsTotal: item.BathroomsTotal ?? null,
    TotalLivingAreaSqFt: (item as { TotalLivingAreaSqFt?: number | null }).TotalLivingAreaSqFt ?? null,
    StreetNumber: item.StreetNumber ?? null,
    StreetName: item.StreetName ?? null,
    City: item.City ?? null,
    State: item.State ?? null,
    PostalCode: item.PostalCode ?? null,
    SubdivisionName: item.SubdivisionName ?? null,
    PhotoURL: item.PhotoURL ?? null,
    Latitude: null,
    Longitude: null,
    StandardStatus: item.StandardStatus ?? null,
    OnMarketDate: (item as { OnMarketDate?: string | null }).OnMarketDate ?? null,
    CloseDate: (item as { CloseDate?: string | null }).CloseDate ?? null,
  }
}

/** Map activity feed event_type to ListingTile badge props. */
function getBadgeProps(eventType: ActivityFeedItem['event_type']): {
  hasRecentPriceChange: boolean
  hotBadge: boolean
} {
  return {
    hasRecentPriceChange: eventType === 'price_drop',
    hotBadge: false,
  }
}

function getPriceDropAmount(item: ActivityFeedItem): number | null {
  if (item.event_type !== 'price_drop') return null
  const previousRaw = item.payload?.previous_price
  const nextRaw = item.payload?.new_price ?? item.ListPrice
  const previous = typeof previousRaw === 'number' ? previousRaw : Number(previousRaw ?? NaN)
  const next = typeof nextRaw === 'number' ? nextRaw : Number(nextRaw ?? NaN)
  if (!Number.isFinite(previous) || !Number.isFinite(next) || previous <= next) return null
  return previous - next
}

export default function ActivityFeedSlider({
  title = 'What is happening nearby',
  items,
  signedIn = false,
  savedKeys = [],
  likedKeys = [],
  userEmail,
}: Props) {
  if (items.length === 0) return null

  const savedSet = new Set(savedKeys)
  const likedSet = new Set(likedKeys)

  return (
    <TilesSlider title={title}>
      {items.map((item, idx) => {
        const tile = mapToTileListing(item)
        const badges = getBadgeProps(item.event_type)
        return (
          <div
            key={item.id || `${item.listing_key}-${item.event_at}`}
            className="w-[280px] shrink-0 snap-start sm:w-[320px]"
          >
            <ListingTile
              listing={tile}
              listingKey={item.listing_key}
              signedIn={signedIn}
              userEmail={userEmail}
              saved={savedSet.has(item.listing_key)}
              liked={likedSet.has(item.listing_key)}
              hasRecentPriceChange={badges.hasRecentPriceChange}
              priceDropAmount={getPriceDropAmount(item)}
              activityAt={item.event_at}
              hotBadge={badges.hotBadge}
              priority={idx < 3}
            />
          </div>
        )
      })}
    </TilesSlider>
  )
}
