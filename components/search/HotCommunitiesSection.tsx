'use client'

import type { HotCommunity } from '@/app/actions/listings'
import { subdivisionEntityKey } from '@/lib/slug'
import CommunityTile from '@/components/CommunityTile'
import TilesSlider, { TilesSliderItem } from '@/components/TilesSlider'
import { TILE_MIN_HEIGHT_PX } from '@/lib/tile-constants'

type Props = {
  city: string
  communities: HotCommunity[]
  /** Banner image URLs in same order as communities */
  bannerUrls?: (string | null)[]
  signedIn?: boolean
  savedCommunityKeys?: string[]
}

const DEFAULT_DISPLAY_COUNT = 10

export default function HotCommunitiesSection({
  city,
  communities,
  bannerUrls = [],
  signedIn = false,
  savedCommunityKeys = [],
}: Props) {
  const displayCommunities = communities.slice(0, DEFAULT_DISPLAY_COUNT)

  if (displayCommunities.length === 0) return null

  return (
    <section className="w-full" aria-labelledby="hot-communities-heading">
      <TilesSlider
        title={`Hot communities in ${city}`}
        subtitle="Where the action is — most listings, pending sales, and new listings. Explore these in-demand neighborhoods."
        titleId="hot-communities-heading"
      >
        {displayCommunities.map((c, i) => {
          const entityKey = subdivisionEntityKey(city, c.subdivisionName)
          return (
            <TilesSliderItem key={c.subdivisionName} style={{ minHeight: TILE_MIN_HEIGHT_PX }}>
              <CommunityTile
                city={city}
                community={c}
                bannerUrl={bannerUrls[i] ?? null}
                signedIn={signedIn}
                saved={savedCommunityKeys.includes(entityKey)}
              />
            </TilesSliderItem>
          )
        })}
      </TilesSlider>
    </section>
  )
}
