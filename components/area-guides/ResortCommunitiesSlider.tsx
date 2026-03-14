'use client'

import Link from 'next/link'
import type { CommunityForIndex } from '@/lib/communities'
import type { HotCommunity } from '@/app/actions/listings'
import CommunityTile from '@/components/CommunityTile'
import TilesSlider, { TilesSliderItem } from '@/components/TilesSlider'
import { TILE_MIN_HEIGHT_PX } from '@/lib/tile-constants'

function toHotCommunity(c: CommunityForIndex): HotCommunity {
  return {
    subdivisionName: c.subdivision,
    forSale: c.activeCount,
    pending: 0,
    newLast7Days: 0,
    medianListPrice: c.medianPrice,
  }
}

type Props = {
  communities: CommunityForIndex[]
  savedCommunityKeys: string[]
  signedIn: boolean
}

/**
 * Single-row slider of resort & master-planned communities in primary Central Oregon cities.
 * Same CommunityTile cards as elsewhere; ends with "See All Communities" linking to /communities.
 */
export default function ResortCommunitiesSlider({
  communities,
  savedCommunityKeys,
  signedIn,
}: Props) {
  const savedSet = new Set(savedCommunityKeys.map((k) => k.trim().toLowerCase()))

  return (
    <TilesSlider
      title="Resort & master-planned communities"
      subtitle="Sunriver, Tetherow, Pronghorn, Black Butte Ranch, and more. Explore golf, amenities, and lifestyle in Central Oregon's premier communities."
      titleId="communities-heading"
      className="bg-muted px-4 py-16 sm:px-6 sm:py-20"
    >
      {communities.map((c) => (
        <TilesSliderItem key={c.entityKey} style={{ minHeight: TILE_MIN_HEIGHT_PX }}>
          <CommunityTile
            city={c.city}
            community={toHotCommunity(c)}
            bannerUrl={c.heroImageUrl}
            signedIn={signedIn}
            saved={savedSet.has(c.entityKey.trim().toLowerCase())}
          />
        </TilesSliderItem>
      ))}
      <TilesSliderItem style={{ minHeight: TILE_MIN_HEIGHT_PX }}>
        <Link
          href="/communities"
          className="flex h-full min-h-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-card/80 p-6 text-center transition hover:border-accent hover:bg-card hover:shadow-sm"
          aria-label="See all communities"
        >
          <span className="text-4xl text-accent-foreground" aria-hidden>
            →
          </span>
          <span className="font-semibold text-primary">See all communities</span>
          <span className="text-sm text-muted-foreground">
            View every community listed by city
          </span>
        </Link>
      </TilesSliderItem>
    </TilesSlider>
  )
}
