'use client'

import Link from 'next/link'
import type { ListingTileRow } from '@/app/actions/listings'
import type { EngagementCounts } from '@/app/actions/engagement'
import TilesSlider, { TilesSliderItem } from '@/components/TilesSlider'
import ListingTile from '@/components/ListingTile'
import { Card, CardContent } from '@/components/ui/card'
import { listingRowShowsVideoTile } from '@/lib/pick-video-from-details'

type Props = {
  title: string
  listings: (ListingTileRow & { details?: unknown; OpenHouses?: unknown })[]
  signedIn: boolean
  savedKeys?: string[]
  likedKeys?: string[]
  userEmail?: string | null
  engagementMap?: Record<string, EngagementCounts>
  viewAllHref?: string
  /**
   * When true, listings were returned from getListingsWithVideos* (each row already has a tour URL).
   * Skips client-side re-filtering so a slow or partial timeout does not double-drop tiles.
   */
  listingsAreVideoCurated?: boolean
}

export default function VideoToursRow({
  title,
  listings,
  signedIn,
  savedKeys = [],
  likedKeys = [],
  userEmail,
  engagementMap,
  viewAllHref,
  listingsAreVideoCurated = false,
}: Props) {
  const withVideo = (
    listingsAreVideoCurated ? listings : listings.filter(listingRowShowsVideoTile)
  ).slice(0, 12)
  if (withVideo.length === 0) {
    return (
      <TilesSlider
        title={title}
        headerRight={
          viewAllHref ? (
            <Link href={viewAllHref} className="text-sm font-medium text-muted-foreground hover:text-foreground">
              View all videos →
            </Link>
          ) : null
        }
      >
        <TilesSliderItem>
          <Card className="h-full border-border bg-card">
            <CardContent className="p-6">
              <p className="text-sm font-semibold text-foreground">Video tours are still syncing for active listings.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Check back shortly or open the full videos page for newly processed tours.
              </p>
            </CardContent>
          </Card>
        </TilesSliderItem>
      </TilesSlider>
    )
  }

  return (
    <TilesSlider
      title={title}
      headerRight={
        viewAllHref ? (
          <Link href={viewAllHref} className="text-sm font-medium text-muted-foreground hover:text-foreground">
            View all videos →
          </Link>
        ) : null
      }
    >
      {withVideo.map((listing) => {
        const listingKey = (listing.ListingKey ?? listing.ListNumber ?? '').toString().trim()
        if (!listingKey) return null
        const engagement = engagementMap?.[listingKey]
        return (
          <TilesSliderItem key={listingKey}>
            <ListingTile
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              listing={listing as any}
              listingKey={listingKey}
              signedIn={signedIn}
              saved={savedKeys.includes(listingKey)}
              liked={likedKeys.includes(listingKey)}
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
