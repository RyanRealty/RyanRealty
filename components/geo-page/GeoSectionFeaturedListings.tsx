'use client'

import Link from 'next/link'
import type { ListingTileRow } from '@/app/actions/listings'
import type { ListingTileListing } from '@/components/ListingTile'
import type { EngagementCounts } from '@/app/actions/engagement-types'
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
  /** When set, show engagement badges (e.g. 🔥 views, ❤️ likes) on tiles with high activity. */
  engagementMap?: Record<string, EngagementCounts>
}

/** Featured listings section: single-row slider of listing tiles. Optional engagement badges (🔥 ❤️) when engagementMap provided. */
export default function GeoSectionFeaturedListings({
  title,
  listings,
  viewAllHref,
  viewAllLabel = 'View all',
  savedKeys = [],
  likedKeys = [],
  signedIn,
  userEmail,
  engagementMap,
}: Props) {
  if (listings.length === 0) return null

  return (
    <TilesSlider
      title={title}
      titleId="featured-listings-heading"
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
        const engagement = engagementMap?.[key]
        return (
          <TilesSliderItem key={key} style={{ minHeight: TILE_MIN_HEIGHT_PX }}>
            <ListingTile
              listing={listing as ListingTileListing}
              listingKey={key}
              saved={savedKeys.includes(key)}
              liked={likedKeys.includes(key)}
              signedIn={signedIn}
              userEmail={userEmail}
              viewCount={engagement?.view_count ?? 0}
              likeCount={engagement?.like_count ?? 0}
              saveCount={engagement?.save_count ?? 0}
              shareCount={engagement?.share_count ?? 0}
            />
          </TilesSliderItem>
        )
      })}
    </TilesSlider>
  )
}
