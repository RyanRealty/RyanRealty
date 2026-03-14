'use client'

import Link from 'next/link'
import type { HotCommunity } from '@/app/actions/listings'
import { subdivisionEntityKey } from '@/lib/slug'
import CommunityTile from '@/components/CommunityTile'
import { TILE_MIN_HEIGHT_PX } from '@/lib/tile-constants'
import TilesSlider, { TilesSliderItem } from '@/components/TilesSlider'

type Props = {
  city: string
  communities: HotCommunity[]
  /** Optional banner image URLs in same order as communities */
  bannerUrls?: (string | null)[]
  signedIn?: boolean
  savedCommunityKeys?: string[]
}

export default function PopularCommunitiesRow({ city, communities, bannerUrls = [], signedIn = false, savedCommunityKeys = [] }: Props) {
  if (communities.length === 0) return null

  return (
    <section className="w-full px-4 py-10 sm:px-6" aria-labelledby="popular-communities-heading">
      <div className="mx-auto w-full max-w-7xl">
        <TilesSlider
        title="Popular Communities"
        subtitle={`Communities with the most activity in ${city}. Click to explore.`}
        titleId="popular-communities-heading"
        headerRight={
          <Link
            href="/communities"
            className="text-sm font-semibold text-accent-foreground hover:text-accent-foreground"
          >
            Explore communities →
          </Link>
        }
      >
        {communities.map((c, i) => {
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
      </div>
    </section>
  )
}
