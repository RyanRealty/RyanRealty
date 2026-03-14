'use client'

import Link from 'next/link'
import type { ListingTileRow } from '@/app/actions/listings'
import type { ListingTileListing } from '@/components/ListingTile'
import ListingTile from '@/components/ListingTile'
import TilesSlider, { TilesSliderItem } from '@/components/TilesSlider'
import { TILE_MIN_HEIGHT_PX } from '@/lib/tile-constants'

type Props = {
  title: string
  listings: (ListingTileRow & { details?: unknown })[]
  viewAllHref: string
  viewAllLabel?: string
  savedKeys?: string[]
  likedKeys?: string[]
  signedIn: boolean
  userEmail?: string | null
}

/** Newest listings section: single-row slider of listing tiles + View all link. */
export default function GeoSectionNewestListings({
  title,
  listings,
  viewAllHref,
  viewAllLabel = 'View all',
  savedKeys = [],
  likedKeys = [],
  signedIn,
  userEmail,
}: Props) {
  if (listings.length === 0) return null

  return (
    <TilesSlider
      title={title}
      titleId="newest-listings-heading"
      headerRight={
        <Link href={viewAllHref} className="text-sm font-semibold text-accent-foreground hover:text-accent-foreground">
          {viewAllLabel}
        </Link>
      }
      className="bg-card px-4 py-10 sm:px-6 sm:py-12"
    >
      {listings.map((listing) => {
        const key = (listing.ListingKey ?? listing.ListNumber ?? '').toString()
        if (!key) return null
        return (
          <TilesSliderItem key={key} style={{ minHeight: TILE_MIN_HEIGHT_PX }}>
            <ListingTile
              listing={listing as ListingTileListing}
              listingKey={key}
              saved={savedKeys.includes(key)}
              liked={likedKeys.includes(key)}
              signedIn={signedIn}
              userEmail={userEmail}
            />
          </TilesSliderItem>
        )
      })}
    </TilesSlider>
  )
}
